import type { SaveVideoWordsRequest } from "@learn-english/shared";
import type { BackgroundRequest, BackgroundResponse } from "./types";
import { buildYouTubeWords, formatTimestamp, type YouTubeCaptionSegment, type YouTubeWord } from "./youtube-words";
import { createWordScrollPositions, rememberWordScroll, restoredWordScroll, type WordView } from "./youtube-panel-scroll";

interface PageTranscript {
  videoId: string;
  title: string;
  author: string;
  duration: number;
  language: string;
  url: string;
  segments: YouTubeCaptionSegment[];
}

interface TranscriptMessage {
  source: "english-garden-youtube-page";
  type: "TRANSCRIPT_RESULT" | "VIDEO_NAVIGATED";
  requestId?: string;
  ok?: boolean;
  error?: string;
  videoId?: string | null;
  data?: PageTranscript;
}

const ROOT_ID = "english-garden-youtube-panel";
const REQUEST_SOURCE = "english-garden-extension";
let root: HTMLDivElement | null = null;
let shadow: ShadowRoot | null = null;
let transcript: PageTranscript | null = null;
let words: YouTubeWord[] = [];
let selected = new Set<string>();
let saved = new Set<string>();
let cursor = new Map<string, number>();
let activeWord = "";
let filter = "";
let wordView: WordView = "all";
let wordScrollPositions = createWordScrollPositions();
let loading = false;
let error = "";
let notice = "";
let replayTimer: number | null = null;

function isWatchPage(): boolean {
  return location.pathname === "/watch" && Boolean(new URL(location.href).searchParams.get("v"));
}

function send<T>(message: BackgroundRequest): Promise<T> {
  return chrome.runtime.sendMessage(message).then((response: BackgroundResponse) => {
    if (!response.ok) throw new Error(response.error);
    return response.data as T;
  });
}

function ensureRoot(): ShadowRoot {
  if (root && shadow) return shadow;
  root = document.createElement("div");
  root.id = ROOT_ID;
  root.style.position = "fixed";
  root.style.zIndex = "2147483646";
  root.style.right = "14px";
  root.style.top = "74px";
  document.documentElement.append(root);
  shadow = root.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    *{box-sizing:border-box} button,input{font:inherit}.launcher{width:54px;height:54px;border:0;border-radius:50%;background:#315d43;color:#fff;font:800 15px system-ui;box-shadow:0 10px 30px #17251c66;cursor:pointer}.panel{display:flex;flex-direction:column;width:min(410px,calc(100vw - 28px));height:calc(100vh - 90px);border:1px solid #cdd5ca;border-radius:20px;background:#fffdf8;color:#213026;box-shadow:0 20px 70px #17251c55;font:14px/1.45 system-ui,sans-serif;overflow:hidden}.head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:18px;border-bottom:1px solid #e3e3da}.eyebrow{margin:0 0 5px;color:#6e8172;font-size:10px;font-weight:800;letter-spacing:.16em}.head h2{margin:0;font-size:22px}.head-actions{display:flex;gap:5px}.head button{border:0;background:transparent;color:#637068;font-size:18px;cursor:pointer}.load{margin:14px;border:0;border-radius:999px;padding:12px;background:#315d43;color:#fff;font-weight:800;cursor:pointer}.load:disabled{opacity:.6;cursor:wait}.status{margin:0 14px 12px;padding:10px;border-radius:10px;background:#edf2e9;color:#5e6a61}.error{background:#f8e5e6;color:#913740}.notice{background:#e3eee0;color:#315d43}.meta{padding:0 16px 10px;color:#707970;font-size:12px}.word-tabs{display:flex;gap:5px;margin:0 14px 10px;padding:4px;border-radius:999px;background:#edf0e9}.word-tab{flex:1;border:0;border-radius:999px;padding:7px 9px;background:transparent;color:#667168;font-weight:750;cursor:pointer}.word-tab.active{background:#315d43;color:#fff}.tools{display:flex;gap:8px;padding:0 14px 12px}.tools input{min-width:0;flex:1;border:1px solid #cbd1c8;border-radius:10px;padding:10px;background:#fff}.save{border:0;border-radius:10px;padding:9px 12px;background:#315d43;color:#fff;font-weight:750;cursor:pointer}.save:disabled{opacity:.5;cursor:not-allowed}.words{display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:minmax(98px,max-content);align-content:start;gap:7px;min-height:0;flex:1;padding:0 12px 16px;overflow:auto}.word{position:relative;min-width:0;min-height:98px;border:1px solid #d9ddd5;border-radius:12px;background:#fff;overflow:hidden}.word.active{border-color:#5d8464;box-shadow:0 0 0 2px #5d84641f}.word.chosen{background:#edf4e9;border-color:#91aa8e}.play{display:flex;width:100%;height:100%;min-height:96px;flex-direction:column;align-items:flex-start;gap:2px;border:0;padding:11px 10px 28px;background:transparent;color:#213026;text-align:left;cursor:pointer}.play strong{max-width:100%;overflow:hidden;text-overflow:ellipsis;font-size:16px}.time{color:#54705b;font-size:11px}.count{color:#858d87;font-size:11px}.pick{position:absolute;right:8px;bottom:6px;display:flex;align-items:center;gap:4px;color:#677168;font-size:10px;cursor:pointer}.pick input{margin:0;accent-color:#315d43}.context{margin:0 14px 12px;padding:10px;border-radius:10px;background:#f0eee6;color:#5c655e}.context strong{display:block;margin-bottom:3px}.empty{padding:50px 20px;text-align:center;color:#7c847d}.word-list-empty{grid-column:1/-1}.footer{padding:9px 14px;border-top:1px solid #e4e4dc;color:#7b827c;font-size:11px}.saved{color:#315d43;font-weight:750}@media(max-width:700px){.panel{width:calc(100vw - 16px);height:calc(100vh - 82px)}.words{grid-template-columns:1fr}}
  `;
  shadow.append(style);
  return shadow;
}

function closePanel(): void {
  root?.remove(); root = null; shadow = null;
}

function resetForNavigation(): void {
  transcript = null; words = []; selected = new Set(); saved = new Set(); cursor = new Map(); activeWord = ""; filter = ""; wordView = "all"; wordScrollPositions = createWordScrollPositions(); loading = false; error = ""; notice = "";
  if (replayTimer !== null) window.clearTimeout(replayTimer);
  replayTimer = null;
  closePanel();
  if (isWatchPage()) renderLauncher();
}

function renderLauncher(): void {
  if (!isWatchPage()) { closePanel(); return; }
  const ui = ensureRoot();
  ui.querySelectorAll(":not(style)").forEach((node) => node.remove());
  const button = document.createElement("button");
  button.className = "launcher";
  button.textContent = "学词";
  button.title = "用 English Garden 学习当前视频";
  button.addEventListener("click", () => { renderPanel(); void requestTranscript(); });
  ui.append(button);
}

function unknownWordCount(): number {
  return new Set([...selected, ...saved]).size;
}

function isUnknownWord(word: string): boolean {
  return selected.has(word) || saved.has(word);
}

function visibleWords(): YouTubeWord[] {
  const query = filter.trim().toLocaleLowerCase("en-US");
  return words.filter((item) => (wordView === "all" || isUnknownWord(item.word)) && (!query || item.word.includes(query)));
}

function showPanelError(message: string): void {
  error = message;
  const panel = shadow?.querySelector<HTMLElement>(".panel");
  if (!panel) return;
  let status = panel.querySelector<HTMLElement>(".status.error");
  if (!status) {
    status = document.createElement("div");
    status.className = "status error";
    panel.querySelector(".head")?.insertAdjacentElement("afterend", status);
  }
  status.textContent = message;
}

function updatePanelControls(panel: HTMLElement): void {
  const saveButton = panel.querySelector<HTMLButtonElement>(".save");
  if (saveButton) {
    saveButton.disabled = selected.size === 0;
    saveButton.textContent = `加入词库 (${selected.size})`;
  }
  const allTab = panel.querySelector<HTMLButtonElement>('[data-view="all"]');
  const unknownTab = panel.querySelector<HTMLButtonElement>('[data-view="unknown"]');
  if (allTab) {
    allTab.textContent = `全部单词 (${words.length})`;
    allTab.classList.toggle("active", wordView === "all");
  }
  if (unknownTab) {
    unknownTab.textContent = `不认识 (${unknownWordCount()})`;
    unknownTab.classList.toggle("active", wordView === "unknown");
  }
}

function rememberCurrentWordScroll(panel: HTMLElement, view: WordView = wordView): void {
  const list = panel.querySelector<HTMLElement>(".words");
  if (list) rememberWordScroll(wordScrollPositions, view, list.scrollTop);
}

function restoreCurrentWordScroll(list: HTMLElement): void {
  const restore = () => {
    if (!list.isConnected) return;
    list.scrollTop = restoredWordScroll(wordScrollPositions, wordView, list.scrollHeight, list.clientHeight);
  };
  restore();
  window.requestAnimationFrame(restore);
}

function renderWordList(panel: HTMLElement): void {
  const list = panel.querySelector<HTMLElement>(".words");
  if (!list) return;
  list.replaceChildren();
  const filtered = visibleWords();
  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty word-list-empty";
    empty.textContent = wordView === "unknown" ? "还没有标记不认识的单词。" : "没有匹配的单词。";
    list.append(empty);
  } else {
    for (const item of filtered) list.append(createWordCard(item));
  }
  restoreCurrentWordScroll(list);
}

function updateContext(item: YouTubeWord, occurrenceIndex: number): void {
  const context = shadow?.querySelector<HTMLElement>(".context");
  if (!context) return;
  const occurrence = item.occurrences[occurrenceIndex];
  if (!occurrence) return;
  context.hidden = false;
  context.replaceChildren();
  const strong = document.createElement("strong");
  strong.textContent = `${item.word} · ${formatTimestamp(occurrence.offset)}`;
  const span = document.createElement("span");
  span.textContent = occurrence.context;
  context.append(strong, span);
}

function updateActiveWordCards(item: YouTubeWord): void {
  const panel = shadow?.querySelector<HTMLElement>(".panel");
  if (!panel) return;
  panel.querySelectorAll<HTMLElement>(".word.active").forEach((card) => card.classList.remove("active"));
  const card = [...panel.querySelectorAll<HTMLElement>(".word")].find((candidate) => candidate.dataset.word === item.word);
  card?.classList.add("active");
  const nextIndex = cursor.get(item.word) ?? 0;
  const nextOccurrence = item.occurrences[nextIndex] ?? item.occurrences[0]!;
  const time = card?.querySelector<HTMLElement>(".time");
  if (time) time.textContent = formatTimestamp(nextOccurrence.offset);
}

function renderPanel(): void {
  const existingPanel = shadow?.querySelector<HTMLElement>(".panel");
  if (existingPanel) rememberCurrentWordScroll(existingPanel);
  const ui = ensureRoot();
  ui.querySelectorAll(":not(style)").forEach((node) => node.remove());
  const panel = document.createElement("section"); panel.className = "panel";
  panel.innerHTML = `
    <header class="head"><div><p class="eyebrow">ENGLISH GARDEN</p><h2>当前视频学单词</h2></div><div class="head-actions"><button class="reload" title="重新读取字幕">↻</button><button class="close" title="收起">×</button></div></header>
    ${!transcript ? `<button class="load" ${loading ? "disabled" : ""}>${loading ? "正在读取当前账号可见字幕…" : "读取当前视频字幕"}</button>` : ""}
    ${error ? `<div class="status error"></div>` : ""}${notice ? `<div class="status notice"></div>` : ""}
    ${transcript ? `<div class="meta"><strong></strong><br><span>${words.length} 个不重复单词 · ${transcript.language}</span></div><nav class="word-tabs"><button class="word-tab" data-view="all"></button><button class="word-tab" data-view="unknown"></button></nav><div class="tools"><input class="filter" placeholder="筛选单词…" value=""><button class="save" ${selected.size === 0 ? "disabled" : ""}>加入词库 (${selected.size})</button></div><div class="context" ${activeWord ? "" : "hidden"}></div><div class="words"></div><footer class="footer">点击单词：跳到下一处并重播 · 勾选“不认识”：批量加入本地词库</footer>` : `<div class="empty">直接读取你登录状态下当前 YouTube 页面可见的英文字幕。</div>`}
  `;
  ui.append(panel);
  panel.querySelector<HTMLButtonElement>(".close")?.addEventListener("click", renderLauncher);
  panel.querySelector<HTMLButtonElement>(".reload")?.addEventListener("click", () => void requestTranscript());
  panel.querySelector<HTMLButtonElement>(".load")?.addEventListener("click", () => void requestTranscript());
  if (error) panel.querySelector<HTMLElement>(".status.error")!.textContent = error;
  if (notice) panel.querySelector<HTMLElement>(".status.notice")!.textContent = notice;
  if (!transcript) return;
  panel.querySelector<HTMLElement>(".meta strong")!.textContent = transcript.title;
  const filterInput = panel.querySelector<HTMLInputElement>(".filter")!;
  filterInput.value = filter;
  filterInput.addEventListener("input", () => { rememberCurrentWordScroll(panel); filter = filterInput.value; renderWordList(panel); });
  panel.querySelectorAll<HTMLButtonElement>(".word-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const nextView: WordView = tab.dataset.view === "unknown" ? "unknown" : "all";
      if (nextView === wordView) return;
      rememberCurrentWordScroll(panel);
      wordView = nextView;
      updatePanelControls(panel);
      renderWordList(panel);
    });
  });
  panel.querySelector<HTMLButtonElement>(".save")!.addEventListener("click", () => void saveSelectedWords());
  if (activeWord) {
    const item = words.find((word) => word.word === activeWord);
    const occurrenceIndex = Math.max(0, (cursor.get(activeWord) ?? 1) - 1) % (item?.occurrences.length ?? 1);
    if (item) updateContext(item, occurrenceIndex);
  }
  updatePanelControls(panel);
  const wordList = panel.querySelector<HTMLElement>(".words")!;
  wordList.addEventListener("scroll", () => rememberWordScroll(wordScrollPositions, wordView, wordList.scrollTop), { passive: true });
  renderWordList(panel);
}

function createWordCard(item: YouTubeWord): HTMLElement {
  const card = document.createElement("article");
  card.dataset.word = item.word;
  card.className = `word${activeWord === item.word ? " active" : ""}${isUnknownWord(item.word) ? " chosen" : ""}`;
  const play = document.createElement("button"); play.className = "play";
  const occurrenceIndex = cursor.get(item.word) ?? 0;
  const occurrence = item.occurrences[Math.min(occurrenceIndex, item.occurrences.length - 1)] ?? item.occurrences[0]!;
  const strong = document.createElement("strong"); strong.textContent = item.word;
  const time = document.createElement("span"); time.className = "time"; time.textContent = formatTimestamp(occurrence.offset);
  const count = document.createElement("span"); count.className = "count"; count.textContent = `出现 ${item.count} 次${item.count > 1 ? " · 再点下一处" : ""}`;
  play.append(strong, time, count); play.addEventListener("click", () => playWord(item));
  const label = document.createElement("label"); label.className = "pick";
  const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.checked = isUnknownWord(item.word); checkbox.disabled = saved.has(item.word);
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) selected.add(item.word); else selected.delete(item.word);
    card.classList.toggle("chosen", isUnknownWord(item.word));
    const panel = card.closest<HTMLElement>(".panel");
    if (!panel) return;
    updatePanelControls(panel);
    if (wordView === "unknown" && !isUnknownWord(item.word)) {
      const list = card.parentElement;
      const scrollTop = list?.scrollTop ?? 0;
      card.remove();
      if (list && list.querySelectorAll(".word").length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty word-list-empty";
        empty.textContent = "还没有标记不认识的单词。";
        list.append(empty);
      }
      if (list) {
        list.scrollTop = scrollTop;
        rememberWordScroll(wordScrollPositions, wordView, list.scrollTop);
      }
    }
  });
  const text = document.createElement("span"); text.textContent = saved.has(item.word) ? "已加入" : "不认识";
  label.append(checkbox, text); card.append(play, label); return card;
}

async function requestTranscript(): Promise<void> {
  loading = true; error = ""; notice = ""; transcript = null; words = []; selected = new Set(); cursor = new Map(); activeWord = ""; wordView = "all"; wordScrollPositions = createWordScrollPositions(); renderPanel();
  const requestId = crypto.randomUUID();
  try {
    const result = await new Promise<PageTranscript>((resolve, reject) => {
      const timeout = window.setTimeout(() => { cleanup(); reject(new Error("读取字幕超时。请确认视频已开始加载，或先打开 YouTube 的“显示文字记录”。")); }, 15_000);
      const onMessage = (event: MessageEvent<TranscriptMessage>) => {
        const message = event.data;
        if (event.source !== window || message?.source !== "english-garden-youtube-page" || message.type !== "TRANSCRIPT_RESULT" || message.requestId !== requestId) return;
        cleanup();
        if (message.ok && message.data) resolve(message.data); else reject(new Error(message.error ?? "字幕读取失败"));
      };
      const cleanup = () => { window.clearTimeout(timeout); window.removeEventListener("message", onMessage as EventListener); };
      window.addEventListener("message", onMessage as EventListener);
      window.postMessage({ source: REQUEST_SOURCE, type: "REQUEST_TRANSCRIPT", requestId }, "*");
    });
    transcript = result;
    words = buildYouTubeWords(result.segments);
    if (words.length === 0) throw new Error("字幕中没有识别到英文单词。");
    notice = `已从当前登录页面读取 ${words.length} 个不重复单词。`;
  } catch (cause) {
    error = cause instanceof Error ? cause.message : "字幕读取失败";
  } finally { loading = false; renderPanel(); }
}

function playWord(item: YouTubeWord): void {
  const index = cursor.get(item.word) ?? 0;
  const occurrence = item.occurrences[index] ?? item.occurrences[0]!;
  cursor.set(item.word, (index + 1) % item.occurrences.length);
  activeWord = item.word;
  const video = document.querySelector<HTMLVideoElement>("video.html5-main-video, video");
  if (!video) { showPanelError("没有找到 YouTube 播放器，请刷新页面后重试。"); return; }
  if (replayTimer !== null) window.clearTimeout(replayTimer);
  video.currentTime = Math.max(0, occurrence.offset - 0.6);
  void video.play().catch(() => undefined);
  replayTimer = window.setTimeout(() => video.pause(), Math.max(2500, Math.min(8000, occurrence.duration * 1000 + 1000)));
  updateContext(item, index);
  updateActiveWordCards(item);
}

async function saveSelectedWords(): Promise<void> {
  if (!transcript || selected.size === 0) return;
  error = ""; notice = "正在翻译并保存…"; renderPanel();
  const chosen = words.filter((item) => selected.has(item.word));
  let created = 0;
  try {
    for (let start = 0; start < chosen.length; start += 50) {
      const chunk = chosen.slice(start, start + 50);
      const payload: SaveVideoWordsRequest = {
        videoId: transcript.videoId,
        title: transcript.title,
        url: transcript.url,
        words: chunk.map((item) => ({ word: item.word, context: item.occurrences[0]!.context, offset: item.occurrences[0]!.offset }))
      };
      const response = await send<{ created: number; total: number }>({ type: "save-video-words", payload });
      created += response.created;
    }
    for (const item of chosen) saved.add(item.word);
    selected = new Set(); notice = `已加入 ${chosen.length} 个单词，其中 ${created} 个是新词。`;
  } catch (cause) {
    notice = ""; error = cause instanceof Error ? cause.message : "加入词库失败";
  }
  renderPanel();
}

interface YouTubeExtensionWindow extends Window {
  __englishGardenYoutubeBootstrapped?: boolean;
}

const extensionWindow = window as YouTubeExtensionWindow;
const isYoutubeHost = location.hostname === "www.youtube.com" || location.hostname === "m.youtube.com";
if (isYoutubeHost && !extensionWindow.__englishGardenYoutubeBootstrapped) {
  extensionWindow.__englishGardenYoutubeBootstrapped = true;
  window.addEventListener("message", (event: MessageEvent<TranscriptMessage>) => {
    if (event.source === window && event.data?.source === "english-garden-youtube-page" && event.data.type === "VIDEO_NAVIGATED") resetForNavigation();
  });
  if (isWatchPage()) renderLauncher();
}
