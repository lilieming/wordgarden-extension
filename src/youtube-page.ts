import { fetchCaptionSegments } from "./youtube-captions";
interface CaptionTrack {
  baseUrl?: string;
  languageCode?: string;
  kind?: string;
  name?: { simpleText?: string; runs?: Array<{ text?: string }> };
}

interface YouTubePlayerResponse {
  videoDetails?: { videoId?: string; title?: string; author?: string; lengthSeconds?: string };
  captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] } };
}

interface YouTubePlayerElement extends HTMLElement {
  getPlayerResponse?: () => YouTubePlayerResponse;
}

interface YouTubeWindow extends Window {
  ytInitialPlayerResponse?: YouTubePlayerResponse;
}

const REQUEST_SOURCE = "english-garden-extension";
const RESPONSE_SOURCE = "english-garden-youtube-page";

function currentVideoId(): string | null {
  const url = new URL(location.href);
  if (url.pathname === "/watch") return url.searchParams.get("v");
  if (url.pathname.startsWith("/shorts/")) return url.pathname.split("/")[2] ?? null;
  return null;
}

function getPlayerResponse(): YouTubePlayerResponse | undefined {
  const player = document.querySelector<YouTubePlayerElement>("#movie_player");
  return player?.getPlayerResponse?.() ?? (window as YouTubeWindow).ytInitialPlayerResponse;
}

function captionTrackName(track: CaptionTrack): string {
  return track.name?.simpleText ?? track.name?.runs?.map((run) => run.text ?? "").join("") ?? track.languageCode ?? "";
}

function chooseEnglishTrack(tracks: CaptionTrack[]): CaptionTrack | undefined {
  const english = tracks.filter((track) => {
    const languageCode = (track.languageCode ?? "").toLocaleLowerCase("en-US");
    const name = captionTrackName(track).toLocaleLowerCase("en-US");
    return languageCode === "en" || languageCode.startsWith("en-") || name.includes("english");
  });
  return english.find((track) => track.kind !== "asr") ?? english[0];
}

async function waitForPlayerResponse(): Promise<YouTubePlayerResponse | undefined> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const response = getPlayerResponse();
    if (response?.videoDetails?.videoId) return response;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  return undefined;
}

function parseRenderedTimestamp(value: string): number {
  const pieces = value.trim().split(":").map(Number);
  if (pieces.some((piece) => !Number.isFinite(piece))) return -1;
  if (pieces.length === 2) return pieces[0]! * 60 + pieces[1]!;
  if (pieces.length === 3) return pieces[0]! * 3600 + pieces[1]! * 60 + pieces[2]!;
  return -1;
}

async function readRenderedTranscript(): Promise<Array<{ text: string; offset: number; duration: number }>> {
  let nodes = [...document.querySelectorAll<HTMLElement>("ytd-transcript-segment-renderer")];
  if (nodes.length === 0) {
    const transcriptButton = document.querySelector<HTMLButtonElement>("ytd-video-description-transcript-section-renderer button, button[aria-label*='transcript' i]");
    transcriptButton?.click();
    for (let attempt = 0; attempt < 15 && nodes.length === 0; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 200));
      nodes = [...document.querySelectorAll<HTMLElement>("ytd-transcript-segment-renderer")];
    }
  }
  const timed = nodes.flatMap((node) => {
    const timestamp = node.querySelector<HTMLElement>(".segment-timestamp")?.innerText ?? "";
    const text = node.querySelector<HTMLElement>(".segment-text")?.innerText?.replace(/\s+/g, " ").trim() ?? "";
    const offset = parseRenderedTimestamp(timestamp);
    return text && offset >= 0 ? [{ text, offset }] : [];
  });
  return timed.map((item, index) => ({
    ...item,
    duration: Math.max(1.5, Math.min(10, (timed[index + 1]?.offset ?? item.offset + 4) - item.offset))
  }));
}

async function loadCaptionTrack(track: CaptionTrack): Promise<Array<{ text: string; offset: number; duration: number }>> {
  if (!track.baseUrl) return [];
  return fetchCaptionSegments(track.baseUrl);
}

async function loadTranscript() {
  const videoId = currentVideoId();
  if (!videoId) throw new Error("请先打开一个 YouTube 视频页面。");
  const playerResponse = await waitForPlayerResponse();
  if (!playerResponse) throw new Error("YouTube 播放器尚未准备好，请稍后重试。");
  const tracks = playerResponse.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  const track = chooseEnglishTrack(tracks);
  let segments: Array<{ text: string; offset: number; duration: number }> = [];
  let trackError = "";
  if (track) {
    try { segments = await loadCaptionTrack(track); }
    catch (error) { trackError = error instanceof Error ? error.message : "字幕轨道读取失败"; }
  }
  if (segments.length === 0) segments = await readRenderedTranscript();
  if (segments.length === 0) {
    const detail = trackError ? `（${trackError}）` : "";
    throw new Error(`已找到字幕入口，但没有读取到字幕内容${detail}。请先在 YouTube 中打开“显示文字记录”，再点击重新读取。`);
  }
  return {
    videoId,
    title: playerResponse.videoDetails?.title ?? document.title.replace(/\s*-\s*YouTube$/, ""),
    author: playerResponse.videoDetails?.author ?? "",
    duration: Number(playerResponse.videoDetails?.lengthSeconds ?? 0),
    language: track?.languageCode ?? "en",
    url: `https://www.youtube.com/watch?v=${videoId}`,
    segments
  };
}

window.addEventListener("message", (event) => {
  if (event.source !== window || event.data?.source !== REQUEST_SOURCE || event.data?.type !== "REQUEST_TRANSCRIPT") return;
  const requestId = String(event.data.requestId ?? "");
  void loadTranscript()
    .then((data) => window.postMessage({ source: RESPONSE_SOURCE, type: "TRANSCRIPT_RESULT", requestId, ok: true, data }, "*"))
    .catch((error) => window.postMessage({ source: RESPONSE_SOURCE, type: "TRANSCRIPT_RESULT", requestId, ok: false, error: error instanceof Error ? error.message : "字幕读取失败" }, "*"));
});

document.addEventListener("yt-navigate-finish", () => {
  window.postMessage({ source: RESPONSE_SOURCE, type: "VIDEO_NAVIGATED", videoId: currentVideoId() }, "*");
});
