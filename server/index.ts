import express from 'express'
import cors from 'cors'
import multer from 'multer'
import dotenv from 'dotenv'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'
import type { AppSettings, ReviewItem, SubtitleSegment } from '../shared/types'
import { parseSubtitles, isJapanese } from './services/subtitles'
import { processSubtitlesWithClaude } from './services/claude'
import { transcribeWithWhisper } from './services/asr'
import { generateAnkiTSV } from './services/anki'

dotenv.config()

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(__dirname, '..', 'data')

// Keys from environment variables (.env file) - used as defaults
const ENV_CLAUDE_KEY = process.env.CLAUDE_API_KEY || ''
const ENV_OPENAI_KEY = process.env.OPENAI_API_KEY || ''
const ENV_CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5-20250929'

const DEFAULT_SETTINGS: AppSettings = {
  claudeApiKey: ENV_CLAUDE_KEY,
  openaiApiKey: ENV_OPENAI_KEY,
  claudeModel: ENV_CLAUDE_MODEL,
  showJapanese: true,
  showChinese: true,
  showFurigana: true
}

async function ensureDataDir(): Promise<void> {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true })
  }
}

async function loadSettings(): Promise<AppSettings> {
  try {
    const content = await readFile(join(DATA_DIR, 'settings.json'), 'utf-8')
    const saved = JSON.parse(content)
    // Environment variables take precedence for API keys (if set in .env)
    return {
      ...DEFAULT_SETTINGS,
      ...saved,
      claudeApiKey: ENV_CLAUDE_KEY || saved.claudeApiKey || '',
      openaiApiKey: ENV_OPENAI_KEY || saved.openaiApiKey || '',
      claudeModel: ENV_CLAUDE_MODEL || saved.claudeModel || ENV_CLAUDE_MODEL
    }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

async function saveSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
  await ensureDataDir()
  const current = await loadSettings()
  const updated = { ...current, ...settings }
  await writeFile(join(DATA_DIR, 'settings.json'), JSON.stringify(updated, null, 2), 'utf-8')
  return updated
}

async function loadReviewBook(): Promise<ReviewItem[]> {
  try {
    const content = await readFile(join(DATA_DIR, 'review-book.json'), 'utf-8')
    return JSON.parse(content)
  } catch {
    return []
  }
}

async function saveReviewBook(items: ReviewItem[]): Promise<void> {
  await ensureDataDir()
  await writeFile(join(DATA_DIR, 'review-book.json'), JSON.stringify(items, null, 2), 'utf-8')
}

const app = express()
app.use(cors())
app.use(express.json({ limit: '500mb' }))

// Serve static files in production
const distDir = join(__dirname, '..', 'dist')
if (existsSync(distDir)) {
  app.use(express.static(distDir))
}

// Multer for file uploads (Whisper ASR)
const upload = multer({ storage: multer.memoryStorage() })

// ===== API Routes =====

// Parse subtitles
app.post('/api/subtitles/parse', (req, res) => {
  try {
    const { content, fileName } = req.body
    const segments = parseSubtitles(content, fileName)
    res.json(segments)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// Check if text is Japanese
app.post('/api/subtitles/is-japanese', (req, res) => {
  const { text } = req.body
  res.json({ isJapanese: isJapanese(text) })
})

// Process subtitles with Claude
app.post('/api/claude/process', async (req, res) => {
  try {
    const { segments, settings, options } = req.body as {
      segments: SubtitleSegment[]
      settings: AppSettings
      options: { translate: boolean; furigana: boolean }
    }
    if (!settings.claudeApiKey) {
      return res.status(400).json({ error: '未设置 Claude API Key' })
    }
    const items = segments
      .filter((s) => s.japanese)
      .map((s) => ({ id: s.id, japanese: s.japanese! }))
    const results = await processSubtitlesWithClaude(items, {
      apiKey: settings.claudeApiKey,
      model: settings.claudeModel
    }, options)
    res.json(results)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// Transcribe video with Whisper
app.post('/api/whisper/transcribe', upload.single('video'), async (req, res) => {
  try {
    const settings = JSON.parse(req.body.settings) as AppSettings
    if (!settings.openaiApiKey) {
      return res.status(400).json({ error: '未设置 OpenAI API Key' })
    }
    if (!req.file) {
      return res.status(400).json({ error: '未上传视频文件' })
    }

    // Write uploaded file to temp, transcribe, then clean up
    const { writeFile: writeTemp, unlink } = await import('fs/promises')
    const { tmpdir } = await import('os')
    const tempPath = join(tmpdir(), `languagemaster_upload_${Date.now()}.mp4`)
    await writeTemp(tempPath, req.file.buffer)

    try {
      const segments = await transcribeWithWhisper(tempPath, { apiKey: settings.openaiApiKey })
      res.json(segments)
    } finally {
      try { await unlink(tempPath) } catch { /* ignore */ }
    }
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// Settings
app.get('/api/settings', async (req, res) => {
  res.json(await loadSettings())
})

app.post('/api/settings', async (req, res) => {
  const updated = await saveSettings(req.body)
  res.json(updated)
})

// Review book
app.get('/api/review', async (req, res) => {
  res.json(await loadReviewBook())
})

app.post('/api/review', async (req, res) => {
  const items = await loadReviewBook()
  const item: ReviewItem = {
    ...req.body,
    id: crypto.randomUUID(),
    createdAt: Date.now()
  }
  items.push(item)
  await saveReviewBook(items)
  res.json(items)
})

app.delete('/api/review/:id', async (req, res) => {
  const items = await loadReviewBook()
  const filtered = items.filter((item) => item.id !== req.params.id)
  await saveReviewBook(filtered)
  res.json(filtered)
})

app.delete('/api/review', async (req, res) => {
  await saveReviewBook([])
  res.json([])
})

// Anki export (return TSV as downloadable file)
app.post('/api/anki/export', async (req, res) => {
  try {
    const items = req.body as ReviewItem[]
    const tsv = generateAnkiTSV(items)
    res.setHeader('Content-Type', 'text/tab-separated-values; charset=utf-8')
    res.setHeader('Content-Disposition', 'attachment; filename="languagemaster-review.txt"')
    res.send(tsv)
  } catch (err) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// Catch-all: serve index.html for SPA (only in production)
if (existsSync(distDir)) {
  app.get('*', (req, res) => {
    res.sendFile(join(distDir, 'index.html'))
  })
}

const PORT = parseInt(process.env.PORT || '3001', 10)
app.listen(PORT, () => {
  console.log(`LanguageMaster server running at http://localhost:${PORT}`)
  ensureDataDir()
})
