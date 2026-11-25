import { getCollection, type CollectionEntry } from "astro:content";

// 記事（articles）とウィークリー（weekly）を一覧・検索で同じ形に揃えて扱う
export type PostKind = "articles" | "weekly";

export const KINDS: Record<PostKind, { label: string; path: string }> = {
  articles: { label: "Articles", path: "/articles/" },
  weekly: { label: "Weekly Tech Note", path: "/weekly/" },
};

export type Post = {
  kind: PostKind;
  id: string;
  url: string;
  title: string;
  date: Date;
  description: string;
  tags: string[];
  body: string;
};

export type ArticleEntry = CollectionEntry<"articles">;
export type WeeklyEntry = CollectionEntry<"weekly">;

// draft は本番ビルドから除外し、新しい順に並べる
const published = ({ data }: { data: { draft: boolean } }) => import.meta.env.DEV || !data.draft;

export async function getArticles(): Promise<ArticleEntry[]> {
  const all = await getCollection("articles", published);
  return all.sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

export async function getWeeklies(): Promise<WeeklyEntry[]> {
  const all = await getCollection("weekly", published);
  return all.sort((a, b) => b.data.weekStart.getTime() - a.data.weekStart.getTime());
}

const toPost = (kind: PostKind, e: ArticleEntry | WeeklyEntry): Post => ({
  kind,
  id: e.id,
  url: `${KINDS[kind].path}${e.id}/`,
  title: e.data.title,
  date: e.data.date,
  description: e.data.description,
  tags: e.data.tags,
  body: e.body ?? "",
});

export async function getPosts(kind: PostKind): Promise<Post[]> {
  return kind === "articles"
    ? (await getArticles()).map((e) => toPost("articles", e))
    : (await getWeeklies()).map((e) => toPost("weekly", e));
}

export async function getAllPosts(): Promise<Post[]> {
  const [a, w] = await Promise.all([getPosts("articles"), getPosts("weekly")]);
  return [...a, ...w].sort((x, y) => y.date.getTime() - x.date.getTime());
}

export const fmtDate = (d: Date) =>
  d.toLocaleDateString("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" });

export const fmtPeriod = (start: Date, end: Date) => `${fmtDate(start)} 〜 ${fmtDate(end)}`;

// 検索用に Markdown からおおまかに本文テキストだけを取り出す
export const plainText = (md: string) =>
  md
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_`|~-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
