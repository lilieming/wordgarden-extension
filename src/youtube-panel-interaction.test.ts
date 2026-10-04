import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("YouTube panel selection interaction", () => {
  const source = readFileSync(resolve(process.cwd(), "src/youtube.ts"), "utf8");

  it("does not rebuild the panel when an unknown checkbox changes", () => {
    const handlerStart = source.indexOf('checkbox.addEventListener("change"');
    const handlerEnd = source.indexOf("const text = document.createElement", handlerStart);
    const handler = source.slice(handlerStart, handlerEnd);
    expect(handler).toContain("updatePanelControls(panel)");
    expect(handler).not.toContain("renderPanel()");
    expect(handler).not.toContain("renderWordList(panel)");
  });

  it("provides All and Unknown tabs with live counts", () => {
    expect(source).toContain('data-view="all"');
    expect(source).toContain('data-view="unknown"');
    expect(source).toContain("不认识 (${unknownWordCount()})");
    expect(source).toContain('wordView === "unknown"');
  });

  it("updates playback UI without rebuilding the list", () => {
    const functionStart = source.indexOf("function playWord(");
    const functionEnd = source.indexOf("async function saveSelectedWords", functionStart);
    const playWord = source.slice(functionStart, functionEnd);
    expect(playWord).toContain("playOccurrence(item, occurrence)");
    expect(playWord).toContain("updateContext(item, Math.max(0, item.occurrences.indexOf(occurrence)))");
    expect(playWord).toContain("updateActiveWordCards(item)");
    expect(playWord).not.toContain("renderPanel()");
  });
  it("remembers the current tab scroll before switching and restores the target tab", () => {
    expect(source).toContain("rememberCurrentWordScroll(panel)");
    expect(source).toContain("wordScrollPositions");
    expect(source).toContain("restoreCurrentWordScroll(list)");
    expect(source).toContain("rememberWordScroll(wordScrollPositions, wordView, wordList.scrollTop)");
  });

});
