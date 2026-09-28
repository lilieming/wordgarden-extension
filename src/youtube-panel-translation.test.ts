import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("YouTube unknown-word translations", () => {
  const source = readFileSync(resolve(process.cwd(), "src/youtube.ts"), "utf8");
  const background = readFileSync(resolve(process.cwd(), "src/background.ts"), "utf8");

  it("loads translations for unknown words when their tab is opened", () => {
    expect(source).toContain("loadUnknownTranslations(panel)");
    expect(source).toContain("type: \"translate-words\"");
    expect(source).toContain("translations.get(item.word)");
  });

  it("renders a Chinese translation on unknown-word cards", () => {
    expect(source).toContain('translation.className = "translation"');
    expect(source).toContain("wordView === \"unknown\"");
    expect(background).toContain('case "translate-words"');
    expect(background).toContain('api("/api/translate-words"');
  });
});
