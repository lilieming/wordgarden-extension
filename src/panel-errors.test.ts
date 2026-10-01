import { describe, expect, it } from "vitest";
import { describeFailure, isStaleExtensionContext } from "./panel-errors";

describe("describeFailure", () => {
  it("tells the user to reload the page after the extension was reloaded", () => {
    const error = new Error("Extension context invalidated.");
    expect(isStaleExtensionContext(error)).toBe(true);
    expect(describeFailure(error, "翻译失败")).toMatch(/刷新页面/);
  });

  it("treats a missing service worker as the same class of failure", () => {
    const error = new Error("Error: Could not establish connection. Receiving end does not exist.");
    expect(isStaleExtensionContext(error)).toBe(true);
    expect(describeFailure(error, "保存失败")).toMatch(/刷新页面/);
  });

  it("keeps real service errors verbatim and falls back when there is no message", () => {
    expect(isStaleExtensionContext(new Error("boom"))).toBe(false);
    expect(describeFailure(new Error("无法连接本地服务"), "翻译失败")).toBe("无法连接本地服务");
    expect(describeFailure(undefined, "翻译失败")).toBe("翻译失败");
  });
});
