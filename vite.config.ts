import { defineConfig } from "vite";
import { resolve } from "node:path";
import { cpSync } from "node:fs";
import { wrapExtensionChunk } from "./build-scope";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        content: resolve(__dirname, "src/content.ts"),
        "youtube-page": resolve(__dirname, "src/youtube-page.ts"),
        background: resolve(__dirname, "src/background.ts"),
        options: resolve(__dirname, "options.html")
      },
      output: { entryFileNames: "[name].js", chunkFileNames: "assets/[name]-[hash].js", assetFileNames: "assets/[name]-[hash][extname]" }
    }
  },
  plugins: [
    {
      name: "scope-extension-scripts",
      generateBundle(_options, bundle) {
        for (const output of Object.values(bundle)) {
          if (output.type === "chunk") output.code = wrapExtensionChunk(output.code);
        }
      }
    },
    {
      name: "copy-extension-static",
      closeBundle() {
        cpSync(resolve(__dirname, "static"), resolve(__dirname, "dist"), { recursive: true });
      }
    }
  ]
});
