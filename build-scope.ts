export function wrapExtensionChunk(code: string): string {
  return `(() => {\n${code}\n})();\n`;
}
