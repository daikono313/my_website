import type { APIRoute } from "astro";
import { profile } from "../data/profile";
import { getArticles, getWeeklies, getBlogPosts, fmtDate } from "../lib/posts";

// AI 向けのサイト案内（https://llmstxt.org の形式）。ビルド時に静的生成する
// タイトル・説明は frontmatter のプレーンテキストをそのまま使う
const line = (s: string) => s.replace(/\s+/g, " ").trim();

export const GET: APIRoute = async ({ site }) => {
  const base = site ?? new URL("http://localhost");
  const url = (path: string) => new URL(path, base).href;
  const [articles, weeklies, blogPosts] = await Promise.all([getArticles(), getWeeklies(), getBlogPosts()]);

  const body = [
    `# ${profile.name}`,
    "",
    `> ${line(profile.summary)}`,
    "",
    `${profile.name}（${profile.title}／${profile.titleJa}）の個人サイト。手書きの技術記事、技術・減量記録などのブログ、データ基盤・OSS・AI×データの動きを毎週まとめた Weekly Tech Note（AI が作成し、人が確認して公開）を載せている。`,
    "",
    "## Articles",
    "",
    ...articles.map((a) => `- [${line(a.data.title)}](${url(`/articles/${a.id}/`)}): ${line(a.data.description)}（${fmtDate(a.data.updated ?? a.data.date)}）`),
    "",
    "## Blog",
    "",
    ...blogPosts.map((b) => `- [${line(b.data.title)}](${url(`/blog/${b.id}/`)}): ${line(b.data.description)}（${b.data.category}・${fmtDate(b.data.updatedDate ?? b.data.pubDate)}）`),
    "",
    "## Weekly Tech Note",
    "",
    ...weeklies.map((w) => `- [${line(w.data.title)}](${url(`/weekly/${w.id}/`)}): ${line(w.data.description)}`),
    "",
    "## Optional",
    "",
    `- [プロフィール](${url("/")}): 経歴・スキル・GitHub での活動`,
    `- [技術記事の全文](${url("/llms-full.txt")}): 技術記事の本文をまとめた Markdown`,
    `- [RSS](${url("/rss.xml")}): 記事・ブログ・Weekly Tech Note の更新情報`,
    `- [検索インデックス](${url("/search-index.json")}): 全記事のタイトル・説明・タグ・本文（JSON）`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
