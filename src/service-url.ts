import { t } from "./copy.options";

export function normalizeServiceUrl(rawValue: string): string {
  const raw = rawValue.trim();
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(t("urlIncomplete"));
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(t("urlProtocol"));
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error(t("urlUserInfo"));
  }
  if (url.pathname !== "/") {
    throw new Error(t("urlPath"));
  }
  return url.origin;
}

export function serviceUrlWarning(serviceUrl: string): string | null {
  const url = new URL(serviceUrl);
  if ((url.hostname === "127.0.0.1" || url.hostname === "localhost") && url.port === "5173") {
    return t("urlPort5173");
  }
  return null;
}
