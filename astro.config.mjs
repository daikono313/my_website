import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://example.com", // TODO: 独自ドメインを設定したら変更
  // CSP で inline style を許可しないため、CSS は常に外部ファイルとして出力する
  build: { inlineStylesheets: "never" },
  vite: { build: { sourcemap: false } },
});
