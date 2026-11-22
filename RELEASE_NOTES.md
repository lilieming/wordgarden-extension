# Word Garden v0.1.12

发布日期：2026-11-22

这次 Release 同时发布浏览器扩展和 Android 客户端。所有安装包都在本页下方下载。

## Android

- 新增原生 Kotlin / Jetpack Compose 客户端，最低支持 Android 12（API 31）。
- 私人花园、分级词书、词条卡片、爱心收藏、FSRS 复习和系统朗读均可在手机上使用。
- 支持 English、简体中文、繁體中文、日本語、한국어界面，并可单独选择词书释义语言。
- 词库保存在本机，API Key 使用 Android Keystore 加密。
- 下载 `word-garden-android-0.1.12.apk` 后直接安装；Android 可能要求允许当前浏览器或文件管理器安装应用。

## 浏览器扩展

- Chrome、Safari macOS、Safari iOS 三份构建使用同一版本号。
- Chrome 继续支持网页划词、右键翻译和 YouTube 字幕学词。

## 下载

- `word-garden-android-0.1.12.apk`：Android 12 及以上。
- `word-garden-extension-chrome-0.1.12.zip`：Chrome Manifest V3 扩展。
- `word-garden-extension-safari-macos-0.1.12.zip`：Safari macOS 扩展构建目录。
- `word-garden-extension-safari-ios-0.1.12.zip`：Safari iOS 扩展构建目录。
- `SHA256SUMS.txt`：全部下载文件的 SHA-256 校验值。

## 安装

### Android

1. 下载 APK。
2. 在系统提示中允许浏览器或文件管理器安装未知来源应用。
3. 安装并打开 Word Garden。

### Chrome

1. 解压 `word-garden-extension-chrome-0.1.12.zip`。
2. 打开 `chrome://extensions` 并启用“开发者模式”。
3. 点击“加载已解压的扩展程序”，选择解压后的目录。
