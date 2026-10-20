# 問い合わせフォームのセットアップ

フォーム（`/contact/`）→ Worker（`/api/contact`）→ Google Apps Script → Gmail（自分宛て）。すべて無料枠で動く。
送信先のアドレスは Apps Script のスクリプトプロパティにだけ置き、リポジトリ・Worker・ページには出さない。

## 1. Google Apps Script（送信先アドレスの Google アカウントで）
1. https://script.google.com で新しいプロジェクトを作り、`apps-script.gs` の内容を貼り付けて保存
2. プロジェクトの設定 → スクリプト プロパティに次の2つを追加
   - `RECIPIENT`: 送信先メールアドレス
   - `SECRET`: 長いランダム文字列（例: `openssl rand -hex 32` の出力）
3. デプロイ → 新しいデプロイ → 種類「ウェブアプリ」、実行ユーザー「自分」、アクセス「全員」→ デプロイ（初回は権限の承認が必要）
4. 表示された URL（`https://script.google.com/macros/s/…/exec`）を控える

## 2. Cloudflare Turnstile
1. Cloudflare ダッシュボード → Turnstile → ウィジェットを追加
   - ホスト名: `daisuke-harato.workers.dev`（本番とプレビューの両方を含む）
   - モード: マネージド
2. サイトキー → GitHub Variables `TURNSTILE_SITE_KEY`（公開値）
3. シークレットキー → 次の手順で Worker の Secret に入れる

## 3. Worker の Secrets（Cloudflare ダッシュボード → Workers & Pages → `de` → 設定 → 変数とシークレット）
| 名前 | 値 |
|---|---|
| `TURNSTILE_SECRET_KEY` | Turnstile のシークレットキー |
| `CONTACT_GAS_URL` | Apps Script の URL |
| `CONTACT_GAS_SECRET` | Apps Script の `SECRET` と同じ値 |

いずれも「シークレット」（暗号化）として追加する。Secrets が未設定のあいだ、送信すると「現在利用できません」と表示する。
`TURNSTILE_SITE_KEY` が未設定のビルドでは、フォーム自体を出さず「準備中」と表示する（ローカルの `npm run dev` だけ Turnstile のテスト用キーを使う）。
Preview のビルドにはサイトキーを渡していないため、Preview では「準備中」と表示される。
