# LanguageMaster

日语学习工具 - 通过动画视频学习日语，支持注音（furigana）、中文翻译、复习本。

## 技术栈

- **前端**: React + TypeScript + Vite
- **后端**: Express (Node.js) - 代理 Claude/Whisper API 调用
- **存储**: 本地 JSON 文件 (data/ 目录)

## 开发命令

```bash
npm run dev        # 同时启动前端 (5173) 和后端 (3001)
npm run dev:web    # 仅启动前端
npm run dev:server # 仅启动后端
npm run build      # 构建生产版本
npm run start      # 启动生产服务器
npm run typecheck  # 类型检查
```

## 使用流程

1. 打开 http://localhost:5173
2. 点击 ⚙️设置，填入 Claude API Key（必须）和 OpenAI API Key（Whisper 用，可选）
3. 点击 📁打开视频，选择本地视频文件
4. 点击 📝加载字幕，选择 SRT/VTT 字幕文件（日文或中文）
   - 或点击 🎙️生成字幕，用 Whisper 从视频音频生成日语字幕
5. 点击 ✨处理字幕，Claude 会生成注音（furigana）和中文翻译
6. 播放视频，字幕会同步显示
7. 在字幕栏框选文字，自动加入复习本
8. 点击 📖复习本，查看/导出 Anki 卡片

## 架构约定（多个功能并行开发时必须遵守）

- **页面路由**：hash 路由，见 `src/router.ts`（`#/local`、`#/watch?url=...`、`#/community`、`#/pricing`）。`src/App.tsx` 只负责切换页面，每个页面放在 `src/pages/`。
- **导航栏**：`src/components/NavBar.tsx`，右侧 `#navbar-right` 区域放用量显示和设置按钮。
- **数据库**：SQLite（better-sqlite3），共享连接在 `server/db.ts`。每个功能模块在自己的文件里用 `CREATE TABLE IF NOT EXISTS` 建表，表名带功能前缀（`billing_*`、`community_*`、`videos_*`、`user_*`）。
- **用户身份（上线前）**：客户端在 `src/userId.ts` 生成匿名 ID，所有 `/api` 请求都通过 `apiFetch` / `fetchJSON` 发送，带 `X-User-Id` 请求头。服务端由 `server/user.ts` 中间件写入 `req.userId`。
- **后端路由**：每个功能写一个 Express Router，在 `server/index.ts` 里用 `app.use('/api/<feature>', router)` 挂载。
- **用量计费**：所有耗资源的处理，调用前都要先调 `server/usage.ts` 里的 `consumeCredits(userId, { kind, durationSec, videoKey })`；命中缓存时不调用。超出额度会抛出 `UsageLimitError`（HTTP 402）。
- **新手引导**：需要被引导的关键元素加上 `data-tour="..."` 属性。
- **字幕翻译字段**：`SubtitleSegment.chinese` 目前表示"用户母语的翻译"（历史原因沿用这个字段名）。
- **端口**：`PORT`（后端，默认 3001）和 `WEB_PORT`（前端，默认 5173）可以通过环境变量覆盖。
- **测试**：Playwright 脚本放在 `test-videos/`，用 `npx tsx test-videos/<file>.ts` 运行。

## API Keys

- **Claude API Key**: https://console.anthropic.com (用于翻译+注音)
- **OpenAI API Key**: https://platform.openai.com (用于 Whisper ASR)

## 依赖

- ffmpeg (Whisper ASR 需要提取音频): `brew install ffmpeg`
