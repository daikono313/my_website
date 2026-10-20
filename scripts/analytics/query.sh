#!/usr/bin/env bash
# Workers Analytics Engine（ページ表示の記録）に SQL を実行する
# 使い方: npm run pv -- "SELECT ..."   または   npm run pv -- scripts/analytics/queries/top-pages.sql
# 認証: CLOUDFLARE_API_TOKEN（Account Analytics: Read を含む読み取り専用トークン）/ CLOUDFLARE_ACCOUNT_ID。direnv がキーチェーンから読み込む
set -euo pipefail
: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN が未設定です（docs/analytics.md）}"
: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID が未設定です}"
sql="${1:?SQL またはファイルパスを指定してください}"
[[ -f "$sql" ]] && sql=$(cat "$sql")
# SQL API の出力形式は JSON / JSONEachRow / TabSeparated のみ。列名付きの表にするため JSON を受けて整形する
curl -sS --fail-with-body "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/analytics_engine/sql" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  --data-binary "$sql FORMAT JSON" |
  jq -r '([.meta[].name] | @tsv), (.data[] | [.[]] | @tsv)' | column -t -s $'\t'

