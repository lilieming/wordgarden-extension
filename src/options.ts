import type { BackgroundRequest, BackgroundResponse, ServiceConfig } from "./types";
import { normalizeServiceUrl, serviceUrlWarning } from "./service-url";
import { appRelayAvailable } from "./platform";
import { t } from "./copy.options";
import "./options.css";

const DEFAULT: ServiceConfig = { serviceUrl: "http://127.0.0.1:3789" };
const app = document.querySelector<HTMLDivElement>("#app")!;

/**
 * 界面文案：构建期从 `static/_locales` 编进来的自包含模块（`build-copy.mjs`）。
 * 不用 `chrome.i18n.getMessage`：Safari 里 manifest 的 `__MSG_` 替换是好的，运行时却返回空串；
 * 向后台要目录也拿不到回包（2026-10-18 实测：设置页只剩骨架）。
 */
render();

function render(): void {
  const header = `<p class="eyebrow">WORD GARDEN · <span class="extension-version"></span></p><h1>${t("settingsHeading")}</h1>`;

  if (appRelayAvailable) {
    // iOS：这里既没有本机 API 服务可连，也没有地址可填，设置页就只说清楚词去哪儿。
    app.innerHTML = `<main>${header}
  <p>${t("iosIntro")}</p>
  <p>${t("iosNote")}</p></main>`;
  } else {
    app.innerHTML = `<main>${header}
  <p>${t("serviceIntro")}</p>
  <div class="address-guide"><span>${t("apiLabel")}</span><code>http://127.0.0.1:3789</code></div>
  <form>
    <label>${t("addressLabel")}<input type="url" required spellcheck="false"><small>${t("addressHint")}</small></label>
    <div class="actions"><button>${t("testButton")}</button><span class="status"></span></div>
  </form>
  <section><h2>${t("stepsHeading")}</h2><ol><li>${t("step1")}</li><li>${t("step2")}</li><li>${t("step3")}</li></ol></section>
</main>`;
    wireServiceUrlForm();
  }

  document.title = t("optionsTitle");
  app.querySelector<HTMLElement>(".extension-version")!.textContent = `v${chrome.runtime.getManifest().version}`;
}

function wireServiceUrlForm(): void {
  const input = app.querySelector<HTMLInputElement>("input")!;
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
      showStatus(error instanceof Error ? error.message : t("statusInvalid"), "error");
      return;
    }

    input.value = serviceUrl;
    showStatus(t("statusConnecting"));
    const response = await chrome.runtime.sendMessage({ type: "health", serviceUrl } satisfies BackgroundRequest) as BackgroundResponse;
    if (!response.ok) {
      showStatus(response.error, "error");
      return;
    }
    await chrome.storage.sync.set({ serviceUrl });
    showStatus(t("statusConnected"), "success");
  });
}
