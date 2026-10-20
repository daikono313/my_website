#!/usr/bin/env node
// 情報源から対象週の項目を集めて JSON で出力する（AI は使わない）
// 使い方: node scripts/weekly/collect.mjs [--week YYYY-MM-DD] > items.json
// GH_TOKEN があれば GitHub API のレート制限が緩くなる
import { SOURCES } from "./sources.mjs";
import { resolveWeek, inWeek, parseFeed, stripHtml, truncate, isHttps, decode } from "./lib.mjs";

const arg = process.argv.indexOf("--week");
const week = resolveWeek(arg > 0 ? process.argv[arg + 1] : undefined);
const UA = "Mozilla/5.0 (compatible; de-weekly-report/1.0; +https://de.daisuke-harato.workers.dev)";

async function get(url, accept) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, ...(accept ? { Accept: accept } : {}) },
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

const collectors = {
  async feed(src) {
    return parseFeed(await get(src.url))
      .filter((e) => e.date && inWeek(e.date, week))
      .filter((e) => !src.include || src.include.test(`${e.title} ${e.text}`));
  },

  // Snowflake はフィードがないため、一覧ページの日付入りリンクから個別ページを取得する
  async "snowflake-notes"(src) {
    const html = await get(src.url);
    const paths = [...new Set([...html.matchAll(/href="(\/en\/release-notes\/\d{4}\/[^"#]*?(\d{4}-\d{2}-\d{2})[^"#]*)"/g)].map((m) => `${m[1]}|${m[2]}`))];
    const items = [];
    for (const p of paths) {
      const [path, ymd] = p.split("|");
      const date = new Date(`${ymd}T12:00:00+09:00`);
      if (!inWeek(date, week)) continue;
      const url = new URL(path, src.url).href;
      try {
        const page = await get(url);
        const title = stripHtml(page.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? page.match(/<title>([^<]*)/i)?.[1] ?? path);
        const desc = decode(page.match(/<meta name="description" content="([^"]*)"/i)?.[1] ?? "");
        items.push({ title: title.replace(/\s*\|\s*Snowflake Documentation$/, ""), url, date, text: desc });
      } catch {
        items.push({ title: path.split("/").pop(), url, date, text: "" });
      }
    }
    return items;
  },

  async "github-releases"(src) {
    const headers = { "User-Agent": UA, Accept: "application/vnd.github+json" };
    const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`https://api.github.com/repos/${src.repo}/releases?per_page=15`, { headers, signal: AbortSignal.timeout(30000) });
    if (!res.ok) throw new Error(`${res.status} ${src.repo}`);
    return (await res.json())
      .filter((r) => !r.draft && inWeek(new Date(r.published_at), week))
      .map((r) => ({
        title: `${src.repo.split("/")[1]} ${r.tag_name}${r.prerelease ? "（pre-release）" : ""}`,
        url: r.html_url,
        date: new Date(r.published_at),
        text: (r.body ?? "").replace(/\r/g, ""),
      }));
  },
};

const LIMITS = { platform: 1200, oss: 3000, ai: 1200, blog: 400 }; // 1項目あたりの本文の最大文字数
const items = [];
const coverage = [];
await Promise.all(
  SOURCES.map(async (src) => {
    try {
      const found = (await collectors[src.type](src)).filter((e) => isHttps(e.url) && e.title);
      found.forEach((e) =>
        items.push({
          category: src.category,
          source: src.name,
          title: truncate(e.title, 200),
          url: e.url,
          date: e.date.toISOString(),
          text: truncate(e.text, LIMITS[src.category]),
        }),
      );
      coverage.push({ source: src.name, category: src.category, status: found.length ? "updated" : "no-updates", count: found.length });
    } catch (e) {
      coverage.push({ source: src.name, category: src.category, status: "failed", error: String(e.message ?? e) });
    }
  }),
);

items.sort((a, b) => a.category.localeCompare(b.category) || a.date.localeCompare(b.date));
items.forEach((it, i) => (it.id = `i${i + 1}`));
coverage.sort((a, b) => a.category.localeCompare(b.category) || a.source.localeCompare(b.source));
process.stdout.write(JSON.stringify({ weekStart: week.weekStart, weekEnd: week.weekEnd, items, coverage }, null, 2));
console.error(`collected ${items.length} items (${coverage.filter((c) => c.status === "failed").length} sources failed)`);
