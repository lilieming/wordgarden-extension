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

export function buildYouTubeWords(segments: YouTubeCaptionSegment[]): YouTubeWord[] {
  const words = new Map<string, YouTubeWord>();
  for (const segment of segments) {
    const context = segment.text.replace(/\s+/g, " ").trim();
    if (!context || /^\s*[[(].*[\])]\s*$/.test(context)) continue;
    for (const match of context.matchAll(WORD_PATTERN)) {
      const word = match[0].replace(/’/g, "'").toLocaleLowerCase("en-US");
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
