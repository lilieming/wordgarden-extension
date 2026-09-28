import type { BackgroundRequest, BackgroundResponse, ServiceConfig } from "./types";
import { ExtensionApiError, parseApiResponse } from "./api-response";

const DEFAULT_CONFIG: ServiceConfig = { serviceUrl: "http://127.0.0.1:3789" };

async function getConfig(): Promise<ServiceConfig> {
  return { ...DEFAULT_CONFIG, ...(await chrome.storage.sync.get(DEFAULT_CONFIG)) } as ServiceConfig;
}

async function api(path: string, init?: RequestInit, serviceUrlOverride?: string): Promise<unknown> {
  const config = await getConfig();
  const serviceUrl = (serviceUrlOverride ?? config.serviceUrl).replace(/\/$/, "");
  let response: Response;
  try {
    response = await fetch(`${serviceUrl}${path}`, {
      ...init,
      headers: { "content-type": "application/json", ...init?.headers }
    });
  } catch {
    throw new ExtensionApiError(`无法连接本地服务 ${serviceUrl}。请确认 API 已启动；默认地址是 http://127.0.0.1:3789。`, "SERVICE_UNREACHABLE");
  }
  return parseApiResponse(response, serviceUrl);
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: "english-garden-translate", title: "在 English Garden 中翻译", contexts: ["selection"] });
});

chrome.contextMenus.onClicked.addListener((_info, tab) => {
  if (tab?.id) void chrome.tabs.sendMessage(tab.id, { type: "show-selection" }).catch(() => undefined);
});
chrome.commands.onCommand.addListener((_command, tab) => {
  if (tab?.id) void chrome.tabs.sendMessage(tab.id, { type: "show-selection" }).catch(() => undefined);
});
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

chrome.runtime.onMessage.addListener((message: BackgroundRequest, _sender, sendResponse: (value: BackgroundResponse) => void) => {
  void (async () => {
    try {
      switch (message.type) {
        case "translate-llm": sendResponse({ ok: true, data: await api("/api/translate", { method: "POST", body: JSON.stringify(message.payload) }) }); break;
        case "translate-words": sendResponse({ ok: true, data: await api("/api/translate-words", { method: "POST", body: JSON.stringify(message.payload) }) }); break;
        case "entry-status": sendResponse({ ok: true, data: await api(`/api/entries/status?text=${encodeURIComponent(message.text)}&sourceLanguage=${encodeURIComponent(message.sourceLanguage)}`) }); break;
        case "save-entry": sendResponse({ ok: true, data: await api("/api/entries", { method: "PUT", body: JSON.stringify(message.payload) }) }); break;
        case "save-video-words": sendResponse({ ok: true, data: await api("/api/video-learning/save-words", { method: "POST", body: JSON.stringify(message.payload) }) }); break;
        case "health": {
          const data = await api("/api/health", undefined, message.serviceUrl);
          if (!data || typeof data !== "object" || !("ok" in data) || data.ok !== true) {
            throw new ExtensionApiError("该地址返回了 JSON，但不是 English Garden API。", "NOT_API_SERVER");
          }
          sendResponse({ ok: true, data });
          break;
        }
        case "open-options": await chrome.runtime.openOptionsPage(); sendResponse({ ok: true }); break;
      }
    } catch (error) {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : "未知错误", code: error && typeof error === "object" && "code" in error ? String(error.code) : undefined });
    }
  })();
  return true;
});
