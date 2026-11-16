import type { APIRoute } from "astro";
import { profile } from "../data/profile";
import { getArticles, fmtDate } from "../lib/posts";

// AI 向けに、技術記事の本文（Markdown）をまとめた 1 ファイル（llms.txt の補足。https://llmstxt.org）
// Weekly Tech Note は AI 生成で量も多いため含めず、llms.txt のリンクに留める
export const GET: APIRoute = async ({ site }) => {
  const base = site ?? new URL("http://localhost");
  const articles = await getArticles();
  const parts = [
    `# ${profile.name} の技術記事（全文）`,
    "",
    `> ${profile.name}（${profile.titleJa}）が書いた技術記事の本文。各記事の出典 URL を明記している。`,
    "",
    ...articles.flatMap((a) => [
      "---",
      "",
      `# ${a.data.title}`,
      "",
      `- URL: ${new URL(`/articles/${a.id}/`, base).href}`,
      `- 公開: ${fmtDate(a.data.date)}${a.data.updated ? ` / 更新: ${fmtDate(a.data.updated)}` : ""}`,
      `- 著者: ${profile.name}`,
      `- 概要: ${a.data.description}`,
      ...(a.data.summary ? ["- 要点:", ...a.data.summary.map((s) => `  - ${s}`)] : []),
      "",
      (a.body ?? "").trim(),
      "",
      ...(a.data.faq?.length ? ["## よくある質問", "", ...a.data.faq.flatMap((f) => [`**Q. ${f.q}**`, "", f.a, ""])] : []),
    ]),
  ];
  return new Response(parts.join("\n"), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
