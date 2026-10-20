#!/usr/bin/env bash
# 機械的に判定できるセキュリティ検査。pre-push hook と CI から実行する。
set -uo pipefail
cd "$(git rev-parse --show-toplevel)"

fail=0
ok()  { echo "✅ $1"; }
ng()  { echo "❌ $1"; fail=1; }

# 1. 秘密情報（追跡対象ファイル）
patterns='AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{50,}|sk-[A-Za-z0-9_-]{20,}|xox[abprs]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----'
if hits=$(git grep -nIE "$patterns" -- ':!scripts/security-scan.sh' 2>/dev/null); then
  ng "secret scan"; echo "$hits"
else ok "secret scan"; fi

# 2. 追跡してはいけないファイル
if bad=$(git ls-files | grep -E '(^|/)(\.env(\..*)?|\.dev\.vars|.*\.pem|.*\.p8|.*\.key|id_(rsa|ed25519)[^/]*)$'); then
  ng "forbidden files"; echo "$bad"
else ok "forbidden files"; fi

# 3. 依存ライブラリの既知脆弱性
if npm audit --audit-level=high >/tmp/npm-audit.$$ 2>&1; then ok "npm audit (high+)"
else ng "npm audit (high+)"; tail -20 /tmp/npm-audit.$$; fi
rm -f /tmp/npm-audit.$$

# 4. 配信物
if [ -d dist ]; then
  [ -z "$(find dist -name '*.map' -o -name '.env*' -o -name '*.pem')" ] && ok "dist: no sourcemap/secret files" || ng "dist: sourcemap/secret files"
  grep -rqE '<script(\s[^>]*)?>[^<]' dist --include='*.html' && ng "dist: inline script (CSP違反)" || ok "dist: no inline script"
  [ -f dist/_headers ] && grep -q 'Content-Security-Policy' dist/_headers && ok "dist: security headers" || ng "dist: security headers (_headers)"
  grep -qE "unsafe-(inline|eval)|script-src[^;]*\*" dist/_headers 2>/dev/null && ng "CSP: unsafe-inline/unsafe-eval/ワイルドカード" || ok "CSP: no unsafe-inline/eval/wildcard"
else
  ng "dist not found (npm run build を先に実行)"
fi

# 5. コンテンツ（記事・ウィークリー）: 生 HTML と危険なリンクを禁止（コードブロックは除く）
bad_content=""
for f in $(git ls-files 'src/content/*.md'); do
  prose=$(awk '/^```/{c=!c; next} !c' "$f" | sed -E 's/`[^`]*`//g')
  echo "$prose" | grep -qE '<\/?[a-zA-Z][^>]*>' && bad_content+="$f: raw HTML"$'\n'
  echo "$prose" | grep -qiE '\]\((javascript|data|vbscript):' && bad_content+="$f: dangerous link"$'\n'
done
[ -z "$bad_content" ] && ok "content: no raw HTML / dangerous links" || { ng "content"; printf "%s" "$bad_content"; }

# 6. GitHub Actions
wf=.github/workflows
if [ -d $wf ]; then
  unpinned=$(grep -hE '^\s*-?\s*uses:' $wf/*.y*ml | grep -vE '@[0-9a-f]{40}' || true)
  [ -z "$unpinned" ] && ok "actions pinned by SHA" || { ng "actions not pinned by SHA"; echo "$unpinned"; }
  grep -q 'pull_request_target' $wf/*.y*ml && ng "pull_request_target used" || ok "no pull_request_target"
  for f in $wf/*.y*ml; do grep -q '^permissions:\|^\s*permissions:' "$f" || ng "permissions missing: $f"; done
fi

exit $fail
