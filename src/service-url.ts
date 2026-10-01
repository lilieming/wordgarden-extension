export function normalizeServiceUrl(rawValue: string): string {
  const raw = rawValue.trim();
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("请输入完整地址，例如 http://127.0.0.1:3789。");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("本地服务地址必须使用 http:// 或 https://。");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error("本地服务地址不能包含账号、查询参数或锚点。");
  }
  if (url.pathname !== "/") {
    throw new Error("请填写服务根地址，不要包含 /api/health 等路径。");
  }
  return url.origin;
}

export function serviceUrlWarning(serviceUrl: string): string | null {
  const url = new URL(serviceUrl);
  if ((url.hostname === "127.0.0.1" || url.hostname === "localhost") && url.port === "5173") {
    return "5173 是已经移除的网页版端口，不是 API 端口。请改为 http://127.0.0.1:3789。";
  }
  return null;
}
