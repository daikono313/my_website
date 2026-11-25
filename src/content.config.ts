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
    affiliate: z.boolean().default(false), // 広告（アフィリエイトリンク）を含むなら true。タイトル直下に PR 表記を自動で出す
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
    affiliate: z.boolean().default(false), // 広告を含むなら true（人が確認時に付ける。AI の自動生成では付けない）
  }),
});

export const collections = { articles, weekly };
