# PomoCare 開発引き継ぎドキュメント

> **最終更新:** 2026-04-11
> **リポジトリ:** https://github.com/urakutours/pomocare
> **ブランチ:** `feat/capacitor-android` が現在進行中

---

## 1. プロジェクト概要

**PomoCare** はポモドーロ・テクニックに基づく集中タイマー PWA。
ラベル管理・統計グラフ・CSV エクスポート/インポート・多言語対応・ダークモードなどを備える。

- **本番URL:** https://app.pomocare.com
- **LP サイト:** https://pomocare.com（Xserver でホスティング）

---

## 2. 技術スタック

| カテゴリ | 技術 |
|---------|------|
| フレームワーク | React 18 + TypeScript 5.7 |
| ビルドツール | Vite 6 |
| スタイリング | Tailwind CSS 3 |
| PWA | vite-plugin-pwa（Workbox / Service Worker） |
| 認証 | Better Auth on Neon（Google OAuth + Email/Password） |
| データベース | Neon PostgreSQL（JSONB） |
| ローカル保存 | localStorage（未ログイン時） |
| モバイル | Capacitor（Android ネイティブアプリ） |
| アイコン | lucide-react |
| ホスティング | GitHub Pages（カスタムドメイン: app.pomocare.com） |
| LP サイト | Xserver + SCSS + バニラJS |
| Capacitor 依存 | `@capacitor/{core,android,app,haptics,local-notifications,preferences,browser,splash-screen,status-bar}` (^8.x) |

---

## 3. 外部サービス

### Neon + Better Auth（現行）

- **認証エンドポイント（Neon Auth マネージド Better Auth）:**
  `https://ep-royal-breeze-akf5w0cu.neonauth.c-3.us-west-2.aws.neon.tech/neondb/auth`
- **データベース:** Neon PostgreSQL（同プロジェクト内）
- **クライアント初期化:** `src/lib/neon.ts`（`createClient` + `BetterAuthReactAdapter`）
- **環境変数:**
  - `VITE_NEON_AUTH_URL` — Better Auth エンドポイント URL
  - `VITE_NEON_DATA_API_URL` — Neon Data API URL
- **用途:** 認証（Auth）、ログイン済みユーザーのセッション・設定データ保存

### 移行履歴（参考）

旧スタックは **Supabase Auth + Supabase PostgreSQL** だった（commit `cc3df8e6` で Neon + Better Auth へ移行済み）。
移行スクリプト: `scripts/migrate-supabase-to-neon.mjs`

### GitHub Pages

- **デプロイ先ブランチ:** `gh-pages`
- **カスタムドメイン:** `app.pomocare.com`（`public/CNAME` で設定）
- **DNS:** GitHub Pages のデフォルト設定

---

## 4. ディレクトリ構成

```
pomodoro-build/
├── src/
│   ├── App.tsx                   # メインアプリ（タイマーUI、ラベル選択モーダル等）
│   ├── main.tsx                  # エントリーポイント
│   ├── index.css                 # グローバルCSS（Tailwind directives）
│   ├── components/
│   │   ├── auth/                 # 認証関連
│   │   │   ├── LoginModal.tsx    #   ログイン/サインアップモーダル
│   │   │   └── EmailActionHandler.tsx  # メール認証・パスワードリセット
│   │   ├── layout/
│   │   │   └── AppShell.tsx      #   レイアウトシェル
│   │   ├── settings/
│   │   │   └── SettingsPanel.tsx  #   設定パネル（全般/ラベル/プリセット）
│   │   ├── stats/
│   │   │   └── StatsChart.tsx    #   統計・分析パネル（週間/月間/年間グラフ）
│   │   └── timer/                #   タイマー表示コンポーネント
│   ├── contexts/
│   │   ├── AuthContext.tsx        # Better Auth 認証コンテキスト（appUrlOpen で Native ディープリンク受信）
│   │   ├── FeatureContext.tsx     # 機能フラグコンテキスト（free/pro tier）
│   │   └── I18nContext.tsx        # 多言語コンテキスト
│   ├── hooks/
│   │   ├── useTimer.ts           # タイマーロジック
│   │   ├── useSessions.ts        # セッションデータ管理
│   │   ├── useSettings.ts        # 設定管理
│   │   ├── useInstallPrompt.ts   # PWA インストール
│   │   └── useNotification.ts    # 通知
│   ├── i18n/                     # 多言語翻訳ファイル
│   │   ├── types.ts              #   翻訳キー型定義
│   │   ├── index.ts              #   エクスポート
│   │   ├── ja.ts                 #   日本語
│   │   ├── en.ts                 #   英語
│   │   ├── es.ts / pt.ts / de.ts / fr.ts / it.ts
│   │   └──                       #   スペイン/ポルトガル/ドイツ/フランス/イタリア語
│   ├── services/
│   │   ├── auth/AuthService.ts   # Better Auth 認証サービス
│   │   ├── storage/              # データ永続化
│   │   │   ├── types.ts          #   StorageService インターフェース
│   │   │   ├── LocalStorageAdapter.ts  # 未ログイン時 → localStorage
│   │   │   ├── NeonAdapter.ts          # ログイン時 → Neon PostgreSQL
│   │   │   └── index.ts
│   │   └── analytics/            # 分析サービス
│   ├── types/
│   │   ├── session.ts            # PomodoroSession, LabelDefinition
│   │   ├── settings.ts           # PomodoroSettings, AlarmSettings
│   │   └── timer.ts              # タイマー型
│   ├── utils/
│   │   ├── alarm.ts              # アラーム音（Web / Native 二系統ディスパッチ）
│   │   ├── platform.ts           # ネイティブ/Web 判定（isNative, isIOS, getAuthRedirectBase）
│   │   ├── date.ts               # 日付ユーティリティ
│   │   └── time.ts               # 時間フォーマット
│   ├── config/
│   │   └── *.ts                  # ストレージキー、機能フラグ定義
│   └── lib/
│       └── neon.ts               # Neon クライアント初期化（createClient + BetterAuthReactAdapter）
├── public/
│   ├── CNAME                     # カスタムドメイン設定（app.pomocare.com）
│   ├── .well-known/
│   │   └── assetlinks.json       # TWA 時代の Digital Asset Links（Android Package 紐付け、現行 Capacitor でも有効）
│   ├── icons/                    # PWA アイコン
│   ├── sounds/                   # アラーム音声ファイル
│   └── favicon.*
├── android/                      # Capacitor が生成する Android プロジェクト
│   ├── app/
│   │   └── src/main/
│   │       ├── AndroidManifest.xml   # パーミッション・intent-filter（カスタムスキーム受信）
│   │       ├── java/                 # Capacitor ブリッジ Java コード
│   │       └── res/                  # アイコン・文字列リソース等
│   ├── build.gradle                  # ルートビルドスクリプト
│   ├── gradle/                       # Gradle Wrapper
│   ├── variables.gradle              # compileSdk / targetSdk 等のバージョン変数
│   └── settings.gradle
├── resources/                   # Capacitor アイコン素材（icon.png / icon-foreground.png）
├── scripts/
│   ├── generate-alarm-sounds.mjs # アラーム音 WAV ファイル生成スクリプト
│   ├── generate-icons.mjs        # アイコン生成
│   └── migrate-supabase-to-neon.mjs  # 移行スクリプト（完了済み）
├── lp/                           # LP サイト（別ホスティング: Xserver）
│   ├── index.html                # メインLP
│   ├── scss/                     # SCSS ソース
│   ├── css/                      # コンパイル済みCSS
│   ├── js/                       # main.js + i18n.js
│   ├── images/                   # 画像素材
│   ├── privacy/                  # プライバシーポリシー
│   ├── terms/                    # 利用規約
│   ├── support/                  # サポートページ
│   ├── manual/                   # ユーザーマニュアル
│   └── DESIGN.md                 # LP デザイン設計書
├── capacitor.config.ts           # Capacitor 設定（appId, webDir, LocalNotifications 等）
├── vite.config.ts
├── tailwind.config.js
├── tsconfig.json
├── package.json
└── CLAUDE.md                     # ← このファイル
```

---

## 5. 開発コマンド

```bash
# 開発サーバー起動
npm run dev

# 型チェック + 本番ビルド
npm run build

# ビルド結果をプレビュー
npm run preview

# Lint
npm run lint

# 本番デプロイ（GitHub Pages）
npm run build && npm run deploy
# ※ 内部で gh-pages -d dist を実行
# ※ public/CNAME により app.pomocare.com に紐づく

# LP の SCSS 開発（ウォッチ）
npm run lp:dev

# LP の SCSS ビルド（本番圧縮）
npm run lp:build

# Capacitor sync（dist/ を android/app/src/main/assets/public に反映）
npm run cap:sync
# または npx cap sync android

# Android Studio で開く
npm run cap:android

# Android 開発ビルド + 実機/エミュレータ起動
npm run android:dev
# ※ Windows では TEMP=C:/tmp が必須（gradle の tmp ディレクトリがマルチバイトパスで落ちるため）
# ※ script に TEMP=C:/tmp TMP=C:/tmp が組み込み済み

# Android APK（debug）
npm run android:apk

# Android Bundle（release）
npm run android:release

# アラーム音ファイル生成
npm run generate-sounds
```

---

## 6. デプロイ手順

### アプリ本体（app.pomocare.com）

1. `npm run build` — TypeScript コンパイル + Vite ビルド → `dist/` に出力
2. `npm run deploy` — `gh-pages -d dist` で `gh-pages` ブランチにプッシュ
3. GitHub Pages が自動的に `gh-pages` ブランチを配信
4. 反映まで 1〜2 分程度

**注意:** 自動デプロイ（GitHub Actions 等）は未設定。手動で上記コマンドを実行する。

### Android ネイティブアプリ（Google Play Store）

1. `npm run build` — React アプリをビルド（`dist/` 生成）
2. `npm run cap:sync` — `dist/` を Android アセット（`android/app/src/main/assets/public`）へ同期
3. `npm run android:release` — AAB を生成（`android/app/build/outputs/bundle/release/`）
   - ※ 署名キーは `.secrets/upload-keystore.jks`（別途管理、Git 追跡外）
   - ※ Windows では `TEMP=C:/tmp` 環境変数が必須（gradle の tmp ディレクトリがマルチバイトパスで落ちるため）。スクリプトに組み込み済み
4. Google Play Console にアップロード

### LP サイト（pomocare.com）

1. `npm run lp:build` — SCSS をコンパイル
2. FileZilla で `lp/` ディレクトリの内容を Xserver にアップロード

---

## 7. ブランチ運用

| ブランチ | 用途 |
|---------|------|
| `main` | メイン開発ブランチ（ソースコード） |
| `gh-pages` | デプロイ用（`npm run deploy` で自動更新、直接編集しない） |

---

## 8. 主要な設計方針

### テーマカラー

- **Tiffany:** `#0abab5`（メインカラー）
- hover 時: `#099d99`
- Tailwind で `tiffany` / `tiffany-hover` として定義

### ダークモード

- Tailwind の `darkMode: 'class'` を使用
- `<html>` タグに `dark` クラスを付与して切り替え

### レスポンシブ

- モバイルファーストで `max-w-sm`（384px）を基本幅
- `landscape` ブレークポイントはスマホ横向き（max-width: 767px）のみ

### データ保存

- **未ログイン:** localStorage（`pomodoro-sessions` / `pomodoro-settings` キー）
- **ログイン済み:** Neon PostgreSQL（JSONB カラム）
- `StorageService` インターフェースで抽象化されており、切り替え可能

### 多言語対応

- 7 言語: 日本語(ja), 英語(en), スペイン語(es), ポルトガル語(pt), ドイツ語(de), フランス語(fr), イタリア語(it)
- `src/i18n/types.ts` で全翻訳キーを型定義
- 新しいキーを追加する場合は `types.ts` → 全言語ファイルに追加が必要

### パネルの UI 構造（設定・統計）

- 閉じる (X) ボタンは `absolute top-0 right-0` で固定表示
- タイトル・タブ・コンテンツは全体がスクロール可能
- 下部のアクションボタン（「設定を適用」「前の週/次の週」等）は固定

### アラームの二系統ディスパッチ（Web / Native）

- **Web ブラウザ版:** Web Audio API（アプリ内生成）+ HTMLAudioElement フォールバック（iOS 向け）
- **Capacitor Android 版:** `LocalNotifications.schedule()` で OS レベルに予約（アプリが kill されても OS が発火）+ `Haptics.impact()` で振動
- `src/utils/alarm.ts` 内で `isNative()`（`src/utils/platform.ts`）を判定して dispatch
- 7 種類のサウンド + OFF

### AlarmChannel 設定（media / notification）

- Android では鳴らし方の経路を 2 種類から選べる
  - `media`: アプリ内の Audio で鳴らす（メディア音量連動、画面オフで kill されると鳴らない）
  - `notification`: OS 通知として鳴らす（画面オフでも鳴る、通知権限要、マナーモードで制限あり）
- UI は `isNative()` ガードで Android アプリ版のみ表示

### 認証のネイティブ対応

- **Web:** Better Auth のリダイレクト URL に `window.location.origin + window.location.pathname` を使用
- **Native:** カスタムスキーム `com.pomocare.app://auth` を使用（`AndroidManifest.xml` の `intent-filter` で受信）
- `AuthContext.tsx` で `@capacitor/app` の `App.addListener('appUrlOpen')` を購読し、
  パスワードリセット（`token + type=password-reset`）と OAuth callback を判別
- `src/utils/platform.ts` の `getAuthRedirectBase()` で Web / Native を自動切り替え

### PWA

- `vite-plugin-pwa` で Service Worker を自動生成
- `registerType: 'autoUpdate'` でバックグラウンド自動更新
- オフライン対応あり

---

## 9. 機能フラグ（将来拡張用）

`src/config/` に `free` / `pro` ティアの機能フラグが定義されている。
現時点では全ユーザー `free` ティアで動作。Pro 機能は未実装。

```
free: customSounds=false, exportData=false, cloudSync=false, advancedStats=false, themes=false
pro:  全て true
```

---

## 10. よく触るファイル

| 変更内容 | ファイル |
|---------|---------|
| タイマーロジック | `src/hooks/useTimer.ts` |
| メイン UI / ラベル選択 | `src/App.tsx` |
| 設定パネル | `src/components/settings/SettingsPanel.tsx` |
| 統計グラフ | `src/components/stats/StatsChart.tsx` |
| 日本語テキスト | `src/i18n/ja.ts` |
| 翻訳キー追加 | `src/i18n/types.ts` → 全言語ファイル |
| セッションデータ管理 | `src/hooks/useSessions.ts` |
| Neon 接続 | `src/lib/neon.ts` |
| ネイティブ/Web 判定 | `src/utils/platform.ts` |
| Capacitor 設定 | `capacitor.config.ts` |
| Android マニフェスト | `android/app/src/main/AndroidManifest.xml` |
| PWA 設定 | `vite.config.ts` |
| テーマ色・ブレークポイント | `tailwind.config.js` |
