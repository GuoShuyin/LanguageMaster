import React from 'react'

interface FuriganaTextProps {
  text: string // furigana-annotated text using 漢字[かんじ] notation
  className?: string
}

/**
 * Parse furigana-annotated text (漢字[かんじ] format) and render as HTML ruby tags.
 * Text without brackets is rendered as-is.
 * Example: "私[わたし]は日本語[にほんご]を勉強[べんきょう]します"
 * → <ruby>私<rt>わたし</rt></ruby>は<ruby>日本語<rt>にほんご</rt></ruby>を...
 */
export const FuriganaText: React.FC<FuriganaTextProps> = ({ text, className }) => {
  const parts = parseFurigana(text)

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.reading) {
          return (
            <ruby key={i}>
              {part.text}
              <rt>{part.reading}</rt>
            </ruby>
          )
        }
        return <span key={i}>{part.text}</span>
      })}
    </span>
  )
}

interface FuriganaPart {
  text: string
  reading?: string
}

/**
 * Parse 漢字[かんじ] notation into parts.
 * Matches patterns like: 漢字[reading] or plain text.
 */
export function parseFurigana(text: string): FuriganaPart[] {
  const parts: FuriganaPart[] = []
  const regex = /([^\[]+)\[([^\]]+)\]/g
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = regex.exec(text)) !== null) {
    // Text before the match (if any) that wasn't captured
    if (match.index > lastIndex) {
      const before = text.slice(lastIndex, match.index)
      if (before) parts.push({ text: before })
    }
    parts.push({ text: match[1], reading: match[2] })
    lastIndex = regex.lastIndex
  }

  // Remaining text after last match
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex)
    if (remaining) parts.push({ text: remaining })
  }

  return parts.length > 0 ? parts : [{ text }]
}

/**
 * Strip furigana brackets to get plain text.
 */
export function stripFurigana(text: string): string {
  return text.replace(/\[([^\]]*)\]/g, '')
}

export default FuriganaText
