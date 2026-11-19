/**
 * 划词面板的错误文案：只给 content script 用。
 *
 * 刻意不放进 `api-response.ts`——那个模块被 service worker（ESM 入口）使用，
 * 两边共享会被 rollup 拆成 chunk，而 content script 是 classic script，
 * 不能出现 `import`。见 `../build-scope.ts`。
 */

/**
 * 扩展被重新加载/更新后，页面里残留的旧内容脚本已经拿不到 runtime。
 * 这类失败与本机服务、密钥都无关，不该引导用户去翻设置。
 */
export function isStaleExtensionContext(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /extension context invalidated|receiving end does not exist|could not establish connection/i.test(message);
}

/**
 * 把底层报错翻译成可操作的提示；认不出来就用原文。
 * 文案由调用方给（那边才拿得到 `chrome.i18n`），这个模块本身不认识语言。
 */
export function describeFailure(error: unknown, copy: { stale: string; fallback: string }): string {
  if (isStaleExtensionContext(error)) return copy.stale;
  const message = error instanceof Error ? error.message : "";
  return message || copy.fallback;
}
