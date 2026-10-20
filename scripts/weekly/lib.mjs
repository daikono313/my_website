// Weekly Tech Report 用の共通処理（週の計算・HTML/フィードの簡易パース・文字列の無害化）

const JST = 9 * 3600 * 1000;
const DAY = 86400 * 1000;

// 対象週（JST の月曜〜日曜）。weekStart 未指定なら「実行日の前週」
export function resolveWeek(weekStartArg, now = new Date()) {
  let start;
  if (weekStartArg) {
    start = new Date(`${weekStartArg}T00:00:00+09:00`);
  } else {
    const jstNow = new Date(now.getTime() + JST);
    const dow = (jstNow.getUTCDay() + 6) % 7; // 月曜=0
    const thisMonday = Date.UTC(jstNow.getUTCFullYear(), jstNow.getUTCMonth(), jstNow.getUTCDate()) - dow * DAY;
    start = new Date(thisMonday - 7 * DAY - JST);
  }
  const end = new Date(start.getTime() + 7 * DAY); // 翌週月曜 00:00 JST（未満）
  const ymd = (d) => new Date(d.getTime() + JST).toISOString().slice(0, 10);
  return { start, end, weekStart: ymd(start), weekEnd: ymd(new Date(end.getTime() - DAY)), ymd };
}

export const inWeek = (date, week) => date >= week.start && date < week.end;

export const mmdd = (d) => new Date(d.getTime() + JST).toISOString().slice(5, 10).replace("-", "/");

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'" };
export const decode = (s) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z#0-9]+);/gi, (m, e) => ENTITIES[e.toLowerCase()] ?? m);

export const stripHtml = (s) => decode(decode(s).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

const tag = (xml, name) => xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"))?.[1];

// RSS 2.0 / Atom の簡易パース
export function parseFeed(xml) {
  const blocks = [...xml.matchAll(/<(item|entry)[\s>][\s\S]*?<\/\1>/gi)].map((m) => m[0]);
  return blocks.map((b) => {
    const link =
      tag(b, "link")?.trim() ||
      b.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/i)?.[1] ||
      b.match(/<link[^>]*href="([^"]+)"/i)?.[1] ||
      "";
    const date = tag(b, "pubDate") ?? tag(b, "published") ?? tag(b, "updated") ?? tag(b, "dc:date");
    return {
      title: stripHtml(tag(b, "title") ?? ""),
      url: decode(link).trim(),
      date: date ? new Date(stripHtml(date)) : null,
      text: stripHtml(tag(b, "description") ?? tag(b, "summary") ?? tag(b, "content") ?? tag(b, "content:encoded") ?? ""),
    };
  });
}

export const truncate = (s, n) => (s.length > n ? s.slice(0, n) + "…" : s);

export const isHttps = (u) => {
  try {
    return new URL(u).protocol === "https:";
  } catch {
    return false;
  }
};

// AI が生成した文字列を Markdown の地の文として安全にする（HTML・リンク・強調記法を無効化し、1行にする）
export const safeText = (s) =>
  String(s ?? "")
    .replace(/\s+/g, " ")
    .replace(/[<>]/g, (c) => (c === "<" ? "＜" : "＞"))
    .replace(/[\[\]`|*_]/g, (c) => `\\${c}`)
    .trim();

// frontmatter（プレーンテキストとして表示される値）用: 記法として解釈されうる記号を全角に置き換える
export const plainLine = (s) =>
  String(s ?? "")
    .replace(/\s+/g, " ")
    .replace(/[<>\[\]()`*_|]/g, (c) => ({ "<": "＜", ">": "＞", "[": "［", "]": "］", "(": "（", ")": "）", "`": "'", "*": "", _: " ", "|": "｜" })[c])
    .trim();
