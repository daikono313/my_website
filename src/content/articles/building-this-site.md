---
title: Astro + Cloudflare Workers で個人サイトを作り、push 前のセキュリティ診断を仕組み化した
date: 2026-10-20
description: 静的サイトの構成と、push 前に脆弱性診断を必須にするリリースフローのまとめ。
tags: [Astro, Cloudflare, Security, GitHub Actions]
---

自己紹介・経歴・GitHub 活動・技術記事をまとめる個人サイトを作りました。構成と、push 前のセキュリティ診断を仕組みとして必須にした方法を書きます。

## 構成

| 役割 | 採用したもの |
|---|---|
| サイト生成 | Astro（静的出力） |
| 配信 | Cloudflare Workers Static Assets |
| デプロイ | GitHub Actions（main への push と毎日の定期実行） |
| GitHub の統計 | ビルド時に GitHub GraphQL API から取得 |

サーバーで処理を行わないので、攻撃面は「配信する HTML/CSS」と「ビルド・デプロイの経路」だけになります。

## GitHub の統計はビルド時に取得する

コミット数やマージ数は、ビルド時に GraphQL でまとめて取得して HTML に埋め込みます。

```ts
const json = await gql(
  `query($login: String!, $from: DateTime!, $to: DateTime!, $q: String!) {
    user(login: $login) {
      contributionsCollection(from: $from, to: $to) {
      commitContributionsByRepository(maxRepositories: 100) {
        repository { isPrivate }
        contributions { totalCount }
      }
    }
    }
    merged: search(query: $q, type: ISSUE, first: 1) { issueCount }
  }`,
  { login, from, to, q: `author:${login} is:pr is:merged is:public merged:>=${since}` },
);
```

ブラウザから API を呼ばないため、トークンが配信物に混ざらず、CSP も厳しく設定できます。

## セキュリティヘッダー

Cloudflare の `_headers` で、すべてのレスポンスにヘッダーを付けています。

```text
Content-Security-Policy: default-src 'none'; style-src 'self'; img-src 'self'; ...
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
```

`style-src 'self'` を守るため、Astro の CSS インライン化を無効にし、コードハイライトも inline style を出す Shiki ではなく、class ベースの Prism を使っています。

## push 前の診断を「必須」にする

ルールを決めるだけでは、そのうち守られなくなります。そこで、守らないと先へ進めない仕組みにしました。

1. **診断 skill**: Claude Code の skill として、観点（注入・認証・認可・ブラウザ境界・情報漏えい・サプライチェーンなど）とレポート形式を定義する
2. **pre-push hook**: push するコミットの診断レポートが `Verdict: PASS` でなければ push を止める
3. **迂回の禁止**: Claude Code の hook で `git push --no-verify` を禁止する
4. **CI**: PR とデプロイの前に、同じ自動検査（秘密情報、`npm audit`、配信物、Actions の SHA 固定）を実行する

診断結果は PR にコメントとして残るので、あとから「何を確認して出したか」を追えます。
