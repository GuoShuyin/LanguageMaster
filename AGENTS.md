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

## API Keys

- **Claude API Key**: https://console.anthropic.com (用于翻译+注音)
- **OpenAI API Key**: https://platform.openai.com (用于 Whisper ASR)

## 依赖

- ffmpeg (Whisper ASR 需要提取音频): `brew install ffmpeg`
