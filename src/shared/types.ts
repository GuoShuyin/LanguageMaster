// Shared types between main process and renderer

export interface SubtitleSegment {
  id: number
  start: number // seconds
  end: number // seconds
  japanese?: string // original Japanese text
  chinese?: string // Chinese translation
  furigana?: string // furigana-annotated text using 漢字[かんじ] notation
  processed?: boolean // whether furigana/translation has been generated
}

export interface ReviewItem {
  id: string
  text: string // the selected text
  context?: string // the full subtitle line it came from
  japanese?: string // full japanese line
  chinese?: string // chinese translation
  furigana?: string // furigana of the full line
  videoFileName?: string
  timestamp?: number // video time when added
  createdAt: number
}

export interface AppSettings {
  claudeApiKey: string
  openaiApiKey: string
  claudeModel: string
  showJapanese: boolean
  showChinese: boolean
  showFurigana: boolean
}

export interface ProcessResult {
  id: number
  furigana?: string
  chinese?: string
}
