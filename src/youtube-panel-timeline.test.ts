import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("YouTube panel timeline view", () => {
  const source = readFileSync(resolve(process.cwd(), "src/youtube.ts"), "utf8");

  it("adds a Timeline tab next to All and Unknown", () => {
    expect(source).toContain('data-view="timeline"');
    expect(source).toContain("const nextView = tab.dataset.view as WordView");
  });

  it("renders the whole transcript as clickable words instead of the card grid", () => {
    expect(source).toContain('if (wordView === "timeline") { renderCaptionStream(list); return; }');
    expect(source).toContain("for (const [index, segment] of transcript.segments.entries())");
    expect(source).toContain('word.className = `tl-token${saved.has(token.word) ? " saved"');
    expect(source).toContain('list.classList.add("timeline-mode")');
  });

  it("delegates one click listener for thousands of word tokens", () => {
    expect(source).toContain('wordList.addEventListener("click", onCaptionClick)');
    expect(source).not.toContain("word.addEventListener");
    expect(source).toContain('closest<HTMLElement>(".tl-time, .tl-token")');
  });

  it("collects the clicked word and replays the line it was clicked in", () => {
    const start = source.indexOf("function onCaptionClick(");
    const end = source.indexOf("function playCaptionSegment(", start);
    const click = source.slice(start, end);
    expect(click).toContain("transcript.segments[Number(line.dataset.segment)]");
    expect(click).toContain("playOccurrence(item, item.occurrences.find((occurrence) => occurrence.context === context)");
    expect(click).toContain("markUnknown(item)");
  });

  it("queues a clicked word as unknown instead of saving it right away", () => {
    const start = source.indexOf("function markUnknown(");
    const end = source.indexOf("function tokensFor(", start);
    const mark = source.slice(start, end);
    expect(mark).toContain("selected.add(item.word)");
    expect(mark).toContain("void requestGloss(item.word)");
    expect(mark).not.toContain("saveWords(");
    expect(mark).not.toContain("renderPanel()");
  });

  it("shows the Chinese gloss next to every marked word in the transcript", () => {
    const start = source.indexOf("async function requestGloss(");
    const end = source.indexOf("function renderPanel(", start);
    const gloss = source.slice(start, end);
    expect(gloss).toContain("glosses.set(word, text)");
    expect(gloss).toContain('token.insertAdjacentElement("afterend", glossNode(text))');
    expect(source).toContain("const gloss = glosses.get(token.word)");
  });

  it("reuses one Chrome translator session for glosses and saving", () => {
    expect(source).toContain("function sharedTranslator(): Promise<ChromeTranslator | null>");
    const start = source.indexOf("async function requestGloss(");
    const end = source.indexOf("function renderPanel(", start);
    expect(source.slice(start, end)).toContain("await sharedTranslator()");
    const save = source.slice(source.indexOf("async function saveWords("), source.indexOf("interface YouTubeExtensionWindow"));
    expect(save).toContain("const session = await sharedTranslator()");
    expect(save).not.toContain("session.close()");
  });

  it("hides the redundant context box in timeline view", () => {
    const start = source.indexOf("function updateContext(");
    const end = source.indexOf("function updateActiveWordCards(", start);
    expect(source.slice(start, end)).toContain('if (wordView === "timeline") {');
    expect(source).toContain('if (context && wordView === "timeline") context.hidden = true;');
  });

  it("follows playback without hijacking a manual scroll", () => {
    expect(source).toContain('document.addEventListener("timeupdate", syncCaptionToVideo, true)');
    const start = source.indexOf("function setActiveCaption(");
    const end = source.indexOf("function renderPanel(", start);
    const follow = source.slice(start, end);
    expect(follow).toContain('if (Date.now() - lastUserScrollAt < 5_000) return;');
    expect(follow).toContain("if (box.top >= view.top && box.bottom <= view.bottom) return;");
    expect(follow).toContain("scrollListTo(list,");
    const remember = source.indexOf('wordList.addEventListener("scroll"');
    expect(source.slice(remember, source.indexOf("renderWordList(panel)", remember))).toContain("lastUserScrollAt = Date.now()");
  });

  it("shows the gloss on the unknown-word cards too", () => {
    expect(source).toContain('gloss.textContent = glosses.get(item.word) ?? ""');
    expect(source).toContain("play.append(strong, gloss, time, count)");
    const start = source.indexOf("async function requestGloss(");
    const end = source.indexOf("function cardsFor(", start);
    expect(source.slice(start, end)).toContain("slot.textContent = text");
  });

  it("translates a word when it is ticked unknown in the grid", () => {
    const start = source.indexOf('checkbox.addEventListener("change"');
    const end = source.indexOf("const text = document.createElement", start);
    expect(source.slice(start, end)).toContain("void requestGloss(item.word)");
  });
});
