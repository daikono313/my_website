import type { APIRoute } from "astro";
import { profile } from "../data/profile";
import { getAllPosts, KINDS } from "../lib/posts";

// 記事と Weekly Tech Note の RSS 2.0 フィード（ビルド時に静的生成）。フィードリーダーや AI の収集向け
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export const GET: APIRoute = async ({ site }) => {
  const base = site ?? new URL("http://localhost");
  const posts = (await getAllPosts()).slice(0, 50);
  const items = posts.map((p) => {
    const url = new URL(p.url, base).href;
    return [
      "    <item>",
      `      <title>${esc(p.title)}</title>`,
      `      <link>${esc(url)}</link>`,
      `      <guid isPermaLink="true">${esc(url)}</guid>`,
      `      <description>${esc(p.description)}</description>`,
      `      <category>${esc(KINDS[p.kind].label)}</category>`,
      ...p.tags.map((t) => `      <category>${esc(t)}</category>`),
      `      <pubDate>${p.date.toUTCString()}</pubDate>`,
      "    </item>",
    ].join("\n");
  });
  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${esc(profile.name)}</title>`,
    `    <link>${esc(new URL("/", base).href)}</link>`,
    `    <atom:link href="${esc(new URL("/rss.xml", base).href)}" rel="self" type="application/rss+xml" />`,
    `    <description>${esc(`${profile.summary}技術記事と Weekly Tech Note の更新情報。`)}</description>`,
    "    <language>ja</language>",
    ...(posts[0] ? [`    <lastBuildDate>${posts[0].date.toUTCString()}</lastBuildDate>`] : []),
    ...items,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "application/rss+xml; charset=utf-8" } });
};
