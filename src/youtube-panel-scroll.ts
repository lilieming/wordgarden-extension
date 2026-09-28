export type WordView = "all" | "unknown";
export type WordScrollPositions = Record<WordView, number>;

export function createWordScrollPositions(): WordScrollPositions {
  return { all: 0, unknown: 0 };
}

export function rememberWordScroll(positions: WordScrollPositions, view: WordView, scrollTop: number): void {
  positions[view] = Math.max(0, scrollTop);
}

export function restoredWordScroll(positions: WordScrollPositions, view: WordView, scrollHeight: number, clientHeight: number): number {
  return Math.min(positions[view], Math.max(0, scrollHeight - clientHeight));
}
