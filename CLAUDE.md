# my_website

## 大前提: 無料枠のみ
- **有料プラン・従量課金が発生する機能は使わない**（Cloudflare・GitHub・その他すべて）。提案や実装の前に無料枠で使えるかを確認し、上限（リクエスト数・保存期間など）がある場合はそれも明記する。
- 有料機能が必要になりそうな場合は、実装せずに無料の代替案と一緒にユーザーへ相談する。
- 現在使っている無料枠: Cloudflare Workers Free（静的アセット配信・Workers Previews）、Cloudflare Workers AI（1日 10,000 Neurons。Free プランは超過してもエラーになるだけで課金されない）、Cloudflare Web Analytics、GitHub Free（公開リポジトリの Actions・ブランチ保護）

## 運用

- GitHub アカウントは daikono313（git/gh とも自動切替済み）。
- **push / PR 作成前に必ず `/prepush-security-review` を実行する**。pre-push hook が `.security-review/<SHA>.md` の `Verdict: PASS` を要求する。PR 作成後はレポートを PR コメントに投稿する。
- リリースフロー: docs/RELEASE.md

## サイト構成

Astro の静的サイトを Cloudflare Workers（Worker 名 `de`）で配信している。本番は https://de.daisuke-harato.workers.dev

### ページ（上部バー: 左にタブ Home / Articles / Weekly、右に常設の検索欄 → `/search/?q=`）
| URL | ファイル | 内容 |
|---|---|---|
| `/` | `src/pages/index.astro` | Profile → Skills → Career → Projects → GitHub 統計 → Articles（最新3件）→ Weekly Tech Report（最新3件） |
| `/articles/` `/articles/<slug>/` | `src/pages/articles/` | 手書きの技術記事の一覧と詳細 |
| `/weekly/` `/weekly/<weekStart>/` | `src/pages/weekly/` | Weekly Tech Report の一覧と詳細（注目ポイント・前後の週へのリンク・AI 生成の注記） |
| `/search/` | `src/pages/search.astro` + `src/client/search.ts` | キーワード・種類・タグによる検索。`?q=` `?kind=` `?tag=` で条件を共有できる |
| `/search-index.json` | `src/pages/search-index.json.ts` | 検索インデックス（ビルド時に生成） |

### コンテンツとデータ
| 置き場所 | 内容 | 追加方法 |
|---|---|---|
| `src/content/articles/*.md` | 技術記事 | 手で書いて PR |
| `src/content/weekly/<weekStart>.md` | Weekly Tech Report | 毎週月曜に GitHub Actions + Workers AI が自動生成して PR → 人が確認してマージ。手動で作り直すときは skill `weekly-tech-report` |
| `src/content.config.ts` | 上記2つの frontmatter スキーマ | |
| `src/data/profile.ts` | プロフィール・スキル・経歴・強調するリポジトリ | 手で編集 |
| `src/lib/github.ts` | GitHub 統計（ビルド時に API から取得。公開リポジトリのみ） | |

### コード構成
- `src/layouts/Base.astro`: 全ページ共通（head、タブ、フッター、本番だけ Web Analytics）
- `src/components/`: `SiteNav`（タブ）、`PageHeader`（見出し）、`PostCards`（トップのカード）、`PostList`（一覧）、`TagList`（タグ → タグ検索へのリンク）
- `src/lib/posts.ts`: 記事とウィークリーを共通の `Post` 型で扱う（一覧・トップ・検索で共用）
- `src/styles/global.css`: スタイルはこの1ファイル。色は `:root` の変数で、ダークモードに対応
- `scripts/weekly/`: Weekly Tech Report の自動生成（`sources.mjs` 情報源 / `collect.mjs` 収集 / `generate.mjs` Workers AI で生成・描画 / `auto-review.sh` 自動診断レポート）。AI には項目 ID だけを返させ、リンクはスクリプトが収集した URL から差し込む

### 守ること
- **CSP**（`public/_headers`）: インラインのスクリプト・スタイルは使わない（`style="..."` も不可）。スクリプトは `src/client/` に置き、Astro に外部ファイルとして出力させる
- クライアント JS で DOM を組み立てるときは `textContent` を使い、`innerHTML` は使わない
- コンテンツの Markdown に生の HTML・`javascript:` リンクを書かない（`scripts/security-scan.sh` が検出する）

