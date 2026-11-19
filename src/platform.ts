/**
 * 这份 bundle 能不能把词交给宿主 App 排队入库。
 *
 * 由 Vite 的 `define` 在构建期写死：`vite.config.ts` 给 false，`vite.config.safari.ts` 给
 * true。压缩时这个常量会被折叠掉，所以 Chrome 产物里连排队那几条代码都不剩，
 * 现有行为一个字都不用变；Safari 里也不靠 UA 猜自己跑在哪个系统上。
 */
declare const __EG_APP_RELAY__: boolean;

export const appRelayAvailable: boolean = __EG_APP_RELAY__;
