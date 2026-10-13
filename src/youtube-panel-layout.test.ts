import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("YouTube panel word grid", () => {
  const source = readFileSync(resolve(process.cwd(), "src/youtube.ts"), "utf8");

  it("sizes implicit grid rows by content so a gloss line never gets sliced", () => {
    // minmax(98px,max-content) 的 98px 是基准轨道：网格需要滚动时可用空间为负，
    // 轨道永远停在 98px，卡片里的行就被 flex 压缩、文字被横切。最低高度交给 .word 的 min-height。
    expect(source).toContain("grid-auto-rows:max-content");
    expect(source).not.toContain("grid-auto-rows:minmax(");
    expect(source).toContain("align-content:start");
    expect(source).toContain("min-height:98px");
  });

  it("lets the card button fill its row", () => {
    expect(source).toContain("height:100%;min-height:96px");
  });

  it("keeps the panel clear of YouTube's header and wide enough for two columns", () => {
    expect(source).toContain('root.style.top = "64px"');
    expect(source).toContain("width:min(430px,calc(100vw - 28px))");
  });
});
