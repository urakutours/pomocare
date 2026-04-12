# pomocare 実機/エミュレータ動作確認チェックリスト

> **最終更新:** 2026-04-12
> **対象:** Android ネイティブアプリ版 pomocare（Capacitor 8.x）
> **前提:**
>  - `docs/android-release.md` の前提条件（Java 17+、Android SDK、ANDROID_HOME）がセットアップ済み
>  - `docs/external-config.md` のセクション 2〜5（Neon / GCP / Cloudflare / assetlinks）が完了済み
>  - `.secrets/upload-keystore.jks` が発行済み、`android/local.properties` に環境変数が登録済み
>  - テスト対象のシナリオごとに **clean install** を推奨（`adb uninstall com.pomocare.app` で前状態をクリア）

---

## 実行方法

### ビルドと起動

```bash
cd /c/dev/pomocare

# クリーンビルド
npm run build
TEMP=C:/tmp TMP=C:/tmp npx cap sync android

# エミュレータ / 実機で起動
TEMP=C:/tmp TMP=C:/tmp npm run android:dev
# または Android Studio で android/ を開いて実行
```

### ログ取得

別ターミナルで adb logcat を起動しておくと OAuth 周りのデバッグが楽:

```bash
adb logcat | grep -E "Capacitor|PomoCare|appUrlOpen|chromium"
```

Chrome DevTools でも WebView をデバッグ可能:

1. デスクトップ Chrome で `chrome://inspect/#devices`
2. PomoCare の WebView を選択 → `inspect`

---

## シナリオ A. アプリ起動 & 基本動作

| # | 手順 | 期待結果 |
|---|------|---------|
| A-1 | エミュレータ / 実機でアプリを起動 | スプラッシュ → タイマー画面（25:00 表示） |
| A-2 | タイマー表示、ボタン、アイコンが Tiffany カラー (#0abab5) で表示される | ブランドカラーの適用確認 |
| A-3 | ステータスバーがアプリと干渉していない | `@capacitor/status-bar` の設定が効いている |
| A-4 | 設定画面（歯車アイコン）を開く | SettingsPanel が開く |
| A-5 | 言語切替（日本語 / English 等） | 全 7 言語で UI が切り替わる |
| A-6 | ダークモード切替 | `<html>` に dark クラスが付与される |

---

## シナリオ B. アラーム発火（media / notification 両チャンネル）

### B-1. Media チャンネル（デフォルト）

| # | 手順 | 期待結果 |
|---|------|---------|
| B-1-1 | 設定 → アラーム → 鳴らし方: 「ふつうに鳴らす」を選択、保存 | 設定が保存される |
| B-1-2 | タイマー設定を 30 秒に短縮してスタート | カウントダウン開始 |
| B-1-3 | **アプリをフォアグラウンドに保ったまま**待機 | 30 秒後にアラーム音 + 振動が発火 |
| B-1-4 | 音量はメディア音量スライダー（端末右側ボリュームキー）に連動する | 確認 |

### B-2. Notification チャンネル

| # | 手順 | 期待結果 |
|---|------|---------|
| B-2-1 | 設定 → アラーム → 鳴らし方: 「画面オフでも鳴らす」を選択、保存 | 設定が保存される（`isNative()` ガードで Android アプリ版のみ表示される） |
| B-2-2 | タイマー設定を 30 秒にしてスタート | カウントダウン開始 |
| B-2-3 | **画面をオフにして**（電源ボタン短押し）待機 | 30 秒後に OS 通知として音・振動が発火（LocalNotifications 経由） |
| B-2-4 | 通知をタップ → アプリに戻る | タイマーが終了状態で表示される |
| B-2-5 | マナーモード（サイレント）で同じ手順 | 通知音量の設定に依存する挙動を確認 |

### B-3. 通知権限拒否時の graceful fallback（Android 13+）

| # | 手順 | 期待結果 |
|---|------|---------|
| B-3-1 | 設定 → アプリ → PomoCare → 通知 → OFF | 通知権限を取り消す |
| B-3-2 | アプリに戻り、タイマー 30 秒スタート → 画面オフ | アプリ内ログに `[alarm] native schedule failed` または fallback 成功メッセージが出る |
| B-3-3 | アプリがクラッシュしない | タイマー自体は正常に動く（graceful fallback 効果） |
| B-3-4 | 通知権限を戻して再試行 | 正常に通知発火 |

### B-4. SCHEDULE_EXACT_ALARM 拒否時の graceful fallback（Android 12/13+）

| # | 手順 | 期待結果 |
|---|------|---------|
| B-4-1 | 設定 → アプリ → PomoCare → 特別なアプリアクセス → Alarm & reminders → OFF | Exact Alarm 権限を拒否 |
| B-4-2 | アプリでタイマー 30 秒スタート | `scheduleNativeAlarm` Stage 1 失敗 → Stage 2 (非 exact) でリトライ |
| B-4-3 | Chrome DevTools Console に `[alarm] exact schedule failed, retrying without allowWhileIdle` のログ | 段階的フォールバックの実動作確認 |
| B-4-4 | 30 秒後に通知が発火する（多少の遅延は許容） | Stage 2 での成功 |

---

## シナリオ C. Google OAuth ログイン

### C-1. Warm start（アプリ起動中のログイン）

| # | 手順 | 期待結果 |
|---|------|---------|
| C-1-1 | アプリ起動、未ログイン状態 | ログインモーダルが開ける |
| C-1-2 | 「Google でログイン」をタップ | Chrome Custom Tab または外部ブラウザで Google の同意画面 |
| C-1-3 | アカウントを選択 | 同意 → リダイレクト |
| C-1-4 | `com.pomocare.app://auth` カスタムスキームでアプリに戻る | adb logcat に `Handling intent with action: android.intent.action.VIEW` |
| C-1-5 | AuthContext の `appUrlOpen` リスナが発火 → セッション確立 | user ステートが更新される |
| C-1-6 | UI にログイン済みユーザー名 / アバターが表示される | Better Auth セッション有効 |

### C-2. Cold start（アプリ killed 状態で OAuth 戻り）

| # | 手順 | 期待結果 |
|---|------|---------|
| C-2-1 | `adb shell am force-stop com.pomocare.app` でアプリを完全に kill | アプリ終了確認 |
| C-2-2 | ブラウザで Google OAuth を開始して、コールバックをアプリで受ける（C-1-2〜3 と同じ） | カスタムスキームでアプリが cold 起動 |
| C-2-3 | `App.getLaunchUrl()` フォールバックがリスナー登録前に URL を受け取り処理する | `[Auth] launchUrl processed` 等のログ |
| C-2-4 | セッションが確立、UI にログイン済み表示 | cold start race が解消されている（T1.1 の効果） |

### C-3. 3 回連続 cold start OAuth 成功（race 堅牢性テスト）

| # | 手順 | 期待結果 |
|---|------|---------|
| C-3-1 | C-2 を 3 回繰り返す（毎回 force-stop してからログイン） | **3 回全部成功** すれば T1.1 が機能している |
| C-3-2 | 失敗するケースがあれば adb logcat を保存してフォローアップ | pitfalls.md に再現条件を追記 |

---

## シナリオ D. パスワードリセットメールリンク

| # | 手順 | 期待結果 |
|---|------|---------|
| D-1 | ログインモーダル → 「パスワードを忘れた方」→ メールアドレス入力 → 送信 | Better Auth がリセットメール送信 |
| D-2 | メール到着確認（Gmail 等） | 件名: "Password Reset" / "パスワードリセット" |
| D-3 | **Android 端末のメールアプリ**でメールを開き、リンクをタップ | ブラウザ → `com.pomocare.app://auth?token=xxx&type=password-reset` → アプリ起動 |
| D-4 | アプリ内でパスワード再設定画面が開く | `setIsPasswordRecovery(true)` が発火、EmailActionHandler が起動 |
| D-5 | 新パスワードを 2 回入力 → 確定 | Better Auth が新パスワードを受け取り |
| D-6 | 自動的にログイン画面 or 自動ログインへ遷移 | 新パスワードでログインできることを確認 |

---

## シナリオ E. AlarmChannel 切替の UI 確認

| # | 手順 | 期待結果 |
|---|------|---------|
| E-1 | **Web ブラウザ版**（`npm run dev` または本番 https://app.pomocare.com）で設定 → アラーム | channel トグル UI が **表示されない**（`isNative()` ガード） |
| E-2 | Android 実機 / エミュレータで同じ画面 | channel トグル UI が表示される（「ふつうに鳴らす」「画面オフでも鳴らす」） |
| E-3 | サウンドを「None」に変更 | channel トグル UI が非表示になる（`sound !== 'none'` ガード） |
| E-4 | サウンドを bell 等に戻す | channel トグル UI が再表示 |
| E-5 | 各言語（ja/en/es/pt/de/fr/it）に切り替えて文言を確認 | 7 言語で自然な文言が表示される |

---

## シナリオ F. データ同期とログアウト

| # | 手順 | 期待結果 |
|---|------|---------|
| F-1 | ログイン状態でタイマーを 3 回完了させる | セッション履歴が記録される |
| F-2 | 設定 → 統計を開く | 3 回分が反映されている |
| F-3 | 別ブラウザで https://app.pomocare.com にログイン | Android で記録した 3 回が同期されている（Neon DB 経由） |
| F-4 | Android 側でログアウト | localStorage のデータは残る / セッションクリア |
| F-5 | 未ログイン状態でタイマー完了 → 統計確認 | ローカルデータ + ログアウト前のデータの扱いが一貫 |

---

## 合格基準

### 必須（MUST）
- シナリオ A 全項目 OK
- シナリオ B-1（media チャンネル）全項目 OK
- シナリオ C-1（warm start OAuth）全項目 OK
- シナリオ D（パスワードリセット）全項目 OK

### 推奨（SHOULD）
- シナリオ B-2（notification チャンネル）
- シナリオ C-2（cold start OAuth）
- シナリオ E（AlarmChannel UI ガード）

### 任意（NICE TO HAVE）
- シナリオ B-3 / B-4（権限拒否 graceful fallback）
- シナリオ C-3（3 回連続 cold start）
- シナリオ F（データ同期）

---

## 失敗時のフォローアップ

### OAuth が動かない
1. `docs/external-config.md` セクション 2（Neon Auth trustedOrigins）が完了しているか確認
2. `docs/external-config.md` セクション 3（Google Cloud Console Client ID）が完了しているか確認
3. `adb logcat` で `appUrlOpen` の発火タイミングを確認
4. 既知問題: Capacitor Issue #6300, #795 — `App.getLaunchUrl()` でも塞ぎきれない場合がある

### アラームが鳴らない
1. 通知権限と Exact Alarm 権限を確認（設定 → アプリ → PomoCare → 権限）
2. `adb logcat | grep alarm` でログ確認
3. `android/app/src/main/res/raw/` に音源（bell.wav 等）が配置されているか確認
4. `capacitor.config.ts` の `LocalNotifications.sound` が `bell.wav` を指しているか

### パスワードリセットメールが開かない
1. AndroidManifest.xml の intent-filter でカスタムスキーム `com.pomocare.app` が定義されているか
2. メールリンクの URL 形式が `com.pomocare.app://auth?token=...&type=password-reset` になっているか
3. Better Auth の `redirectTo` が正しく設定されているか（`AuthService.ts` の `sendPasswordReset`）

---

## 関連ドキュメント

- [docs/android-release.md](./android-release.md) — keystore 発行、AAB ビルド、Play Store 登録
- [docs/external-config.md](./external-config.md) — Neon / GCP / Cloudflare / assetlinks 設定
- [.secrets/README.md](../.secrets/README.md) — キーストア保管方針
- プロジェクトルートの `.claude/knowledge/pitfalls.md` — 既知問題・落とし穴

---

**Last updated:** 2026-04-12
