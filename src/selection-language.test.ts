import { describe, expect, it } from "vitest";
import { isEnglishSelection } from "./selection-language";

describe("selected text language", () => {
  it.each([
    "hello",
    "I",
    "It doesn't make sense.",
    "state-of-the-art",
    "café",
    "Read 12 pages.",
    "Hello 👋",
  ])("accepts English text: %s", (text) => {
    expect(isEnglishSelection(text)).toBe(true);
  });

  it.each([
    "",
    "   ",
    "1234",
    "——",
    "你好",
    "こんにちは",
    "안녕하세요",
    "Привет",
    "مرحبا",
    "hello 世界",
    "Hello こんにちは",
  ])("rejects non-English text: %s", (text) => {
    expect(isEnglishSelection(text)).toBe(false);
  });
});
