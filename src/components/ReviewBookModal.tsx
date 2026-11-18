import React from 'react'
import type { ReviewItem } from '../shared/types'
import { stripFurigana } from './FuriganaText'

interface ReviewBookModalProps {
  items: ReviewItem[]
  onRemove: (id: string) => void
  onClear: () => void
  onExportAnki: () => void
  onClose: () => void
}

export const ReviewBookModal: React.FC<ReviewBookModalProps> = ({
  items,
  onRemove,
  onClear,
  onExportAnki,
  onClose
}) => {
  const getReading = (item: ReviewItem): string => {
    if (!item.furigana) return ''
    // Extract readings from furigana for the selected text
    const plain = stripFurigana(item.furigana)
    if (plain.includes(item.text)) {
      // Find the reading for the selected text within the furigana
      const regex = new RegExp(
        item.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\[([^\\]]+)\\]'
      )
      const match = item.furigana.match(regex)
      if (match) return match[1]
    }
    return ''
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ minWidth: 600 }}>
        <button className="modal-close" onClick={onClose}>
          ×
        </button>
        <div className="modal-title">复习本</div>

        <div className="review-header">
          <span className="review-count">{items.length} 个条目</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="form-btn form-btn-secondary"
              onClick={onExportAnki}
              disabled={items.length === 0}
            >
              导出 Anki
            </button>
            <button
              className="form-btn form-btn-secondary"
              onClick={() => {
                if (confirm('确定清空复习本？此操作不可撤销。')) {
                  onClear()
                }
              }}
              disabled={items.length === 0}
            >
              清空
            </button>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="review-empty">
            复习本为空。在字幕中框选文字即可自动添加到复习本。
          </div>
        ) : (
          <div className="review-list">
            {items.map((item) => (
              <div key={item.id} className="review-item">
                <div className="review-item-content">
                  <div className="review-item-text">{item.text}</div>
                  {getReading(item) && (
                    <div className="review-item-reading">{getReading(item)}</div>
                  )}
                  {item.chinese && <div className="review-item-meaning">{item.chinese}</div>}
                  {item.japanese && item.japanese !== item.text && (
                    <div className="review-item-context">原文: {item.japanese}</div>
                  )}
                  {item.videoFileName && (
                    <div className="review-item-context">来源: {item.videoFileName}</div>
                  )}
                </div>
                <button
                  className="review-item-delete"
                  onClick={() => onRemove(item.id)}
                  title="删除"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default ReviewBookModal
