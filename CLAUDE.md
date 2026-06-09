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

### アラームディスパッチ設計（②′ 仕様、2026-06-05 確定）

> 出典: judgment #2（web 版 ① escalate 確定方針）+ 実機検証 (A)(B) PASS（S22/One UI 8.0）。
> 旧「二系統ディスパッチ（Web / Native）」・「AlarmChannel（media/notification）」節を本節に統合置換。

#### AlarmScheduler 薄1インタフェース

`src/utils/alarmScheduler.ts`（新設）に「未来時刻 T にアラームを予約/取消する」責務のみを閉じ込める。

```ts
export interface AlarmScheduler {
  schedule(fireAtMs: number, sound: AlarmSound): Promise<void>; // 冪等
  cancel(): Promise<void>;
}
export const alarmScheduler = isNative() ? new NativeAlarmScheduler() : new WebAlarmScheduler();
```

- **NativeAlarmScheduler（Android）**: `LocalNotifications.schedule({ at, allowWhileIdle: true })` 1段のみ。通知チャンネルに長尺MP3を添付し OS が発火・フル再生。アプリ内 HTMLAudio 不使用。
- **WebAlarmScheduler（Web / iOS）**: 内部 setTimeout + フォアグラウンド時のみ再生（Web Audio / HTMLAudio fallback 1段）。OS 予約はしない。

#### 振る舞い表（②′ 製品仕様の正本）

| 状態 | Android (native) | Web / PWA | iOS |
|---|---|---|---|
| アプリ前面（画面オン） | 終了時アラーム（未決 #1） | in-app 音（volume 連動） | in-app 音（HTMLAudio fallback） |
| バックグラウンド | **OS 予約通知で発火 ✅** | 鳴らない（仕様） | 鳴らない（仕様） |
| 画面オフ / kill | **OS 予約通知で定刻発火 ✅**（~5 秒ラグ許容） | 鳴らない（仕様） | 鳴らない（仕様） |
| 復帰時 | wall-clock 再計算で状態同期（音は予約通知が発火済） | 跨いだ終了は鳴らさず状態のみ fast-forward | 同左 |

**Android = 画面オフ・バックグラウンド・kill でも定刻発火**（exact-alarm + 長尺 MP3 を通知音、~5 秒 OS 配信ラグ許容）。

**Web・iOS = フォアグラウンド時のみ**。画面オフ・バックグラウンドでの通知は技術的に不可（SW setTimeout は数十秒〜数分でアイドル停止、Notification Triggers は stable 未到達）。これは機能の欠如ではなく仕様の明示であり品質の表明。Web で画面オフを将来確実化するにはサーバ Web Push 復活が唯一手段（別タスク、本 sprint 外）。

#### 廃止・変更事項

- **`AlarmChannel`（media / notification）廃止**: `channel` 二軸の設定 UI と型を削除。Android は常に OS 予約通知 = 既定で画面オフ発火。`DEFAULT_SETTINGS.alarm.channel` 削除済。旧 localStorage/Neon に残存した `channel` 値は新コードが読まないため無害、能動マイグレーション不要。
- **`repeat` は `@deprecated`**: `AlarmSettings.repeat` に `@deprecated` 付与。AlarmScheduler は repeat 不使用（長尺音 1 回再生）。旧 `repeat:N` 保存値は無視（1:1 置換）。完全削除は次 sprint。
- **vibration は off / always ON の 2 択**: `'silent'` 表現は OS 通知方式では機能しない。2 択に簡素化（旧 3 択廃止）。
- **音源**: 長尺 3 種（classic / gentle / soft MP3）維持。短い合成音 WAV 4 種は新規デザイン検討中。既定はアラーム音あり（画面オフでも鳴る）。
- **channel 再作成注意**: Android の通知チャンネル sound は immutable。旧チャンネルが残存する端末では新 MP3 が鳴らないため、channelId バージョニング（例: `pomocare-gentle-v2`）または `deleteChannel` → 再作成が必須（T2d AC）。

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
