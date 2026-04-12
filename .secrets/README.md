# .secrets/ — PomoCare 秘密情報ディレクトリ

このディレクトリは Android 署名キーストアなど、リポジトリに含めてはならない秘密情報を置く場所です。

**.gitignore によってこのディレクトリ全体が Git 追跡から除外されています。**
いかなるファイルもコミットしないでください。

---

## 置くべきファイル

| ファイル名 | 用途 |
|------------|------|
| `upload-keystore.jks` | Google Play Store アップロード用署名キーストア |

---

## 署名キーストアの設定方法

署名情報は以下の 2 通りのいずれかで設定します。
`android/app/build.gradle` が `local.properties` → 環境変数の優先順で読み込みます。

### a) android/local.properties に追記（推奨・ローカル開発向け）

`android/local.properties` はすでに `.gitignore` 対象です。以下の 4 行を追記してください。

```
POMOCARE_KEYSTORE_PATH=../../.secrets/upload-keystore.jks
POMOCARE_KEYSTORE_PASSWORD=xxxxx
POMOCARE_KEY_ALIAS=pomocare-upload
POMOCARE_KEY_PASSWORD=xxxxx
```

パスは `android/` ディレクトリからの相対パス、または絶対パスで指定できます。

### b) 環境変数で設定（CI/CD 向け）

```bash
export POMOCARE_KEYSTORE_PATH=/abs/path/to/upload-keystore.jks
export POMOCARE_KEYSTORE_PASSWORD=xxxxx
export POMOCARE_KEY_ALIAS=pomocare-upload
export POMOCARE_KEY_PASSWORD=xxxxx
```

CI/CD（GitHub Actions 等）ではリポジトリの Secrets に登録し、workflow で環境変数として展開してください。

---

## パスワードの扱いについて

このディレクトリや `local.properties` に平文でパスワードを書いても `.gitignore` によって保護されます。
ただし、**外部シークレット管理ツールを使うことを強く推奨します。**

推奨ツール例:
- 1Password（添付ファイルでキーストア本体も保管可能）
- Bitwarden
- Windows 認証情報マネージャー

**このREADMEファイル自体にはパスワードを書かないでください。**
README は誤ってコミットされる可能性があるため、パスワード記載は厳禁です。

---

## キーストア紛失リスクについて

Play Store にアップロード済みのアプリは、**同じ署名キー以外では更新できません。**

キーストアを紛失した場合、同じ `applicationId`（`com.pomocare.app`）で Play Store に再アップロードできなくなります。
アプリを継続提供するためには、**キーストアのバックアップを 2 箇所以上に保管してください。**

推奨バックアップ先（2 箇所以上):
- 1Password の添付ファイル
- 暗号化済み外部ストレージ（外付けHDD、USB等）

---

## 履歴漏洩について

旧キーストアのパスワードは git 履歴（commit `2e5de9be`）に平文で漏洩済みです。

**新しいキーストアを発行した際は、古いキーストアを絶対に再利用しないでください。**

git 履歴から旧パスワードを削除する作業（`git filter-repo` / BFG Repo-Cleaner）は別途対応が必要です。

---

## 新キーストアの発行手順

`docs/android-release.md` を参照してください（T2.2 で作成予定）。

---

Last updated: 2026-04-12
