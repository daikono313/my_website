# my_website

自己紹介・経歴・GitHub 活動をまとめた個人サイト。Astro で静的生成し、Cloudflare Workers (Static Assets) で配信。

- 自己紹介・スキル・経歴: `src/data/profile.ts` を編集
- GitHub 活動: ビルド時に GitHub API から取得（`GH_TOKEN` があればコントリビューションカレンダーも表示）
- デプロイ: `main` への push と毎日 06:00 JST に GitHub Actions が再ビルド＆デプロイ

## ローカル開発

```sh
nvm use          # Node 22
npm install
npm run dev      # http://localhost:4321
npm run preview  # wrangler dev で本番相当を確認
```

## デプロイ設定（初回のみ）

GitHub リポジトリの Secrets に以下を登録:

- `CLOUDFLARE_API_TOKEN` — テンプレート「Edit Cloudflare Workers」で作成
- `CLOUDFLARE_ACCOUNT_ID`

## 記事を書く

`src/content/articles/<slug>.md` を追加すると `/articles/<slug>/` として公開される。

```md
---
title: タイトル
date: 2026-10-20
description: 一覧やカードに出る概要
tags: [Astro, Cloudflare]
draft: true   # true の間は本番ビルドに含まれない（npm run dev では表示）
---
```
