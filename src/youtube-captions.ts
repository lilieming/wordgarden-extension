export interface CaptionSegment {
  text: string;
  offset: number;
  duration: number;
}

interface JsonCaptionPayload {
  events?: Array<{ tStartMs?: number; dDurationMs?: number; segs?: Array<{ utf8?: string }> }>;
}

function decodeEntities(value: string): string {
  return value
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseJsonCaptions(body: string): CaptionSegment[] {
  let payload: JsonCaptionPayload;
  try { payload = JSON.parse(body) as JsonCaptionPayload; }
  catch { return []; }
  return (payload.events ?? []).flatMap((event) => {
    const text = decodeEntities(event.segs?.map((segment) => segment.utf8 ?? "").join("") ?? "");
    if (!text) return [];
    return [{
      text,
      offset: Math.max(0, (event.tStartMs ?? 0) / 1000),
      duration: Math.max(1.5, (event.dDurationMs ?? 3000) / 1000)
    }];
  });
}

function parseSecondsXml(body: string): CaptionSegment[] {
  const segments: CaptionSegment[] = [];
  const pattern = /<text\b([^>]*)>([\s\S]*?)<\/text>/gi;
  for (const match of body.matchAll(pattern)) {
    const attributes = match[1] ?? "";
    const start = Number(attributes.match(/\bstart=["']([^"']+)["']/i)?.[1] ?? NaN);
    const duration = Number(attributes.match(/\bdur=["']([^"']+)["']/i)?.[1] ?? 3);
    const text = decodeEntities(match[2] ?? "");
    if (Number.isFinite(start) && text) segments.push({ text, offset: Math.max(0, start), duration: Math.max(1.5, Number.isFinite(duration) ? duration : 3) });
  }
  return segments;
}

function parseMillisecondsXml(body: string): CaptionSegment[] {
  const segments: CaptionSegment[] = [];
  const pattern = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
  for (const match of body.matchAll(pattern)) {
    const attributes = match[1] ?? "";
    const startMs = Number(attributes.match(/\bt=["']([^"']+)["']/i)?.[1] ?? NaN);
    const durationMs = Number(attributes.match(/\bd=["']([^"']+)["']/i)?.[1] ?? 3000);
    const text = decodeEntities(match[2] ?? "");
    if (Number.isFinite(startMs) && text) segments.push({ text, offset: Math.max(0, startMs / 1000), duration: Math.max(1.5, Number.isFinite(durationMs) ? durationMs / 1000 : 3) });
  }
  return segments;
}

export function parseCaptionBody(body: string): CaptionSegment[] {
  const trimmed = body.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    const json = parseJsonCaptions(trimmed);
    if (json.length > 0) return json;
  }
  return parseSecondsXml(trimmed).concat(parseMillisecondsXml(trimmed));
}

export async function fetchCaptionSegments(baseUrl: string, fetcher: typeof fetch = fetch): Promise<CaptionSegment[]> {
  const jsonUrl = new URL(baseUrl);
  jsonUrl.searchParams.set("fmt", "json3");
  const candidates = [jsonUrl.toString(), baseUrl];
  let lastStatus = 0;
  for (const url of candidates) {
    const response = await fetcher(url, { credentials: "include" });
    lastStatus = response.status;
    if (!response.ok) continue;
    const body = await response.text();
    const segments = parseCaptionBody(body);
    if (segments.length > 0) return segments;
  }
  if (lastStatus >= 400) throw new Error(`字幕请求失败 (${lastStatus})`);
  return [];
}
