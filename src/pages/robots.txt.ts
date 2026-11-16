import type { APIRoute } from "astro";

// 検索エンジン・AI のクローラーとも、公開ページはすべて許可する（AI の回答で引用されることも目的に含むため）
// /api/ は Worker の受け口なので対象外にする
export const GET: APIRoute = ({ site }) => {
  const sitemap = new URL("/sitemap.xml", site ?? "http://localhost").href;
  const body = ["User-agent: *", "Allow: /", "Disallow: /api/", "", `Sitemap: ${sitemap}`, ""].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
