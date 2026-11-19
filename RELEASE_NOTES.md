# Word Garden 浏览器扩展 v0.1.11

这是 Word Garden 浏览器扩展的首个公开 Release，提供可直接下载的 Chrome 与 Safari 安装包。

发布日期：2026-11-19

## 更新内容

- 划词翻译现在只在选中英文时显示“译”按钮；中文、日文、韩文、俄文、阿拉伯文等非英文文本不再弹出翻译入口。
- 鼠标重新点选非英文内容时，之前残留的翻译面板会自动收起。
- Chrome、Safari macOS、Safari iOS 三份构建使用同一个版本号和同一套界面文案。

## 下载

- `word-garden-extension-chrome-0.1.11.zip`：Chrome Manifest V3 扩展，可直接加载。
- `word-garden-extension-safari-macos-0.1.11.zip`：Safari macOS 扩展构建目录。
- `word-garden-extension-safari-ios-0.1.11.zip`：Safari iOS 扩展构建目录。
- `SHA256SUMS.txt`：三个压缩包的 SHA-256 校验值。

Safari 的常规安装方式仍是从 Word Garden App 内启用随附扩展；独立压缩包用于开发、审查和重新打包。

## Chrome 安装

1. 解压 `word-garden-extension-chrome-0.1.11.zip`。
2. 打开 Chrome 的 `chrome://extensions`，启用“开发者模式”。
3. 点击“加载已解压的扩展程序”，选择解压后的目录。
4. 先启动 macOS 版 Word Garden App，再在扩展设置中连接 `http://127.0.0.1:3789`。

## 功能

- 任意网页划选英文，收集单词、原句、页面标题和来源。
- 中文释义按“内置词典 → Chrome 内置翻译 → 大模型”的顺序回退。
- Chrome 的 YouTube 页面提供字幕时间线与批量学词面板。
- 数据只交给本机 App，不需要账号，也没有云端词库。
