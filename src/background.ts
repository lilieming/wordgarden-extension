import type { BackgroundRequest, BackgroundResponse, ServiceConfig } from "./types";
import { ExtensionApiError, parseApiResponse } from "./api-response";
import { lookupMeaning, toDictionary } from "./dictionary-lookup";

const DEFAULT_CONFIG: ServiceConfig = { serviceUrl: "http://127.0.0.1:3789" };

let dictionary: Promise<Map<string, string>> | null = null;

/**
 * 内置词表 1.6MB，不等 service worker 一唤醒就解，第一次真有人查词才解。
 * 读失败就当词表是空的：查不到本来会回退浏览器翻译，不该因此卡住取词。
 */
function loadDictionary(): Promise<Map<string, string>> {
  dictionary ??= fetch(chrome.runtime.getURL("dictionary.json"))
    .then((response) => (response.ok ? response.json() : { words: [] }))
    .then((payload: { words: [string, string][] }) => toDictionary(payload.words))
    .catch(() => new Map<string, string>());
  return dictionary;
}

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
  chrome.contextMenus.create({ id: "english-garden-translate", title: "在 Word Garden 中翻译", contexts: ["selection"] });
});

chrome.contextMenus.onClicked.addListener((_info, tab) => {
  if (tab?.id) void chrome.tabs.sendMessage(tab.id, { type: "show-selection" }).catch(() => undefined);
});
chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

chrome.runtime.onMessage.addListener((message: BackgroundRequest, _sender, sendResponse: (value: BackgroundResponse) => void) => {
  void (async () => {
    try {
      switch (message.type) {
        case "lookup-word": sendResponse({ ok: true, data: { meaning: lookupMeaning(await loadDictionary(), message.word) } }); break;
        case "translate-llm": sendResponse({ ok: true, data: await api("/api/translate", { method: "POST", body: JSON.stringify(message.payload) }) }); break;
        case "entry-status": sendResponse({ ok: true, data: await api(`/api/entries/status?text=${encodeURIComponent(message.text)}&sourceLanguage=${encodeURIComponent(message.sourceLanguage)}`) }); break;
        case "save-entry": sendResponse({ ok: true, data: await api("/api/entries", { method: "PUT", body: JSON.stringify(message.payload) }) }); break;
        case "save-video-words": sendResponse({ ok: true, data: await api("/api/video-learning/save-words", { method: "POST", body: JSON.stringify(message.payload) }) }); break;
        case "health": {
          const data = await api("/api/health", undefined, message.serviceUrl);
          if (!data || typeof data !== "object" || !("ok" in data) || data.ok !== true) {
            throw new ExtensionApiError("该地址返回了 JSON，但不是 Word Garden API。", "NOT_API_SERVER");
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
