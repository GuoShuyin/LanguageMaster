"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
const electron = require("electron");
const path = require("path");
const promises = require("fs/promises");
const url = require("url");
const crypto = require("crypto");
function parseTime(time) {
  const cleaned = time.trim().replace(",", ".");
  const parts = cleaned.split(":");
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseFloat(s);
  } else if (parts.length === 2) {
    const [m, s] = parts;
    return parseInt(m, 10) * 60 + parseFloat(s);
  }
  return parseFloat(cleaned);
}
function parseSRT(content) {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  const blocks = normalized.split(/\n\s*\n/);
  const segments = [];
  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.trim());
    if (lines.length < 2) continue;
    let textStartIndex = 0;
    if (/^\d+$/.test(lines[0].trim())) {
      textStartIndex = 1;
    }
    const timeLine = lines[textStartIndex];
    const timeMatch = timeLine.match(
      /(\d{1,2}:\d{2}:\d{2}[.,]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[.,]\d{1,3})/
    );
    if (!timeMatch) continue;
    const start = parseTime(timeMatch[1]);
    const end = parseTime(timeMatch[2]);
    const text = lines.slice(textStartIndex + 1).join("\n").trim();
    if (text) {
      segments.push({
        id: segments.length,
        start,
        end,
        japanese: text
      });
    }
  }
  return segments;
}
function parseVTT(content) {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  const body = normalized.replace(/^WEBVTT.*\n/, "").replace(/^NOTE.*\n\n/gm, "");
  const blocks = body.split(/\n\s*\n/);
  const segments = [];
  for (const block of blocks) {
    const lines = block.split("\n").filter((l) => l.trim());
    if (lines.length < 2) continue;
    let textStartIndex = 0;
    if (/^\d+$/.test(lines[0].trim())) {
      textStartIndex = 1;
    }
    const timeLine = lines[textStartIndex];
    const timeMatch = timeLine.match(
      /(\d{1,2}:\d{2}:\d{2}[.,]\d{1,3}|\d+[.,]\d+s?)\s*-->\s*(\d{1,2}:\d{2}:\d{2}[.,]\d{1,3}|\d+[.,]\d+s?)/
    );
    if (!timeMatch) continue;
    const start = parseTime(timeMatch[1]);
    const end = parseTime(timeMatch[2]);
    const text = lines.slice(textStartIndex + 1).join("\n").trim();
    if (text) {
      segments.push({
        id: segments.length,
        start,
        end,
        japanese: text
      });
    }
  }
  return segments;
}
function parseSubtitles(content, fileName) {
  const trimmed = content.trim();
  if (fileName?.toLowerCase().endsWith(".vtt") || trimmed.startsWith("WEBVTT")) {
    return parseVTT(content);
  }
  return parseSRT(content);
}
function isJapanese(text) {
  return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(text);
}
async function processSubtitlesWithClaude(items, config, options) {
  const { translate, furigana } = options;
  const results = [];
  const CHUNK_SIZE = 15;
  const chunks = [];
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    chunks.push(items.slice(i, i + CHUNK_SIZE));
  }
  const MAX_CONCURRENT = 3;
  for (let i = 0; i < chunks.length; i += MAX_CONCURRENT) {
    const batch = chunks.slice(i, i + MAX_CONCURRENT);
    const batchResults = await Promise.all(batch.map((chunk) => processChunk(chunk, config, translate, furigana)));
    for (const chunkResult of batchResults) {
      results.push(...chunkResult);
    }
  }
  return results;
}
async function processChunk(chunk, config, translate, furigana) {
  const linesText = chunk.map((item) => `${item.id}: ${item.japanese}`).join("\n");
  const tasks = [];
  if (furigana) {
    tasks.push(
      '"furigana": the Japanese text with kanji readings annotated using the format 漢字[かんじ]. Only add readings for kanji (and kanji compounds). Leave kana and punctuation as-is. Example: 私[わたし]は日本語[にほんご]を勉強[べんきょう]します。'
    );
  }
  if (translate) {
    tasks.push('"chinese": a natural Chinese (Simplified) translation of the Japanese line');
  }
  const systemPrompt = "You are a Japanese language assistant. You help language learners by annotating Japanese text with furigana readings and providing Chinese translations. You return only valid JSON.";
  const userPrompt = `For each Japanese subtitle line below, provide ${tasks.join(" and ")}.

Return a JSON array of objects, one per line, with the "id" field matching the input. Do not include any text outside the JSON array.

Lines:
${linesText}`;
  const body = {
    model: config.model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }]
  };
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API error (${response.status}): ${errorText}`);
  }
  const data = await response.json();
  const text = data.content?.[0]?.text ?? "";
  const jsonMatch = text.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error(`Claude did not return valid JSON: ${text}`);
  }
  const parsed = JSON.parse(jsonMatch[0]);
  const resultMap = /* @__PURE__ */ new Map();
  for (const item of parsed) {
    resultMap.set(item.id, item);
  }
  return chunk.map((item) => resultMap.get(item.id) ?? { id: item.id });
}
async function transcribeWithWhisper(videoPath, config, onProgress) {
  const audioPath = await extractAudio(videoPath);
  try {
    onProgress?.("Transcribing with Whisper...");
    const segments = await callWhisperAPI(audioPath, config);
    onProgress?.(`Transcribed ${segments.length} segments`);
    return segments;
  } finally {
    const { unlink } = await import("fs/promises");
    try {
      await unlink(audioPath);
    } catch {
    }
  }
}
async function extractAudio(videoPath) {
  const { tmpdir } = await import("os");
  const { join } = await import("path");
  const audioPath = join(tmpdir(), `languagemaster_${Date.now()}.m4a`);
  const { execFile } = await import("child_process");
  const { promisify } = await import("util");
  const execFileAsync = promisify(execFile);
  await execFileAsync("ffmpeg", [
    "-i",
    videoPath,
    "-vn",
    "-acodec",
    "aac",
    "-ar",
    "16000",
    "-ac",
    "1",
    "-y",
    audioPath
  ], { timeout: 3e5 });
  return audioPath;
}
async function callWhisperAPI(audioPath, config) {
  const audioBuffer = await promises.readFile(audioPath);
  const formData = new FormData();
  formData.append("file", new Blob([audioBuffer]), "audio.m4a");
  formData.append("model", "whisper-1");
  formData.append("language", "ja");
  formData.append("response_format", "verbose_json");
  formData.append("timestamp_granularities[]", "segment");
  const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`
    },
    body: formData
  });
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Whisper API error (${response.status}): ${errorText}`);
  }
  const data = await response.json();
  const rawSegments = data.segments ?? [];
  return rawSegments.map((seg, i) => ({
    id: i,
    start: seg.start,
    end: seg.end,
    japanese: seg.text.trim()
  }));
}
const DEFAULT_SETTINGS = {
  claudeApiKey: "",
  openaiApiKey: "",
  claudeModel: "claude-sonnet-4-20250514",
  showJapanese: true,
  showChinese: true,
  showFurigana: true
};
function getSettingsPath() {
  return path.join(electron.app.getPath("userData"), "settings.json");
}
function getReviewPath() {
  return path.join(electron.app.getPath("userData"), "review-book.json");
}
async function ensureDataDir() {
  const dataDir = electron.app.getPath("userData");
  try {
    await promises.mkdir(dataDir, { recursive: true });
  } catch {
  }
}
async function loadSettings() {
  try {
    const content = await promises.readFile(getSettingsPath(), "utf-8");
    return { ...DEFAULT_SETTINGS, ...JSON.parse(content) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}
async function saveSettings(settings) {
  await ensureDataDir();
  const current = await loadSettings();
  const updated = { ...current, ...settings };
  await promises.writeFile(getSettingsPath(), JSON.stringify(updated, null, 2), "utf-8");
  return updated;
}
async function loadReviewBook() {
  try {
    const content = await promises.readFile(getReviewPath(), "utf-8");
    return JSON.parse(content);
  } catch {
    return [];
  }
}
async function saveReviewItem(item) {
  await ensureDataDir();
  const items = await loadReviewBook();
  items.push(item);
  await promises.writeFile(getReviewPath(), JSON.stringify(items, null, 2), "utf-8");
  return items;
}
async function removeReviewItem(id) {
  const items = await loadReviewBook();
  const filtered = items.filter((item) => item.id !== id);
  await promises.writeFile(getReviewPath(), JSON.stringify(filtered, null, 2), "utf-8");
  return filtered;
}
async function clearReviewBook() {
  await promises.writeFile(getReviewPath(), JSON.stringify([], null, 2), "utf-8");
}
function stripFurigana(furigana) {
  return furigana.replace(/\[([^\]]*)\]/g, "");
}
function generateAnkiTSV(items) {
  const header = "#Expression	Reading	Meaning	Context	Source\n";
  const rows = items.map((item) => {
    const expression = item.text;
    const reading = item.furigana ? extractReadingForText(item.furigana, item.text) : "";
    const meaning = item.chinese ?? "";
    const context = item.japanese ?? "";
    const source = item.videoFileName ?? "";
    return [expression, reading, meaning, context, source].map((field) => escapeTSV(field)).join("	");
  });
  return header + rows.join("\n") + "\n";
}
function extractReadingForText(furigana, text) {
  const plain = stripFurigana(furigana);
  if (plain === text) {
    return furigana.replace(/漢字\[([^\]]*)\]/g, "$1").replace(/\[([^\]]*)\]/g, "$1");
  }
  return "";
}
function escapeTSV(text) {
  return text.replace(/\t/g, " ").replace(/\n/g, " ").replace(/\r/g, "");
}
let mainWindow = null;
electron.protocol.registerSchemesAsPrivileged([
  {
    scheme: "app-video",
    privileges: { stream: true, supportFetchAPI: true, standard: true, secure: true }
  }
]);
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "LanguageMaster",
    webPreferences: {
      preload: path.join(__dirname, "../preload/preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
electron.app.whenReady().then(() => {
  electron.protocol.handle("app-video", async (request) => {
    const url$1 = new URL(request.url);
    const filePath = decodeURIComponent(url$1.pathname.slice(1));
    try {
      const fileUrl = url.pathToFileURL(filePath).toString();
      const response = await electron.net.fetch(fileUrl, { headers: request.headers });
      return response;
    } catch (err) {
      return new Response(`Failed to load video: ${err.message}`, {
        status: 404
      });
    }
  });
  createWindow();
  electron.app.on("activate", () => {
    if (electron.BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
electron.ipcMain.handle("dialog:openVideo", async () => {
  const result = await electron.dialog.showOpenDialog({
    title: "选择视频文件",
    filters: [
      { name: "视频文件", extensions: ["mp4", "mkv", "avi", "mov", "webm", "m4v"] }
    ],
    properties: ["openFile"]
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  const videoUrl = `app-video://local/${encodeURIComponent(filePath)}`;
  return { filePath, videoUrl };
});
electron.ipcMain.handle("dialog:openSubtitle", async () => {
  const result = await electron.dialog.showOpenDialog({
    title: "选择字幕文件",
    filters: [
      { name: "字幕文件", extensions: ["srt", "vtt", "ass", "txt"] }
    ],
    properties: ["openFile"]
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  const filePath = result.filePaths[0];
  const content = await promises.readFile(filePath, "utf-8");
  return { filePath, content };
});
electron.ipcMain.handle("subtitles:parse", async (_event, content, fileName) => {
  return parseSubtitles(content, fileName);
});
electron.ipcMain.handle("subtitles:isJapanese", async (_event, text) => {
  return isJapanese(text);
});
electron.ipcMain.handle(
  "claude:process",
  async (_event, segments, settings, options) => {
    if (!settings.claudeApiKey) {
      throw new Error("未设置 Claude API Key，请先在设置中填写");
    }
    const items = segments.filter((s) => s.japanese).map((s) => ({ id: s.id, japanese: s.japanese }));
    return processSubtitlesWithClaude(items, {
      apiKey: settings.claudeApiKey,
      model: settings.claudeModel
    }, options);
  }
);
electron.ipcMain.handle(
  "whisper:transcribe",
  async (_event, videoPath, settings) => {
    if (!settings.openaiApiKey) {
      throw new Error("未设置 OpenAI API Key，请先在设置中填写");
    }
    return transcribeWithWhisper(videoPath, { apiKey: settings.openaiApiKey });
  }
);
electron.ipcMain.handle("settings:load", async () => {
  return loadSettings();
});
electron.ipcMain.handle("settings:save", async (_event, settings) => {
  return saveSettings(settings);
});
electron.ipcMain.handle("review:load", async () => {
  return loadReviewBook();
});
electron.ipcMain.handle("review:add", async (_event, item) => {
  const fullItem = {
    ...item,
    id: crypto.randomUUID(),
    createdAt: Date.now()
  };
  return saveReviewItem(fullItem);
});
electron.ipcMain.handle("review:remove", async (_event, id) => {
  return removeReviewItem(id);
});
electron.ipcMain.handle("review:clear", async () => {
  await clearReviewBook();
  return [];
});
electron.ipcMain.handle("anki:export", async (_event, items) => {
  const result = await electron.dialog.showSaveDialog({
    title: "导出 Anki 卡片",
    defaultPath: "languagemaster-review.txt",
    filters: [{ name: "文本文件", extensions: ["txt"] }]
  });
  if (result.canceled || !result.filePath) return null;
  const tsv = generateAnkiTSV(items);
  await promises.writeFile(result.filePath, tsv, "utf-8");
  return result.filePath;
});
