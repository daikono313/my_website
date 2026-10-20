# リリースフロー

| # | フェーズ | 実施内容 | 担保する仕組み |
|---|---------|----------|----------------|
| 1 | 開発 | `main` から `feat/*` `fix/*` `chore/*` ブランチを切る。`npm run dev` で確認 | — |
| 2 | 診断 | Claude Code で `/prepush-security-review` → `.security-review/<SHA>.md` に Verdict 出力 | skill |
| 3 | push | `git push`。レポートが PASS でない／自動検査失敗ならブロック | `.githooks/pre-push`、Claude hook（`--no-verify` 禁止） |
| 4 | PR | テンプレートに沿って作成し、診断レポートを PR コメントに投稿 | `.github/pull_request_template.md` |
| 5 | CI・プレビュー | build + `scripts/security-scan.sh`。通過後、Workers Preview（`pr-<番号>-de.<subdomain>.workers.dev`）を作成・更新して URL を PR にコメント。PR を閉じると削除 | `.github/workflows/ci.yml` |
| 6 | マージ | CI green・プレビュー確認・セルフレビュー後に squash merge | ブランチ保護（PR 必須・`build-and-scan` 必須・管理者にも適用・force push 禁止） |
| 7 | デプロイ | `main` push で Cloudflare Workers へ自動デプロイ。毎日 06:00 JST に GitHub 活動を再取得して再デプロイ | `.github/workflows/deploy.yml` |
| 8 | 確認・切り戻し | 本番 URL 表示確認。問題時は `git revert` → PR、緊急時は `npx wrangler rollback` | Cloudflare バージョン管理 |

## Weekly Tech Report
| # | 実施内容 | 担保する仕組み |
|---|----------|----------------|
| 1 | 毎週月曜 08:00 JST に `weekly-report.yml` が前週分を収集し、Cloudflare Workers AI（無料枠）で生成する | GitHub Actions（schedule）。手動実行は Actions 画面から `week` を指定 |
| 2 | `validate-weekly --check-links`・build・`security-scan` がすべて通ったら、自動診断レポートを作って push → PR → 診断結果をコメント → bot の PR で承認待ちになる CI（`build-and-scan`・Preview）を承認 | ワークフロー内のステップ、pre-push hook |
| 3 | Preview URL で内容と影響度を確認し、問題なければマージする（AI の誤りは公開前にここで止める）。質が足りなければ skill `weekly-tech-report` で Claude が書き直す | ブランチ保護（PR 必須・CI 必須） |

## 初回セットアップ
- `npm install`（`prepare` で `core.hooksPath=.githooks` を設定）
- GitHub Secrets: `CLOUDFLARE_API_TOKEN`（Edit Cloudflare Workers テンプレート）、`CLOUDFLARE_ACCOUNT_ID`
- GitHub Secrets: `CLOUDFLARE_AI_TOKEN`（Workers AI 権限だけのトークン。Weekly の自動生成用）
- GitHub Actions の設定で「Actions に PR の作成を許可」を有効にする（Weekly の自動 PR 用）
- 問い合わせフォーム（手順の詳細は `docs/contact/README.md`）
  - Cloudflare Turnstile のウィジェットを作り、サイトキーを GitHub Variables `TURNSTILE_SITE_KEY` に、シークレットキーを Worker の Secret `TURNSTILE_SECRET_KEY` に設定
  - `docs/contact/apps-script.gs` を Google Apps Script にデプロイし、URL と合言葉を Worker の Secrets `CONTACT_GAS_URL` / `CONTACT_GAS_SECRET` に設定
- GitHub Variables: `CF_ANALYTICS_TOKEN`（Cloudflare Web Analytics のサイト token。本番デプロイ時のみ埋め込む）
- GitHub Environment `production` を作成（必要なら承認者を設定）
- Preview URL は既定で公開。限定したい場合は Cloudflare Access で保護
