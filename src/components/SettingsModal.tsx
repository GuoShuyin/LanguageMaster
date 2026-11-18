import React, { useState } from 'react'
import type { AppSettings } from '../../shared/types'

interface SettingsModalProps {
  settings: AppSettings
  onSave: (settings: Partial<AppSettings>) => Promise<void>
  onClose: () => void
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ settings, onSave, onClose }) => {
  const [claudeApiKey, setClaudeApiKey] = useState(settings.claudeApiKey)
  const [openaiApiKey, setOpenaiApiKey] = useState(settings.openaiApiKey)
  const [claudeModel, setClaudeModel] = useState(settings.claudeModel)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave({ claudeApiKey, openaiApiKey, claudeModel })
      onClose()
    } catch (err) {
      alert('保存失败: ' + (err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ×
        </button>
        <div className="modal-title">设置</div>

        <div className="form-group">
          <label className="form-label">Claude API Key</label>
          <input
            type="password"
            className="form-input"
            value={claudeApiKey}
            onChange={(e) => setClaudeApiKey(e.target.value)}
            placeholder="sk-ant-..."
          />
          <div className="form-help">
            用于翻译（日→中）和汉字注音。从 https://console.anthropic.com 获取。
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Claude 模型</label>
          <input
            type="text"
            className="form-input"
            value={claudeModel}
            onChange={(e) => setClaudeModel(e.target.value)}
            placeholder="claude-sonnet-4-20250514"
          />
          <div className="form-help">推荐 claude-sonnet-4-20250514（性价比高）。</div>
        </div>

        <div className="form-group">
          <label className="form-label">OpenAI API Key</label>
          <input
            type="password"
            className="form-input"
            value={openaiApiKey}
            onChange={(e) => setOpenaiApiKey(e.target.value)}
            placeholder="sk-..."
          />
          <div className="form-help">
            用于 Whisper 语音转文字（无字幕视频生成日语字幕）。从 https://platform.openai.com 获取。
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button className="form-btn" onClick={handleSave} disabled={saving}>
            {saving ? '保存中...' : '保存'}
          </button>
          <button className="form-btn form-btn-secondary" onClick={onClose}>
            取消
          </button>
        </div>
      </div>
    </div>
  )
}

export default SettingsModal
