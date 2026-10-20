---
name: prepush-security-review
description: push 前の脆弱性診断。git push / PR 作成の前に必ず実行する。差分とサイト全体を観点リストで診断し、.security-review/<HEAD SHA>.md にレポートを出力する（pre-push hook がこのレポートの Verdict: PASS を要求する）。
---

# Pre-push Security Review

## 手順

1. **対象確定**: `BASE=$(git merge-base HEAD origin/main 2>/dev/null || git hash-object -t tree /dev/null)`、`git diff --stat $BASE..HEAD` で差分を把握。差分外でも設定・配信物は全体を見る。
2. **自動検査**: `npm run build && bash scripts/security-scan.sh`。失敗はすべて Finding にする。
3. **手動レビュー**: 下の観点を差分→全体の順に確認。各観点を `OK / NG / N/A(理由)` で判定。
   - 「確認できなかった」と「存在しない」を区別する。
4. **修正**: Critical/High は原則このブランチで修正し、同じ手順で再確認（修正確認は攻撃系と正常系を対にする）。
5. **レポート出力**: 下のテンプレートで `.security-review/$(git rev-parse HEAD).md` に書く。修正コミットを積んだら HEAD が変わるので再出力。
6. **PR**: PR 作成後、`gh pr comment <PR> --body-file .security-review/<SHA>.md` で結果を投稿。

## 観点（MECE）

| # | 区分 | 確認内容 |
|---|------|----------|
| A | 入力→出力（注入） | 外部入力（HTTP・API応答・ファイル・環境変数）の Source→Sink を追う。XSS: 自動エスケープ迂回（`set:html`/`innerHTML`/`|safe`）、`href`等の URL スキーム検証。SQLi・OS Command・SSTI・Path Traversal・XML/デシリアライズ。入力値検証は Allow List。ファイルアップロード。SSRF: 利用者指定の接続先に fetch しない |
| B | 認証・セッション | パスワード保存・列挙・試行制限・MFA。Cookie 属性・固定化・失効・SECRET 管理 |
| C | 認可・API | オブジェクト/機能単位の認可、IDOR、Deny by Default。API の入出力プロパティ明示・処理量上限 |
| D | ブラウザ境界 | CSRF: unsafe method のトークン検証。セキュリティヘッダー: CSP・frame-ancestors・nosniff・Referrer-Policy・Permissions-Policy・HSTS。CORS: Origin 反射禁止・完全一致。クライアント側: eval・postMessage・Web Storage の秘密情報 |
| E | ビジネスロジック | 不変条件・状態遷移・冪等性・競合 |
| F | 情報漏えい | 秘密情報（トークン・鍵・.env）のコミット/配信物混入、ソースマップ、詳細エラー、バージョン露出、不要な個人情報 |
| G | サプライチェーン | `npm audit` High 以上なし、lock file コミット、新規依存の名前・配布元確認、Actions は SHA 固定・最小 permissions・`pull_request_target` 不使用 |
| H | デプロイ・設定 | 秘密情報は Secrets/環境変数のみ、配信物に不要ファイルなし、404/エラー時の挙動、本番設定 |
| I | ログ・監視 | 機密情報をログに出さない、失敗検知（デプロイ失敗通知等） |

本サイトは静的サイト（サーバー処理・認証・DBなし）のため B/C/E は通常 N/A。ただし機能追加で該当したら必ず確認する。

## 重大度

Critical（即時悪用・秘密漏えい） / High（XSS 等の実害） / Medium（多層防御の欠如） / Low / Info

**Verdict: FAIL** = 未修正の Critical/High がある、または自動検査が失敗。それ以外は **PASS**。

## レポートテンプレート

```markdown
## 🔒 Pre-push Security Review

Verdict: PASS
- Commit: <SHA> / Base: <BASE>
- 対象範囲: <差分ファイル数・主な変更>
- 制約: <確認できなかった事項。なければ「なし」>

### 自動検査
| 検査 | 結果 |
|---|---|
| secret scan | ✅ |
| npm audit (high+) | ✅ |
| 配信物（sourcemap/秘密/inline script） | ✅ |
| Actions（SHA固定/permissions） | ✅ |

### 観点別
| # | 区分 | 判定 | メモ |
|---|---|---|---|
| A | 入力→出力 | OK | |
| ... |

### Findings
| ID | 重大度 | 箇所 | 内容（観測事実→影響） | 対応 | 状態 |
|---|---|---|---|---|---|
| F-1 | Medium | `file:line` | ... | ... | Fixed in <sha> / Open |
```
