import type { APIRoute } from "astro";

// 検索エンジン・AI のクローラーとも、公開ページはすべて許可する（AI の回答で引用されることも目的に含むため）
// /api/ は Worker の受け口なので対象外にする
// Content-Signal（Cloudflare が提唱する利用目的の表明）: 検索と AI の回答への利用は許可。学習（ai-train）は表明しない（許可も制限もしない）
export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL("/sitemap.xml", site ?? "http://localhost").href;
  const body = [
    "User-agent: *",
    "Content-Signal: search=yes, ai-input=yes",
    "Allow: /",
    "Disallow: /api/",
    "",
    `Sitemap: ${sitemap}`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
