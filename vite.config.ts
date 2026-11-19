import { defineConfig } from "vite";
import { resolve } from "node:path";
import { finalizeChunk } from "./build-scope";
import { copyExtensionStatic } from "./build-static";

export default defineConfig({
  define: { __EG_APP_RELAY__: "false" },
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
          if (output.type === "chunk") {
            output.code = finalizeChunk({ fileName: output.fileName, isEntry: output.isEntry }, output.code);
          }
        }
      }
    },
    {
      name: "copy-extension-static",
      closeBundle() {
        copyExtensionStatic(resolve(__dirname, "static"), resolve(__dirname, "dist"), "chrome");
      }
    }
  ]
});
