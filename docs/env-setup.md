# Env 運用 (案 3: .env 1 file selective encrypt)

PomoCare (Vite + Capacitor + Cloudflare Worker + Xserver SFTP デプロイ) の env 管理。2026-05-22 Phase 2b で確立。B-1 派生形・案 3 採用。

## 4 ファイル運用

| ファイル | git | 機密度 | 役割 |
|---|---|---|---|
| `.env` | ✅ commit | 🔴 + 🟡 混在 | DEPLOY_* (5 keys、dotenvx 暗号化) + VITE_* (3 keys、平文) 1 file 集約 |
| `.env.keys` | ❌ gitignored | 🔴 | dotenvx 復号鍵 (`DOTENV_PRIVATE_KEY`)。Google Drive 経由で配布 |
| `.env.local` | ❌ `*.local` で自動 ignore | — | ローカル override 用 (通常は空、Vite が `.env` より優先で読む) |
| `workers/.env.example` | ✅ commit | 🟢 placeholder | Cloudflare Worker secret 正本リスト (実値なし、`wrangler secret put` で登録) |

機密度アイコン凡例:
- 🔴 実機密 (漏洩 = 即実害、暗号化 or wrangler 必須)
- 🟡 semi-public (build 後 bundle に inline される、暗号化価値ゼロ)
- 🟢 公開可 (placeholder / price ID / from address 等)

## なぜ案 3 (.env 1 file selective encrypt) か

- **Vite default 動作と完全整合**: Vite は `.env` を自動 load、別 file (`.env.public`) の loadEnv カスタム設定不要
- **1 file 管理**: 機密度差を `.env` 内の dotenvx selective encrypt で表現、開発者は 1 file 見れば全 env を把握
- **fail-safe な selective encrypt**: `dotenvx encrypt -ek VITE_NEON_AUTH_URL -ek VITE_NEON_DATA_API_URL -ek VITE_WORKER_URL` で「VITE_* 除外、残りを暗号化」= 将来 VITE_* 追加忘れ → 自動暗号化 → build fail で気づく
- **judgment ① の本質を保持**: 「DEPLOY_* だけ暗号化、VITE_* は平文 OK」は守られ、`.env.public` 名称だけ廃止

判定経緯: web 版 ① 経由で B-1 確定 → ② で `.env.public` の Vite 自動 load 問題発見 → Daisuke 案 3 採用。

## Setup 手順 (新端末 clone 後)

1. **`.env.keys` を Google Drive から配置**: `sync-secrets.sh --restore` (メインPC 以外) で `~/G:/マイドライブ/管理/private-repo/secrets/pomocare/.env.keys` → `pomocare/.env.keys`
2. **動作確認**:
   ```bash
   cd pomocare
   npm install
   npx dotenvx get DEPLOY_HOST -f .env   # → sv14166.xserver.jp が返れば OK
   npx dotenvx get VITE_WORKER_URL -f .env  # → https://pomocare-api.urakutours.workers.dev (平文取得)
   ```
3. **Worker secrets が必要なら**: `cd workers && cp .env.example .dev.vars`、`.dev.vars` を編集して実値を入れる (gitignored)

## 開発フロー

```bash
# Vite dev (VITE_* を .env から自動 load)
npm run dev

# Build (VITE_* が bundle に inline される)
npm run build

# LP デプロイ (DEPLOY_* を dotenvx で復号して SFTP)
npm run lp:deploy

# Worker dev (.dev.vars がある時)
cd workers && npx wrangler dev
```

## 新規 secret 追加 SOP

### DEPLOY_* / VITE_* (アプリ side)

1. `.env` を編集して新 key を追加
2. **DEPLOY_* (機密) なら**: `npx dotenvx encrypt -f .env -ek VITE_NEON_AUTH_URL -ek VITE_NEON_DATA_API_URL -ek VITE_WORKER_URL` で再 encrypt (VITE_* 除外指定維持)
3. **VITE_* (公開) なら**: 平文のまま commit。dotenvx encrypt 不要 (VITE_* は selective encrypt 対象外)
4. `git add .env && git commit`

### Worker secret (workers/wrangler-side)

`workers/README.md` の SOP 3 ステップ参照:
1. `workers/.env.example` に placeholder 追加
2. `npx wrangler secret put <KEY>` で production 登録
3. 動作確認

## 復号鍵 (`.env.keys`) の配布

`.env.keys` は **#2 リポ固有の復号鍵** (`secret-management.md` 参照)。`.claude/scripts/secrets-entries.sh` の `pomocare/.env.keys` 行で Google Drive 経由配布。

- メインPC: `bash .claude/scripts/sync-secrets.sh` で Drive へ backup
- ノートPC: Google Drive 同期 → `sync-secrets.sh --restore` で配置
- u-mini: `u-secrets pomocare` (該当時、現状 u-mini に pomocare 未配備)

## VITE_* 変更時の注意

- **PWA**: `npm run build` 後の `dist/` に inline されるので、再 deploy で反映
- **Capacitor APK**: `npm run android:release` で AAB に inline。**Google Play 再リリース必須**
- VITE_* の値変更は production 反映に時間がかかる (PWA 即時 / APK 数日)。極力 stable な URL のみ VITE_ prefix を付ける

## Secret rotation 方針 (2026-05-22 Daisuke 確定)

**rotation 永続不要**:
- `.env` (DEPLOY_* + VITE_*) は selective encrypt + gitignored → commit 漏れ事故時のみ即 rotate
- Worker secrets (wrangler) は `.env.local` 平文から wrangler 一本化済、流出経路最小
- `.env.local` は今後空運用、平文 secret は持たない
- Drive backup: 個人 Google アカウント (2FA 有) のみアクセス、Daisuke 1 名運用

**今後規律**:
- 新規 secret 追加は本 docs の SOP 厳守
- `.env.local` に二度と平文 secret を書かない (旧 9 keys 列挙の轍を踏まない)
- Worker 系は `wrangler secret put` が正本、`.env.example` は placeholder のみ

## 関連ファイル

| ファイル | 内容 |
|---|---|
| `docs/secret-audit.md` | 2026-05-22 audit 結果 (production wrangler 11 keys vs `.env.local` 9 keys diff) |
| `workers/README.md` | Worker secret 管理規律 + 月次照合 SOP |
| `workers/.env.example` | Worker secret 正本 placeholder |
| `.env` | DEPLOY_* 暗号化 + VITE_* 平文 (本 docs の主役) |
| `~/.claude/knowledge/secret-management.md` | 横断: 3 カテゴリモデル + Worker variant 節 |
| `~/.claude/templates/dotenvx-setup-template.md` | 横断: 17 ステップ + B-1 派生形・案 3 節 |
