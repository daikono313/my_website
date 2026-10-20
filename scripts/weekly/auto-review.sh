#!/usr/bin/env bash
# 自動生成したウィークリーの診断レポートを .security-review/<SHA>.md に書く（GitHub Actions から実行）
# 前段のステップ（validate-weekly --check-links / build / security-scan）がすべて成功したときだけ呼ばれる
set -euo pipefail
file="$1"; items="$2"
sha=$(git rev-parse HEAD); base=$(git rev-parse origin/main)
mkdir -p .security-review
cat > ".security-review/$sha.md" <<MD
## 🔒 Pre-push Security Review（Weekly Tech Report 自動生成）

Verdict: PASS
- Commit: \`$sha\` / Base: \`$base\`
- 対象範囲: \`$file\`（コンテンツのみ。Cloudflare Workers AI が収集 $items 件から生成）
- 制約: 自動診断のみ。内容の正しさ（AI の要約・影響度の判断）は、マージ前に人が確認する

### 自動検査
| 検査 | 結果 |
|---|---|
| validate-weekly（形式・生 HTML・https 以外のリンク・リンク切れ） | ✅ |
| npm run build（frontmatter スキーマ） | ✅ |
| security-scan（秘密情報・配信物・CSP・コンテンツの生 HTML/危険なリンク） | ✅ |

### 観点別
| # | 区分 | 判定 | メモ |
|---|---|---|---|
| A | 入力→出力 | OK | リンクは収集した項目の URL だけをスクリプトが差し込む。AI の文字列は HTML・リンク・強調記法を無効化してから埋め込む |
| F | 情報漏えい | OK | 公開情報の要約だけで、秘密情報は扱わない |
| その他 | | N/A | コード・設定の変更なし |

### Findings
なし（AI の誤要約・誤った影響度は、レビューで確認すること）
MD
echo ".security-review/$sha.md"
