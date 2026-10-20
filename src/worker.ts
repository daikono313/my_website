// Worker のエントリポイント。静的ファイルは assets がそのまま返し、/api/* だけがここに来る（wrangler.jsonc の run_worker_first）
// /api/contact: 問い合わせフォーム（概要・メールアドレス・内容）を受け付け、Turnstile で検証してから Google Apps Script に転送する（Apps Script が Gmail で自分宛てに送る）

interface Env {
  ASSETS: Fetcher;
  TURNSTILE_SECRET_KEY?: string; // Cloudflare Turnstile のシークレットキー
  CONTACT_GAS_URL?: string; // Apps Script ウェブアプリの URL（https://script.google.com/macros/s/.../exec）
  CONTACT_GAS_SECRET?: string; // Apps Script と共有する合言葉
}

const LIMITS = { subject: 100, email: 254, message: 5000 };
// 返信先として使えるかの最低限の形式チェック（空白・改行・山括弧を含まない、@ とドットがある）
const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/;

// 制御文字を除き、前後の空白を落とす（件名は改行も除く）
const clean = (v: FormDataEntryValue | null, singleLine: boolean) =>
  String(v ?? "")
    .replace(singleLine ? /[\u0000-\u001f\u007f]/g : /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, singleLine ? " " : "")
    .trim();

// Worker が返すレスポンスにも、静的ファイル（public/_headers）と同等のセキュリティヘッダーを付ける
const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Cache-Control": "no-store",
};
const reply = (body: string | null, status: number, headers: Record<string, string> = {}) =>
  new Response(body, { status, headers: { ...SECURITY_HEADERS, ...headers } });

const back = (req: Request, status: "sent" | string) => {
  const url = new URL("/contact/", req.url);
  url.searchParams.set(status === "sent" ? "sent" : "error", status === "sent" ? "1" : status);
  return reply(null, 303, { Location: url.pathname + url.search });
};

async function verifyTurnstile(token: string, secret: string, ip: string | null): Promise<boolean> {
  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);
  if (ip) body.append("remoteip", ip);
  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body });
  const data = (await res.json()) as { success?: boolean };
  return data.success === true;
}

async function handleContact(req: Request, env: Env): Promise<Response> {
  if (req.method !== "POST") return reply("Method Not Allowed", 405, { Allow: "POST" });

  // 自サイトのフォーム以外からの送信を拒否する
  const origin = req.headers.get("Origin");
  if (origin !== new URL(req.url).origin) return reply("Forbidden", 403);

  if (!env.TURNSTILE_SECRET_KEY || !env.CONTACT_GAS_URL || !env.CONTACT_GAS_SECRET) return back(req, "unavailable");

  const type = req.headers.get("Content-Type") ?? "";
  if (!type.startsWith("application/x-www-form-urlencoded") && !type.startsWith("multipart/form-data")) {
    return reply("Unsupported Media Type", 415);
  }
  if (Number(req.headers.get("Content-Length") ?? 0) > 32_000) return back(req, "invalid");

  const form = await req.formData();
  // ボット対策の隠し項目（人には見えない）。入力されていたら送信したことにして捨てる
  if (clean(form.get("website"), true)) return back(req, "sent");

  const subject = clean(form.get("subject"), true);
  const email = clean(form.get("email"), true);
  const message = clean(form.get("message"), false);
  if (
    !subject || !email || !message ||
    subject.length > LIMITS.subject || email.length > LIMITS.email || message.length > LIMITS.message ||
    !EMAIL_RE.test(email)
  ) return back(req, "invalid");

  const ok = await verifyTurnstile(clean(form.get("cf-turnstile-response"), true), env.TURNSTILE_SECRET_KEY, req.headers.get("CF-Connecting-IP"));
  if (!ok) return back(req, "captcha");

  const res = await fetch(env.CONTACT_GAS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ secret: env.CONTACT_GAS_SECRET, subject, email, message, receivedAt: new Date().toISOString() }),
    redirect: "follow",
  });
  const result = res.ok ? ((await res.json().catch(() => ({}))) as { ok?: boolean }) : {};
  if (!result.ok) {
    console.error(`contact: forward failed (status ${res.status})`); // 内容や秘密情報はログに出さない
    return back(req, "failed");
  }
  return back(req, "sent");
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(req.url);
    if (pathname === "/api/contact") return handleContact(req, env);
    if (pathname.startsWith("/api/")) return reply("Not Found", 404);
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;
