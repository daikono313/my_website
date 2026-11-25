import { getCollection, type CollectionEntry } from "astro:content";

// 記事（articles）・ウィークリー（weekly）・ブログ（blog）を一覧・検索で同じ形に揃えて扱う
export type PostKind = "articles" | "weekly" | "blog";

export const KINDS: Record<PostKind, { label: string; path: string }> = {
  articles: { label: "Articles", path: "/articles/" },
  weekly: { label: "Weekly Tech Note", path: "/weekly/" },
  blog: { label: "Blog", path: "/blog/" },
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
export type BlogEntry = CollectionEntry<"blog">;

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

// ブログ本文の画像は代替テキスト必須。![](…) ・ ![ ][ref] のように空なら、下書きも含めてビルドを失敗させる
const EMPTY_ALT = /!\[\s*\](?=[(\[])/;
const assertImageAlt = (entries: BlogEntry[]) => {
  const bad = entries.filter((e) => EMPTY_ALT.test((e.body ?? "").replace(/```[\s\S]*?```/g, "").replace(/`[^`\n]*`/g, "")));
  if (bad.length) throw new Error(`画像に代替テキストがありません（![説明](パス) の形で書く）: ${bad.map((e) => e.filePath ?? e.id).join(", ")}`);
};

export async function getBlogPosts(): Promise<BlogEntry[]> {
  const all = await getCollection("blog");
  assertImageAlt(all);
  return all.filter(published).sort((a, b) => b.data.pubDate.getTime() - a.data.pubDate.getTime());
}

const toPost = (kind: PostKind, e: ArticleEntry | WeeklyEntry | BlogEntry): Post => ({
  kind,
  id: e.id,
  url: `${KINDS[kind].path}${e.id}/`,
  title: e.data.title,
  date: "pubDate" in e.data ? e.data.pubDate : e.data.date,
  description: e.data.description,
  tags: e.data.tags,
  body: e.body ?? "",
});

export async function getPosts(kind: PostKind): Promise<Post[]> {
  const entries = kind === "articles" ? await getArticles() : kind === "weekly" ? await getWeeklies() : await getBlogPosts();
  return entries.map((e) => toPost(kind, e));
}

export async function getAllPosts(): Promise<Post[]> {
  const lists = await Promise.all((Object.keys(KINDS) as PostKind[]).map(getPosts));
  return lists.flat().sort((x, y) => y.date.getTime() - x.date.getTime());
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
