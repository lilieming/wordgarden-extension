import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface ContentScript {
  matches: string[];
  js: string[];
  world?: string;
}

describe("extension manifest", () => {
  const manifest = JSON.parse(readFileSync(resolve(process.cwd(), "static/manifest.json"), "utf8")) as { content_scripts: ContentScript[] };

  it("loads only one isolated-world bundle on YouTube", () => {
    const isolatedBundles = manifest.content_scripts
      .filter((script) => script.world !== "MAIN" && script.matches.some((match) => match === "<all_urls>" || match.includes("youtube.com")))
      .flatMap((script) => script.js);
    expect(isolatedBundles).toEqual(["content.js"]);
    expect(isolatedBundles).not.toContain("youtube.js");
  });

  it("keeps the separate page-world caption bridge", () => {
    const mainWorld = manifest.content_scripts.find((script) => script.world === "MAIN");
    expect(mainWorld?.js).toEqual(["youtube-page.js"]);
  });
});
