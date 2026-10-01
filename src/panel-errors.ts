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

/** 把底层报错翻译成可操作的中文提示；认不出来就用原文。 */
export function describeFailure(error: unknown, fallback: string): string {
  if (isStaleExtensionContext(error)) {
    return "扩展刚被重新加载过，这个页面里跑的还是旧脚本。刷新页面（⌘R / F5）就能继续收藏。";
  }
  const message = error instanceof Error ? error.message : "";
  return message || fallback;
}
