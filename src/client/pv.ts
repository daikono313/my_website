// ページ表示を /api/pv に送る（本番のみ。Base.astro が Web Analytics と同じ条件で読み込む）
// 送るのはパスとリファラーだけ。Cookie・識別子は使わない
const body = JSON.stringify({ p: location.pathname, r: document.referrer });
navigator.sendBeacon("/api/pv", new Blob([body], { type: "application/json" }));
