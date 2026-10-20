/**
 * サイトの問い合わせフォーム → Gmail 転送用の Google Apps Script（ウェブアプリ）
 *
 * 設定（スクリプトのプロジェクト設定 → スクリプト プロパティ）:
 *   RECIPIENT : 送信先メールアドレス（このスクリプトの中にだけ置く。リポジトリには書かない）
 *   SECRET    : Worker の CONTACT_GAS_SECRET と同じ合言葉（長いランダム文字列）
 *
 * デプロイ: 「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」
 *   次のユーザーとして実行: 自分 / アクセスできるユーザー: 全員
 *   発行された URL（…/exec）を Worker の CONTACT_GAS_URL に設定する
 */
function doPost(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var data = JSON.parse(e.postData.contents);

    // 合言葉が一致しないリクエストは何もせず拒否する
    if (!data || typeof data.secret !== "string" || data.secret !== props.getProperty("SECRET")) {
      return json_({ ok: false, error: "forbidden" });
    }

    var subject = String(data.subject || "").replace(/[\r\n]+/g, " ").slice(0, 100);
    var email = String(data.email || "").trim();
    var message = String(data.message || "").slice(0, 5000);
    // 返信先に使うため、Worker と同じ形式チェックをここでも行う
    var emailOk = email.length <= 254 && /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/.test(email);
    if (!subject || !message || !emailOk) return json_({ ok: false, error: "invalid" });

    MailApp.sendEmail({
      to: props.getProperty("RECIPIENT"),
      subject: "[サイト問い合わせ] " + subject,
      body: message + "\n\n---\n返信先: " + email + "\n受信: " + String(data.receivedAt || "") + "\n送信元: de.daisuke-harato.workers.dev の問い合わせフォーム",
      replyTo: email, // 届いたメールに「返信」すると問い合わせた人に送れる
    });
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: "error" });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
