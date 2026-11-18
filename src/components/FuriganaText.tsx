import React from 'react'
import { parseFurigana, stripFurigana } from '../shared/furigana'

interface FuriganaTextProps {
  text: string // furigana-annotated text using 漢字[かんじ] notation
  className?: string
}

/**
 * Render 漢字[かんじ] notation as HTML ruby tags.
 * Example: "私[わたし]は日本語[にほんご]" → <ruby>私<rt>わたし</rt></ruby>は<ruby>日本語<rt>にほんご</rt></ruby>
 */
export const FuriganaText: React.FC<FuriganaTextProps> = ({ text, className }) => (
  <span className={className}>
    {parseFurigana(text).map((part, i) =>
      part.reading ? (
        <ruby key={i}>
          {part.text}
          <rt>{part.reading}</rt>
        </ruby>
      ) : (
        <span key={i}>{part.text}</span>
      )
    )}
  </span>
)

export { parseFurigana, stripFurigana }

export default FuriganaText
