import { describe, expect, it } from "vitest";
import { finalizeChunk, wrapExtensionChunk } from "../build-scope";

describe("extension bundle scoping", () => {
  it("allows independently minified content scripts to reuse top-level names", () => {
    const content = wrapExtensionChunk("const z = 'selection';");
    const youtube = wrapExtensionChunk("const z = 'youtube';");
    expect(() => new Function(`${content}\n${youtube}`)).not.toThrow();
  });

  it("does not leak bundle bindings onto the global object", () => {
    const run = new Function(`${wrapExtensionChunk("const z = 'private';")} return typeof z;`);
    expect(run()).toBe("undefined");
  });
});

describe("finalizeChunk", () => {
  const entry = (fileName: string) => ({ fileName, isEntry: true });

  it("keeps module-loaded entries as real ES modules", () => {
    // service worker 是 manifest 里声明的 ESM：包进 IIFE 会让 import 语句变成语法错误
    const code = `import{a}from"./assets/shared-1.js";\nchrome.runtime.onMessage.addListener(()=>{});\n`;
    expect(finalizeChunk(entry("background.js"), code)).toBe(code);
    expect(finalizeChunk(entry("options.js"), code)).toBe(code);
  });

  it("wraps classic content scripts so two bundles can share a page", () => {
    expect(finalizeChunk(entry("content.js"), "const z = 1;")).toContain("(() => {");
    expect(finalizeChunk(entry("youtube-page.js"), "const z = 1;")).toContain("(() => {");
  });

  it("leaves shared chunks untouched", () => {
    const chunk = { fileName: "assets/api-response-abc.js", isEntry: false };
    expect(finalizeChunk(chunk, "export const x = 1;")).toBe("export const x = 1;");
  });

  it("fails the build when a content script would need module syntax", () => {
    expect(() => finalizeChunk(entry("content.js"), 'import{a}from"./x.js";')).toThrow(/classic script/);
    expect(() => finalizeChunk(entry("content.js"), 'const url = `report{x}`;')).not.toThrow();
    expect(() => finalizeChunk(entry("content.js"), 'const load = async () => await import("./x.js");')).not.toThrow();
  });
});
