#!/usr/bin/env bash
# Claude が pre-push hook を迂回する push をしないようにする
cmd=$(jq -r '.tool_input.command // ""')
if echo "$cmd" | grep -qE 'git\b.*\bpush\b.*(--no-verify|\s-n\b)|core\.hooksPath'; then
  echo "pre-push のセキュリティ検査を迂回する操作は禁止です。/prepush-security-review を実行してから通常の git push をしてください。" >&2
  exit 2
fi
exit 0
