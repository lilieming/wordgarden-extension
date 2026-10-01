/**
 * 打包产物的作用域处理。
 *
 * Chrome 的 content script 只能是 classic script，而且 `content.js` 与
 * `youtube-page.js` 会注入同一个页面：各自压缩后顶层名字可能重名，所以给它们
 * 各包一层 IIFE。
 *
 * 反过来，manifest 里声明成模块的东西**绝不能**包进函数体：
 * - `background.type = "module"` 的 service worker
 * - `options.html` 里的 `<script type="module">`
 * 一旦它们引用了共享 chunk 就会出现 `import` 语句，被包进 IIFE 后直接语法错误，
 * Chrome 表现为 “Service worker registration failed” + “Unexpected token '{'”。
 */

/** 以 ESM 加载的入口名（与 vite 的 rollupOptions.input 键名一致）。 */
export const moduleEntryNames: readonly string[] = ["background", "options"];

/** 必须是 classic script 的入口名。 */
export const classicEntryNames: readonly string[] = ["content", "youtube-page"];

export function wrapExtensionChunk(code: string): string {
  return `(() => {\n${code}\n})();\n`;
}

/** classic script 里出现静态 import/export 就是构建配置错了，不是可以兜住的运行时问题。 */
export function assertClassicScriptSafe(name: string, code: string): void {
  const offender = /(?:^|[\s;}])(import|export)\s*(?:[{*]|["'`])/.exec(code);
  if (offender) {
    throw new Error(
      `content script "${name}.js" 含静态 ${offender[1]} 语句：classic script 不支持模块语法。` +
        ` 被多个入口共享的模块会被 rollup 拆成 chunk，请把该模块改成只被单一入口使用（或各自内联）。`
    );
  }
}

/**
 * 按入口类型决定最终代码：模块入口原样输出，classic 入口包 IIFE 并先做安全检查。
 *
 * @param chunk 只关心 fileName 与 isEntry：非入口 chunk 由模块入口 import，不该被包装
 */
export function finalizeChunk(chunk: { fileName: string; isEntry: boolean }, code: string): string {
  if (!chunk.isEntry) return code;
  const name = chunk.fileName.replace(/\.js$/, "");
  if (moduleEntryNames.includes(name)) return code;
  assertClassicScriptSafe(name, code);
  return wrapExtensionChunk(code);
}
