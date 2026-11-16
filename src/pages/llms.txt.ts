import type { APIRoute } from "astro";
import { profile } from "../data/profile";
import { getArticles, getWeeklies, fmtDate } from "../lib/posts";

// AI 向けのサイト案内（https://llmstxt.org の形式）。ビルド時に静的生成する
// タイトル・説明は frontmatter のプレーンテキストをそのまま使う
const line = (s: string) => s.replace(/\s+/g, " ").trim();

export const GET: APIRoute = async ({ site }) => {
  const base = site ?? new URL("http://localhost");
  const url = (path: string) => new URL(path, base).href;
  const [articles, weeklies] = await Promise.all([getArticles(), getWeeklies()]);

  const body = [
    `# ${profile.name}`,
    "",
    `> ${line(profile.summary)}`,
    "",
    `${profile.name}（${profile.title}）の個人サイト。手書きの技術記事と、データ基盤・OSS・AI×データの動きを毎週まとめた Weekly Tech Note（AI が作成し、人が確認して公開）を載せている。`,
    "",
    "## Articles",
    "",
    ...articles.map((a) => `- [${line(a.data.title)}](${url(`/articles/${a.id}/`)}): ${line(a.data.description)}（${fmtDate(a.data.updated ?? a.data.date)}）`),
    "",
    "## Weekly Tech Note",
    "",
    ...weeklies.map((w) => `- [${line(w.data.title)}](${url(`/weekly/${w.id}/`)}): ${line(w.data.description)}`),
    "",
    "## Optional",
    "",
    `- [プロフィール](${url("/")}): 経歴・スキル・GitHub での活動`,
    `- [検索インデックス](${url("/search-index.json")}): 全記事のタイトル・説明・タグ・本文（JSON）`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
