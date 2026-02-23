# PomoCare 開発引き継ぎドキュメント

> **最終更新:** 2026-02-23
> **リポジトリ:** https://github.com/urakutours/pomocare

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
| 認証 | Supabase Auth（Google OAuth + Email/Password） |
| データベース | Supabase PostgreSQL（JSONB） |
| ローカル保存 | localStorage（未ログイン時） |
| アイコン | lucide-react |
| ホスティング | GitHub Pages（カスタムドメイン: app.pomocare.com） |
| LP サイト | Xserver + SCSS + バニラJS |

---

## 3. 外部サービス

### Supabase

- **管理ダッシュボード:** https://supabase.com/dashboard/org/velckwqackuwduiahgbg
- **プロジェクトURL:** `https://cjylcizaikyirdxkwpao.supabase.co`
- **Anon Key:** `src/lib/supabase.ts` に記載
- **用途:** 認証（Auth）、ログイン済みユーザーのセッション・設定データ保存

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
│   │   ├── AuthContext.tsx        # Supabase認証コンテキスト
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
│   │   ├── auth/AuthService.ts   # Supabase認証サービス
│   │   ├── storage/              # データ永続化
│   │   │   ├── types.ts          #   StorageService インターフェース
│   │   │   ├── LocalStorageAdapter.ts  # 未ログイン時 → localStorage
│   │   │   ├── SupabaseAdapter.ts      # ログイン時 → Supabase
│   │   │   └── index.ts
│   │   └── analytics/            # 分析サービス
│   ├── types/
│   │   ├── session.ts            # PomodoroSession, LabelDefinition
│   │   ├── settings.ts           # PomodoroSettings, AlarmSettings
│   │   └── timer.ts              # タイマー型
│   ├── utils/
│   │   ├── alarm.ts              # アラーム音生成（Web Audio API）
│   │   ├── date.ts               # 日付ユーティリティ
│   │   └── time.ts               # 時間フォーマット
│   ├── config/
│   │   └── *.ts                  # ストレージキー、機能フラグ定義
│   └── lib/
│       └── supabase.ts           # Supabase クライアント初期化
├── public/
│   ├── CNAME                     # カスタムドメイン設定（app.pomocare.com）
│   ├── icons/                    # PWA アイコン
│   ├── sounds/                   # アラーム音声ファイル
│   └── favicon.*
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
```

---

## 6. デプロイ手順

### アプリ本体（app.pomocare.com）

1. `npm run build` — TypeScript コンパイル + Vite ビルド → `dist/` に出力
2. `npm run deploy` — `gh-pages -d dist` で `gh-pages` ブランチにプッシュ
3. GitHub Pages が自動的に `gh-pages` ブランチを配信
4. 反映まで 1〜2 分程度

**注意:** 自動デプロイ（GitHub Actions 等）は未設定。手動で上記コマンドを実行する。

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
- **ログイン済み:** Supabase PostgreSQL（JSONB カラム）
- `StorageService` インターフェースで抽象化されており、切り替え可能

### 多言語対応

- 7 言語: 日本語(ja), 英語(en), スペイン語(es), ポルトガル語(pt), ドイツ語(de), フランス語(fr), イタリア語(it)
- `src/i18n/types.ts` で全翻訳キーを型定義
- 新しいキーを追加する場合は `types.ts` → 全言語ファイルに追加が必要

### パネルの UI 構造（設定・統計）

- 閉じる (X) ボタンは `absolute top-0 right-0` で固定表示
- タイトル・タブ・コンテンツは全体がスクロール可能
- 下部のアクションボタン（「設定を適用」「前の週/次の週」等）は固定

### アラーム

- Web Audio API でブラウザ内生成（`src/utils/alarm.ts`）
- 7 種類のサウンド + OFF

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
| Supabase 接続 | `src/lib/supabase.ts` |
| PWA 設定 | `vite.config.ts` |
| テーマ色・ブレークポイント | `tailwind.config.js` |
