import { app, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron'
import { join } from 'path'
import { readFile, writeFile } from 'fs/promises'
import { pathToFileURL } from 'url'
import { randomUUID } from 'crypto'
import type { AppSettings, ReviewItem, SubtitleSegment } from '../shared/types'
import { parseSubtitles, isJapanese } from './services/subtitles'
import { processSubtitlesWithClaude } from './services/claude'
import { transcribeWithWhisper } from './services/asr'
import {
  loadSettings,
  saveSettings,
  loadReviewBook,
  saveReviewItem,
  removeReviewItem,
  clearReviewBook
} from './services/storage'
import { generateAnkiTSV } from './services/anki'

let mainWindow: BrowserWindow | null = null

// Register custom protocol for serving local video files (avoids CORS issues in dev mode)
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app-video',
    privileges: { stream: true, supportFetchAPI: true, standard: true, secure: true }
  }
])

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'LanguageMaster',
    webPreferences: {
      preload: join(__dirname, '../preload/preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // In dev mode, load the vite dev server; in production, load the built file
  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  // Register protocol handler for local video files
  protocol.handle('app-video', async (request) => {
    const url = new URL(request.url)
    // The pathname (after leading /) is the URL-encoded file path
    const filePath = decodeURIComponent(url.pathname.slice(1))
    try {
      const fileUrl = pathToFileURL(filePath).toString()
      const response = await net.fetch(fileUrl, { headers: request.headers })
      return response
    } catch (err) {
      return new Response(`Failed to load video: ${(err as Error).message}`, {
        status: 404
      })
    }
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// ===== IPC Handlers =====

// Open video file dialog
ipcMain.handle('dialog:openVideo', async () => {
  const result = await dialog.showOpenDialog({
    title: '选择视频文件',
    filters: [
      { name: '视频文件', extensions: ['mp4', 'mkv', 'avi', 'mov', 'webm', 'm4v'] }
    ],
    properties: ['openFile']
  })
  if (result.canceled || result.filePaths.length === 0) return null
  const filePath = result.filePaths[0]
  // Encode the file path into the app-video protocol URL (path goes in pathname)
  const videoUrl = `app-video://local/${encodeURIComponent(filePath)}`
  return { filePath, videoUrl }
})

// Open subtitle file dialog
ipcMain.handle('dialog:openSubtitle', async () => {
  const result = await dialog.showOpenDialog({
    title: '选择字幕文件',
    filters: [
      { name: '字幕文件', extensions: ['srt', 'vtt', 'ass', 'txt'] }
    ],
    properties: ['openFile']
  })
  if (result.canceled || result.filePaths.length === 0) return null
  const filePath = result.filePaths[0]
  const content = await readFile(filePath, 'utf-8')
  return { filePath, content }
})

// Parse subtitle content
ipcMain.handle('subtitles:parse', async (_event, content: string, fileName?: string) => {
  return parseSubtitles(content, fileName)
})

// Check if text is Japanese
ipcMain.handle('subtitles:isJapanese', async (_event, text: string) => {
  return isJapanese(text)
})

// Process subtitles with Claude (furigana + translation)
ipcMain.handle(
  'claude:process',
  async (
    _event,
    segments: SubtitleSegment[],
    settings: AppSettings,
    options: { translate: boolean; furigana: boolean }
  ) => {
    if (!settings.claudeApiKey) {
      throw new Error('未设置 Claude API Key，请先在设置中填写')
    }

    const items = segments
      .filter((s) => s.japanese)
      .map((s) => ({ id: s.id, japanese: s.japanese! }))

    return processSubtitlesWithClaude(items, {
      apiKey: settings.claudeApiKey,
      model: settings.claudeModel
    }, options)
  }
)

// Transcribe video with Whisper
ipcMain.handle(
  'whisper:transcribe',
  async (_event, videoPath: string, settings: AppSettings) => {
    if (!settings.openaiApiKey) {
      throw new Error('未设置 OpenAI API Key，请先在设置中填写')
    }
    return transcribeWithWhisper(videoPath, { apiKey: settings.openaiApiKey })
  }
)

// Settings
ipcMain.handle('settings:load', async () => {
  return loadSettings()
})

ipcMain.handle('settings:save', async (_event, settings: Partial<AppSettings>) => {
  return saveSettings(settings)
})

// Review book
ipcMain.handle('review:load', async () => {
  return loadReviewBook()
})

ipcMain.handle('review:add', async (_event, item: Omit<ReviewItem, 'id' | 'createdAt'>) => {
  const fullItem: ReviewItem = {
    ...item,
    id: randomUUID(),
    createdAt: Date.now()
  }
  return saveReviewItem(fullItem)
})

ipcMain.handle('review:remove', async (_event, id: string) => {
  return removeReviewItem(id)
})

ipcMain.handle('review:clear', async () => {
  await clearReviewBook()
  return []
})

// Anki export
ipcMain.handle('anki:export', async (_event, items: ReviewItem[]) => {
  const result = await dialog.showSaveDialog({
    title: '导出 Anki 卡片',
    defaultPath: 'languagemaster-review.txt',
    filters: [{ name: '文本文件', extensions: ['txt'] }]
  })
  if (result.canceled || !result.filePath) return null
  const tsv = generateAnkiTSV(items)
  await writeFile(result.filePath, tsv, 'utf-8')
  return result.filePath
})
