# pomocare-api (Cloudflare Worker)

PomoCare の Cloudflare Worker。Neon DB access / Stripe (checkout + webhook) / Resend (transactional mail) / VAPID legacy push (削除予定) を担当。

エントリポイント: `src/index.ts`。設定: `wrangler.toml`。

## Secret 管理規律 (2026-05-22 確立)

**今後の新規 secret は wrangler 一本管理**。`pomocare/.env.local` (repo root) への二重列挙はしない (Phase 2b で確立、`../docs/secret-audit.md` 参照)。

### 新 secret 追加 SOP (3 ステップ)

1. **`workers/.env.example` に placeholder 追加** (機密度コメント + 取得元 + 用途)
2. **`wrangler secret put <KEY>`** で production に登録
   ```bash
   cd workers
   npx wrangler secret put NEW_KEY
   # 対話 prompt で実値を入力
   ```
3. **動作確認**: Worker 経由のエンドポイントを叩いて期待通り動くか / 必要なら `npx wrangler tail` でログ確認

### Local wrangler dev で値が必要な場合

`workers/.dev.vars` (gitignored) に `KEY=VALUE` 形式で記載。`wrangler dev` が自動 load する。

```bash
cd workers
cp .env.example .dev.vars
# .dev.vars を編集して実値を埋める (git 追跡外なので安全)
npx wrangler dev
```

### 月次照合 (運用)

毎月初に以下で wrangler 登録と `.env.example` placeholder の同期確認:

```bash
cd workers
npx wrangler secret list | jq -r '.[].name' | sort > /tmp/wrangler-keys.txt
grep -oE '^[A-Z_]+(?==)' .env.example | sort > /tmp/example-keys.txt
diff /tmp/wrangler-keys.txt /tmp/example-keys.txt
```

差分があれば片方追加漏れ。

### 関連ファイル

| ファイル | 役割 |
|---|---|
| `wrangler.toml` | Worker 設定 + 必要 secret 一覧コメント (重複あり、運用文書として価値) |
| `.env.example` | Secret 正本 placeholder リスト (本規律で管理) |
| `.dev.vars` (gitignored) | Local dev 用実値 |
| `../docs/secret-audit.md` | 2026-05-22 audit 結果 + 機密度分類 |
| `../docs/env-setup.md` | repo 全体の env ファイル運用 (B-1 派生形) |

## 開発

```bash
# Local dev (port 8787)
npx wrangler dev

# Production deploy
npx wrangler deploy

# Logs (production)
npx wrangler tail

# Secret 操作
npx wrangler secret list
npx wrangler secret put <KEY>
npx wrangler secret delete <KEY>
```

## SQL マイグレーション

`workers/sql/` 配下の SQL を Neon Console から手動実行する運用 (自動 migration なし)。

## 関連 Worker bindings

なし (D1 / KV / R2 / Queues 未使用、Stateless Worker)。
