import type { UpsertEntry } from "@learn-english/shared";
import type { BackgroundRequest, BackgroundResponse, ServiceConfig } from "./types";
import { ExtensionApiError, parseApiResponse } from "./api-response";
import { lookupMeaning, toDictionary } from "./dictionary-lookup";
import { t } from "./copy.background";
import { appRelayAvailable } from "./platform";

const DEFAULT_CONFIG: ServiceConfig = { serviceUrl: "http://127.0.0.1:3789" };

/**
 * Safari 网页扩展的原生外壳（app extension）收消息用的名字。
 *
 * Chrome/Firefox 把它当本机注册的 native host 名，Safari 则忽略这个参数、一律投给
 * 自己的容器 App —— 所以填 App 的 bundle id 只是把这个必填参数写得说得通。
 */
const APP_RELAY_ID = "app.wordgarden.safari";

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

/**
 * 界面文案：构建期从 `static/_locales` 编进来的自包含模块（`build-copy.mjs`），
 * 运行时不依赖 `chrome.i18n` —— Safari 里 manifest 的 `__MSG_` 替换是好的，
 * 但 `getMessage()` 返回空串（2026-10-18 实测）。
 */

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
    throw new ExtensionApiError(t("errServiceUnreachable", serviceUrl), "SERVICE_UNREACHABLE");
  }
  return parseApiResponse(response, serviceUrl);
}

/**
 * 把词交给宿主 App 的 app extension 排队，等 App 回前台入库。
 *
 * 只有 iOS 构建会走到这里：App 一退后台就挂起，本机根本没有服务可打。macOS 不排队是因为
 * 主 App 要读那条共享钥匙串就得加 keychain-access-groups，而动的正是它已存 API Key 那把组，
 * 不该在这个改动里顺手碰；macOS 继续要求服务在跑，连不上就照实报错。
 */
async function relayToApp(payload: UpsertEntry): Promise<{ queued: true }> {
  const reply = await chrome.runtime.sendNativeMessage(APP_RELAY_ID, {
    text: payload.text,
    pageURL: payload.url,
    pageTitle: payload.pageTitle
  }) as { ok?: boolean; error?: string } | undefined;
  // 原生外壳没存下就等于没收藏，别一脸诚意地说「已排队」。
  if (reply && reply.ok === false) throw new ExtensionApiError(reply.error || t("errRelayRejected"), "RELAY_REJECTED");
  return { queued: true };
}

/**
 * 收藏只有两条路，且都不带空译文去 PUT：服务端按 schema 拒收空译文，
 * 没释义的词只能排队让 App 补。
 */
async function saveEntry(payload: UpsertEntry): Promise<unknown> {
  const put = () => api("/api/entries", { method: "PUT", body: JSON.stringify(payload) });
  if (!appRelayAvailable) return put();
  if (!payload.translation.trim()) return relayToApp(payload);
  try {
    return await put();
  } catch (error) {
    // 只有「服务没开」才换通道；地址填错这类问题照原样报出来，别悄悄改道。
    if (!(error instanceof ExtensionApiError) || error.code !== "SERVICE_UNREACHABLE") throw error;
    return relayToApp(payload).catch(() => { throw error; });
  }
}

// iOS 上这两个 API 整个不存在，摸一下就是 service worker 启动即崩，后面消息全收不到。
const hasContextMenuApi = "contextMenus" in chrome;
const hasActionApi = "action" in chrome;

chrome.runtime.onInstalled.addListener(() => {
  if (hasContextMenuApi) chrome.contextMenus.create({ id: "english-garden-translate", title: t("contextMenuTranslate"), contexts: ["selection"] });
});

if (hasContextMenuApi) {
  chrome.contextMenus.onClicked.addListener((_info, tab) => {
    if (tab?.id) void chrome.tabs.sendMessage(tab.id, { type: "show-selection" }).catch(() => undefined);
  });
}
if (hasActionApi) chrome.action.onClicked.addListener(() => chrome.runtime.openOptionsPage());

chrome.runtime.onMessage.addListener((message: BackgroundRequest, _sender, sendResponse: (value: BackgroundResponse) => void) => {
  void (async () => {
    try {
      switch (message.type) {
        case "lookup-word": sendResponse({ ok: true, data: { meaning: lookupMeaning(await loadDictionary(), message.word) } }); break;
        // iOS 上没有本机服务可问：释义只认扩展自带的词表，别去撞一个必然被拒的连接。
        case "translate-llm": if (appRelayAvailable) throw new ExtensionApiError(t("errNoLocalService"), "NO_LOCAL_SERVICE"); sendResponse({ ok: true, data: await api("/api/translate", { method: "POST", body: JSON.stringify(message.payload) }) }); break;
        case "entry-status": sendResponse({ ok: true, data: appRelayAvailable ? { saved: false, entry: null } : await api(`/api/entries/status?text=${encodeURIComponent(message.text)}&sourceLanguage=${encodeURIComponent(message.sourceLanguage)}`) }); break;
        case "save-entry": sendResponse({ ok: true, data: await saveEntry(message.payload) }); break;
        case "save-video-words": sendResponse({ ok: true, data: await api("/api/video-learning/save-words", { method: "POST", body: JSON.stringify(message.payload) }) }); break;
        case "health": {
          const data = await api("/api/health", undefined, message.serviceUrl);
          if (!data || typeof data !== "object" || !("ok" in data) || data.ok !== true) {
            throw new ExtensionApiError(t("errNotApiJson"), "NOT_API_SERVER");
          }
          sendResponse({ ok: true, data });
          break;
        }
        case "open-options": await chrome.runtime.openOptionsPage(); sendResponse({ ok: true }); break;
      }
    } catch (error) {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : t("errUnknown"), code: error && typeof error === "object" && "code" in error ? String(error.code) : undefined });
    }
  })();
  return true;
});
