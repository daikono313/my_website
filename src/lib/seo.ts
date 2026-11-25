import { profile, skills } from "../data/profile";

// 構造化データ（JSON-LD）と SEO 用メタ情報の組み立て。
// JSON-LD は <script type="application/ld+json"> に入れる。実行されないデータなので CSP の script-src には掛からないが、
// 中身に "</script>" などが入ると HTML として壊れる（注入になる）ため、必ず jsonLd() を通して出力する。

type Json = string | number | boolean | null | Json[] | { [k: string]: Json | undefined };

/** HTML の <script> 内に安全に置ける JSON 文字列にする（<, >, &, U+2028/2029 をエスケープ）。 */
export const jsonLd = (data: Json): string =>
  JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");

const iso = (d: Date) => d.toISOString();

export const personLd = (site: URL) => ({
  "@type": "Person",
  "@id": new URL("/#person", site).href,
  name: profile.name,
  ...(profile.nameJa ? { alternateName: profile.nameJa } : {}),
  jobTitle: [profile.title, profile.titleJa],
  description: profile.summary,
  knowsAbout: [...profile.topics, ...skills.flatMap((s) => s.items)],
  url: new URL("/", site).href,
  sameAs: profile.links.map((l) => l.href),
});

const ref = (site: URL, id: string) => ({ "@id": new URL(`/#${id}`, site).href });

/** トップページ: 人物のプロフィールページ */
export const profilePageLd = (site: URL, modified?: Date) => ({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "ProfilePage",
      url: new URL("/", site).href,
      name: `${profile.name}｜${profile.titleJa}`,
      inLanguage: "ja",
      ...(modified ? { dateModified: modified.toISOString() } : {}),
      mainEntity: ref(site, "person"),
      isPartOf: ref(site, "website"),
    },
    {
      "@type": "WebSite",
      "@id": new URL("/#website", site).href,
      name: profile.name,
      url: new URL("/", site).href,
      inLanguage: "ja",
      description: profile.summary,
      author: ref(site, "person"),
    },
    personLd(site),
  ],
});

/** 一覧ページ: 記事の集まり */
export const collectionLd = (
  site: URL,
  c: { url: URL; name: string; description: string; items: { url: string; name: string }[] },
) => ({
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  url: c.url.href,
  name: c.name,
  description: c.description,
  inLanguage: "ja",
  isPartOf: ref(site, "website"),
  mainEntity: {
    "@type": "ItemList",
    itemListElement: c.items.map((it, i) => ({ "@type": "ListItem", position: i + 1, url: new URL(it.url, site).href, name: it.name })),
  },
});

/** パンくず。items は上の階層から順に（最後が現在のページ） */
export const breadcrumbLd = (site: URL, items: { name: string; path: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, item: new URL(it.path, site).href })),
});

export const contactPageLd = (site: URL, url: URL, description: string) => ({
  "@context": "https://schema.org",
  "@type": "ContactPage",
  url: url.href,
  name: `お問い合わせ｜${profile.name}`,
  description,
  inLanguage: "ja",
  isPartOf: ref(site, "website"),
  about: ref(site, "person"),
});

export const articleLd = (
  site: URL,
  a: { url: URL; title: string; description: string; published: Date; modified?: Date; tags: string[]; type?: "TechArticle" | "BlogPosting"; image?: string },
) => ({
  "@context": "https://schema.org",
  "@type": a.type ?? "TechArticle",
  ...(a.image ? { image: a.image } : {}),
  headline: a.title,
  description: a.description,
  url: a.url.href,
  mainEntityOfPage: a.url.href,
  inLanguage: "ja",
  datePublished: iso(a.published),
  dateModified: iso(a.modified ?? a.published),
  keywords: a.tags.join(", "),
  author: personLd(site),
  publisher: { "@id": new URL("/#person", site).href },
});

export const faqLd = (faq: { q: string; a: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
});
