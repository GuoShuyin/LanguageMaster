import type { AppSettings, ReviewItem, SubtitleSegment, ProcessResult } from '../shared/types'

const API_BASE = '/api'

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {})
    }
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }))
    throw new Error(error.error || `HTTP ${response.status}`)
  }
  return response.json()
}

export const api = {
  // Subtitles
  parseSubtitles: async (content: string, fileName?: string): Promise<SubtitleSegment[]> => {
    return fetchJSON(`${API_BASE}/subtitles/parse`, {
      method: 'POST',
      body: JSON.stringify({ content, fileName })
    })
  },

  isJapanese: async (text: string): Promise<boolean> => {
    const result = await fetchJSON<{ isJapanese: boolean }>(`${API_BASE}/subtitles/is-japanese`, {
      method: 'POST',
      body: JSON.stringify({ text })
    })
    return result.isJapanese
  },

  // Claude
  processWithClaude: async (
    segments: SubtitleSegment[],
    settings: AppSettings,
    options: { translate: boolean; furigana: boolean }
  ): Promise<ProcessResult[]> => {
    return fetchJSON(`${API_BASE}/claude/process`, {
      method: 'POST',
      body: JSON.stringify({ segments, settings, options })
    })
  },

  // Whisper - upload video file
  transcribeWithWhisper: async (videoFile: File, settings: AppSettings): Promise<SubtitleSegment[]> => {
    const formData = new FormData()
    formData.append('video', videoFile)
    formData.append('settings', JSON.stringify(settings))
    const response = await fetch(`${API_BASE}/whisper/transcribe`, {
      method: 'POST',
      body: formData
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }))
      throw new Error(error.error || `HTTP ${response.status}`)
    }
    return response.json()
  },

  // Settings
  loadSettings: async (): Promise<AppSettings> => {
    return fetchJSON(`${API_BASE}/settings`)
  },

  saveSettings: async (settings: Partial<AppSettings>): Promise<AppSettings> => {
    return fetchJSON(`${API_BASE}/settings`, {
      method: 'POST',
      body: JSON.stringify(settings)
    })
  },

  // Review book
  loadReviewBook: async (): Promise<ReviewItem[]> => {
    return fetchJSON(`${API_BASE}/review`)
  },

  addReviewItem: async (item: Omit<ReviewItem, 'id' | 'createdAt'>): Promise<ReviewItem[]> => {
    return fetchJSON(`${API_BASE}/review`, {
      method: 'POST',
      body: JSON.stringify(item)
    })
  },

  removeReviewItem: async (id: string): Promise<ReviewItem[]> => {
    return fetchJSON(`${API_BASE}/review/${id}`, {
      method: 'DELETE'
    })
  },

  clearReviewBook: async (): Promise<ReviewItem[]> => {
    return fetchJSON(`${API_BASE}/review`, {
      method: 'DELETE'
    })
  },

  // Anki export - triggers browser download
  exportAnki: async (items: ReviewItem[]): Promise<void> => {
    const response = await fetch(`${API_BASE}/anki/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(items)
    })
    if (!response.ok) {
      throw new Error('导出失败')
    }
    const blob = await response.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'languagemaster-review.txt'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
}
