import type { ReviewItem } from '../../shared/types'

/**
 * Convert furigana notation (漢字[かんじ]) to Anki's furigana format (漢字[かんじ]).
 * Anki supports the same 漢字[ふりがな] syntax in the "Japanese" card type.
 * We also generate a clean reading-only field.
 */

/**
 * Remove furigana brackets to get plain text.
 * 漢字[かんじ] → 漢字
 */
export function stripFurigana(furigana: string): string {
  return furigana.replace(/\[([^\]]*)\]/g, '')
}

/**
 * Generate Anki-importable TSV file content.
 * Format: Expression\tReading\tMeaning\tContext
 * Compatible with Anki's "Import" feature (tab-separated, basic note type).
 */
export function generateAnkiTSV(items: ReviewItem[]): string {
  const header = '#Expression\tReading\tMeaning\tContext\tSource\n'
  const rows = items.map((item) => {
    const expression = item.text
    const reading = item.furigana ? extractReadingForText(item.furigana, item.text) : ''
    const meaning = item.chinese ?? ''
    const context = item.japanese ?? ''
    const source = item.videoFileName ?? ''
    return [expression, reading, meaning, context, source]
      .map((field) => escapeTSV(field))
      .join('\t')
  })
  return header + rows.join('\n') + '\n'
}

/**
 * Extract the reading for a specific text from a furigana-annotated string.
 * If the text is a substring of the furigana string, find its reading.
 */
function extractReadingForText(furigana: string, text: string): string {
  // If the full text matches the plain version of furigana, return all readings
  const plain = stripFurigana(furigana)
  if (plain === text) {
    // Return all readings concatenated
    return furigana.replace(/漢字\[([^\]]*)\]/g, '$1').replace(/\[([^\]]*)\]/g, '$1')
  }
  // Otherwise try to find the text within the furigana string
  // This is a best-effort approach for selected substrings
  return ''
}

function escapeTSV(text: string): string {
  // TSV: replace tabs and newlines
  return text.replace(/\t/g, ' ').replace(/\n/g, ' ').replace(/\r/g, '')
}
