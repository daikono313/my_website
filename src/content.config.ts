import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

// 手書きの技術記事
const articles = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/articles" }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string(),
    tags: z.array(z.string()).default([]),
    draft: z.boolean().default(false),
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

export const collections = { articles, weekly };
