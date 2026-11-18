"use strict";
const electron = require("electron");
const api = {
  // Dialogs
  openVideoDialog: () => electron.ipcRenderer.invoke("dialog:openVideo"),
  openSubtitleDialog: () => electron.ipcRenderer.invoke("dialog:openSubtitle"),
  // Subtitles
  parseSubtitles: (content, fileName) => electron.ipcRenderer.invoke("subtitles:parse", content, fileName),
  isJapanese: (text) => electron.ipcRenderer.invoke("subtitles:isJapanese", text),
  // Claude
  processWithClaude: (segments, settings, options) => electron.ipcRenderer.invoke("claude:process", segments, settings, options),
  // Whisper
  transcribeWithWhisper: (videoPath, settings) => electron.ipcRenderer.invoke("whisper:transcribe", videoPath, settings),
  // Settings
  loadSettings: () => electron.ipcRenderer.invoke("settings:load"),
  saveSettings: (settings) => electron.ipcRenderer.invoke("settings:save", settings),
  // Review book
  loadReviewBook: () => electron.ipcRenderer.invoke("review:load"),
  addReviewItem: (item) => electron.ipcRenderer.invoke("review:add", item),
  removeReviewItem: (id) => electron.ipcRenderer.invoke("review:remove", id),
  clearReviewBook: () => electron.ipcRenderer.invoke("review:clear"),
  // Anki export
  exportAnki: (items) => electron.ipcRenderer.invoke("anki:export", items)
};
electron.contextBridge.exposeInMainWorld("api", api);
