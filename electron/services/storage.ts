import { app } from 'electron'
import { join } from 'path'
import { readFile, writeFile, mkdir } from 'fs/promises'
import type { AppSettings, ReviewItem } from '../../shared/types'

const DEFAULT_SETTINGS: AppSettings = {
  claudeApiKey: '',
  openaiApiKey: '',
  claudeModel: 'claude-sonnet-4-20250514',
  showJapanese: true,
  showChinese: true,
  showFurigana: true
}

function getSettingsPath(): string {
  return join(app.getPath('userData'), 'settings.json')
}

function getReviewPath(): string {
  return join(app.getPath('userData'), 'review-book.json')
}

async function ensureDataDir(): Promise<void> {
  const dataDir = app.getPath('userData')
  try {
    await mkdir(dataDir, { recursive: true })
  } catch {
    // dir may already exist
  }
}

export async function loadSettings(): Promise<AppSettings> {
  try {
    const content = await readFile(getSettingsPath(), 'utf-8')
    return { ...DEFAULT_SETTINGS, ...JSON.parse(content) }
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<AppSettings> {
  await ensureDataDir()
  const current = await loadSettings()
  const updated = { ...current, ...settings }
  await writeFile(getSettingsPath(), JSON.stringify(updated, null, 2), 'utf-8')
  return updated
}

export async function loadReviewBook(): Promise<ReviewItem[]> {
  try {
    const content = await readFile(getReviewPath(), 'utf-8')
    return JSON.parse(content)
  } catch {
    return []
  }
}

export async function saveReviewItem(item: ReviewItem): Promise<ReviewItem[]> {
  await ensureDataDir()
  const items = await loadReviewBook()
  items.push(item)
  await writeFile(getReviewPath(), JSON.stringify(items, null, 2), 'utf-8')
  return items
}

export async function removeReviewItem(id: string): Promise<ReviewItem[]> {
  const items = await loadReviewBook()
  const filtered = items.filter((item) => item.id !== id)
  await writeFile(getReviewPath(), JSON.stringify(filtered, null, 2), 'utf-8')
  return filtered
}

export async function clearReviewBook(): Promise<void> {
  await writeFile(getReviewPath(), JSON.stringify([], null, 2), 'utf-8')
}
