// Furigana notation: 漢字[かんじ]. The ruby base is ONLY the run of kanji
// immediately before "[" — preceding kana stays plain text.

export interface FuriganaPart {
  text: string
  reading?: string
}

const KANJI = '\\u4E00-\\u9FFF\\u3400-\\u4DBF\\uF900-\\uFAFF々〆〇ヶヵ'
const KANA = '\\u3040-\\u309F\\u30A0-\\u30FFー'
const RUBY_RE = new RegExp(`([${KANJI}]+)\\[([${KANA}]+)\\]`, 'g')

export function parseFurigana(text: string): FuriganaPart[] {
  const parts: FuriganaPart[] = []
  let lastIndex = 0
  for (const match of text.matchAll(RUBY_RE)) {
    if (match.index! > lastIndex) parts.push({ text: text.slice(lastIndex, match.index) })
    parts.push({ text: match[1], reading: match[2] })
    lastIndex = match.index! + match[0].length
  }
  if (lastIndex < text.length) parts.push({ text: text.slice(lastIndex) })
  return parts
}

export function stripFurigana(text: string): string {
  return parseFurigana(text)
    .map((p) => p.text)
    .join('')
}

/**
 * Kana reading of a substring of the plain text, e.g. "楽しく" → "たのしく".
 * Ruby parts that overlap the selection contribute their whole reading.
 */
export function readingForSelection(furigana: string, selected: string): string {
  const parts = parseFurigana(furigana)
  const plain = parts.map((p) => p.text).join('')
  const start = plain.indexOf(selected)
  if (start < 0) return ''
  const end = start + selected.length
  let pos = 0
  let reading = ''
  let hasRuby = false
  for (const part of parts) {
    const pStart = pos
    const pEnd = pos + part.text.length
    pos = pEnd
    if (pEnd <= start || pStart >= end) continue
    if (part.reading) {
      reading += part.reading
      hasRuby = true
    } else {
      reading += part.text.slice(Math.max(start - pStart, 0), Math.min(end, pEnd) - pStart)
    }
  }
  return hasRuby ? reading : ''
}
