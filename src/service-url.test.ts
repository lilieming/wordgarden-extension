import { describe, expect, it } from "vitest";
import { normalizeServiceUrl, serviceUrlWarning } from "./service-url";
import { t } from "./copy.options";

describe("service URL", () => {
  it("normalizes a valid API root", () => {
    expect(normalizeServiceUrl(" http://127.0.0.1:3789/ ")).toBe("http://127.0.0.1:3789");
  });

  it("rejects API paths", () => {
    expect(() => normalizeServiceUrl("http://127.0.0.1:3789/api/health")).toThrow(t("urlPath"));
  });

  it("warns for the Vite client port", () => {
    expect(serviceUrlWarning("http://127.0.0.1:5173")).toBe(t("urlPort5173"));
  });
});
