import type { SubtitleSegment } from '../../shared/types'

/**
 * Parse a time string from SRT/VTT format to seconds.
 * Supports: HH:MM:SS,mmm  and  HH:MM:SS.mmm
 */
function parseTime(time: string): number {
  const cleaned = time.trim().replace(',', '.')
  const parts = cleaned.split(':')
  if (parts.length === 3) {
    const [h, m, s] = parts
    return parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseFloat(s)
  } else if (parts.length === 2) {
    const [m, s] = parts
    return parseInt(m, 10) * 60 + parseFloat(s)
  }
  return parseFloat(cleaned)
}

/**
 * Parse SRT subtitle content into SubtitleSegment array.
 */
export function parseSRT(content: string): SubtitleSegment[] {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  const blocks = normalized.split(/\n\s*\n/)
  const segments: SubtitleSegment[] = []

  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim())
    if (lines.length < 2) continue

    let textStartIndex = 0
    // Skip the index line if it's a number
    if (/^\d+$/.test(lines[0].trim())) {
      textStartIndex = 1
    }

    const timeLine = lines[textStartIndex]
    const timeMatch = timeLine.match(
      /(\d{1,2}:\d{2}:\d{2}[.,]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[.,]\d{1,3})/
    )
    if (!timeMatch) continue

    const start = parseTime(timeMatch[1])
    const end = parseTime(timeMatch[2])
    const text = lines
      .slice(textStartIndex + 1)
      .join('\n')
      .trim()

    if (text) {
      segments.push({
        id: segments.length,
        start,
        end,
        japanese: text
      })
    }
  }

  return segments
}

/**
 * Parse WebVTT subtitle content into SubtitleSegment array.
 */
export function parseVTT(content: string): SubtitleSegment[] {
  const normalized = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  // Remove WEBVTT header and metadata
  const body = normalized.replace(/^WEBVTT.*\n/, '').replace(/^NOTE.*\n\n/gm, '')
  const blocks = body.split(/\n\s*\n/)
  const segments: SubtitleSegment[] = []

  for (const block of blocks) {
    const lines = block.split('\n').filter((l) => l.trim())
    if (lines.length < 2) continue

    let textStartIndex = 0
    // Skip index line if numeric
    if (/^\d+$/.test(lines[0].trim())) {
      textStartIndex = 1
    }

    const timeLine = lines[textStartIndex]
    const timeMatch = timeLine.match(
      /(\d{1,2}:\d{2}:\d{2}[.,]\d{1,3}|\d+[.,]\d+s?)\s*-->\s*(\d{1,2}:\d{2}:\d{2}[.,]\d{1,3}|\d+[.,]\d+s?)/
    )
    if (!timeMatch) continue

    const start = parseTime(timeMatch[1])
    const end = parseTime(timeMatch[2])
    const text = lines
      .slice(textStartIndex + 1)
      .join('\n')
      .trim()

    if (text) {
      segments.push({
        id: segments.length,
        start,
        end,
        japanese: text
      })
    }
  }

  return segments
}

/**
 * Auto-detect format and parse subtitles.
 */
export function parseSubtitles(content: string, fileName?: string): SubtitleSegment[] {
  const trimmed = content.trim()
  if (fileName?.toLowerCase().endsWith('.vtt') || trimmed.startsWith('WEBVTT')) {
    return parseVTT(content)
  }
  // Default to SRT
  return parseSRT(content)
}

/**
 * Detect language: check if text contains Japanese characters (hiragana, katakana, kanji).
 */
export function isJapanese(text: string): boolean {
  return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(text)
}
