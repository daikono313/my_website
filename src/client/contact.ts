// /contact/ のクライアント処理
// - 3項目（概要・メールアドレス・内容）がすべて正しく入力されるまで送信ボタンを無効にする
// - 送信結果（Worker が ?sent=1 / ?error=... でリダイレクトしてくる）を表示する
const MESSAGES: Record<string, string> = {
  sent: "送信しました。お問い合わせありがとうございます。",
  invalid: "入力内容を確認してください（概要は100字以内、メールアドレスは正しい形式、内容は5,000字以内）。",
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

export function enableSubmitWhenComplete() {
  const form = document.querySelector<HTMLFormElement>(".contact-form");
  const button = form?.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (!form || !button) return;
  const fields = ["subject", "email", "message"].map((n) => form.elements.namedItem(n) as HTMLInputElement | HTMLTextAreaElement);
  const update = () => {
    // 空白だけの入力は未入力とみなす。メールアドレスはブラウザの形式チェック（type=email）も使う
    button.disabled = !fields.every((f) => f && f.value.trim() !== "" && f.checkValidity());
  };
  form.addEventListener("input", update);
  update();
}
