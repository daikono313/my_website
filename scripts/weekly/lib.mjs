// Weekly Tech Note 用の共通処理（週の計算・HTML/フィードの簡易パース・文字列の無害化）

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

// ステータス: リリースノートの表記（タイトル → 本文の冒頭の順）から決める。AI の判断は使わない
// 「Preview」とだけ書かれたものは、公開されたリリースノートでの告知なので Public Preview として扱う
// 判定は上から順に行う（例: 「will soon be generally available」は GA ではなく「今後の変更」）。どれにも当たらなければ「Other News」
export const STATUS_ORDER = ["非推奨・廃止", "今後の変更", "変更", "GA", "Public Preview", "Private Preview", "Beta", "Other News"];
const STATUS_RULES = [
  ["非推奨・廃止", /deprecat|retire|legacy model|end of (life|support)|sunset|廃止|非推奨/i],
  ["今後の変更", /\bwill\b|upcoming|coming soon|scheduled to|今後|予定/i],
  ["Private Preview", /private preview|限定プレビュー|プライベートプレビュー/i],
  ["Public Preview", /public preview|パブリックプレビュー/i],
  ["Beta", /\bbeta\b|ベータ/i],
  ["Public Preview", /\bpreview\b|プレビュー/i],
  ["GA", /generally available|general availability|\(ga\)|\bga\b|一般提供/i],
  ["変更", /breaking change|behavior change|no longer|default behavior|動作の変更|破壊的変更/i],
];
const matchStatus = (s) => STATUS_RULES.find(([, re]) => re.test(s))?.[0];
export const statusOf = (it) => matchStatus(it.title) ?? matchStatus((it.text ?? "").slice(0, 300)) ?? "Other News";

// OSS のリリース種別: バージョン番号から決める（x.0.0 = メジャー、x.y.0 = マイナー、それ以外 = パッチ）
export function releaseKind(title) {
  if (/pre-release|プレリリース|-rc|\brc\d|alpha|beta|\.dev\d|\d(a|b|rc)\d+\b/i.test(title)) return "プレリリース";
  const m = title.match(/(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!m) return "リリース";
  const [, , minor, patch = "0"] = m;
  if (minor === "0" && patch === "0") return "メジャー";
  return patch === "0" ? "マイナー" : "パッチ";
}
