import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://example.com", // TODO: 独自ドメインを設定したら変更
  // CSP で inline style を許可しないため、CSS は常に外部ファイルとして出力する
  build: { inlineStylesheets: "never" },
  // Shiki は inline style を出力するため、class ベースの Prism を使う
  markdown: { syntaxHighlight: "prism" },
  // 小さいスクリプトもインライン化せず外部ファイルにする（CSP script-src 'self' のため）
  vite: { build: { sourcemap: false, assetsInlineLimit: 0 } },
});
