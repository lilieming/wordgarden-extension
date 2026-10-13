import type { SaveVideoWordsRequest } from "@learn-english/shared";
import type { BackgroundRequest, BackgroundResponse, WordLookup } from "./types";
import { buildYouTubeWords, formatTimestamp, readableCaptionText, tokenizeCaption, type YouTubeCaptionSegment, type YouTubeWord, type YouTubeWordOccurrence } from "./youtube-words";
import { createWordScrollPositions, rememberWordScroll, restoredWordScroll, type WordView } from "./youtube-panel-scroll";
import { captionIndexAt } from "./youtube-caption-sync";
import { openChromeTranslator, type ChromeTranslator } from "./chrome-translate";

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
let glosses = new Map<string, string>();
let glossPending = new Set<string>();
let translator: Promise<ChromeTranslator | null> | null = null;
let captionLines: Array<{ offset: number; element: HTMLElement }> = [];
let activeCaption: HTMLElement | null = null;
let lastUserScrollAt = 0;
let programmaticScrollTop = -1;
let saving = false;
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
  root.style.top = "64px";
  document.documentElement.append(root);
  shadow = root.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = `
    *{box-sizing:border-box} button,input{font:inherit}.launcher{width:54px;height:54px;border:0;border-radius:50%;background:#315d43;color:#fff;font:800 15px system-ui;box-shadow:0 10px 30px #17251c66;cursor:pointer}.panel{display:flex;flex-direction:column;width:min(430px,calc(100vw - 28px));height:calc(100vh - 90px);border:1px solid #cdd5ca;border-radius:20px;background:#fffdf8;color:#213026;box-shadow:0 20px 70px #17251c55;font:14px/1.45 system-ui,sans-serif;overflow:hidden}.head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding:18px;border-bottom:1px solid #e3e3da}.eyebrow{margin:0 0 5px;color:#6e8172;font-size:10px;font-weight:800;letter-spacing:.16em}.head h2{margin:0;font-size:22px}.head-actions{display:flex;gap:5px}.head button{border:0;background:transparent;color:#637068;font-size:18px;cursor:pointer}.load{margin:14px;border:0;border-radius:999px;padding:12px;background:#315d43;color:#fff;font-weight:800;cursor:pointer}.load:disabled{opacity:.6;cursor:wait}.status{margin:0 14px 12px;padding:10px;border-radius:10px;background:#edf2e9;color:#5e6a61}.error{background:#f8e5e6;color:#913740}.notice{background:#e3eee0;color:#315d43}.meta{padding:0 16px 10px;color:#707970;font-size:12px}.word-tabs{display:flex;gap:5px;margin:0 14px 10px;padding:4px;border-radius:999px;background:#edf0e9}.word-tab{flex:1;border:0;border-radius:999px;padding:7px 9px;background:transparent;color:#667168;font-weight:750;cursor:pointer}.word-tab.active{background:#315d43;color:#fff}.tools{display:flex;gap:8px;padding:0 14px 12px}.tools input{min-width:0;flex:1;border:1px solid #cbd1c8;border-radius:10px;padding:10px;background:#fff}.save{border:0;border-radius:10px;padding:9px 12px;background:#315d43;color:#fff;font-weight:750;cursor:pointer}.save:disabled{opacity:.5;cursor:not-allowed}.words{display:grid;grid-template-columns:1fr 1fr;grid-auto-rows:max-content;align-content:start;gap:7px;min-height:0;flex:1;padding:0 12px 16px;overflow:auto}.word{position:relative;min-width:0;min-height:98px;border:1px solid #d9ddd5;border-radius:12px;background:#fff;overflow:hidden}.word.active{border-color:#5d8464;box-shadow:0 0 0 2px #5d84641f}.word.chosen{background:#edf4e9;border-color:#91aa8e}.play{display:flex;width:100%;height:100%;min-height:96px;flex-direction:column;align-items:flex-start;gap:2px;border:0;padding:11px 10px 28px;background:transparent;color:#213026;text-align:left;cursor:pointer}.play strong{max-width:100%;overflow:hidden;text-overflow:ellipsis;font-size:16px}.gloss{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#4d7a5b;font-size:12px;font-weight:650}.gloss:empty{display:none}.time{color:#54705b;font-size:11px}.count{color:#858d87;font-size:11px}.pick{position:absolute;right:8px;bottom:6px;display:flex;align-items:center;gap:4px;color:#677168;font-size:10px;cursor:pointer}.pick input{margin:0;accent-color:#315d43}.context{margin:0 14px 12px;padding:10px;border-radius:10px;background:#f0eee6;color:#5c655e}.context strong{display:block;margin-bottom:3px}.empty{padding:50px 20px;text-align:center;color:#7c847d}.word-list-empty{grid-column:1/-1}.footer{padding:9px 14px;border-top:1px solid #e4e4dc;color:#7b827c;font-size:11px}.saved{color:#315d43;font-weight:750}.words.timeline-mode{display:block;padding:0 16px 16px}.tl-line{display:flex;align-items:baseline;gap:8px;padding:3px 0 3px 7px;border-bottom:1px solid #f1f1e8}.tl-line.now{background:#eaf3e6;box-shadow:inset 3px 0 0 #315d43}.tl-line.now .tl-time{color:#315d43;font-weight:750}.tl-time{flex:0 0 42px;color:#54705b;font-size:11px;cursor:pointer}.tl-time:hover{text-decoration:underline}.tl-text{margin:0;font-size:13px;line-height:1.7;color:#2b3a30}.tl-token{padding:1px 2px;margin:0 -1px;border-radius:4px;cursor:pointer}.tl-token:hover{background:#e2ecdd;box-shadow:inset 0 -1px 0 #9bb79a}.tl-token.saved{background:#dcead8;color:#2f5a3c;font-weight:700}.tl-token.chosen{background:#fbeec5;color:#7a5c00;font-weight:700}.tl-gloss{margin:0 4px 0 2px;font-size:11px;color:#8a7a3f}.tl-gloss::before{content:"("}.tl-gloss::after{content:")"}@media(max-width:700px){.panel{width:calc(100vw - 16px);height:calc(100vh - 82px)}.words{grid-template-columns:1fr}}
  `;
  shadow.append(style);
  return shadow;
}

function closePanel(): void {
  captionLines = []; activeCaption = null;
  root?.remove(); root = null; shadow = null;
}

function resetGlosses(): void {
  glosses = new Map();
  glossPending = new Set();
  void translator?.then((session) => session?.close());
  translator = null;
}

function resetForNavigation(): void {
  transcript = null; words = []; selected = new Set(); saved = new Set(); cursor = new Map(); activeWord = ""; filter = ""; wordView = "all"; wordScrollPositions = createWordScrollPositions(); loading = false; error = ""; notice = "";
  resetGlosses();
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
  button.title = "用 Word Garden 学习当前视频";
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
  const timelineTab = panel.querySelector<HTMLButtonElement>('[data-view="timeline"]');
  if (allTab) {
    allTab.textContent = `全部单词 (${words.length})`;
    allTab.classList.toggle("active", wordView === "all");
  }
  if (unknownTab) {
    unknownTab.textContent = `不认识 (${unknownWordCount()})`;
    unknownTab.classList.toggle("active", wordView === "unknown");
  }
  if (timelineTab) timelineTab.classList.toggle("active", wordView === "timeline");
  const context = panel.querySelector<HTMLElement>(".context");
  if (context && wordView === "timeline") context.hidden = true;
  const footer = panel.querySelector<HTMLElement>(".footer");
  if (footer) footer.textContent = wordView === "timeline"
    ? "点单词先记进「不认识」并显示中文 · 攒够了按「加入词库」统一提交 · 点时间戳只听该句"
    : "点击单词：跳到下一处并重播 · 勾选“不认识”：批量加入本地词库";
}

function rememberCurrentWordScroll(panel: HTMLElement, view: WordView = wordView): void {
  const list = panel.querySelector<HTMLElement>(".words");
  if (list) rememberWordScroll(wordScrollPositions, view, list.scrollTop);
}

function restoreCurrentWordScroll(list: HTMLElement): void {
  const restore = () => {
    if (!list.isConnected) return;
    scrollListTo(list, restoredWordScroll(wordScrollPositions, wordView, list.scrollHeight, list.clientHeight));
  };
  restore();
  window.requestAnimationFrame(restore);
}

/** 只有用户自己滚才算「在看别处」；我们写 scrollTop 触发的 scroll 事件要排除掉。 */
function scrollListTo(list: HTMLElement, top: number): void {
  list.scrollTop = top;
  // 读回真实值：浏览器会把超出滚动范围的目标夹到边界，否则会被误判成用户滚动。
  programmaticScrollTop = list.scrollTop;
}

function renderWordList(panel: HTMLElement): void {
  const list = panel.querySelector<HTMLElement>(".words");
  if (!list) return;
  if (wordView === "timeline") { renderCaptionStream(list); return; }
  list.classList.remove("timeline-mode");
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

/** 时间线模式：整条字幕按时间顺序铺开，每个单词都是可点的收词按钮。 */
function renderCaptionStream(list: HTMLElement): void {
  const query = filter.trim().toLocaleLowerCase("en-US");
  list.classList.add("timeline-mode");
  list.replaceChildren();
  if (!transcript) return;
  let lines = 0;
  captionLines = [];
  activeCaption = null;
  for (const [index, segment] of transcript.segments.entries()) {
    const context = readableCaptionText(segment.text);
    if (!context) continue;
    const tokens = tokenizeCaption(context);
    if (query && !tokens.some((token) => token.word?.includes(query))) continue;
    const line = createCaptionLine(index, segment.offset, tokens);
    list.append(line);
    captionLines.push({ offset: segment.offset, element: line });
    lines += 1;
  }
  if (lines === 0) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "没有匹配的字幕。";
    list.append(empty);
  }
  restoreCurrentWordScroll(list);
  syncCaptionToVideo();
}

/** 播放进度跟着字幕走：当前行常亮，只有它滚出可视区才把列表带过去。 */
function syncCaptionToVideo(): void {
  if (wordView !== "timeline" || captionLines.length === 0) return;
  const video = document.querySelector<HTMLVideoElement>("video.html5-main-video, video");
  if (!video) return;
  setActiveCaption(captionLineAt(video.currentTime));
}

function captionLineAt(time: number): HTMLElement | null {
  const index = captionIndexAt(captionLines, time);
  return index < 0 ? null : captionLines[index]!.element;
}

function setActiveCaption(line: HTMLElement | null): void {
  if (line === activeCaption) return;
  activeCaption?.classList.remove("now");
  line?.classList.add("now");
  activeCaption = line;
  if (!line) return;
  const list = line.parentElement;
  if (!list) return;
  // 刚手动滚过就交给用户，别抢滚动条。
  if (Date.now() - lastUserScrollAt < 5_000) return;
  const box = line.getBoundingClientRect();
  const view = list.getBoundingClientRect();
  if (box.top >= view.top && box.bottom <= view.bottom) return;
  scrollListTo(list, list.scrollTop + (box.top - view.top) - Math.round(list.clientHeight / 3));
}

function createCaptionLine(index: number, offset: number, tokens: ReturnType<typeof tokenizeCaption>): HTMLElement {
  const line = document.createElement("div");
  line.className = "tl-line";
  line.dataset.segment = String(index);
  const time = document.createElement("span");
  time.className = "tl-time";
  time.textContent = formatTimestamp(offset);
  const text = document.createElement("p");
  text.className = "tl-text";
  for (const token of tokens) {
    if (!token.word) {
      text.append(token.text);
      continue;
    }
    const word = document.createElement("span");
    word.className = `tl-token${saved.has(token.word) ? " saved" : selected.has(token.word) ? " chosen" : ""}`;
    word.dataset.word = token.word;
    word.textContent = token.text;
    text.append(word);
    const gloss = glosses.get(token.word);
    if (gloss) text.append(glossNode(gloss));
  }
  line.append(time, text);
  return line;
}

function glossNode(text: string): HTMLElement {
  const gloss = document.createElement("span");
  gloss.className = "tl-gloss";
  gloss.textContent = text;
  return gloss;
}

function onCaptionClick(event: Event): void {
  const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(".tl-time, .tl-token");
  const line = target?.closest<HTMLElement>(".tl-line");
  if (!target || !line || !transcript) return;
  const segment = transcript.segments[Number(line.dataset.segment)];
  const context = segment ? readableCaptionText(segment.text) : null;
  if (!segment || !context) return;
  const word = target.dataset.word;
  if (!word) {
    playCaptionSegment(segment);
    return;
  }
  const item = words.find((entry) => entry.word === word);
  if (!item) return;
  playOccurrence(item, item.occurrences.find((occurrence) => occurrence.context === context) ?? item.occurrences[0]!);
  markUnknown(item);
}

function playCaptionSegment(segment: YouTubeCaptionSegment): void {
  const video = document.querySelector<HTMLVideoElement>("video.html5-main-video, video");
  if (!video) { showPanelError("没有找到 YouTube 播放器，请刷新页面后重试。"); return; }
  if (replayTimer !== null) window.clearTimeout(replayTimer);
  video.currentTime = Math.max(0, segment.offset);
  void video.play().catch(() => undefined);
  replayTimer = window.setTimeout(() => video.pause(), Math.max(2500, Math.min(8000, segment.duration * 1000 + 1000)));
}

/** 点一下先进「不认识」队列、当场翻出中文，攒够了按「加入词库」统一提交。 */
function markUnknown(item: YouTubeWord): void {
  if (saved.has(item.word)) return;
  selected.add(item.word);
  for (const token of tokensFor(item.word)) {
    token.classList.remove("saved");
    token.classList.add("chosen");
  }
  const panel = shadow?.querySelector<HTMLElement>(".panel");
  if (panel) updatePanelControls(panel);
  void requestGloss(item.word);
}

function tokensFor(word: string): HTMLElement[] {
  return [...(shadow?.querySelectorAll<HTMLElement>(".tl-token") ?? [])].filter((token) => token.dataset.word === word);
}

function sharedTranslator(): Promise<ChromeTranslator | null> {
  if (!translator) translator = openChromeTranslator();
  return translator;
}

/** 点词先看内置词典：命中就省掉一次 Chrome 翻译，也不吃 token。 */
async function dictionaryGloss(word: string): Promise<string | null> {
  const result = await send<WordLookup>({ type: "lookup-word", word }).catch(() => ({ meaning: null }));
  return result.meaning?.trim() || null;
}

async function chromeGloss(word: string): Promise<string | null> {
  const session = await sharedTranslator();
  return (session ? await session.translate(word).catch(() => "") : "").trim() || null;
}

async function requestGloss(word: string): Promise<void> {
  if (glosses.has(word) || glossPending.has(word)) return;
  glossPending.add(word);
  const text = (await dictionaryGloss(word)) ?? (await chromeGloss(word));
  glossPending.delete(word);
  if (!text) return;
  glosses.set(word, text);
  for (const token of tokensFor(word)) {
    if (token.nextElementSibling?.classList.contains("tl-gloss")) continue;
    token.insertAdjacentElement("afterend", glossNode(text));
  }
  for (const card of cardsFor(word)) {
    const slot = card.querySelector<HTMLElement>(".gloss");
    if (slot) slot.textContent = text;
  }
}

function cardsFor(word: string): HTMLElement[] {
  return [...(shadow?.querySelectorAll<HTMLElement>(".word") ?? [])].filter((card) => card.dataset.word === word);
}

function updateContext(item: YouTubeWord, occurrenceIndex: number): void {
  const context = shadow?.querySelector<HTMLElement>(".context");
  if (!context) return;
  // 时间线模式下原句就在字幕流里，再顶一块上下文是重复的。
  if (wordView === "timeline") {
    context.hidden = true;
    return;
  }
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
    <header class="head"><div><p class="eyebrow">WORD GARDEN</p><h2>当前视频学单词</h2></div><div class="head-actions"><button class="reload" title="重新读取字幕">↻</button><button class="close" title="收起">×</button></div></header>
    ${!transcript ? `<button class="load" ${loading ? "disabled" : ""}>${loading ? "正在读取当前账号可见字幕…" : "读取当前视频字幕"}</button>` : ""}
    ${error ? `<div class="status error"></div>` : ""}${notice ? `<div class="status notice"></div>` : ""}
    ${transcript ? `<div class="meta"><strong></strong><br><span>${words.length} 个不重复单词 · ${transcript.language}</span></div><nav class="word-tabs"><button class="word-tab" data-view="all"></button><button class="word-tab" data-view="unknown"></button><button class="word-tab" data-view="timeline">时间线</button></nav><div class="tools"><input class="filter" placeholder="筛选单词…" value=""><button class="save" ${selected.size === 0 ? "disabled" : ""}>加入词库 (${selected.size})</button></div><div class="context" ${activeWord ? "" : "hidden"}></div><div class="words"></div><footer class="footer">点击单词：跳到下一处并重播 · 勾选“不认识”：批量加入本地词库</footer>` : `<div class="empty">直接读取你登录状态下当前 YouTube 页面可见的英文字幕。</div>`}
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
      const nextView = tab.dataset.view as WordView;
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
  wordList.addEventListener("scroll", () => {
    rememberWordScroll(wordScrollPositions, wordView, wordList.scrollTop);
    if (Math.abs(wordList.scrollTop - programmaticScrollTop) < 2) return;
    lastUserScrollAt = Date.now();
  }, { passive: true });
  // 一条字幕约十几个可点词、整片上千行，用事件委托而不是逐词挂监听。
  wordList.addEventListener("click", onCaptionClick);
  // timeupdate 不冒泡，但捕获阶段能收到，所以挂在 document 上，换视频也不用重挂。
  document.addEventListener("timeupdate", syncCaptionToVideo, true);
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
  const gloss = document.createElement("span"); gloss.className = "gloss"; gloss.textContent = glosses.get(item.word) ?? "";
  const time = document.createElement("span"); time.className = "time"; time.textContent = formatTimestamp(occurrence.offset);
  const count = document.createElement("span"); count.className = "count"; count.textContent = `出现 ${item.count} 次${item.count > 1 ? " · 再点下一处" : ""}`;
  play.append(strong, gloss, time, count); play.addEventListener("click", () => playWord(item));
  const label = document.createElement("label"); label.className = "pick";
  const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.checked = isUnknownWord(item.word); checkbox.disabled = saved.has(item.word);
  checkbox.addEventListener("change", () => {
    if (checkbox.checked) {
      selected.add(item.word);
      void requestGloss(item.word);
    } else selected.delete(item.word);
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
  playOccurrence(item, occurrence);
}

function playOccurrence(item: YouTubeWord, occurrence: YouTubeWordOccurrence): void {
  activeWord = item.word;
  const video = document.querySelector<HTMLVideoElement>("video.html5-main-video, video");
  if (!video) { showPanelError("没有找到 YouTube 播放器，请刷新页面后重试。"); return; }
  if (replayTimer !== null) window.clearTimeout(replayTimer);
  video.currentTime = Math.max(0, occurrence.offset - 0.6);
  void video.play().catch(() => undefined);
  replayTimer = window.setTimeout(() => video.pause(), Math.max(2500, Math.min(8000, occurrence.duration * 1000 + 1000)));
  updateContext(item, Math.max(0, item.occurrences.indexOf(occurrence)));
  updateActiveWordCards(item);
}

async function saveSelectedWords(): Promise<void> {
  if (selected.size === 0) return;
  await saveWords(words.filter((item) => selected.has(item.word)), () => { selected = new Set(); });
}

async function saveWords(chosen: YouTubeWord[], onAccepted?: () => void): Promise<boolean> {
  if (!transcript || chosen.length === 0 || saving) return false;
  saving = true;
  error = ""; notice = "正在翻译并保存…"; renderPanel();
  let created = 0;
  let withTranslation = 0;
  try {
    // 译文优先用 Chrome 内置翻译：本地模型，没配大模型 API Key 也能收词。
    const session = await sharedTranslator();
    const translated = new Map<string, string>();
    for (const item of chosen) {
      const cached = glosses.get(item.word);
      if (cached) {
        translated.set(item.word, cached);
        continue;
      }
      const text = (session ? await session.translate(item.word).catch(() => "") : "").trim();
      if (text) {
        translated.set(item.word, text);
        glosses.set(item.word, text);
      }
    }
    for (let start = 0; start < chosen.length; start += 50) {
      const chunk = chosen.slice(start, start + 50);
      const payload: SaveVideoWordsRequest = {
        videoId: transcript.videoId,
        title: transcript.title,
        url: transcript.url,
        words: chunk.map((item) => ({
          word: item.word,
          context: item.occurrences[0]!.context,
          offset: item.occurrences[0]!.offset,
          translation: translated.get(item.word) ?? ""
        }))
      };
      const response = await send<{ items: Array<{ translation: string }>; created: number; total: number }>({ type: "save-video-words", payload });
      created += response.created;
      withTranslation += response.items.filter((entry) => entry.translation.trim()).length;
    }
    for (const item of chosen) saved.add(item.word);
    onAccepted?.();
    notice = `已加入 ${chosen.length} 个单词，其中 ${created} 个是新词。`;
    if (withTranslation < chosen.length) notice += ` ${chosen.length - withTranslation} 个还没有中文释义，配好大模型 API Key 后可补。`;
    return true;
  } catch (cause) {
    notice = ""; error = cause instanceof Error ? cause.message : "加入词库失败";
    return false;
  } finally {
    saving = false;
    renderPanel();
  }
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
