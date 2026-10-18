import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { hasCaptionBridge } from "./youtube-caption-bridge";

interface ContentScript {
  matches: string[];
  js: string[];
  world?: string;
}

interface ExtensionManifest {
  name: string;
  version: string;
  description: string;
  permissions: string[];
  background: { service_worker: string; type?: string };
  content_scripts: ContentScript[];
}

const load = (file: string) =>
  JSON.parse(readFileSync(resolve(process.cwd(), "static", file), "utf8")) as ExtensionManifest;

const isolatedBundles = (manifest: ExtensionManifest) =>
  manifest.content_scripts.filter((script) => script.world !== "MAIN").flatMap((script) => script.js);

describe("chrome manifest", () => {
  const manifest = load("manifest.json");

  it("loads only one isolated-world bundle on YouTube", () => {
    const isolated = isolatedBundles(manifest);
    expect(isolated).toEqual(["content.js"]);
    expect(isolated).not.toContain("youtube.js");
  });

  it("keeps the separate page-world caption bridge", () => {
    const mainWorld = manifest.content_scripts.find((script) => script.world === "MAIN");
    expect(mainWorld?.js).toEqual(["youtube-page.js"]);
  });
});

describe("youtube panel mount", () => {
  // 判据错了的后果不对称：把 Chrome 的面板砍掉是线上功能消失，所以直接拿两份真 manifest 验。
  it("mounts where the page-world caption bridge is installed", () => {
    expect(hasCaptionBridge(load("manifest.json"))).toBe(true);
  });

  it("stays off in Safari, where that key is not supported at all", () => {
    expect(hasCaptionBridge(load("manifest.safari.json"))).toBe(false);
  });
});

describe("localized extension copy", () => {
  const locales = readdirSync(resolve(process.cwd(), "static/_locales"));
  const text = (locale: string, key: string) =>
    (JSON.parse(readFileSync(resolve(process.cwd(), "static/_locales", locale, "messages.json"), "utf8")) as Record<string, { message?: string }>)[key]?.message ?? "";
  const keys = ["extensionName", "extensionDescription", "contextMenuTranslate"];

  it("ships the same four languages the App ships in", () => {
    expect([...locales].sort()).toEqual(["en", "ja", "ko", "zh_CN", "zh_TW"]);
  });

  it("defines every key the manifests and the context menu ask for", () => {
    for (const locale of locales) {
      for (const key of keys) expect(text(locale, key), `${locale}.${key}`).toBeTruthy();
    }
  });

  it("points both manifests at the message bundle", () => {
    for (const file of ["manifest.json", "manifest.safari.json"]) {
      const manifest = JSON.parse(readFileSync(resolve(process.cwd(), "static", file), "utf8")) as { name: string; description: string; default_locale: string };
      expect(manifest).toMatchObject({ name: "__MSG_extensionName__", description: "__MSG_extensionDescription__", default_locale: "en" });
    }
  });

  it("stays inside the browser's name and description limits", () => {
    for (const locale of locales) {
      expect(text(locale, "extensionName").length, `name ${locale}`).toBeLessThanOrEqual(75);
      expect(text(locale, "extensionDescription").length, `description ${locale}`).toBeLessThanOrEqual(132);
    }
  });

  // 释义跟着系统语言走，写「中文释义」等于告诉日韩用户这里给的是中文（App 侧同一条规矩）。
  it("never claims the gloss is Chinese", () => {
    for (const locale of locales) {
      expect(text(locale, "extensionDescription")).not.toMatch(/中文|中国語|중국어|Chinese/i);
    }
  });

  // 缺 key 不会报错，只会在界面上渲染成一片空白 —— 所以拿源码里真正引用的键来对账。
  const referencedKeys = (): string[] => {
    const keys = new Set<string>();
    for (const file of readdirSync(resolve(process.cwd(), "src"))) {
      if (!file.endsWith(".ts") || file.endsWith(".test.ts")) continue;
      const source = readFileSync(resolve(process.cwd(), "src", file), "utf8");
      for (const match of source.matchAll(/\b(?:t|getMessage)\("([A-Za-z]+)"/g)) keys.add(match[1] as string);
    }
    for (const file of ["manifest.json", "manifest.safari.json"]) {
      const source = readFileSync(resolve(process.cwd(), "static", file), "utf8");
      for (const match of source.matchAll(/__MSG_([A-Za-z]+)__/g)) keys.add(match[1] as string);
    }
    return [...keys].sort();
  };

  it("has a non-empty translation for every string the code asks for", () => {
    const keys = referencedKeys();
    expect(keys.length).toBeGreaterThan(20);
    for (const locale of locales) {
      for (const key of keys) expect(text(locale, key), `${locale}.${key}`).toBeTruthy();
    }
  });
});

describe("safari manifest", () => {
  const manifest = load("manifest.safari.json");

  // Safari 实测只拒绝这两个 key（xcrun safari-web-extension-packager 报 type 和 world）。
  it("drops the manifest keys Safari ignores", () => {
    expect(manifest.background.type).toBeUndefined();
    expect(manifest.content_scripts.every((script) => script.world === undefined)).toBe(true);
  });

  it("carries no YouTube injection at all", () => {
    expect(isolatedBundles(manifest)).toEqual(["content.js"]);
    expect(manifest.content_scripts.some((script) => script.matches.some((match) => match.includes("youtube.com")))).toBe(false);
  });

  it("can talk to its containing app, which is how iOS saves a word", () => {
    expect(manifest.permissions).toContain("nativeMessaging");
  });

  it("keeps the same identity as the chrome build", () => {
    const chrome = load("manifest.json");
    expect([manifest.name, manifest.version, manifest.description]).toEqual([chrome.name, chrome.version, chrome.description]);
  });
});
