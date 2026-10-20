# アクセス分析（Workers Analytics Engine）

ページ表示を Workers Analytics Engine に記録し、SQL で分析する。無料枠のみ（書き込み 1日10万件・クエリ 1日1万回、保持 3か月）。

## 仕組み
```
ブラウザ（src/client/pv.ts、本番のみ）── sendBeacon ──▶ POST /api/pv（src/worker.ts）── writeDataPoint ──▶ dataset my_website_pageviews
                                                                                           ▲
                                                         npm run pv -- "<SQL>"（SQL API）──┘
```
- 静的配信は今までどおり Worker を通さない。Worker が動くのは `/api/pv` だけ
- 無料枠（Workers 1日10万リクエスト）を超えても、記録と問い合わせフォームが止まるだけでページ表示は止まらない
- JavaScript を実行しないクローラーは記録されない。`/api/pv` は誰でも送れるので、厳密な数値ではなく傾向を見る用途

## 列
| 列 | 内容 |
|---|---|
| `timestamp` | 記録時刻（UTC） |
| `blob1` | パス（例: `/weekly/2026-10-12/`）。クエリ文字列は含まない |
| `blob2` | 流入元のホスト名（自サイト内の遷移・直接アクセスは空） |
| `blob3` | 国コード（Cloudflare 判定） |
| `blob4` | `desktop` / `mobile` / `bot`（User-Agent から判定） |
| `blob5` | ホスト名（本番は `de.daisuke-harato.workers.dev`） |
| `_sample_interval` | サンプリング倍率。件数は `COUNT()` ではなく `SUM(_sample_interval)` で数える |

IP アドレス・User-Agent の全文・リファラーの URL 全体・Cookie は保存しない。

## 初期設定（済）
- アカウントで Analytics Engine を有効化済み（未有効だと `wrangler deploy` が code 10089、SQL API が 403 で失敗する。Preview のデプロイでは検出されない）

## 使い方
読み取り専用トークン（`CLAUDE.md` の cf CLI と同じもの。Account Analytics: Read を含む）を使う。
```bash
npm run pv -- scripts/analytics/queries/top-pages.sql   # よく見られているページ
npm run pv -- scripts/analytics/queries/daily.sql       # 日別の推移
npm run pv -- scripts/analytics/queries/referrers.sql   # 流入元
npm run pv -- "SELECT blob3 AS country, SUM(_sample_interval) AS views FROM my_website_pageviews GROUP BY country ORDER BY views DESC"
```
SQL の文法: https://developers.cloudflare.com/analytics/analytics-engine/sql-reference/
