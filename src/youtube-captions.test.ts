import { describe, expect, it, vi } from "vitest";
import { fetchCaptionSegments, parseCaptionBody } from "./youtube-captions";

describe("YouTube caption parsing", () => {
  it("parses JSON3 captions", () => {
    expect(parseCaptionBody(JSON.stringify({ events: [
      { tStartMs: 1500, dDurationMs: 2500, segs: [{ utf8: "Hello " }, { utf8: "world" }] }
    ] }))).toEqual([{ text: "Hello world", offset: 1.5, duration: 2.5 }]);
  });

  it("parses legacy XML captions and decodes entities", () => {
    expect(parseCaptionBody('<?xml version="1.0"?><transcript><text start="2.4" dur="3.2">Practice &amp; progress</text></transcript>'))
      .toEqual([{ text: "Practice & progress", offset: 2.4, duration: 3.2 }]);
  });

  it("parses srv3 millisecond XML", () => {
    expect(parseCaptionBody('<timedtext><body><p t="5000" d="2000"><s>Learn</s> <s>English</s></p></body></timedtext>'))
      .toEqual([{ text: "Learn English", offset: 5, duration: 2 }]);
  });

  it("falls back from an empty JSON3 response to the original XML URL", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response("", { status: 200 }))
      .mockResolvedValueOnce(new Response('<transcript><text start="4" dur="2">Fallback works</text></transcript>', { status: 200 }));
    await expect(fetchCaptionSegments("https://www.youtube.com/api/timedtext?v=test", fetcher)).resolves.toEqual([
      { text: "Fallback works", offset: 4, duration: 2 }
    ]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("returns an empty list instead of throwing on empty successful responses", async () => {
    const fetcher = vi.fn().mockImplementation(async () => new Response("", { status: 200 }));
    await expect(fetchCaptionSegments("https://www.youtube.com/api/timedtext?v=test", fetcher)).resolves.toEqual([]);
  });
});
