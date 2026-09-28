import { describe, expect, it } from "vitest";
import { buildYouTubeWords, formatTimestamp } from "./youtube-words";

describe("YouTube word extraction", () => {
  it("deduplicates in first-seen order and keeps all occurrences", () => {
    const words = buildYouTubeWords([
      { text: "Hello world, hello again", offset: 10, duration: 4 },
      { text: "World learners don't stop", offset: 20, duration: 4 },
      { text: "[Music]", offset: 25, duration: 2 }
    ]);
    expect(words.map((item) => item.word)).toEqual(["hello", "world", "again", "learners", "don't", "stop"]);
    expect(words[0]).toMatchObject({ word: "hello", count: 2 });
    expect(words[1]?.occurrences).toHaveLength(2);
  });

  it("formats timestamps", () => {
    expect(formatTimestamp(65.9)).toBe("1:05");
    expect(formatTimestamp(3661)).toBe("1:01:01");
  });
});
