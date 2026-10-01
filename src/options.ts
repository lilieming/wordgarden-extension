import type { BackgroundResponse, ServiceConfig } from "./types";
import { normalizeServiceUrl, serviceUrlWarning } from "./service-url";
import "./options.css";

const DEFAULT: ServiceConfig = { serviceUrl: "http://127.0.0.1:3789" };
const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `<main>
  <p class="eyebrow">ENGLISH GARDEN · <span class="extension-version"></span></p>
  <h1>扩展设置</h1>
  <p>扩展需要连接本机的 <strong>API 服务</strong>：打开 English Garden macOS App，设置页里的“后台服务”会自动监听。大模型 API Key 也在 App 的设置页配置。</p>
  <div class="address-guide"><span>扩展 API</span><code>http://127.0.0.1:3789</code></div>
  <form>
    <label>本地 API 服务地址<input type="url" required spellcheck="false"><small>默认端口是 <strong>3789</strong>，要和 App 设置页显示的那个地址保持一致。</small></label>
    <div class="actions"><button>测试连接并保存</button><span class="status"></span></div>
  </form>
  <section><h2>启动顺序</h2><ol><li>打开 macOS App，设置页显示“监听中”即可</li><li>点上面的“测试连接并保存”，确认地址是 <code>http://127.0.0.1:3789</code></li><li>选中网页里的英文，点绿色“译”按钮，再点“收藏”写进本机词库</li></ol></section>
</main>`;
const input = app.querySelector<HTMLInputElement>("input")!;
app.querySelector<HTMLElement>(".extension-version")!.textContent = `v${chrome.runtime.getManifest().version}`;
const status = app.querySelector<HTMLElement>(".status")!;
const form = app.querySelector<HTMLFormElement>("form")!;
void chrome.storage.sync.get({ serviceUrl: DEFAULT.serviceUrl }).then((value) => { input.value = String(value.serviceUrl); });

function showStatus(message: string, kind: "success" | "error" | "neutral" = "neutral"): void {
  status.textContent = message;
  status.className = kind === "neutral" ? "status" : `status ${kind}`;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  let serviceUrl: string;
  try {
    serviceUrl = normalizeServiceUrl(input.value);
    const warning = serviceUrlWarning(serviceUrl);
    if (warning) throw new Error(warning);
  } catch (error) {
    showStatus(error instanceof Error ? error.message : "地址无效。", "error");
    return;
  }

  input.value = serviceUrl;
  showStatus("正在连接…");
  const response = await chrome.runtime.sendMessage({ type: "health", serviceUrl }) as BackgroundResponse;
  if (!response.ok) {
    showStatus(response.error, "error");
    return;
  }
  await chrome.storage.sync.set({ serviceUrl });
  showStatus("连接成功，API 地址已保存。", "success");
});
