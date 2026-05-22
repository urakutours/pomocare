# Secret Audit (Phase 2b dotenvx 化、2026-05-22)

## 目的

`.env.local` の非 VITE_* 列挙と Cloudflare Worker production 登録の diff、および各 secret の機密度分類を記録する。`workers/.env.example` 起票と `.env.local` スリム化の根拠資料。

## Production wrangler secret list (2026-05-22 取得)

`cd workers && npx wrangler secret list` の出力 (11 keys):

| # | Key | 種類 | 機密度 |
|---|---|---|---|
| 1 | NEON_AUTH_URL | secret_text | 🟡 endpoint URL (Worker 経由でしか叩けないので semi-public) |
| 2 | NEON_DATABASE_URL | secret_text | 🔴 DB credentials 含む |
| 3 | RESEND_API_KEY | secret_text | 🔴 Resend 送信 API key |
| 4 | RESEND_FROM | secret_text | 🟢 from address (公開可) |
| 5 | STRIPE_PRICE_PRO | secret_text | 🟢 price ID (公開可) |
| 6 | STRIPE_PRICE_STANDARD | secret_text | 🟢 price ID (公開可) |
| 7 | STRIPE_SECRET_KEY | secret_text | 🔴 Stripe restricted key (rk_live_*) |
| 8 | STRIPE_WEBHOOK_SECRET | secret_text | 🔴 webhook signing secret |
| 9 | VAPID_PRIVATE_KEY | secret_text | 🔴 Web Push 私鍵 (legacy、wrangler.toml で 2026-06-13 削除予定マーク) |
| 10 | VAPID_PUBLIC_KEY | secret_text | 🟢 Web Push 公開鍵 |
| 11 | VAPID_SUBJECT | secret_text | 🟢 mailto: 文字列 (公開可) |

🔴 実機密 5 keys / 🟡 1 key / 🟢 5 keys

## `.env.local` 非 VITE_* 現状 (2026-05-22 時点)

9 keys (実値含む、`.gitignore` で除外):

```
NEON_DATABASE_URL=postgresql://neondb_owner:<password>@ep-royal-breeze-akf5w0cu-pooler.c-3.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
NEON_AUTH_URL=https://ep-royal-breeze-akf5w0cu.neonauth.c-3.us-west-2.aws.neon.tech/neondb/auth
STRIPE_SECRET_KEY=rk_live_<実値>
STRIPE_WEBHOOK_SECRET=whsec_<実値>
STRIPE_PRICE_STANDARD=price_1T3xzpFgfxFj9hYgMyuktU0B
STRIPE_PRICE_PRO=price_1T3yHOFgfxFj9hYgKVwKV9SQ
VAPID_SUBJECT=mailto:info@pomocare.com
VAPID_PUBLIC_KEY=BN2QB1-7Dy7ZHSOMIYStWlkz0Eor-LTicdzMyKCHs2tMgDdUbLrzjYlHbiScAYqc6wn9ZbDjwA_wyR9CVzq6064
VAPID_PRIVATE_KEY=<実値>
```

## Diff (production vs .env.local)

| Key | wrangler 登録 | .env.local | 状態 |
|---|---|---|---|
| NEON_AUTH_URL | ✅ | ✅ | 同期済 |
| NEON_DATABASE_URL | ✅ | ✅ | 同期済 (実値要確認、後段) |
| RESEND_API_KEY | ✅ | ❌ | **`.env.local` 漏れ** |
| RESEND_FROM | ✅ | ❌ | **`.env.local` 漏れ** |
| STRIPE_PRICE_PRO | ✅ | ✅ | 同期済 |
| STRIPE_PRICE_STANDARD | ✅ | ✅ | 同期済 |
| STRIPE_SECRET_KEY | ✅ | ✅ | 同期済 (実値要確認、後段) |
| STRIPE_WEBHOOK_SECRET | ✅ | ✅ | 同期済 (実値要確認、後段) |
| VAPID_PRIVATE_KEY | ✅ | ✅ | 同期済 (legacy、削除予定) |
| VAPID_PUBLIC_KEY | ✅ | ✅ | 同期済 (legacy) |
| VAPID_SUBJECT | ✅ | ✅ | 同期済 (legacy) |

**結論**: `.env.local` は「wrangler secret put 忘れ防止メモ」として機能しておらず、production 正本 (wrangler) との同期が崩れていた (RESEND_* 2 keys 漏れ)。`workers/.env.example` を起票して **wrangler 正本リスト** に位置付ける必要がある。

## 計画への反映

1. **`workers/.env.example` 起票時の key list**: wrangler 側 11 keys 全てを placeholder で列挙 (`.env.local` 9 keys ベースではなく)
2. **`.env.local` スリム化**: VITE_* 3 keys のみ残置、非 VITE_* 9 keys は削除 (RESEND_* は元々無いので追加削除なし)
3. **VAPID_* legacy 扱い**: wrangler.toml のコメント通り 2026-06-13 削除予定。`workers/.env.example` には placeholder として残置し、コメントで「Legacy: 2026-06-13 削除予定」明記

## 残論点 (Phase 2b スコープ外、別タスク候補)

### 1. 🔴 Drive backup `.env.local` の平文 secret 残存問題

- 直前 (2026-05-22 14:21) の `sync-secrets.sh` 実行で `pomocare/.env.local` 全体 (実 STRIPE/NEON/VAPID 含む) が Google Drive に backup された
- `.env.local` スリム化後に再 sync すれば Drive 側も VITE_* のみに上書きされるが、Google Drive のリビジョン履歴 (30 日 + 100 件) に旧版が残存する可能性
- 完全消去には Daisuke が Google Drive で `.env.local` のリビジョン履歴を明示削除する必要 (手動操作)

### 2. 🟡 Secret rotation 要否判断

- `.env.local` に実 STRIPE_SECRET_KEY (rk_live_*) / WEBHOOK_SECRET / NEON DB password / VAPID_PRIVATE_KEY が平文で存在し続けた期間 = 流出リスクが理論上ゼロでない
- 流出経路想定: メインPC 紛失 / repo の `.gitignore` 漏れ / Drive 共有ミス / 過去の clone 作業時に他端末へ拡散
- security-advisor も「Worker secrets rotation 計画が未定義、Phase 2b 完走後に runbook 起票推奨」と注意点列挙
- **判断材料**:
  - rk_live_* は restricted key (権限制限版) なので sk_live_ より影響範囲狭い
  - webhook secret は signing 用 (送信権限なし)、漏洩しても webhook spoofing リスクのみ
  - NEON DB password は pooler 経由 + IP whitelist あれば実害低 (要確認)
  - VAPID は legacy 経路 (2026-06-13 削除予定) のため rotate 後に放置で OK
- **推奨**: Phase 2b 完走後に rotation runbook 起票、Daisuke 判断で実施

### 3. 🟢 NEON_AUTH_URL の機密度再評価

- 現在 wrangler に secret として登録されているが、`VITE_NEON_AUTH_URL` と同じ値 (`.env.public` で commit 予定)
- Worker 側で重複登録する意義: Worker から Neon Auth endpoint を叩く際の verification 用
- 同じ URL を public と secret 両方で管理するのは整理対象だが、削除すると Worker 側で session 検証経路が壊れる可能性 → 現状維持で OK

## 参照

- judgment ①: `~/.claude/plans/pomocare-2026-05-22-vite-dotenvx-escalate.md`
- security-advisor 判断: 本セッション中、論点 2 🟡 Warning、Worker 二重管理運用フォロー
- secret-management.md § 3 カテゴリモデル
- wrangler.toml コメント (`pomocare/workers/wrangler.toml`)
