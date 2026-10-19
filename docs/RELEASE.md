# リリースフロー

| # | フェーズ | 実施内容 | 担保する仕組み |
|---|---------|----------|----------------|
| 1 | 開発 | `main` から `feat/*` `fix/*` `chore/*` ブランチを切る。`npm run dev` で確認 | — |
| 2 | 診断 | Claude Code で `/prepush-security-review` → `.security-review/<SHA>.md` に Verdict 出力 | skill |
| 3 | push | `git push`。レポートが PASS でない／自動検査失敗ならブロック | `.githooks/pre-push`、Claude hook（`--no-verify` 禁止） |
| 4 | PR | テンプレートに沿って作成し、診断レポートを PR コメントに投稿 | `.github/pull_request_template.md` |
| 5 | CI | build + `scripts/security-scan.sh` | `.github/workflows/ci.yml` |
| 6 | マージ | CI green・セルフレビュー後に squash merge | ブランチ保護（推奨） |
| 7 | デプロイ | `main` push で Cloudflare Workers へ自動デプロイ。毎日 06:00 JST に GitHub 活動を再取得して再デプロイ | `.github/workflows/deploy.yml` |
| 8 | 確認・切り戻し | 本番 URL 表示確認。問題時は `git revert` → PR、緊急時は `npx wrangler rollback` | Cloudflare バージョン管理 |

## 初回セットアップ
- `npm install`（`prepare` で `core.hooksPath=.githooks` を設定）
- GitHub Secrets: `CLOUDFLARE_API_TOKEN`（Edit Cloudflare Workers テンプレート）、`CLOUDFLARE_ACCOUNT_ID`
- GitHub Environment `production` を作成（必要なら承認者を設定）
