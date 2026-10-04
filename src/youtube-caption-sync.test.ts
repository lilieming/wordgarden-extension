import { describe, expect, it } from "vitest";
import { captionIndexAt } from "./youtube-caption-sync";

const lines = [10, 24, 41, 45, 60].map((offset) => ({ offset }));

describe("YouTube caption sync", () => {
  it("picks the line playing at a given time", () => {
    expect(captionIndexAt(lines, 12)).toBe(0);
    expect(captionIndexAt(lines, 44.9)).toBe(2);
    expect(captionIndexAt(lines, 45)).toBe(3);
    expect(captionIndexAt(lines, 9_999)).toBe(4);
  });

  it("returns -1 before the first caption line", () => {
    expect(captionIndexAt(lines, 9.9)).toBe(-1);
    expect(captionIndexAt([], 30)).toBe(-1);
  });
});
