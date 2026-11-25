// ブログのカテゴリ。frontmatter には label（日本語）を書き、URL の絞り込み（/blog/?category=）には slug を使う
// content.config.ts からも読むため、astro:content を import しない
export const BLOG_CATEGORIES = [
  { label: "技術", slug: "tech" },
  { label: "減量記録", slug: "diet" },
  { label: "その他", slug: "other" },
] as const;

export type BlogCategory = (typeof BLOG_CATEGORIES)[number]["label"];

export const BLOG_CATEGORY_LABELS = BLOG_CATEGORIES.map((c) => c.label) as [BlogCategory, ...BlogCategory[]];

export const categorySlug = (label: BlogCategory) => BLOG_CATEGORIES.find((c) => c.label === label)!.slug;

export const categoryHref = (label: BlogCategory) => `/blog/?category=${categorySlug(label)}`;
