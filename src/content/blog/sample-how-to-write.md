---
title: "【サンプル】ブログ記事の書き方（frontmatter の例）"
description: "ブログ記事を書くときの frontmatter と本文の書き方を示すサンプルです。draft: true なので本番には表示されません。"
pubDate: 2026-11-25
category: "技術"        # 技術 / 減量記録 / その他
tags: ["サンプル"]
draft: true             # true の間は本番（一覧・記事・RSS・サイトマップ・検索）に出ない。npm run dev では表示される
affiliate: false        # true にするとタイトル直下に PR 表記が自動で出る。本文には書かない
updatedDate: null       # 内容を更新したときだけ日付を書く（例: 2026-12-01）
# image: ./images/sample-how-to-write/flow.svg   # OGP・記事冒頭の画像（任意）。SNS 共有用は PNG/JPG（1200×630 推奨）。指定するなら imageAlt も必須
# imageAlt: "下書き、PR で確認、マージで公開の 3 段階の流れ"
---

この記事は、ブログ記事の書き方を示すためのサンプルです。内容は仮の文章です。

## 見出しは ## から始める

記事のタイトルは frontmatter の `title` がページの見出し（h1）になるので、本文の見出しは `##` から始めます。

## 本文は素の Markdown で書く

後から別のサービスへ転載できるよう、本文は一般的な Markdown だけで書きます。生の HTML やサイト独自の部品は使いません。

- 箇条書き
- **強調**
- [リンク](https://docs.astro.build/)

```bash
npm run dev
```

## 画像は代替テキストを必ず書く

画像は `src/content/blog/images/<記事のファイル名>/` に置き、本文から相対パスで参照します。`![ ]` の中の代替テキストを空にするとビルドが失敗します。

![下書き、PR で確認、マージで公開の 3 段階の流れ](./images/sample-how-to-write/flow.svg)
