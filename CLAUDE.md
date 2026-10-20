# my_website

## 大前提: 無料枠のみ
- **有料プラン・従量課金が発生する機能は使わない**（Cloudflare・GitHub・その他すべて）。提案や実装の前に無料枠で使えるかを確認し、上限（リクエスト数・保存期間など）がある場合はそれも明記する。
- 有料機能が必要になりそうな場合は、実装せずに無料の代替案と一緒にユーザーへ相談する。
- 現在使っている無料枠: Cloudflare Workers Free（静的アセット配信・Workers Previews）、Cloudflare Web Analytics、GitHub Free（公開リポジトリの Actions・ブランチ保護）

## 運用

- GitHub アカウントは daikono313（git/gh とも自動切替済み）。
- **push / PR 作成前に必ず `/prepush-security-review` を実行する**。pre-push hook が `.security-review/<SHA>.md` の `Verdict: PASS` を要求する。PR 作成後はレポートを PR コメントに投稿する。
- リリースフロー: docs/RELEASE.md
