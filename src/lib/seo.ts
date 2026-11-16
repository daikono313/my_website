import { profile } from "../data/profile";

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
  jobTitle: profile.title,
  url: new URL("/", site).href,
  sameAs: profile.links.map((l) => l.href),
});

export const websiteLd = (site: URL) => ({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": new URL("/#website", site).href,
      name: profile.name,
      url: new URL("/", site).href,
      inLanguage: "ja",
      description: profile.summary,
      author: { "@id": new URL("/#person", site).href },
    },
    personLd(site),
  ],
});

export const articleLd = (
  site: URL,
  a: { url: URL; title: string; description: string; published: Date; modified?: Date; tags: string[] },
) => ({
  "@context": "https://schema.org",
  "@type": "TechArticle",
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
