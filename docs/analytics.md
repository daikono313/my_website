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

### 仮想ビュー `pageviews`
Analytics Engine の SQL API は `CREATE VIEW` と日本語の列名に対応していないため、`npm run pv` が次のように補う。
- SQL 中の `FROM pageviews` を `scripts/analytics/view.sql` のサブクエリに展開する（本番ホストのみ・時刻は日本時間）
- 出力の見出しを日本語に置き換える

| 列 | 表示名 | 内容 |
|---|---|---|
| `time` | 日時 | 記録時刻（日本時間） |
| `day` | 日付 | 記録日（日本時間） |
| `path` | ページ | パス |
| `referrer` | 流入元 | 流入元のホスト名（空は `-` と表示） |
| `country` | 国 | 国コード |
| `device` | 端末 | `desktop` / `mobile` / `bot` |
| `weight` | 件数 | サンプリング倍率。件数は `SUM(weight)` で数える |
| `views` | 表示数 | 集計結果に `AS views` と付けるとこの見出しになる |

```bash
npm run pv -- scripts/analytics/queries/recent.sql      # 直近のアクセス一覧
npm run pv -- scripts/analytics/queries/top-pages.sql   # よく見られているページ（7日）
npm run pv -- scripts/analytics/queries/daily.sql       # 日別の推移（30日）
npm run pv -- scripts/analytics/queries/referrers.sql   # 流入元（30日）
npm run pv -- "SELECT country, SUM(weight) AS views FROM pageviews GROUP BY country ORDER BY views DESC"
```
元の表（`my_website_pageviews`、列は `blob1` など）もそのまま指定できる。
SQL の文法: https://developers.cloudflare.com/analytics/analytics-engine/sql-reference/
