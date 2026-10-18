import { describe, expect, it } from "vitest";
import { describeFailure, isStaleExtensionContext } from "./panel-errors";

describe("describeFailure", () => {
  // 文案归调用方（那里才拿得到 chrome.i18n），这里只验「该说哪句」的判定。
  const copy = { stale: "<stale>", fallback: "<fallback>" };

  it("tells the user to reload the page after the extension was reloaded", () => {
    const error = new Error("Extension context invalidated.");
    expect(isStaleExtensionContext(error)).toBe(true);
    expect(describeFailure(error, copy)).toBe(copy.stale);
  });

  it("treats a missing service worker as the same class of failure", () => {
    const error = new Error("Error: Could not establish connection. Receiving end does not exist.");
    expect(isStaleExtensionContext(error)).toBe(true);
    expect(describeFailure(error, copy)).toBe(copy.stale);
  });

  it("keeps real service errors verbatim and falls back when there is no message", () => {
    expect(isStaleExtensionContext(new Error("boom"))).toBe(false);
    expect(describeFailure(new Error("无法连接本地服务"), copy)).toBe("无法连接本地服务");
    expect(describeFailure(undefined, copy)).toBe(copy.fallback);
  });
});
