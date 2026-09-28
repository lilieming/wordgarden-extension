import { describe, expect, it } from "vitest";
import { wrapExtensionChunk } from "../build-scope";

describe("extension bundle scoping", () => {
  it("allows independently minified content scripts to reuse top-level names", () => {
    const content = wrapExtensionChunk("const z = 'selection';");
    const youtube = wrapExtensionChunk("const z = 'youtube';");
    expect(() => new Function(`${content}\n${youtube}`)).not.toThrow();
  });

  it("does not leak bundle bindings onto the global object", () => {
    const run = new Function(`${wrapExtensionChunk("const z = 'private';")} return typeof z;`);
    expect(run()).toBe("undefined");
  });
});
