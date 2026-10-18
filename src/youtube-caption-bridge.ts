/**
 * YouTube 字幕的页面侧桥在不在，由**实际装上的 manifest** 说了算。
 *
 * 字幕要从页面自己的 InnerTube 接口取，靠的是 `youtube-page.js` 那条 content script。
 * Safari 不认 `world: "MAIN"`，这条声明根本不会被装进来，桥不在而面板照样挂载的话，
 * 用户点开就只有一个永远转圈的界面。
 *
 * 认文件名而不是认 `world` 那个键：各家浏览器回传 `getManifest()` 时对键的保留程度不一，
 * 万一 Chrome 把 world 归一化掉了，按键判断就会顺手砍掉线上面板。
 */
export function hasCaptionBridge(manifest: { content_scripts?: { js?: string[]; world?: string }[] }): boolean {
  return Boolean(manifest.content_scripts?.some((script) => script.js?.includes("youtube-page.js")));
}
