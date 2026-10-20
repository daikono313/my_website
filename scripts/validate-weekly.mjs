#!/usr/bin/env node
// Weekly Tech Note の機械チェック。--check-links でリンク先の到達性も確認する。
// 使い方: node scripts/validate-weekly.mjs src/content/weekly/2026-10-12.md [--check-links]
import { readFileSync } from "node:fs";
import { basename } from "node:path";

const file = process.argv[2];
const checkLinks = process.argv.includes("--check-links");
if (!file) {
  console.error("usage: validate-weekly.mjs <file> [--check-links]");
  process.exit(2);
}

const src = readFileSync(file, "utf8");
const errors = [];
const fm = src.match(/^---\n([\s\S]*?)\n---\n/);
if (!fm) errors.push("frontmatter がない");
const front = fm?.[1] ?? "";
const body = src.slice(fm?.[0].length ?? 0);
const get = (k) => front.match(new RegExp(`^${k}:\\s*(.+)$`, "m"))?.[1]?.trim();

// 期間: ファイル名 = weekStart（月曜）、weekEnd = 日曜
const weekStart = get("weekStart");
const weekEnd = get("weekEnd");
if (basename(file, ".md") !== weekStart) errors.push(`ファイル名と weekStart が一致しない (${weekStart})`);
const ws = new Date(`${weekStart}T00:00:00Z`);
const we = new Date(`${weekEnd}T00:00:00Z`);
if (ws.getUTCDay() !== 1) errors.push("weekStart が月曜ではない");
if ((we - ws) / 86400000 !== 6) errors.push("weekEnd が weekStart の6日後（日曜）ではない");
for (const k of ["title", "date", "description"]) if (!get(k)) errors.push(`${k} がない`);
if (!/^highlights:\n(\s+- .+\n){1,5}/m.test(front + "\n")) errors.push("highlights が1〜5件ない");

// 本文: 生 HTML・危険なスキーム・http リンクを禁止（コードブロックは除く）
const prose = body.replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "");
if (/<\/?[a-zA-Z][^>]*>/.test(prose)) errors.push("生の HTML タグが含まれている");
const links = [...src.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]);
for (const l of links) {
  if (!/^https:\/\//.test(l)) errors.push(`https 以外のリンク: ${l}`);
}
if (/!\[/.test(prose)) errors.push("画像の埋め込みは使わない");
for (const h of ["## 今週のアクション", "## トレンド"]) {
  if (!body.includes(h)) errors.push(`必須の見出しがない: ${h}`);
}

// リンク到達性
if (checkLinks) {
  const uniq = [...new Set(links.filter((l) => l.startsWith("https://")))];
  const results = await Promise.all(
    uniq.map(async (url) => {
      try {
        const ctrl = AbortSignal.timeout(15000);
        let res = await fetch(url, { method: "HEAD", redirect: "follow", signal: ctrl });
        if (res.status >= 400) res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15000) });
        return [url, res.status];
      } catch (e) {
        return [url, String(e.name ?? e)];
      }
    }),
  );
  for (const [url, st] of results) {
    // 403/429/999 は bot 対策のことがあるため警告にとどめる（999 は LinkedIn）
    if (st === 403 || st === 429 || st === 999) console.warn(`⚠️  ${st} ${url}`);
    else if (typeof st !== "number" || st >= 400) errors.push(`リンク切れ (${st}): ${url}`);
  }
  console.log(`links checked: ${uniq.length}`);
}

if (errors.length) {
  for (const e of errors) console.error(`❌ ${e}`);
  process.exit(1);
}
console.log(`✅ ${file}`);
