# ブログの書き方

`/blog/` に載せる記事（カテゴリ: 技術 / 減量記録 / その他）の書き方。手書きの技術記事（`/articles/`）・Weekly Tech Note（`/weekly/`）とは別のコレクション。

## 1 本書く手順

1. `main` から作業ブランチを切る（例: `blog/2026-12-02-dbt-tips`）
2. `src/content/blog/<slug>.md` を作る。`<slug>` は英小文字とハイフン（URL `/blog/<slug>/` になる。公開後は変えない）。サンプル `src/content/blog/sample-how-to-write.md` をコピーすると早い
3. frontmatter を書く（下の表）。書き上がるまでは `draft: true`
4. 画像を使うなら `src/content/blog/images/<slug>/` に置き、本文から `![代替テキスト](./images/<slug>/xxx.png)` で参照する
5. `npm run dev` → http://localhost:4321/blog/<slug>/ で確認（dev では下書きも表示され、「下書き」バッジが付く）
6. 公開するときは `draft: false` にして PR → CI の Workers Preview（PR にコメントされる URL）で確認 → マージで本番に出る

## frontmatter

```yaml
---
title: "記事タイトル"
description: "検索結果と SNS 共有で表示される要約（120 字程度）"
pubDate: 2026-11-25
category: "技術"        # 技術 / 減量記録 / その他 のどれか（それ以外はビルドエラー）
tags: ["Databricks"]    # 既存タグの表記に合わせる（/search/ のタグ一覧で確認）
draft: true             # true の記事は本番の一覧・記事ページ・RSS・サイトマップ・検索・llms.txt から除外
affiliate: false        # true にするとタイトル直下に PR 表記を自動で出す
updatedDate: null       # 内容を更新したときだけ日付を書く
# image: ./images/<slug>/cover.png   # 任意。OGP と記事冒頭に使う。PNG/JPG（1200×630 推奨）
# imageAlt: "画像の説明"             # image を書いたら必須
---
```

## 守ること

- **本文は素の Markdown だけ**で書く。生の HTML・Astro コンポーネント・`javascript:` リンクは使わない（`scripts/security-scan.sh` が検出する。技術記事を Zenn へそのまま転載できるようにするため）
- **画像の代替テキストは必須**。`![](…)` のように空だと、下書きでもビルドが失敗する（`src/lib/posts.ts` の `assertImageAlt`）
- 見出しは `##` から（`title` がページの h1 になる）
- **PR／広告表記は本文に手書きしない**。`affiliate: true` にすればテンプレートが出す
- 実在しない ID・広告コードを入れない。個人情報（住所・勤務先の内部情報・契約金額など）を書かない

## アフィリエイトリンクを入れるとき（ASP 登録後）

- リンクが入った記事は `affiliate: true` にする（景品表示法のステルスマーケティング規制への対応。表記はタイトル直下に自動で出る）
- リンクは Markdown のテキストリンク `[商品名](https://...)` で書く
- ASP が発行する **バナー（`<a><img>`）や計測用の 1×1 画像・`<script>` はそのままでは使えない**。生 HTML は禁止で、CSP（`public/_headers`）も外部画像・外部スクリプトを許可していない。必要になったら、許可するドメインと検査の見直しを別の PR で相談する
- 広告リンクに `rel="sponsored"` を付ける仕組みはまだない（Markdown のリンクには付けられない）。必要なら別の PR で追加する
