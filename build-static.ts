import { cpSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * 把 `static/` 原样拷进产物目录，但 manifest 只放目标浏览器那一份。
 *
 * 两份 manifest 是同一条流水线的两个出口：`manifest.json` 给 Chrome，允许
 * `background.type = "module"` 和 YouTube 面板需要的 `world = "MAIN"`；
 * `manifest.safari.json` 去掉这两样，也就整块不带 YouTube。
 */
export function copyExtensionStatic(staticDir: string, outDir: string, flavor: "chrome" | "safari"): void {
  const wanted = flavor === "chrome" ? "manifest.json" : "manifest.safari.json";
  cpSync(staticDir, outDir, { recursive: true, filter: (src) => !src.endsWith("manifest.json") && !src.endsWith("manifest.safari.json") });
  copyFileSync(resolve(staticDir, wanted), resolve(outDir, "manifest.json"));
}
