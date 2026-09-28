import type { ApiErrorBody } from "@learn-english/shared";

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
  const portHint = port === "5173"
    ? "你填写的是学习客户端端口 5173；"
    : "你可能填写了学习客户端地址；";
  return `本地服务地址 ${serviceUrl} 返回了网页而不是 API。${portHint}扩展默认应连接 http://127.0.0.1:3789。`;
}

export async function parseApiResponse(response: Response, serviceUrl: string): Promise<unknown> {
  if (response.status === 204) return undefined;

  const contentType = response.headers.get("content-type")?.toLocaleLowerCase() ?? "";
  const text = await response.text();
  const looksLikeHtml = contentType.includes("text/html") || /^\s*<!doctype\s+html/i.test(text) || /^\s*<html/i.test(text);
  if (looksLikeHtml) throw new ExtensionApiError(wrongServiceMessage(serviceUrl), "NOT_API_SERVER");

  if (!contentType.includes("json")) {
    const detail = text.trim().slice(0, 160);
    throw new ExtensionApiError(
      `本地服务返回了无法识别的内容类型${contentType ? ` (${contentType})` : ""}${detail ? `：${detail}` : "。"}`,
      "INVALID_CONTENT_TYPE"
    );
  }

  let body: unknown;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    throw new ExtensionApiError("本地服务返回了无效 JSON。请确认连接的是 English Garden API。", "INVALID_JSON");
  }

  if (!response.ok) {
    const apiError = body as ApiErrorBody | null;
    throw new ExtensionApiError(apiError?.error?.message ?? `本地服务请求失败 (${response.status})`, apiError?.error?.code);
  }
  return body;
}
