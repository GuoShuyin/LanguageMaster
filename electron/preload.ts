import { contextBridge, ipcRenderer } from 'electron'
import type { AppSettings, ReviewItem, SubtitleSegment, ProcessResult } from '../shared/types'

const api = {
  // Dialogs
  openVideoDialog: (): Promise<{ filePath: string; videoUrl: string } | null> =>
    ipcRenderer.invoke('dialog:openVideo'),
  openSubtitleDialog: (): Promise<{ filePath: string; content: string } | null> =>
    ipcRenderer.invoke('dialog:openSubtitle'),

  // Subtitles
  parseSubtitles: (content: string, fileName?: string): Promise<SubtitleSegment[]> =>
    ipcRenderer.invoke('subtitles:parse', content, fileName),
  isJapanese: (text: string): Promise<boolean> => ipcRenderer.invoke('subtitles:isJapanese', text),

  // Claude
  processWithClaude: (
    segments: SubtitleSegment[],
    settings: AppSettings,
    options: { translate: boolean; furigana: boolean }
  ): Promise<ProcessResult[]> =>
    ipcRenderer.invoke('claude:process', segments, settings, options),

  // Whisper
  transcribeWithWhisper: (videoPath: string, settings: AppSettings): Promise<SubtitleSegment[]> =>
    ipcRenderer.invoke('whisper:transcribe', videoPath, settings),

  // Settings
  loadSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:load'),
  saveSettings: (settings: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:save', settings),

  // Review book
  loadReviewBook: (): Promise<ReviewItem[]> => ipcRenderer.invoke('review:load'),
  addReviewItem: (item: Omit<ReviewItem, 'id' | 'createdAt'>): Promise<ReviewItem[]> =>
    ipcRenderer.invoke('review:add', item),
  removeReviewItem: (id: string): Promise<ReviewItem[]> => ipcRenderer.invoke('review:remove', id),
  clearReviewBook: (): Promise<ReviewItem[]> => ipcRenderer.invoke('review:clear'),

  // Anki export
  exportAnki: (items: ReviewItem[]): Promise<string | null> => ipcRenderer.invoke('anki:export', items)
}

contextBridge.exposeInMainWorld('api', api)

export type Api = typeof api
