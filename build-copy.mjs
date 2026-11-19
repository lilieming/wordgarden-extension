/**
 * 把 `static/_locales/<locale>/messages.json` 生成成**每个入口一份、自包含**的 TS 模块。
 *
 * 为什么不直接用 chrome.i18n 或运行时 fetch：Safari 里这两条路都不通 ——
 * manifest 的 `__MSG_` 替换是好的（扩展名能显示），但运行时 `chrome.i18n.getMessage()`
 * 返回空串，向后台要目录也拿不到回包（2026-10-18 实测：设置页只剩骨架）。
 * 编进产物就没有任何运行时依赖，Chrome / Safari 走同一套。
 *
 * 为什么一个入口一份而不是共享一个模块：content script 是 classic script，
 * 两个入口共享同一模块会被 rollup 提成 chunk，classic 里出现 `import` 直接构建失败
 * （见 build-scope.ts 的断言）。所以生成的文件必须自带挑语言的逻辑，什么都不 import。
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname);
const localesDir = resolve(root, "static/_locales");
const entries = ["content", "options", "background"];

const catalogs = Object.fromEntries(
  readdirSync(localesDir)
    .map((locale) => [
      locale,
      Object.fromEntries(
        Object.entries(JSON.parse(readFileSync(resolve(localesDir, locale, "messages.json"), "utf8")))
          .map(([key, value]) => [key, value.message ?? ""])
      ),
    ])
);

const banner = "// 由 build-copy.mjs 从 static/_locales 生成，别手改：改文案去改 messages.json。\n";

const helper = `function pick(language: string, fallback: string): Record<string, string> {
  const normalized = (language || "").replace(/-/g, "_");
  const base = normalized.split("_")[0] || normalized;
  for (const candidate of [...new Set([normalized, base, fallback])]) {
    const bundle = catalogs[candidate];
    if (bundle && Object.keys(bundle).length > 0) return bundle;
  }
  return {};
}

// 跑测试时是 node，没有 chrome / navigator，落到 default_locale 那份就行。
const fallbackLocale = typeof chrome === "undefined" ? "en" : chrome.runtime.getManifest().default_locale ?? "en";
const language = typeof navigator === "undefined" ? "" : navigator.language ?? "";
const copy = pick(language, fallbackLocale);

/** 取一条文案；$1$ / $2$ 按传入顺序代入。 */
export function t(key: string, ...subs: (string | number)[]): string {
  return subs.reduce<string>((text, value, index) => text.replaceAll("$" + (index + 1) + "$", String(value)), copy[key] ?? "");
}
`;

for (const entry of entries) {
  const file = resolve(root, `src/copy.${entry}.ts`);
  writeFileSync(file, `${banner}const catalogs: Record<string, Record<string, string>> = ${JSON.stringify(catalogs, null, 2)};\n\n${helper}`, "utf8");
}

console.log(`生成 ${entries.length} 份文案模块：${Object.keys(catalogs).length} 种语言 × ${Object.keys(catalogs.en).length} 条`);
