const LATIN_LETTER = /\p{Script=Latin}/u;
const LETTER = /\p{L}/gu;

/**
 * 划词翻译只处理英文：选中文本必须至少有一个拉丁字母，且不能混入其他文字系统。
 * 数字、标点、网址参数等不参与语言判断；emoji 也不会把英文句子误判成非英文。
 */
export function isEnglishSelection(text: string): boolean {
  const letters = text.trim().match(LETTER);
  if (!letters?.length) return false;
  return letters.every((letter) => LATIN_LETTER.test(letter));
}
