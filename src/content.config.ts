import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";
import { BLOG_CATEGORY_LABELS } from "./lib/blog-categories";

// 手書きの技術記事
const articles = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/articles" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
    // 以下は SEO・AIO 用（任意）。書き方は skill `seo-aio-article`
    updated: z.coerce.date().optional(), // 内容を更新した日。表示と構造化データの dateModified に使う
    summary: z.array(z.string()).min(1).max(5).optional(), // 冒頭に出す「この記事の要点」（プレーンテキスト）
    faq: z.array(z.object({ q: z.string(), a: z.string() })).max(8).optional(), // 末尾の「よくある質問」と FAQPage 構造化データ（プレーンテキスト）
  }),
});

// Claude ルーティンが毎週生成するテックレポート（ファイル名は週の開始日 YYYY-MM-DD.md）
const weekly = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/weekly" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(), // 生成日
    weekStart: z.coerce.date(),
    weekEnd: z.coerce.date(),
    description: z.string(),
    highlights: z.array(z.string()).min(1).max(5), // 今週の注目ポイント（プレーンテキスト）
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
  }),
});

// ブログ（技術・減量記録・その他）。書き方は docs/blog.md
// 本文は Zenn などへ持ち出せるよう、素の Markdown だけで書く（生 HTML・Astro コンポーネントは使わない）
const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string(),
        description: z.string(), // 検索結果と SNS 共有で表示される要約（120 字程度）
        pubDate: z.coerce.date(),
        updatedDate: z.coerce.date().nullish(), // 更新したときだけ
        category: z.enum(BLOG_CATEGORY_LABELS),
        tags: z.array(z.string()).default([]),
        draft: z.boolean().default(false), // true は本番ビルドに出さない（一覧・記事・RSS・サイトマップ・検索すべて）
        affiliate: z.boolean().default(false), // true はタイトル直下に PR 表記を自動で出す（本文に手書きしない）
        image: image().optional(), // OGP・記事冒頭の画像（任意）。src/content/blog/images/ に置く
        imageAlt: z.string().optional(),
      })
      .refine((d) => !d.image || !!d.imageAlt?.trim(), { message: "image を指定したら imageAlt（代替テキスト）も書く", path: ["imageAlt"] }),
});

export const collections = { articles, weekly, blog };
