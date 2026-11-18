import React, { useState, useEffect, useRef, useCallback } from 'react'
import type { AppSettings, ReviewItem, SubtitleSegment } from '../shared/types'
import { api } from './api'
import { FuriganaText, stripFurigana } from './components/FuriganaText'
import SettingsModal from './components/SettingsModal'
import ReviewBookModal from './components/ReviewBookModal'

const App: React.FC = () => {
  // Video state
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [videoFileName, setVideoFileName] = useState<string>('')
  const [currentTime, setCurrentTime] = useState(0)

  // Subtitle state
  const [subtitles, setSubtitles] = useState<SubtitleSegment[]>([])
  const [hasJapaneseSubs, setHasJapaneseSubs] = useState(false)
  const [hasChineseSubs, setHasChineseSubs] = useState(false)

  // Settings
  const [settings, setSettings] = useState<AppSettings | null>(null)

  // Review
  const [reviewItems, setReviewItems] = useState<ReviewItem[]>([])

  // UI state
  const [showSettings, setShowSettings] = useState(false)
  const [showReview, setShowReview] = useState(false)
  const [processing, setProcessing] = useState<{ active: boolean; status: string }>({
    active: false,
    status: ''
  })
  const [notification, setNotification] = useState<{ message: string; error: boolean } | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const subtitleBarRef = useRef<HTMLDivElement>(null)
  const subtitleListRef = useRef<HTMLDivElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const subtitleInputRef = useRef<HTMLInputElement>(null)

  // ===== Load settings and review book on mount =====
  useEffect(() => {
    api.loadSettings().then(setSettings)
    api.loadReviewBook().then(setReviewItems)
  }, [])

  // ===== Notification helper =====
  const showNotification = useCallback((message: string, error = false) => {
    setNotification({ message, error })
    setTimeout(() => setNotification(null), 3000)
  }, [])

  // ===== Find current subtitle index =====
  const currentSegmentIndex = subtitles.findIndex(
    (s) => currentTime >= s.start && currentTime <= s.end
  )
  const currentSegment = currentSegmentIndex >= 0 ? subtitles[currentSegmentIndex] : null

  // Auto-scroll subtitle list to current segment
  useEffect(() => {
    if (currentSegmentIndex >= 0 && subtitleListRef.current) {
      const item = subtitleListRef.current.children[currentSegmentIndex] as HTMLElement
      if (item) {
        item.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
    }
  }, [currentSegmentIndex])

  // ===== Video handlers =====
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime)
    }
  }

  const seekTo = (time: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time
      setCurrentTime(time)
    }
  }

  // ===== Open video via File API =====
  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Revoke old URL
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    const url = URL.createObjectURL(file)
    setVideoFile(file)
    setVideoUrl(url)
    setVideoFileName(file.name)
    setCurrentTime(0)
  }

  // ===== Open subtitle file via File API =====
  const handleSubtitleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const content = await file.text()
    const segments = await api.parseSubtitles(content, file.name)
    if (segments.length === 0) {
      showNotification('字幕文件为空或格式不支持', true)
      return
    }

    // Detect language
    const sampleText = segments.map((s) => s.japanese || '').join(' ')
    const isJp = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(sampleText)
    // Better detection: if it has hiragana/katakana, it's Japanese
    const hasKana = /[\u3040-\u309F\u30A0-\u30FF]/.test(sampleText)

    if (hasKana) {
      setSubtitles((prev) => mergeSubtitles(prev, segments, 'japanese'))
      setHasJapaneseSubs(true)
      showNotification(`已加载 ${segments.length} 条日文字幕`)
    } else if (isJp) {
      // Has CJK but no kana - could be Chinese or all-kanji Japanese
      // Treat as Chinese
      setSubtitles((prev) => mergeSubtitles(prev, segments, 'chinese'))
      setHasChineseSubs(true)
      showNotification(`已加载 ${segments.length} 条中文字幕`)
    } else {
      showNotification('无法识别字幕语言', true)
    }

    // Reset input so the same file can be loaded again
    e.target.value = ''
  }

  // Merge new subtitles into existing ones
  const mergeSubtitles = (
    existing: SubtitleSegment[],
    newSubs: SubtitleSegment[],
    field: 'japanese' | 'chinese'
  ): SubtitleSegment[] => {
    if (existing.length === 0) {
      return newSubs.map((s) => ({
        ...s,
        [field]: s.japanese,
        japanese: field === 'japanese' ? s.japanese : undefined
      }))
    }
    // If same count, merge by index
    if (existing.length === newSubs.length) {
      return existing.map((s, i) => ({ ...s, [field]: newSubs[i].japanese }))
    }
    // Match by overlapping time
    const merged = [...existing]
    for (const ns of newSubs) {
      const matchIdx = merged.findIndex(
        (s) => Math.abs(s.start - ns.start) < 1.5 || Math.abs(s.end - ns.end) < 1.5
      )
      if (matchIdx >= 0) {
        merged[matchIdx] = { ...merged[matchIdx], [field]: ns.japanese }
      }
    }
    return merged
  }

  // ===== Process subtitles with Claude =====
  const handleProcessSubtitles = async () => {
    if (!settings) return
    if (!settings.claudeApiKey) {
      showNotification('请先在设置中填写 Claude API Key', true)
      setShowSettings(true)
      return
    }
    if (!hasJapaneseSubs) {
      showNotification('请先加载日文字幕或用 Whisper 生成', true)
      return
    }

    setProcessing({ active: true, status: '正在处理字幕（注音 + 翻译）...' })
    try {
      const needTranslation = !hasChineseSubs
      const needFurigana = true

      const results = await api.processWithClaude(subtitles, settings, {
        translate: needTranslation,
        furigana: needFurigana
      })

      const updated = subtitles.map((s) => {
        const result = results.find((r) => r.id === s.id)
        if (!result) return s
        return {
          ...s,
          furigana: result.furigana || s.furigana,
          chinese: result.chinese || s.chinese,
          processed: true
        }
      })
      setSubtitles(updated)
      if (needTranslation) setHasChineseSubs(true)
      showNotification(`已处理 ${results.length} 条字幕`)
    } catch (err) {
      showNotification('处理失败: ' + (err as Error).message, true)
    } finally {
      setProcessing({ active: false, status: '' })
    }
  }

  // ===== Whisper ASR =====
  const handleTranscribe = async () => {
    if (!settings) return
    if (!settings.openaiApiKey) {
      showNotification('请先在设置中填写 OpenAI API Key', true)
      setShowSettings(true)
      return
    }
    if (!videoFile) {
      showNotification('请先打开视频文件', true)
      return
    }

    setProcessing({ active: true, status: '正在提取音频并转录（可能需要几分钟）...' })
    try {
      const segments = await api.transcribeWithWhisper(videoFile, settings)
      if (segments.length === 0) {
        showNotification('Whisper 未识别到语音', true)
        return
      }
      setSubtitles((prev) => mergeSubtitles(prev, segments, 'japanese'))
      setHasJapaneseSubs(true)
      showNotification(`已生成 ${segments.length} 条日文字幕，请点击"处理字幕"获取注音和翻译`)
    } catch (err) {
      showNotification('转录失败: ' + (err as Error).message, true)
    } finally {
      setProcessing({ active: false, status: '' })
    }
  }

  // ===== Text selection → add to review book =====
  const handleSubtitleMouseUp = async () => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed) return

    const selectedText = selection.toString().trim()
    if (!selectedText) return

    if (!subtitleBarRef.current) return
    const range = selection.getRangeAt(0)
    if (!subtitleBarRef.current.contains(range.commonAncestorContainer)) return

    if (selectedText.length < 1) return

    const context = currentSegment
    const item = {
      text: selectedText,
      context: context?.japanese,
      japanese: context?.japanese,
      chinese: context?.chinese,
      furigana: context?.furigana,
      videoFileName: videoFileName || undefined,
      timestamp: currentTime
    }

    try {
      const updated = await api.addReviewItem(item)
      setReviewItems(updated)
      showNotification(`已添加到复习本: ${selectedText}`)
      selection.removeAllRanges()
    } catch (err) {
      showNotification('添加失败: ' + (err as Error).message, true)
    }
  }

  // ===== Toggle settings =====
  const toggleSetting = async (key: 'showJapanese' | 'showChinese' | 'showFurigana') => {
    if (!settings) return
    const updated = { ...settings, [key]: !settings[key] }
    setSettings(updated)
    await api.saveSettings({ [key]: updated[key] })
  }

  // ===== Review book handlers =====
  const handleRemoveReview = async (id: string) => {
    const updated = await api.removeReviewItem(id)
    setReviewItems(updated)
  }

  const handleClearReview = async () => {
    const updated = await api.clearReviewBook()
    setReviewItems(updated)
    showNotification('复习本已清空')
  }

  const handleExportAnki = async () => {
    try {
      await api.exportAnki(reviewItems)
      showNotification('Anki 卡片已导出')
    } catch (err) {
      showNotification('导出失败: ' + (err as Error).message, true)
    }
  }

  // ===== Save settings =====
  const handleSaveSettings = async (newSettings: Partial<AppSettings>) => {
    const updated = await api.saveSettings(newSettings)
    setSettings(updated)
    showNotification('设置已保存')
  }

  // ===== Format time =====
  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  if (!settings) {
    return <div className="video-placeholder">加载中...</div>
  }

  return (
    <>
      {/* Hidden file inputs */}
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/x-matroska,video/avi,video/quicktime,video/webm,video/x-m4v,.mp4,.mkv,.avi,.mov,.webm,.m4v"
        style={{ display: 'none' }}
        onChange={handleVideoFileChange}
      />
      <input
        ref={subtitleInputRef}
        type="file"
        accept=".srt,.vtt,.ass,.txt"
        style={{ display: 'none' }}
        onChange={handleSubtitleFileChange}
      />

      {/* ===== Toolbar ===== */}
      <div className="toolbar">
        <span className="toolbar-title">LanguageMaster</span>
        <button className="toolbar-btn" onClick={() => videoInputRef.current?.click()}>
          📁 打开视频
        </button>
        <button
          className="toolbar-btn"
          onClick={() => subtitleInputRef.current?.click()}
          disabled={!videoFile}
        >
          📝 加载字幕
        </button>
        <button
          className="toolbar-btn"
          onClick={handleTranscribe}
          disabled={!videoFile || processing.active}
        >
          🎙️ 生成字幕 (Whisper)
        </button>
        <button
          className="toolbar-btn"
          onClick={handleProcessSubtitles}
          disabled={!hasJapaneseSubs || processing.active}
        >
          ✨ 处理字幕 (注音+翻译)
        </button>
        <div className="toolbar-spacer" />
        <span className="toolbar-status">
          {videoFileName && `🎬 ${videoFileName}`}
          {hasJapaneseSubs && ' | 日文✓'}
          {hasChineseSubs && ' | 中文✓'}
          {subtitles.some((s) => s.processed) && ' | 注音✓'}
        </span>
        <button className="toolbar-btn" onClick={() => setShowReview(true)}>
          📖 复习本 ({reviewItems.length})
        </button>
        <button className="toolbar-btn" onClick={() => setShowSettings(true)}>
          ⚙️ 设置
        </button>
      </div>

      {/* ===== Main Layout ===== */}
      <div className="main-layout">
        {/* Video + Subtitle Bar */}
        <div className="video-section">
          <div className="video-container">
            {videoUrl ? (
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                onTimeUpdate={handleTimeUpdate}
                style={{ width: '100%', height: '100%' }}
              />
            ) : (
              <div className="video-placeholder">
                点击"打开视频"选择一个视频文件开始
                <br />
                <br />
                支持格式: MP4, MKV, AVI, MOV, WebM
              </div>
            )}
          </div>

          {/* Subtitle Controls */}
          <div className="subtitle-controls">
            <button
              className={`toggle-btn ${settings.showJapanese ? 'active' : ''}`}
              onClick={() => toggleSetting('showJapanese')}
            >
              日文
            </button>
            <button
              className={`toggle-btn ${settings.showFurigana ? 'active' : ''}`}
              onClick={() => toggleSetting('showFurigana')}
            >
              注音
            </button>
            <button
              className={`toggle-btn ${settings.showChinese ? 'active' : ''}`}
              onClick={() => toggleSetting('showChinese')}
            >
              中文
            </button>
          </div>

          {/* Current Subtitle Bar */}
          <div className="subtitle-bar" ref={subtitleBarRef} onMouseUp={handleSubtitleMouseUp}>
            {currentSegment ? (
              <>
                {settings.showJapanese && currentSegment.japanese && (
                  <div className="subtitle-japanese">
                    {settings.showFurigana && currentSegment.furigana ? (
                      <FuriganaText text={currentSegment.furigana} />
                    ) : (
                      <span>{currentSegment.japanese}</span>
                    )}
                  </div>
                )}
                {settings.showChinese && currentSegment.chinese && (
                  <div className="subtitle-chinese">{currentSegment.chinese}</div>
                )}
                <div className="subtitle-hint">框选文字可自动加入复习本</div>
              </>
            ) : (
              <div className="subtitle-bar-empty">
                {subtitles.length > 0
                  ? '播放视频以显示字幕'
                  : '加载字幕后，此处显示当前字幕（日文+注音+中文）'}
              </div>
            )}
          </div>
        </div>

        {/* Subtitle List Sidebar */}
        <div className="sidebar">
          <div className="subtitle-list-header">
            <span>字幕列表 ({subtitles.length})</span>
          </div>
          <div className="subtitle-list" ref={subtitleListRef}>
            {subtitles.length === 0 ? (
              <div
                style={{
                  padding: '20px',
                  textAlign: 'center',
                  color: 'var(--text-secondary)',
                  fontSize: '13px'
                }}
              >
                加载字幕后在此显示
              </div>
            ) : (
              subtitles.map((seg, i) => (
                <div
                  key={seg.id}
                  className={`subtitle-list-item ${i === currentSegmentIndex ? 'current' : ''}`}
                  onClick={() => seekTo(seg.start)}
                >
                  <div className="time">
                    {formatTime(seg.start)} - {formatTime(seg.end)}
                    {!seg.processed && seg.japanese && <span className="unprocessed"> (未处理)</span>}
                  </div>
                  {seg.japanese && (
                    <div className="text-jp">
                      {settings.showFurigana && seg.furigana
                        ? stripFurigana(seg.furigana)
                        : seg.japanese}
                    </div>
                  )}
                  {seg.chinese && <div className="text-cn">{seg.chinese}</div>}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ===== Modals ===== */}
      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
      {showReview && (
        <ReviewBookModal
          items={reviewItems}
          onRemove={handleRemoveReview}
          onClear={handleClearReview}
          onExportAnki={handleExportAnki}
          onClose={() => setShowReview(false)}
        />
      )}

      {/* ===== Processing Overlay ===== */}
      {processing.active && (
        <div className="processing-overlay">
          <div className="processing-box">
            <div className="processing-spinner" />
            <div className="processing-text">{processing.status}</div>
            <div className="processing-subtext">请稍候...</div>
          </div>
        </div>
      )}

      {/* ===== Notification ===== */}
      {notification && (
        <div className={`notification ${notification.error ? 'error' : ''}`}>
          {notification.message}
        </div>
      )}
    </>
  )
}

export default App
