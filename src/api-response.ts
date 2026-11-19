import type { ApiErrorBody } from "@learn-english/shared";
import { t } from "./copy.background";

export class ExtensionApiError extends Error {
  constructor(message: string, public readonly code?: string) {
    super(message);
    this.name = "ExtensionApiError";
  }
}

function wrongServiceMessage(serviceUrl: string): string {
  const port = (() => {
    try { return new URL(serviceUrl).port; } catch { return ""; }
  })();
  return port === "5173" ? t("errWrongServiceUrl5173", serviceUrl) : t("errWrongServiceUrl", serviceUrl);
}

export async function parseApiResponse(response: Response, serviceUrl: string): Promise<unknown> {
  if (response.status === 204) return undefined;

  const contentType = response.headers.get("content-type")?.toLocaleLowerCase() ?? "";
  const text = await response.text();
  const looksLikeHtml = contentType.includes("text/html") || /^\s*<!doctype\s+html/i.test(text) || /^\s*<html/i.test(text);
  if (looksLikeHtml) throw new ExtensionApiError(wrongServiceMessage(serviceUrl), "NOT_API_SERVER");

  if (!contentType.includes("json")) {
    const detail = text.trim().slice(0, 160);
    const base = contentType ? t("errContentType", contentType) : t("errContentTypeBare");
    throw new ExtensionApiError(detail ? `${base} ${detail}` : base, "INVALID_CONTENT_TYPE");
  }

  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new ExtensionApiError(t("errInvalidJson"), "INVALID_JSON");
  }

  if (!response.ok) {
    const apiError = body as ApiErrorBody | null;
    throw new ExtensionApiError(apiError?.error?.message ?? t("errRequestFailed", response.status), apiError?.error?.code);
  }
  return body;
}
