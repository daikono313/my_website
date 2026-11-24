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

// 例: "Oct 05, 2026: Enforce CoCo policy with MDM ( Preview ) ¶" → "Enforce CoCo policy with MDM (Preview)"
const cleanSnowflakeTitle = (t) =>
  t
    .replace(/\s*\|\s*Snowflake Documentation$/, "")
    .replace(/¶/g, "")
    .replace(/^[A-Z][a-z]+\.? \d{1,2}, \d{4}:\s*/, "")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .trim();

// 記事ページから本文の冒頭を取る（海外ブログのフィードは要約が短く、AI が中身を判断できないため）
// 説明文（og:description / description）と、<article>（なければ <main>）内の段落をつなげる。取れなければ空
async function articleText(url) {
  try {
    const page = await get(url, "text/html");
    const meta = (name) =>
      decode(page.match(new RegExp(`<meta[^>]+(?:name|property)="${name}"[^>]+content="([^"]*)"`, "i"))?.[1] ?? "");
    const desc = meta("og:description") || meta("description");
    const scope = page.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1] ?? page.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? "";
    const paras = [...scope.replace(/<(script|style|nav|figure|aside)[\s\S]*?<\/\1>/gi, " ").matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((m) => stripHtml(m[1]))
      .filter((t) => t.length > 40);
    return [desc, ...paras].filter(Boolean).join(" ");
  } catch {
    return "";
  }
}

const ENRICH_BELOW = 800; // フィードの本文がこれより短い海外ブログは、記事ページから補う

const collectors = {
  async feed(src) {
    const urls = src.urls ?? [src.url];
    const entries = (await Promise.all(urls.map(async (u) => parseFeed(await get(u))))).flat();
    const found = entries
      .filter((e) => e.date && inWeek(e.date, week))
      .filter((e) => !src.include || src.include.test(`${e.title} ${e.text}`));
    if (src.category === "blog" && src.region === "global") {
      // 1 件ずつ順に取る（同じサイトへ同時に大量のリクエストを送らない）
      for (const e of found) {
        if (e.text.length < ENRICH_BELOW && isHttps(e.url)) {
          const more = await articleText(e.url);
          if (more.length > e.text.length) e.text = more;
        }
      }
    }
    return found;
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
        // description がないページは本文から取る（本文が空だと AI が隣の項目の内容で要約を埋めてしまう）
        const body = desc || stripHtml((page.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1] ?? "").replace(/<(script|style|nav)[\s\S]*?<\/\1>/gi, " "));
        items.push({ title: cleanSnowflakeTitle(title), url, date, text: body.replace(/^.*?¶\s*/, "") });
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
        // タグにプロジェクト名が含まれていれば重ねない（例: apache-arrow-26.0.0）
        title: `${r.tag_name.toLowerCase().includes(src.repo.split("/")[1].toLowerCase()) ? r.tag_name : `${src.repo.split("/")[1]} ${r.tag_name}`}${r.prerelease ? "（pre-release）" : ""}`,
        url: r.html_url,
        date: new Date(r.published_at),
        text: (r.body ?? "").replace(/\r/g, ""),
      }));
  },
};

// 1項目あたりの本文の最大文字数。海外ブログは英語で情報量が少なく見えやすいので長めに渡す
const LIMITS = { platform: 1200, oss: 3000, ai: 1200, blog: 400, "blog:global": 1500 };
const items = [];
const coverage = [];
await Promise.all(
  SOURCES.map(async (src) => {
    try {
      const found = (await collectors[src.type](src)).filter((e) => isHttps(e.url) && e.title);
      found.forEach((e) =>
        items.push({
          category: src.category,
          ...(src.region ? { region: src.region } : {}),
          source: src.name,
          title: truncate(e.title, 200),
          url: e.url,
          date: e.date.toISOString(),
          text: truncate(e.text, LIMITS[`${src.category}:${src.region}`] ?? LIMITS[src.category]),
        }),
      );
      coverage.push({ source: src.name, category: src.category, status: found.length ? "updated" : "no-updates", count: found.length });
    } catch (e) {
      coverage.push({ source: src.name, category: src.category, status: "failed", error: String(e.message ?? e) });
    }
  }),
);

items.sort((a, b) => a.category.localeCompare(b.category) || a.date.localeCompare(b.date));
// 同じ収集元に同じタイトルが複数ページで載ることがある（例: Databricks の製品別と月別のリリースノート）ので1件にする
const seen = new Set();
const unique = items.filter((it) => !seen.has(`${it.source}\n${it.title}`) && seen.add(`${it.source}\n${it.title}`));
unique.forEach((it, i) => (it.id = `i${i + 1}`));
coverage.sort((a, b) => a.category.localeCompare(b.category) || a.source.localeCompare(b.source));
process.stdout.write(JSON.stringify({ weekStart: week.weekStart, weekEnd: week.weekEnd, items: unique, coverage }, null, 2));
console.error(`collected ${unique.length} items, ${items.length - unique.length} duplicates removed (${coverage.filter((c) => c.status === "failed").length} sources failed)`);
