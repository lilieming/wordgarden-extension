import { describe, expect, it } from "vitest";
import { asSingleWord, lookupMeaning, toDictionary } from "./dictionary-lookup";

const dictionary = toDictionary([
  ["absence", "n. 缺席, 缺乏, 没有"],
  ["perceived", "v. 感觉( perceive的过去式和过去分词 )"],
  ["a", "art. 一"]
]);

describe("dictionary-lookup", () => {
  it("normalises a single word and hits the packaged dictionary", () => {
    expect(asSingleWord("  Absence ")).toBe("absence");
    expect(lookupMeaning(dictionary, "Absence")).toBe("n. 缺席, 缺乏, 没有");
    expect(lookupMeaning(dictionary, "perceived")).toContain("perceive");
  });

  it("leaves phrases, sentences and punctuation to the browser translator", () => {
    expect(asSingleWord("in the absence of")).toBeNull();
    expect(asSingleWord("absence.")).toBeNull();
    expect(asSingleWord("")).toBeNull();
    expect(lookupMeaning(dictionary, "absence of")).toBeNull();
  });

  it("returns null for words the dictionary does not carry", () => {
    expect(lookupMeaning(dictionary, "bilingualism")).toBeNull();
  });
});
