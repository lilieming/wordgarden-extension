import { describe, expect, it } from "vitest";
import { createWordScrollPositions, rememberWordScroll, restoredWordScroll } from "./youtube-panel-scroll";

describe("YouTube word-tab scroll memory", () => {
  it("remembers independent positions for All and Unknown tabs", () => {
    const positions = createWordScrollPositions();
    rememberWordScroll(positions, "all", 1420);
    rememberWordScroll(positions, "unknown", 260);
    expect(restoredWordScroll(positions, "all", 5000, 600)).toBe(1420);
    expect(restoredWordScroll(positions, "unknown", 1200, 600)).toBe(260);
  });

  it("clamps a saved position when the destination list is shorter", () => {
    const positions = createWordScrollPositions();
    rememberWordScroll(positions, "unknown", 900);
    expect(restoredWordScroll(positions, "unknown", 700, 500)).toBe(200);
  });
});
