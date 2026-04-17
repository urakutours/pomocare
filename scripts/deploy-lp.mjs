#!/usr/bin/env node
/**
 * LP (pomocare.com) を Xserver に SFTP でアップロードする。
 *
 * 使い方:
 *   npm run lp:deploy
 *
 * 前提:
 *   プロジェクトルートの .env に以下が定義されていること:
 *     DEPLOY_HOST         — SSH ホスト (例: xs***.xserver.jp)
 *     DEPLOY_USER         — SSH ユーザー名
 *     DEPLOY_PORT         — SSH ポート (Xserver は 10022 系)
 *     DEPLOY_KEY_PATH     — SSH 秘密鍵の絶対パス
 *     DEPLOY_REMOTE_PATH  — リモート側の LP 配置ルート (例: /home/xxx/pomocare.com/public_html)
 *
 * 挙動:
 *   - lp/ 配下を再帰的にアップロード
 *   - scss/ や DESIGN.md など開発専用ファイルは除外
 *   - 既存ファイルは上書き（削除はしないので、リモート固有ファイルは保持される）
 *
 * 認証:
 *   SSH 秘密鍵のみ対応（パスワード認証は未対応）。鍵パスフレーズが必要な場合は
 *   DEPLOY_KEY_PASSPHRASE 環境変数に設定する。
 */

import SftpClient from 'ssh2-sftp-client';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, posix, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROJECT_ROOT = join(__dirname, '..');
const LOCAL_LP_DIR = join(PROJECT_ROOT, 'lp');

// アップロード除外リスト（ファイル名 / ディレクトリ名のいずれも）
const EXCLUDE = new Set([
  'scss',          // SCSS ソース（コンパイル後の css/ のみ必要）
  'DESIGN.md',     // 設計ドキュメント
  '.DS_Store',
  'Thumbs.db',
]);

const {
  DEPLOY_HOST,
  DEPLOY_USER,
  DEPLOY_PORT,
  DEPLOY_KEY_PATH,
  DEPLOY_KEY_PASSPHRASE,
  DEPLOY_REMOTE_PATH,
} = process.env;

const required = { DEPLOY_HOST, DEPLOY_USER, DEPLOY_KEY_PATH, DEPLOY_REMOTE_PATH };
const missing = Object.entries(required)
  .filter(([, v]) => !v)
  .map(([k]) => k);
if (missing.length > 0) {
  console.error(`[lp:deploy] Missing env vars: ${missing.join(', ')}`);
  console.error('[lp:deploy] Ensure .env is loaded via `node --env-file=.env`.');
  process.exit(1);
}

const sftp = new SftpClient();

async function main() {
  let privateKey;
  try {
    privateKey = readFileSync(DEPLOY_KEY_PATH);
  } catch (err) {
    console.error(`[lp:deploy] Failed to read SSH key at ${DEPLOY_KEY_PATH}`);
    console.error(err.message);
    process.exit(1);
  }

  const port = Number(DEPLOY_PORT ?? 22);
  console.log(`[lp:deploy] Connecting to ${DEPLOY_USER}@${DEPLOY_HOST}:${port}...`);

  await sftp.connect({
    host: DEPLOY_HOST,
    port,
    username: DEPLOY_USER,
    privateKey,
    passphrase: DEPLOY_KEY_PASSPHRASE,
    readyTimeout: 20000,
  });
  console.log('[lp:deploy] Connected.');

  let uploaded = 0;
  let skipped = 0;

  await uploadDir(LOCAL_LP_DIR, DEPLOY_REMOTE_PATH, {
    onUpload: () => uploaded++,
    onSkip: () => skipped++,
  });

  await sftp.end();
  console.log(`\n[lp:deploy] ✅ Done. Uploaded ${uploaded} file(s), skipped ${skipped}.`);
  console.log(`[lp:deploy] 🌐 Verify: https://pomocare.com/`);
}

/** 再帰的にディレクトリをアップロード */
async function uploadDir(localDir, remoteDir, counters) {
  // リモート側にディレクトリが無ければ作成
  if (!(await sftp.exists(remoteDir))) {
    await sftp.mkdir(remoteDir, true);
  }

  const entries = readdirSync(localDir);
  for (const name of entries) {
    if (EXCLUDE.has(name)) {
      counters.onSkip();
      continue;
    }

    const localPath = join(localDir, name);
    const remotePath = posix.join(remoteDir, name);
    const s = statSync(localPath);

    if (s.isDirectory()) {
      await uploadDir(localPath, remotePath, counters);
    } else if (s.isFile()) {
      const rel = relative(LOCAL_LP_DIR, localPath).replace(/\\/g, '/');
      process.stdout.write(`  ↑ ${rel}\n`);
      await sftp.put(localPath, remotePath);
      counters.onUpload();
    }
  }
}

main().catch(async (err) => {
  console.error('\n[lp:deploy] ❌ Error:', err.message);
  try { await sftp.end(); } catch { /* ignore */ }
  process.exit(1);
});
