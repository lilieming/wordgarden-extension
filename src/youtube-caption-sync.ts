export interface CaptionLineOffset {
  offset: number;
}

/**
 * 二分找出时间点上正在播的那行字幕（字幕按 offset 升序铺在时间线里）。
 * 播放还没到第一行时返回 -1。
 */
export function captionIndexAt(lines: CaptionLineOffset[], time: number): number {
  let low = 0;
  let high = lines.length - 1;
  let found = -1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (lines[middle]!.offset <= time) {
      found = middle;
      low = middle + 1;
    } else high = middle - 1;
  }
  return found;
}
