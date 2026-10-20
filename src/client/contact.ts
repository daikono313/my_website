// /contact/ の送信結果（Worker が ?sent=1 / ?error=... でリダイレクトしてくる）を表示する
const MESSAGES: Record<string, string> = {
  sent: "送信しました。お問い合わせありがとうございます。",
  invalid: "入力内容を確認してください（概要は100字以内、内容は5,000字以内）。",
  captcha: "ボット対策の確認に失敗しました。もう一度お試しください。",
  unavailable: "現在フォームを利用できません。時間をおいてお試しください。",
  failed: "送信に失敗しました。時間をおいてお試しください。",
};

export function showContactStatus() {
  const status = document.querySelector<HTMLElement>("#contact-status");
  if (!status) return;
  const params = new URLSearchParams(location.search);
  const key = params.get("sent") ? "sent" : params.get("error") ?? "";
  const text = MESSAGES[key];
  if (!text) return;
  status.textContent = text; // 固定の文言だけを表示する（URL の値をそのまま出さない）
  status.classList.add(key === "sent" ? "ok" : "ng");
  if (key === "sent") document.querySelector(".contact-form")?.remove();
  history.replaceState(null, "", location.pathname);
}
