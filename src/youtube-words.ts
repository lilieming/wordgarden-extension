export interface YouTubeCaptionSegment {
  text: string;
  offset: number;
  duration: number;
}

export interface YouTubeWordOccurrence {
  offset: number;
  duration: number;
  context: string;
}

export interface YouTubeWord {
  word: string;
  count: number;
  occurrences: YouTubeWordOccurrence[];
}

const WORD_PATTERN = /[A-Za-z]+(?:['’][A-Za-z]+)*/g;

function normalizeWord(match: string): string {
  return match.replace(/’/g, "'").toLocaleLowerCase("en-US");
}

/** 字幕行归一化；[Music]、(applause) 这类非语音行返回 null，不进词表也不进字幕流。 */
export function readableCaptionText(text: string): string | null {
  const context = text.replace(/\s+/g, " ").trim();
  if (!context || /^\s*[[\(].*[\])]\s*$/.test(context)) return null;
  return context;
}

export interface CaptionToken {
  text: string;
  word: string | null;
}

/**
 * 把一行字幕切成「可点词 + 原样标点」，词键与 buildYouTubeWords 保持一致，
 * 这样字幕流里点中的词能和词库里的词对上。
 */
export function tokenizeCaption(text: string): CaptionToken[] {
  return text.split(/(\s+)/).filter((chunk) => chunk !== "").map((chunk) => {
    if (!chunk.trim()) return { text: chunk, word: null };
    const matches = chunk.match(WORD_PATTERN);
    if (!matches || matches.length !== 1) return { text: chunk, word: null };
    const word = normalizeWord(matches[0]!);
    if (word.length === 1 && word !== "a" && word !== "i") return { text: chunk, word: null };
    return { text: chunk, word };
  });
}

export function buildYouTubeWords(segments: YouTubeCaptionSegment[]): YouTubeWord[] {
  const words = new Map<string, YouTubeWord>();
  for (const segment of segments) {
    const context = readableCaptionText(segment.text);
    if (!context) continue;
    for (const match of context.matchAll(WORD_PATTERN)) {
      const word = normalizeWord(match[0]);
      if (word.length === 1 && word !== "a" && word !== "i") continue;
      const relative = context.length > 0 ? (match.index ?? 0) / context.length : 0;
      const occurrence = {
        offset: Math.max(0, segment.offset + segment.duration * relative),
        duration: Math.max(1.5, Math.min(6, segment.duration)),
        context
      };
      const existing = words.get(word);
      if (existing) {
        existing.count += 1;
        existing.occurrences.push(occurrence);
      } else {
        words.set(word, { word, count: 1, occurrences: [occurrence] });
      }
    }
  }
  return [...words.values()];
}

export function formatTimestamp(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`
    : `${minutes}:${String(secs).padStart(2, "0")}`;
}
