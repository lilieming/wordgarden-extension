# Word Garden · Chrome 扩展

划词翻译并收进本机词库，YouTube 视频里按字幕学生词。配合 macOS 版 Word Garden App 使用：扩展只负责在浏览器里取词，词库、拼读、助记和 AI 对话都由 App 在你自己电脑上完成。

产品主页：https://learnenglishwords.cn

## 先决条件

扩展要把词存到本机，所以**必须先装好并启动 macOS 版 Word Garden App**。App 启动后会在 `http://127.0.0.1:3789` 开一个只监听本机的服务，扩展连的就是它。没装 App 时扩展能划词，但存不下，会提示连不上本机服务。

## 安装

1. Chrome 地址栏打开 `chrome://extensions`，点亮右上角的「开发者模式」
2. 把本仓库的 `built` 文件夹**直接拖进这个页面**，扩展就装好了
   - 装了 Word Garden App 的话更省事：App 菜单栏「帮助 → 在访达中显示扩展文件夹」找到的是同一份，拖过去即可
3. 点工具栏里的扩展图标打开设置，确认「本地 API 服务地址」是 `http://127.0.0.1:3789`，点「测试连接并保存」

`built` 里就是可直接加载的成品，不需要 Node、不需要构建。

## Android

Android 10 及以上版本可直接下载 APK（64 位 ARM 手机请下载 `word-garden-android-0.1.13-arm64-v8a.apk`）：

https://github.com/lilieming/wordgarden-extension/releases/latest

APK 和 Chrome、Safari 安装包一起发布在 GitHub Releases。Android 版包含本地词库、私人花园、分级词书、爱心收藏、FSRS 复习和系统朗读；数据保存在手机本机。

## 用法

- **任意网页**：选中英文 → 点浮动按钮，或选中后右键「在 Word Garden 中翻译」
- **YouTube**：打开 `youtube.com/watch` 视频页，右侧出现「学词」按钮 → 载入字幕 → 切到时间线模式整条字幕铺开，点词标为不认识、批量收进词库，生词按播放进度跟随高亮
- 中文释义按「内置词典 → Chrome 内置翻译 → 大模型」的顺序取，第一个给得出结果的就用它；两者都拿不到时词条照样入库，只留空译文

翻译、助记和 AI 对话用到的大模型密钥在 App 的设置页里配，扩展和 App 共用同一把。

## 隐私

扩展只与你本机的 App 通信，不上传任何数据，没有账号，词库不上云。选中的文本会交给 App 处理；如果你配了自己的大模型密钥，App 会把待翻译文本发给该模型端点。

## 许可

暂未声明许可证，Copyright © 2026 leon.li。
