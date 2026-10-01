import { describe, expect, it } from "vitest";
import { parseApiResponse } from "./api-response";

function response(body: string, status = 200, contentType = "application/json"): Response {
  return new Response(body, { status, headers: { "content-type": contentType } });
}

describe("parseApiResponse", () => {
  it("explains when the web client port returns HTML", async () => {
    const result = parseApiResponse(response("<!doctype html><html></html>", 200, "text/html"), "http://127.0.0.1:5173");
    await expect(result).rejects.toMatchObject({ code: "NOT_API_SERVER" });
    await expect(result).rejects.toThrow(/5173.*3789/);
  });

  it("returns valid JSON from the API", async () => {
    await expect(parseApiResponse(response('{"ok":true}'), "http://127.0.0.1:3789")).resolves.toEqual({ ok: true });
  });

  it("preserves structured API error messages", async () => {
    const result = parseApiResponse(response('{"error":{"code":"NOPE","message":"broken"}}', 409), "http://127.0.0.1:3789");
    await expect(result).rejects.toMatchObject({ code: "NOPE", message: "broken" });
  });
});

