declare global {
  interface Window {
    Translator?: {
      availability(options: { sourceLanguage: string; targetLanguage: string }): Promise<string>;
      create(options: { sourceLanguage: string; targetLanguage: string; monitor?: (monitor: EventTarget) => void }): Promise<{ translate(text: string): Promise<string>; destroy?: () => void }>;
    };
  }
}

export interface ChromeTranslator {
  translate(text: string): Promise<string>;
  close(): void;
}

/**
 * Chrome 内置翻译：本地模型，不花 token、也不要 API Key。
 * 浏览器不支持或语言对不可用时返回 null，由调用方决定退回大模型还是留空。
 */
export async function openChromeTranslator(): Promise<ChromeTranslator | null> {
  if (!window.Translator) return null;
  try {
    const availability = await window.Translator.availability({ sourceLanguage: "en", targetLanguage: "zh" });
    if (availability === "unavailable") return null;
    const session = await window.Translator.create({ sourceLanguage: "en", targetLanguage: "zh" });
    return {
      translate: (text: string) => session.translate(text),
      close: () => session.destroy?.()
    };
  } catch {
    return null;
  }
}
