import "./youtube";
import type { TranslateResponse, UpsertEntry } from "@learn-english/shared";
import type { BackgroundRequest, BackgroundResponse, EntryStatus } from "./types";

declare global {
  interface Window {
    Translator?: {
      availability(options: { sourceLanguage: string; targetLanguage: string }): Promise<string>;
      create(options: { sourceLanguage: string; targetLanguage: string; monitor?: (monitor: EventTarget) => void }): Promise<{ translate(text: string): Promise<string>; destroy?: () => void }>;
    };
  }
}

const ROOT_ID = "english-garden-root";
let selectionState: { text: string; sentence: string; rect: DOMRect } | null = null;
let translation: TranslateResponse | null = null;
let isSaved = false;
let root: HTMLDivElement | null = null;
let shadow: ShadowRoot | null = null;

function send<T>(message: BackgroundRequest): Promise<T> {
  return chrome.runtime.sendMessage(message).then((response: BackgroundResponse) => {
    if (!response.ok) throw new Error(response.error);
    return response.data as T;
  });
}

function sentenceAround(range: Range, selectedText: string): string {
  const container = range.commonAncestorContainer.nodeType === Node.TEXT_NODE ? range.commonAncestorContainer.parentElement : range.commonAncestorContainer as Element;
  const text = container?.textContent?.replace(/\s+/g, " ").trim() ?? selectedText;
  if (text.length <= 600) {
    const index = text.toLocaleLowerCase().indexOf(selectedText.trim().toLocaleLowerCase());
    if (index >= 0) {
      const left = Math.max(text.lastIndexOf(".", index - 1), text.lastIndexOf("!", index - 1), text.lastIndexOf("?", index - 1), text.lastIndexOf("。", index - 1));
      const endings = [text.indexOf(".", index + selectedText.length), text.indexOf("!", index + selectedText.length), text.indexOf("?", index + selectedText.length), text.indexOf("。", index + selectedText.length)].filter((x) => x >= 0);
      const right = endings.length ? Math.min(...endings) + 1 : text.length;
      return text.slice(left + 1, right).trim().slice(0, 1_000);
    }
    return text.slice(0, 1_000);
  }
  return selectedText;
}

function captureSelection(): typeof selectionState {
  const selection = window.getSelection();
  const text = selection?.toString().replace(/\s+/g, " ").trim() ?? "";
  if (!selection || selection.rangeCount === 0 || !text || text.length > 10_000) return null;
  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  if (!rect.width && !rect.height) return null;
  return { text, sentence: sentenceAround(range, text), rect };
}

function ensureRoot(): ShadowRoot {
  if (shadow && root) return shadow;
  root = document.createElement("div");
  root.id = ROOT_ID;
  root.style.position = "fixed";
  root.style.zIndex = "2147483647";
  root.style.left = "0";
  root.style.top = "0";
  document.documentElement.append(root);
  shadow = root.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    *{box-sizing:border-box} .trigger{width:36px;height:36px;border:0;border-radius:50%;background:#315d43;color:#fff;font:700 17px system-ui;box-shadow:0 6px 20px #1b2e2160;cursor:pointer;display:grid;place-items:center}
    .card{width:min(390px,calc(100vw - 24px));max-height:min(560px,calc(100vh - 24px));overflow:auto;background:#fffdf8;color:#253128;border:1px solid #d7dbd3;border-radius:18px;box-shadow:0 18px 55px #15251b48;font:14px/1.5 system-ui,sans-serif;padding:18px}
    .head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.label{font-size:10px;letter-spacing:.13em;color:#718075;font-weight:800}.original{font-size:20px;font-weight:750;margin:8px 0 16px;overflow-wrap:anywhere}.translation{font-size:16px;background:#edf3e9;padding:14px;border-radius:12px;white-space:pre-wrap}.provider{font-size:11px;color:#79817b;margin-top:7px}.actions{display:flex;align-items:center;gap:8px;margin-top:16px}.heart,.close,.settings{border:0;cursor:pointer}.heart{font-size:23px;width:45px;height:42px;border-radius:50%;background:#f6e9e9;color:#a6aaa6}.heart.saved{color:#d43d4c;background:#fae5e8}.primary{flex:1;border:0;border-radius:999px;background:#315d43;color:#fff;font-weight:750;padding:11px;cursor:pointer}.primary:disabled{opacity:.6;cursor:wait}.close{background:transparent;color:#79817b;font-size:20px;padding:0}.status{margin-top:12px;padding:9px 11px;border-radius:9px;background:#f2eee2;color:#6e6046;font-size:12px}.error{background:#fae7e7;color:#913541}.settings{display:block;margin-top:9px;padding:0;background:transparent;color:#315d43;text-decoration:underline;font-size:12px}
  `;
  shadow.append(style);
  return shadow;
}

function position(rect: DOMRect, width = 38, height = 42): void {
  if (!root) return;
  const left = Math.min(window.innerWidth - width - 12, Math.max(12, rect.left + rect.width / 2));
  const below = rect.bottom + 10;
  const top = below + height < window.innerHeight ? below : Math.max(12, rect.top - height - 10);
  root.style.transform = `translate(${left}px, ${top}px)`;
}

function close(): void {
  root?.remove(); root = null; shadow = null; selectionState = null; translation = null; isSaved = false;
}

function showTrigger(state: NonNullable<typeof selectionState>): void {
  const ui = ensureRoot();
  ui.querySelectorAll(":not(style)").forEach((node) => node.remove());
  const button = document.createElement("button");
  button.className = "trigger"; button.textContent = "译"; button.title = "翻译并收藏";
  button.addEventListener("click", (event) => { event.stopPropagation(); void showCard(); });
  ui.append(button); position(state.rect);
}

async function chromeTranslate(text: string): Promise<TranslateResponse | null> {
  if (!window.Translator) return null;
  try {
    const availability = await window.Translator.availability({ sourceLanguage: "en", targetLanguage: "zh" });
    if (availability === "unavailable") return null;
    const translator = await window.Translator.create({ sourceLanguage: "en", targetLanguage: "zh" });
    const result = await translator.translate(text);
    translator.destroy?.();
    return { translation: result, provider: "chrome" };
  } catch { return null; }
}

async function resolveTranslation(text: string): Promise<TranslateResponse> {
  const builtIn = await chromeTranslate(text);
  if (builtIn) return builtIn;
  return send<TranslateResponse>({ type: "translate-llm", payload: { text, sourceLanguage: "en", targetLanguage: "zh-CN" } });
}

async function showCard(): Promise<void> {
  if (!selectionState) return;
  const state = selectionState;
  const ui = ensureRoot();
  ui.querySelectorAll(":not(style)").forEach((node) => node.remove());
  const card = document.createElement("div"); card.className = "card";
  card.innerHTML = `<div class="head"><div><div class="label">ENGLISH GARDEN</div><div class="original"></div></div><button class="close" aria-label="关闭">×</button></div><div class="translation">正在翻译…</div><div class="provider"></div><div class="actions"><button class="heart" title="收藏">♡</button><button class="primary" disabled>翻译中…</button></div><div class="status" hidden></div><button class="settings" hidden>打开设置</button>`;
  (card.querySelector(".original") as HTMLElement).textContent = state.text;
  ui.append(card);
  const cardWidth = Math.min(390, window.innerWidth - 24);
  const left = Math.min(window.innerWidth - cardWidth - 12, Math.max(12, state.rect.left));
  const top = state.rect.bottom + 12 + 560 < window.innerHeight ? state.rect.bottom + 12 : Math.max(12, state.rect.top - Math.min(560, window.innerHeight - 24) - 12);
  root!.style.transform = `translate(${left}px, ${Math.max(12, top)}px)`;
  card.querySelector(".close")!.addEventListener("click", close);
  const status = card.querySelector(".status") as HTMLElement;
  const settings = card.querySelector(".settings") as HTMLButtonElement;
  settings.addEventListener("click", () => void send({ type: "open-options" }));
  const heart = card.querySelector(".heart") as HTMLButtonElement;
  const primary = card.querySelector(".primary") as HTMLButtonElement;
  try {
    const savedStatus = await send<EntryStatus>({ type: "entry-status", text: state.text, sourceLanguage: "en" }).catch(() => ({ saved: false, entry: null }));
    const result: TranslateResponse = savedStatus.entry
      ? { translation: savedStatus.entry.translation, provider: savedStatus.entry.translationProvider }
      : await resolveTranslation(state.text);
    translation = result; isSaved = savedStatus.saved;
    (card.querySelector(".translation") as HTMLElement).textContent = result.translation;
    (card.querySelector(".provider") as HTMLElement).textContent = result.provider === "chrome" ? "Chrome 内置翻译" : `大模型${result.model ? ` · ${result.model}` : ""}`;
    heart.textContent = isSaved ? "♥" : "♡"; heart.classList.toggle("saved", isSaved);
    primary.disabled = isSaved; primary.textContent = isSaved ? "已收藏" : "收藏到本地";
  } catch (error) {
    (card.querySelector(".translation") as HTMLElement).textContent = "暂时无法翻译";
    primary.disabled = true; primary.textContent = "无法收藏";
    status.hidden = false; status.classList.add("error"); status.textContent = error instanceof Error ? error.message : "翻译失败";
    settings.hidden = false;
  }
  const save = async () => {
    if (!translation || isSaved) return;
    heart.disabled = true; primary.disabled = true; primary.textContent = "正在保存…";
    const payload: UpsertEntry = {
      text: state.text, sourceLanguage: "en", targetLanguage: "zh-CN", translation: translation.translation,
      translationProvider: translation.provider, pageTitle: document.title, url: location.href, contextSentence: state.sentence
    };
    try {
      await send({ type: "save-entry", payload }); isSaved = true; heart.textContent = "♥"; heart.classList.add("saved"); primary.textContent = "已收藏";
      status.hidden = false; status.classList.remove("error"); status.textContent = "已保存到你的本地词库。";
    } catch (error) {
      heart.disabled = false; primary.disabled = false; primary.textContent = "重试收藏"; status.hidden = false; status.classList.add("error"); status.textContent = error instanceof Error ? error.message : "保存失败"; settings.hidden = false;
    }
  };
  heart.addEventListener("click", save); primary.addEventListener("click", save);
}

function prepareSelection(): void {
  const state = captureSelection();
  if (!state) return;
  selectionState = state; translation = null; isSaved = false; showTrigger(state);
}

document.addEventListener("mouseup", (event) => {
  if (root && event.composedPath().includes(root)) return;
  window.setTimeout(() => { const state = captureSelection(); if (state) { selectionState = state; showTrigger(state); } }, 10);
});
document.addEventListener("mousedown", (event) => { if (root && !event.composedPath().includes(root)) close(); });
document.addEventListener("keydown", (event) => { if (event.key === "Escape") close(); });
window.addEventListener("scroll", () => { if (selectionState) close(); }, true);
chrome.runtime.onMessage.addListener((message: { type?: string }) => { if (message.type === "show-selection") prepareSelection(); });
