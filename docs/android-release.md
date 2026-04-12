# pomocare Android リリース手順

> **最終更新:** 2026-04-12
> **対象:** pomocare 開発者（Daisuke）
> **関連ドキュメント:**
> - `.secrets/README.md` — キーストア・パスワードの保管方針
> - `docs/external-config.md` — 外部サービス設定
> - `CLAUDE.md` — プロジェクト全体の設計・開発メモ

---

## 1. 前提条件のチェック

このドキュメントを実行する前に以下がすべて揃っていることを確認する。

### Java 17 以降（Temurin 推奨）

Java 21 Temurin インストール済み。バージョン確認:

```bash
java -version
# openjdk version "21.x.x" ...
```

`keytool` コマンドも Java に同梱されている:

```bash
keytool -help
```

### Android Studio + SDK

- Android Studio がインストール済みであること
- SDK Manager で **API 34 以降**のプラットフォームをインストール済みであること

### ANDROID_HOME 環境変数

Git Bash セッションでは `ANDROID_HOME` がデフォルト設定されていない。
`~/.bashrc` または `~/.bash_profile` に以下を追記する:

```bash
# ~/.bashrc または ~/.bash_profile に追記
export ANDROID_HOME="$HOME/AppData/Local/Android/Sdk"
export PATH="$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"
```

追記後、新しいターミナルを開くか `source ~/.bashrc` で反映。確認:

```bash
echo $ANDROID_HOME
# /c/Users/<ユーザー名>/AppData/Local/Android/Sdk
```

---

## 2. 重大な注意事項

> **以下を必ず読んでから作業を開始すること。**

### キーストア紛失リスク

- **keystore を一度紛失すると、同じ `com.pomocare.app` で Play Store に更新できなくなる。**
- アプリを継続提供するためには、**新しいキーストアを発行したらすぐに 2 箇所以上にバックアップすること**（手順は [セクション 3.4](#34-バックアップ必須) を参照）。

### 旧キーストアのパスワード漏洩

- 旧キーストアのパスワードは git 履歴（commit `2e5de9be`）に平文で漏洩済み。
- **絶対に再利用しない。** 新しいキーストアには別のパスワードを設定すること。

### 新キーストア発行のタイミング

- pomocare は現時点でまだ Play Store に公開されていないため、**今のうちに新キーストアを発行することがベストタイミング**。
- 一度でも Play Store にアップロードすると、そのキーで署名した更新版しか受け付けなくなる。

---

## 3. 新 upload-keystore.jks の発行手順

### 3.1. 対話式で生成

```bash
cd /c/dev/pomocare
mkdir -p .secrets
keytool -genkey -v \
  -keystore .secrets/upload-keystore.jks \
  -keyalg RSA -keysize 2048 \
  -validity 10000 \
  -alias pomocare-upload
```

対話プロンプトで以下を入力する:

| 項目 | 入力内容 |
|-----|---------|
| キーストアのパスワード | 12 文字以上（1Password 等で生成）|
| 確認（同じパスワード） | 同上 |
| 名前（CN） | 例: `Daisuke` |
| 組織単位（OU） | 例: `URAKU` または空欄 |
| 組織（O） | 例: `URAKU Inc` または空欄 |
| 市区町村（L） | 例: `Tokyo` |
| 都道府県（ST） | 例: `Tokyo` |
| 国コード（C） | `JP` |
| 別名のパスワード | キーストアと同じ場合は Enter でスキップ可 |

### 3.2. 生成後の確認

```bash
keytool -list -v \
  -keystore .secrets/upload-keystore.jks \
  -alias pomocare-upload
```

出力例:

```
Alias name: pomocare-upload
Creation date: 2026-04-12
Entry type: PrivateKeyEntry
Certificate chain length: 1
Certificate[1]:
Owner: CN=Daisuke, OU=URAKU, O=URAKU Inc, L=Tokyo, ST=Tokyo, C=JP
Issuer: CN=Daisuke, OU=URAKU, O=URAKU Inc, L=Tokyo, ST=Tokyo, C=JP
Serial number: xxxxxxxx
Valid from: Sat Apr 12 00:00:00 JST 2026 until: Wed Nov 18 00:00:00 JST 2053
Certificate fingerprints:
         SHA1: XX:XX:XX:...
         SHA256: XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX:XX
```

**SHA-256 フィンガープリントをコピーしてメモしておく。**
後で `public/.well-known/assetlinks.json` や Google Cloud Console（Android OAuth Client ID の登録）で使用する。

### 3.3. パスワードとパスの登録

#### 方法 A: android/local.properties（推奨・ローカル開発向け）

`android/local.properties` はすでに `.gitignore` 対象。以下の 4 行を追記する:

```
POMOCARE_KEYSTORE_PATH=../../.secrets/upload-keystore.jks
POMOCARE_KEYSTORE_PASSWORD=<keystore_password>
POMOCARE_KEY_ALIAS=pomocare-upload
POMOCARE_KEY_PASSWORD=<key_password>
```

パスは `android/` ディレクトリからの相対パス。絶対パスも使用可能。

#### 方法 B: 環境変数（CI/CD 向け）

```bash
export POMOCARE_KEYSTORE_PATH="$(pwd)/.secrets/upload-keystore.jks"
export POMOCARE_KEYSTORE_PASSWORD="<keystore_password>"
export POMOCARE_KEY_ALIAS="pomocare-upload"
export POMOCARE_KEY_PASSWORD="<key_password>"
```

GitHub Actions を使う場合はリポジトリの Secrets に登録し、workflow ファイルで `env:` として展開する。

### 3.4. バックアップ（必須）

**最低 2 箇所**に以下をバックアップする。どちらか一方だけでは不十分。

#### バックアップ先 1: 1Password

1Password に以下をセットで保管する:

- `upload-keystore.jks`（添付ファイルとしてアップロード）
- キーストアパスワード（セキュアノートまたはパスワードフィールド）
- エイリアス（`pomocare-upload`）
- 発行日（2026-04-12）
- SHA-256 フィンガープリント

#### バックアップ先 2: 暗号化外部ストレージ

以下のいずれかに保管する:

- 暗号化した外付け USB / NAS
- Bitwarden（添付ファイル対応プランの場合）
- 企業向けシークレットマネージャ（AWS Secrets Manager 等）

> **注意:** クラウドストレージ（Google Drive、Dropbox 等）に平文で保管しない。
> 必ずパスワード保護された ZIP またはリポジトリ外の暗号化手段を使うこと。

---

## 4. AAB（Android App Bundle）の生成

### 4.1. Web アセットのビルド

```bash
cd /c/dev/pomocare
npm run build
```

TypeScript コンパイル + Vite ビルドが実行され、`dist/` が生成される。

### 4.2. Capacitor sync

```bash
TEMP=C:/tmp TMP=C:/tmp npx cap sync android
```

> **Windows 必須:** `TEMP=C:/tmp TMP=C:/tmp` の付与が必須。
> ユーザーの TEMP パスにマルチバイト文字（日本語等）が含まれる場合、Gradle がファイル作成に失敗する。
> 詳細は `pitfalls.md`「Windows で Android (Gradle) ビルドが TEMP パス問題で失敗する」を参照。

### 4.3. AAB ビルド

```bash
npm run android:release
```

内部で以下が実行される:

```bash
npm run build && npx cap sync android && cd android && TEMP=C:/tmp TMP=C:/tmp ./gradlew bundleRelease --no-daemon
```

成果物の出力先:

```
android/app/build/outputs/bundle/release/app-release.aab
```

### 4.4. ビルド成功確認

ファイルの存在確認:

```bash
ls -la android/app/build/outputs/bundle/release/
```

署名の確認:

```bash
jarsigner -verify -verbose android/app/build/outputs/bundle/release/app-release.aab
```

正常に署名されている場合:

```
jar verified.
```

### 4.5. デバッグ APK（動作確認用）

Play Store にアップロードする前に実機またはエミュレータで動作確認する場合:

```bash
npm run android:apk
```

成果物: `android/app/build/outputs/apk/debug/app-debug.apk`

実機にインストール（adb が使えることを確認してから実行）:

```bash
# adb のパスを通す（ANDROID_HOME 設定済みであれば不要）
export PATH="$HOME/AppData/Local/Android/Sdk/platform-tools:$PATH"

adb install android/app/build/outputs/apk/debug/app-debug.apk
```

---

## 5. Google Play Console への登録

### 5.1. 初回アプリ登録

1. [Google Play Console](https://play.google.com/console/) にログイン
2. **「アプリを作成」** をクリック
3. 以下を設定する:

| 項目 | 入力内容 |
|-----|---------|
| アプリ名 | PomoCare |
| デフォルト言語 | 日本語 |
| アプリまたはゲーム | アプリ |
| 無料または有料 | 無料 |
| 宣言 | Play アプリ署名プログラムへの登録に同意 |

### 5.2. 内部テストトラックへのアップロード

1. Play Console 左メニュー → **テスト** → **内部テスト**
2. **「新しいリリースを作成」** をクリック
3. **App Bundle をアップロード**: `android/app/build/outputs/bundle/release/app-release.aab` をドラッグ＆ドロップ
4. **リリース名**: `1.0.0`（または任意のバージョン名）
5. **リリースノート**: 自由記述（内部テスト用の説明を記載）
6. **テスター追加**: 自分の Gmail アドレスをテスターリストに追加
7. **保存** → **リリース確認** → **リリースを公開**

### 5.3. Play アプリ署名（自動）

- Google Play App Signing が自動的に有効化される。
- 今回生成した Upload key（`upload-keystore.jks`）で署名した AAB を Google が受け取り、Play Store 用の署名鍵で再署名してユーザーに配布する。
- **Upload key を紛失しても**、Google に連絡すれば再発行できる（Play App Signing の利点）。
- ただし、Upload key のバックアップは [セクション 3.4](#34-バックアップ必須) の手順で必ず行うこと。

---

## 6. ストアリスティング必要資料

Play Console でアプリを公開するために必要な資料の一覧。

| 項目 | 必須 | 現状 | 要対応 |
|-----|------|------|-------|
| アプリアイコン（512×512 PNG） | 必須 | `resources/icon.png` から生成可能 | 確認・生成 |
| 機能グラフィック（1024×500 PNG） | 必須 | なし | 新規作成が必要 |
| スクリーンショット（スマホ、最低 2 枚、推奨 1080×1920） | 必須 | `store-screenshots/` にデスクトップ向け 6 枚のみ | Android 実機またはエミュレータで新規キャプチャが必要 |
| プライバシーポリシー URL | 必須 | https://pomocare.com/privacy/ | 設定済み |
| 利用規約 URL | 任意 | https://pomocare.com/terms/ | 設定済み |
| サポート URL | 必須 | https://pomocare.com/support/ | 設定済み |
| 短い説明（80 文字以内） | 必須 | なし | 新規執筆が必要 |
| 長い説明（4000 文字以内） | 必須 | なし | 新規執筆が必要（LP の内容を流用可） |
| アプリカテゴリ | 必須 | 未選択 | 「仕事効率化」または「健康・フィットネス」から選択 |
| コンテンツレーティング | 必須 | 未回答 | アンケート回答で自動判定（全年齢対象になるはず） |
| データセーフティ | 必須 | 未申告 | 収集データの種類・目的を申告 |

### データセーフティ申告の参考

pomocare が収集・使用するデータ:

- **アカウント情報**（メールアドレス）: Google アカウントログイン時のみ
- **アプリのアクティビティ**（ポモドーロセッション記録）: クラウド同期機能使用時
- **未ログイン時**: デバイスのローカルストレージのみ使用（データ共有なし）

---

## 7. トラブルシューティング

### Gradle ビルドが Windows で落ちる

**症状**: `./gradlew bundleRelease` がエラーで停止する

**確認事項**:

1. `TEMP=C:/tmp TMP=C:/tmp` を付与しているか確認:

   ```bash
   echo $TEMP
   # C:/tmp と表示されれば OK
   ```

2. `C:/tmp` ディレクトリが存在するか確認:

   ```bash
   ls /c/tmp || mkdir -p /c/tmp
   ```

3. `ANDROID_HOME` が Git Bash セッションで設定されているか確認:

   ```bash
   echo $ANDROID_HOME
   # 空の場合は ~/.bashrc に export を追加してから source ~/.bashrc
   ```

### cap sync android が失敗する

**症状**: `npx cap sync android` がエラーで停止する

**確認事項**:

1. `dist/` が存在するか確認（先に `npm run build` を実行）:

   ```bash
   ls dist/
   ```

2. `capacitor.config.ts` の `webDir` が `dist` になっているか確認:

   ```bash
   grep webDir capacitor.config.ts
   # webDir: 'dist' と表示されれば OK
   ```

3. 依存関係が揃っているか確認:

   ```bash
   npm install
   ```

### Play Console アップロード時に署名エラーが出る

**症状**: AAB をアップロードすると「署名が無効です」等のエラーが表示される

**確認事項**:

1. AAB の署名が Upload key と一致しているか `jarsigner` で確認:

   ```bash
   jarsigner -verify -verbose android/app/build/outputs/bundle/release/app-release.aab
   # "jar verified." と表示されれば OK
   ```

2. エイリアス名が `build.gradle` の設定と一致しているか確認:

   ```bash
   grep -i alias android/app/build.gradle
   # POMOCARE_KEY_ALIAS が pomocare-upload になっているか確認
   ```

3. `android/local.properties` のパスが正しいか確認:

   ```bash
   cat android/local.properties | grep POMOCARE
   ```

### keytool コマンドが見つからない

**症状**: `keytool: command not found`

**対処**:

```bash
# Java の bin ディレクトリを PATH に追加
# Temurin 21 の場合（パスはインストール先に合わせて変更）
export PATH="/c/Program Files/Eclipse Adoptium/jdk-21.x.x-hotspot/bin:$PATH"

# または JAVA_HOME 経由で
export JAVA_HOME="/c/Program Files/Eclipse Adoptium/jdk-21.x.x-hotspot"
export PATH="$JAVA_HOME/bin:$PATH"
```

---

## 関連ドキュメント

- [`CLAUDE.md`](../CLAUDE.md) — プロジェクト全体の設計・開発メモ・コマンド一覧
- [`.secrets/README.md`](../.secrets/README.md) — キーストア・パスワードの保管方針
- `docs/external-config.md` — 外部サービス（Neon、Google Cloud 等）の設定方法

---

*最終更新: 2026-04-12*
