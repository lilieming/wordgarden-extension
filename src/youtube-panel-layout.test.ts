import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("YouTube panel word grid", () => {
  const source = readFileSync(resolve(process.cwd(), "src/youtube.ts"), "utf8");

  it("gives implicit grid rows a non-collapsible minimum height", () => {
    expect(source).toContain("grid-auto-rows:minmax(98px,max-content)");
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
