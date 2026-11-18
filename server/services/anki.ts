import type { ReviewItem } from '../../shared/types'
import { readingForSelection } from '../../src/shared/furigana'

/**
 * Generate Anki-importable TSV file content.
 * Format: Expression\tReading\tMeaning\tContext\tSource
 */
export function generateAnkiTSV(items: ReviewItem[]): string {
  const header = '#Expression\tReading\tMeaning\tContext\tSource\n'
  const rows = items.map((item) => {
    const expression = item.text
    const reading = item.furigana ? readingForSelection(item.furigana, item.text) : ''
    const meaning = item.chinese ?? ''
    const context = item.japanese ?? ''
    const source = item.videoFileName ?? ''
    return [expression, reading, meaning, context, source]
      .map((field) => escapeTSV(field))
      .join('\t')
  })
  return header + rows.join('\n') + '\n'
}

function escapeTSV(text: string): string {
  return text.replace(/\t/g, ' ').replace(/\n/g, ' ').replace(/\r/g, '')
}
