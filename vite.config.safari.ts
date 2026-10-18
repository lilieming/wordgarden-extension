import { defineConfig } from "vite";
import { resolve } from "node:path";
import { assertClassicScriptSafe, finalizeChunk } from "./build-scope";
import { copyExtensionStatic } from "./build-static";

/**
 * Safari 版产物，macOS 与 iOS 各一份。
 *
 * Safari 不认 manifest 的 `background.type`（实测 packager 报 `type` 和 `world` 两个 key），
 * service worker 只能按 classic script 解析，所以 `background.js` 在这里也必须是单文件、
 * 不含 import 的产物 —— 现在它恰好没有跨入口共享模块，一旦有人加了共享模块，
 * 下面那句 assertClassicScriptSafe 会直接让构建失败，而不是等 Safari 静默罢工。
 *
 * 分平台而不是运行时猜系统：iOS 上 App 退后台就挂起，本机根本没有 HTTP 服务可打，
 * 收藏只能交给 app extension 排队；macOS 上服务照常跑着，排队反而要动主 App 的钥匙串组，
 * 那是会连带挪走已存 API Key 的改动，不在这个改动里顺手做。
 *
 * YouTube 面板不进任何一份：它要 `world = "MAIN"` 的页面侧桥，Safari 给不了。
 */
export default defineConfig(({ mode }) => {
  if (mode !== "mac" && mode !== "ios") {
    throw new Error(`Safari 版要指定平台：--mode mac 或 --mode ios（收到 "${mode}"）。`);
  }
  return {
    base: "./",
    define: { __EG_APP_RELAY__: mode === "ios" ? "true" : "false" },
    build: {
      outDir: `dist-safari-${mode}`,
      emptyOutDir: true,
      rollupOptions: {
        input: {
          content: resolve(__dirname, "src/content.ts"),
          background: resolve(__dirname, "src/background.ts"),
          options: resolve(__dirname, "options.html")
        },
        output: { entryFileNames: "[name].js", chunkFileNames: "assets/[name]-[hash].js", assetFileNames: "assets/[name]-[hash][extname]" }
      }
    },
    plugins: [
      {
        name: "scope-safari-extension-scripts",
        generateBundle(_options, bundle) {
          for (const output of Object.values(bundle)) {
            if (output.type !== "chunk") continue;
            output.code = finalizeChunk({ fileName: output.fileName, isEntry: output.isEntry }, output.code);
            if (output.fileName === "background.js") assertClassicScriptSafe("background", output.code);
          }
        }
      },
      {
        name: "copy-safari-extension-static",
        closeBundle() {
          copyExtensionStatic(resolve(__dirname, "static"), resolve(__dirname, `dist-safari-${mode}`), "safari");
        }
      }
    ]
  };
});
