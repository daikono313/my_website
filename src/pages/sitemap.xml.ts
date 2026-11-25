import type { APIRoute } from "astro";
import { getArticles, getWeeklies, getBlogPosts } from "../lib/posts";

// 検索エンジン向けのサイトマップ（ビルド時に静的生成）。依存を増やさないよう自前で書く
// 404・検索結果（noindex）は含めない
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export const GET: APIRoute = async ({ site }) => {
  const base = site ?? new URL("http://localhost");
  const [articles, weeklies, blogPosts] = await Promise.all([getArticles(), getWeeklies(), getBlogPosts()]);
  const blogDate = (b: (typeof blogPosts)[number]) => b.data.updatedDate ?? b.data.pubDate;
  const latest = (dates: Date[]) => (dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : undefined);

  const entries: { path: string; lastmod?: Date }[] = [
    { path: "/", lastmod: latest([...articles.map((a) => a.data.updated ?? a.data.date), ...weeklies.map((w) => w.data.date), ...blogPosts.map(blogDate)]) },
    { path: "/articles/", lastmod: latest(articles.map((a) => a.data.updated ?? a.data.date)) },
    ...articles.map((a) => ({ path: `/articles/${a.id}/`, lastmod: a.data.updated ?? a.data.date })),
    { path: "/blog/", lastmod: latest(blogPosts.map(blogDate)) },
    ...blogPosts.map((b) => ({ path: `/blog/${b.id}/`, lastmod: blogDate(b) })),
    { path: "/weekly/", lastmod: latest(weeklies.map((w) => w.data.date)) },
    ...weeklies.map((w) => ({ path: `/weekly/${w.id}/`, lastmod: w.data.date })),
    { path: "/contact/" },
    { path: "/privacy/" },
  ];

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries.map(
      (e) =>
        `  <url><loc>${esc(new URL(e.path, base).href)}</loc>${e.lastmod ? `<lastmod>${e.lastmod.toISOString().slice(0, 10)}</lastmod>` : ""}</url>`,
    ),
    "</urlset>",
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
};
