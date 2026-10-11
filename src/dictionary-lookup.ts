export type DictionaryPair = [word: string, meaning: string];

const SINGLE_WORD = /^[A-Za-z]+(?:['’][A-Za-z]+)*$/;

/** 词典只查「一个单词」；短语和整句交给浏览器翻译，别在词表里瞎拼。 */
export function asSingleWord(text: string): string | null {
  const trimmed = text.replace(/\s+/g, " ").trim();
  return SINGLE_WORD.test(trimmed) ? trimmed.toLocaleLowerCase("en-US") : null;
}

export function toDictionary(pairs: DictionaryPair[]): Map<string, string> {
  return new Map(pairs);
}

/**
 * 查内置词表（`static/dictionary.json`，由 scripts/build-vocabulary.mjs 从 ECDICT 生成）。
 * 命中即免掉一次翻译，查不到返回 null，由调用方决定回退给谁。
 */
export function lookupMeaning(dictionary: Map<string, string>, text: string): string | null {
  const word = asSingleWord(text);
  return word ? dictionary.get(word) ?? null : null;
}
