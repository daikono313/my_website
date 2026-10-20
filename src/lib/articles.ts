import { getCollection } from "astro:content";

// 公開対象の記事を新しい順に返す（draft は本番ビルドから除外）
export async function getArticles() {
  const all = await getCollection("articles", ({ data }) => import.meta.env.DEV || !data.draft);
  return all.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export const fmtDate = (d: Date) =>
  d.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" });
