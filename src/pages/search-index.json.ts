import type { APIRoute } from "astro";
import { getAllPosts, plainText, fmtDate, KINDS } from "../lib/posts";

// クライアント側検索用のインデックス（ビルド時に静的生成）
export const GET: APIRoute = async () => {
  const posts = await getAllPosts();
  const index = posts.map((p) => ({
    kind: p.kind,
    kindLabel: KINDS[p.kind].label,
    url: p.url,
    title: p.title,
    date: fmtDate(p.date),
    description: p.description,
    tags: p.tags,
    text: plainText(p.body).slice(0, 5000),
  }));
  return new Response(JSON.stringify(index), { headers: { "Content-Type": "application/json; charset=utf-8" } });
};
