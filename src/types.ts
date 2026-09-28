import type { Entry, SaveVideoWordsRequest, TranslateRequest, TranslateResponse, TranslateWordsRequest, UpsertEntry } from "@learn-english/shared";

export type BackgroundRequest =
  | { type: "translate-llm"; payload: TranslateRequest }
  | { type: "translate-words"; payload: TranslateWordsRequest }
  | { type: "entry-status"; text: string; sourceLanguage: string }
  | { type: "save-entry"; payload: UpsertEntry }
  | { type: "save-video-words"; payload: SaveVideoWordsRequest }
  | { type: "health"; serviceUrl?: string }
  | { type: "open-options" };

export type BackgroundResponse =
  | { ok: true; data?: unknown }
  | { ok: false; error: string; code?: string };

export interface EntryStatus { saved: boolean; entry: Entry | null }
export interface ServiceConfig { serviceUrl: string }
export type ChromeTranslationResult = TranslateResponse & { provider: "chrome" };
