# pomocare 外部サービス設定手順

> **最終更新:** 2026-04-12
> **対象:** pomocare 開発者
> **関連ドキュメント:**
>  - `docs/android-release.md` — keystore 発行 + AAB ビルド + Play Store 登録
>  - `.secrets/README.md` — キーストア・パスワードの保管方針
>  - プロジェクトルートの `.claude/knowledge/pitfalls.md` — 既知問題・過去の落とし穴
>
> **所要時間の目安:** 全体で 60～90 分（各サービスのアカウント状態による）

---

## セクション 1: 作業順序のおすすめ

外部サービスの設定には依存関係があるため、以下の順序で進めること。

```
[1] 新 upload-keystore.jks 発行
         ↓ docs/android-release.md のセクション 3 を参照
[2] SHA-256 fingerprint を取得（keytool で確認）
         ↓
[3] Google Cloud Console で Client ID タイプ確認・設定
    （このドキュメントのセクション 3）
         ↓
[4] Neon Auth の trustedOrigins に本番ドメイン追加
    （このドキュメントのセクション 2）
         ↓
[5] public/.well-known/assetlinks.json の SHA-256 更新
    → GitHub Pages デプロイ
    （このドキュメントのセクション 4）
         ↓
[6] Cloudflare Worker のデプロイと VITE_WORKER_URL 更新
    （このドキュメントのセクション 5）
         ↓
[7] デバッグ APK で実機/エミュレータ動作確認
    ・Google OAuth コールバック
    ・アラーム動作
    ・パスワードリセットメール
         ↓
[8] AAB ビルド → Play Store 内部テストトラック提出
    → docs/android-release.md のセクション 4～5 を参照
```

> **注意:** [3] と [4] は並行して進めてもよいが、[2]（SHA-256 取得）は [3][5] の両方に必要なので先に完了させること。

---

## セクション 2: Neon Auth trustedOrigins 設定

### 背景

Better Auth は CSRF 防止のため、リクエストの `Origin` ヘッダを `trustedOrigins` と照合する。
Capacitor Android アプリから Google OAuth でログインすると、コールバック URL が
`com.pomocare.app://auth` のカスタムスキームになる。Neon Auth サーバーがこのスキームを
trusted として認めないと認証が失敗する。

### 実行担当

ユーザー（手動 UI 操作）

### 所要時間

5 分

### 手順

1. https://console.neon.tech にログイン
2. pomocare プロジェクト（Neon Auth が有効なもの）を選択
3. 左メニュー → **Auth** → **Configuration** → **Domains**
4. **「Add domain」** ボタンをクリック
5. 以下を順番に入力・保存:

   | ドメイン | 備考 |
   |---------|------|
   | `https://app.pomocare.com` | 本番 Web（既に登録済みなら OK） |
   | `com.pomocare.app://` | Capacitor Android のカスタムスキーム |

6. 保存

### カスタムスキームが登録できない場合の代替

Neon ダッシュボード UI が `https://` 以外のスキームを受け付けない可能性がある（公式ドキュメントに `https://` 以外への対応は未記載）。その場合は以下の代替案から選択する。

#### 代替案 A: API 経由で登録を試みる

```bash
# Neon Console → Settings → API Keys で API キーを発行してから実行
curl -X POST \
  "https://console.neon.tech/api/v2/projects/<project_id>/branches/<branch_id>/auth/domains" \
  -H "Authorization: Bearer <api_key>" \
  -H "Content-Type: application/json" \
  -d '{"domain":"com.pomocare.app://"}'
```

`<project_id>` と `<branch_id>` は Neon Console のプロジェクト設定 URL から確認できる。

#### 代替案 B: App Links (HTTPS) 一本化へ方針転換

カスタムスキームを廃止し、`https://app.pomocare.com/auth/callback` に統一する。
詳細はこのドキュメントのセクション 3「選択肢 B」を参照。

#### 代替案 C: Neon Auth から Better Auth 自己ホストへの切り替え

自己ホスト Better Auth（`auth.ts`）であれば `trustedOrigins` に任意のスキームを追加できる。
ただし Neon のマネージド認証から離れるためインフラ管理コストが増える。詳細はセクション 7 を参照。

### 検証

```bash
# 実機で Google OAuth を試し、コールバックが正しく戻るか確認する
# Neon ダッシュボード → Auth → Users で新規ユーザーレコードが作成されているか確認
```

### 切り戻し

登録を間違えた場合は、同じ UI（Auth → Configuration → Domains）から該当 domain を削除できる。

---

## セクション 3: Google Cloud Console OAuth Client ID

### 背景

Google OAuth は **Web / Android / iOS** の 3 タイプの Client ID を使い分ける。
Web タイプの Client ID はカスタムスキームリダイレクト URI（`com.xxx://...`）を拒否するため、
Capacitor Android から OAuth を使う場合は以下どちらかを選択する必要がある。

- **選択肢 A**: Web Client ID をそのまま使いつつ、Android 用 Client ID を別途作成する
- **選択肢 B**: App Links (HTTPS リダイレクト) で Web Client ID に一本化する

### 実行担当

ユーザー（手動 UI 操作）

### 所要時間

10〜20 分

### 3.1. 現状確認

1. https://console.cloud.google.com にログイン
2. pomocare プロジェクトを選択
3. 左メニュー → **APIs & Services** → **Credentials**
4. 「OAuth 2.0 クライアント ID」一覧を確認
5. 現在使用中の Client ID をクリック → **「アプリケーションの種類」** を確認
   - 「ウェブ アプリケーション」→ 選択肢 A または B の判断が必要（下記参照）
   - 「Android」→ すでに対応済み（SHA-1 が最新か確認するだけでよい）

---

### 3.2. 選択肢 A: Web + Android Client ID 併存

| | 内容 |
|--|------|
| **長所** | カスタムスキーム（`com.pomocare.app://`）を維持できる |
| | Web と Android のフローを分離管理できる |
| | cold start レースは `App.getLaunchUrl()` フォールバックで吸収可能 |
| **短所** | Client ID を 2 つ管理する必要がある |
| | Google One Tap は別途設定が必要 |

**手順:**

1. **Credentials** → **「認証情報を作成」** → **OAuth クライアント ID**
2. アプリケーションの種類: **Android**
3. 名前: `pomocare-android`
4. パッケージ名: `com.pomocare.app`
5. SHA-1 フィンガープリント: 新 upload-keystore.jks から取得

   ```bash
   keytool -list -v \
     -keystore /c/dev/pomocare/.secrets/upload-keystore.jks \
     -alias pomocare-upload
   ```

   出力の `SHA1:` 行をコピーする。

6. **作成**
7. 発行された Android Client ID を `.env.local` に追記:

   ```
   VITE_GOOGLE_ANDROID_CLIENT_ID=<発行された Android Client ID>
   ```

   （必要に応じて `src/services/auth/AuthService.ts` 側も対応する）

---

### 3.3. 選択肢 B: App Links 一本化

| | 内容 |
|--|------|
| **長所** | Client ID が 1 つで管理がシンプル |
| | Web / Android でフローが統一される |
| | `assetlinks.json` で信頼関係を Google に保証できる |
| **短所** | カスタムスキームを廃止するため `AndroidManifest.xml` の intent-filter を書き換える必要がある |
| | App Links の autoVerify が `assetlinks.json` 確認に依存するため、デプロイミスで動かなくなる |
| | cold start レースが強く影響する可能性がある |

**手順:**

1. Credentials の Web Client ID を開く → **「承認済みのリダイレクト URI」**
2. `https://app.pomocare.com/auth/callback` を追加
3. **保存**
4. `src/utils/platform.ts` の `getAuthRedirectBase()` を修正:

   ```typescript
   export function getAuthRedirectBase(): string {
     return 'https://app.pomocare.com/auth/callback';
   }
   ```

5. `android/app/src/main/AndroidManifest.xml` のカスタムスキーム用 intent-filter を削除
6. App Links 用 intent-filter（`android:autoVerify="true"` のもの）を残す
7. `public/.well-known/assetlinks.json` に SHA-256 を登録する（セクション 4 参照）

---

### 推奨

**今回は選択肢 A を推奨。**
カスタムスキームが動くので cold start レース以外は比較的安定している。
将来ユーザー数が増えて App Links の信頼性が必要になった時点で選択肢 B へ移行することを検討する。

### 切り戻し

- 選択肢 A: 作成した Android Client ID を Credentials から削除する
- 選択肢 B: `getAuthRedirectBase()` を元に戻し、`AndroidManifest.xml` の intent-filter を復元する

---

## セクション 4: assetlinks.json の SHA-256 fingerprint 更新

### 背景

Android App Links は `https://app.pomocare.com/.well-known/assetlinks.json` を
Google が照会して「この HTTPS ドメインとこの Android アプリは同じオーナーのもの」と検証する。
新 keystore 発行後に SHA-256 fingerprint を正しく登録しないと、App Links 経由のディープリンクが
動かない（選択肢 B を選んだ場合）。選択肢 A を選んだ場合も、将来の移行に備えて更新しておくことを推奨。

### 実行担当

手順 4.1 / 4.3 / 4.4: ユーザー（手動操作）
手順 4.2: Claude（ファイル編集）またはユーザー

### 所要時間

10 分

### 手順

#### 4.1. SHA-256 取得（ユーザー）

```bash
keytool -list -v \
  -keystore /c/dev/pomocare/.secrets/upload-keystore.jks \
  -alias pomocare-upload
```

出力の `SHA256:` 行をコピーする（コロン区切り形式のまま使用する）。

#### 4.2. assetlinks.json の更新（Claude / ユーザー）

`public/.well-known/assetlinks.json` を開いて `sha256_cert_fingerprints` 配列に新 SHA-256 を追加する。

現在登録済みの 2 件はいったん残し、新しい fingerprint を追加する形で並行稼働させること。
（動作確認完了後、不要な旧 fingerprint を削除する）

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.pomocare.app",
      "sha256_cert_fingerprints": [
        "2C:2C:FD:13:DA:93:75:AC:9B:98:7E:B7:C6:7A:25:91:8C:77:58:89:97:1C:E5:F0:88:B5:BC:18:86:03:41:DA",
        "AF:27:D7:40:B6:95:96:DA:2F:1F:14:ED:F7:8A:2A:2E:8B:35:2F:2E:21:9F:1F:43:81:F7:00:B6:35:8B:8B:DB",
        "<新しい SHA-256 fingerprint をここに追記>"
      ]
    }
  }
]
```

#### 4.3. デプロイ（ユーザー）

```bash
cd /c/dev/pomocare
npm run build
npm run deploy
# gh-pages ブランチが更新される → GitHub Pages への反映まで 1〜2 分
```

#### 4.4. 検証（ユーザー）

```bash
# assetlinks.json の内容を確認
curl https://app.pomocare.com/.well-known/assetlinks.json
```

新 SHA-256 が反映されていることを確認する。

Google の App Links 検証ツールでも確認できる:
https://developers.google.com/digital-asset-links/tools/generator

### 切り戻し

```bash
# assetlinks.json を git で revert して再デプロイ
git checkout HEAD -- public/.well-known/assetlinks.json
npm run build && npm run deploy
```

---

## セクション 5: Cloudflare Worker のデプロイと VITE_WORKER_URL 更新

### 背景

pomocare は `workers/` 配下に Cloudflare Worker（`pomocare-api`）を持ち、以下の API を提供している。

| エンドポイント | 用途 |
|--------------|------|
| `/create-checkout-session` | Stripe 決済セッション作成 |
| `/create-portal-session` | Stripe カスタマーポータル |
| `/cancel-subscription` | サブスクリプションキャンセル |
| `/stripe-webhook` | Stripe Webhook 受信 |
| `/schedule-notification` | プッシュ通知スケジュール登録 |
| `/send-push` | プッシュ通知送信（Cron `* * * * *` でも自動実行） |
| `/health` | ヘルスチェック |

現在 `VITE_WORKER_URL` は placeholder のままで、デプロイ後に発行される
`workers.dev` URL に差し替える必要がある。

### 実行担当

ユーザー（Cloudflare アカウント操作）

### 所要時間

15〜30 分（初回。Cloudflare アカウント未作成の場合は +15 分）

### 前提

- Cloudflare アカウント作成済み
- `wrangler` CLI が利用可能（`npx wrangler` で実行可能）

### 手順

#### 5.1. Cloudflare ログイン

```bash
cd /c/dev/pomocare/workers
npx wrangler login
```

ブラウザが開くので承認する。

#### 5.2. Secret の設定

以下のシークレットを `wrangler secret put` で設定する（プロンプトで値を入力）。
各シークレットの値は `.env.local` または `.secrets/` の保管場所から取得する。

```bash
npx wrangler secret put NEON_DATABASE_URL
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put STRIPE_SECRET_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
npx wrangler secret put STRIPE_PRICE_STANDARD
npx wrangler secret put STRIPE_PRICE_PRO
npx wrangler secret put VAPID_SUBJECT
npx wrangler secret put VAPID_PUBLIC_KEY
npx wrangler secret put VAPID_PRIVATE_KEY

# 任意（カスタムポータル設定がある場合）
# npx wrangler secret put STRIPE_PORTAL_CONFIG_ID
```

#### 5.3. デプロイ

```bash
cd /c/dev/pomocare/workers
TEMP=C:/tmp TMP=C:/tmp npx wrangler deploy
```

成功すると以下のようなログが表示される:

```
Uploaded pomocare-api (x.xx sec)
Published pomocare-api (x.xx sec)
  https://pomocare-api.<your-subdomain>.workers.dev
```

URL をコピーしておく。

#### 5.4. `.env.local` を更新

`.env.local` の `VITE_WORKER_URL` を実際の URL に差し替える:

```
VITE_WORKER_URL=https://pomocare-api.<your-subdomain>.workers.dev
```

その後 `npm run build && npm run cap:sync` を実行してネイティブアプリにも反映させること。

#### 5.5. CORS 動作確認

```bash
# Web origin の確認
curl -i \
  -H "Origin: https://app.pomocare.com" \
  https://pomocare-api.<subdomain>.workers.dev/health

# Capacitor Android origin の確認（https://localhost が実効 origin）
curl -i \
  -H "Origin: https://localhost" \
  https://pomocare-api.<subdomain>.workers.dev/health

# カスタムスキーム origin の確認
curl -i \
  -H "Origin: capacitor://localhost" \
  https://pomocare-api.<subdomain>.workers.dev/health
```

いずれも `Access-Control-Allow-Origin` ヘッダが返り、ステータス 200 であること。

### 切り戻し

```bash
cd /c/dev/pomocare/workers
npx wrangler rollback
```

---

## セクション 6: workers/ ディレクトリを git に含めるか

### 現状

`workers/` は現時点で git に未追跡（untracked）。`.gitignore` にも記載されていない。

### 選択肢と推奨

| 選択肢 | 推奨度 | 理由 |
|-------|--------|------|
| **git に含める（推奨）** | 高 | pomocare 専用スコープ。秘密情報は `wrangler secret` で管理できるため、ソースコードは安全にコミット可能。同一リポジトリで一元管理できる。 |
| 別リポジトリ化 | 低 | 複数プロジェクト間で Worker を共有する場合のみ有効。現状は過剰。 |
| `.gitignore` で明示除外 | 非推奨 | バックアップが取れず、チーム開発での共有もできない。 |

### 含める場合の手順

```bash
cd /c/dev/pomocare
git add workers/
# 追加されるファイルを確認（node_modules/ が含まれていないことを確認）
git status --short
git commit -m "Add Cloudflare Workers for payment and push notifications"
```

> **注意:** `workers/node_modules/` が含まれていないことを必ず `git status` で確認すること。

---

## セクション 7: （任意・優先度低）Git 履歴クリーンアップ

### 背景

- commit `2e5de9be` と `3fc9196a` (c1) に平文パスワードが残っている
- 既に GitHub 公開リポジトリに push 済みのため鍵は漏洩済み
- **最優先対応は新 upload-keystore.jks の発行**（docs/android-release.md セクション 3）
- 履歴クリーンアップは後回しにしても実害は新 keystore 発行で防げる

### 選択肢

| 選択肢 | 内容 |
|-------|------|
| **後回し（推奨）** | 新 keystore 発行が最優先。履歴掃除は後日対応で可 |
| 即時実行 | 下記手順で `git filter-repo` を使用。破壊的操作のため慎重に |

### 手順（実行する場合）

```bash
# バックアップブランチを作成（安全のため）
git checkout -b backup-before-filter-repo
git checkout feat/capacitor-android

# git-filter-repo のインストール（pip が使える環境で）
pip install git-filter-repo

# 漏洩済みキーストアファイルを履歴から削除
git filter-repo \
  --invert-paths \
  --path android/signing.keystore \
  --path android/signing-key-info.txt \
  --path android/app/signing.keystore \
  --path android/app/signing-key-info.txt

# 平文パスワードを履歴から置換（実際のパスワード値は 1Password 等から取得）
# replacements.txt の形式: <OLD_VALUE>==><NEW_VALUE>
# 例: echo "<actual_leaked_password>==>REDACTED" > /tmp/replacements.txt
git filter-repo --replace-text /tmp/replacements.txt

# force push（破壊的操作・慎重に実行すること）
git push origin feat/capacitor-android --force
git push origin main --force
```

### 注意事項

- 旧パスワードは既に漏洩済みのため、履歴クリーンアップの実効性は限定的
- 新 keystore を発行すれば旧パスワードを使った実害はない
- force push 後、全クローン済みの開発環境で `git clone` からやり直す必要がある
- **優先度: 低**

### 切り戻し（filter-repo 実行前に行うこと）

```bash
# バックアップブランチに戻す
git checkout backup-before-filter-repo
```

---

## セクション 8: 外部サービスのロールバック一覧

| セクション | サービス | 切り戻し手順 |
|-----------|---------|------------|
| 2 | Neon Auth | Neon Console → Auth → Configuration → Domains から該当 domain を削除 |
| 3（選択肢 A） | Google Cloud Console | Credentials → 作成した Android Client ID を削除 |
| 3（選択肢 B） | Google Cloud Console | `getAuthRedirectBase()` を元に戻し、`AndroidManifest.xml` の intent-filter を復元してリビルド |
| 4 | GitHub Pages（assetlinks） | `git checkout HEAD -- public/.well-known/assetlinks.json` → `npm run build && npm run deploy` |
| 5 | Cloudflare Worker | `workers/` ディレクトリで `npx wrangler rollback` を実行 |
| 6 | git（workers 追加） | `git revert <commit>` または `git reset HEAD~1`（未 push なら） |
| 7 | git 履歴 | force push 前に作成した `backup-before-filter-repo` ブランチから復元 |

---

## 関連ドキュメント

- [`docs/android-release.md`](./android-release.md) — keystore 発行 + AAB ビルド + Play Store 登録
- [`CLAUDE.md`](../CLAUDE.md) — プロジェクト全体の設計・開発メモ・コマンド一覧
- [`.secrets/README.md`](../.secrets/README.md) — キーストア・パスワードの保管方針
- `C:\dev\.claude\knowledge\pitfalls.md` — 既知問題・過去の落とし穴

---

*最終更新: 2026-04-12*
