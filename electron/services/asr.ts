import { readFile } from 'fs/promises'

interface WhisperConfig {
  apiKey: string
}

/**
 * Extract audio from a video file using ffmpeg and transcribe with OpenAI Whisper API.
 * Returns subtitle segments with timestamps.
 */
export async function transcribeWithWhisper(
  videoPath: string,
  config: WhisperConfig,
  onProgress?: (status: string) => void
): Promise<{ id: number; start: number; end: number; japanese: string }[]> {
  onProgress?.('Extracting audio...')
  const audioPath = await extractAudio(videoPath)

  try {
    onProgress?.('Transcribing with Whisper...')
    const segments = await callWhisperAPI(audioPath, config)
    onProgress?.(`Transcribed ${segments.length} segments`)
    return segments
  } finally {
    // Clean up temp audio file
    const { unlink } = await import('fs/promises')
    try {
      await unlink(audioPath)
    } catch {
      // ignore
    }
  }
}

async function extractAudio(videoPath: string): Promise<string> {
  const { tmpdir } = await import('os')
  const { join } = await import('path')
  const audioPath = join(tmpdir(), `languagemaster_${Date.now()}.m4a`)

  const { execFile } = await import('child_process')
  const { promisify } = await import('util')
  const execFileAsync = promisify(execFile)

  // Extract audio as m4a (Whisper supports m4a)
  await execFileAsync('ffmpeg', [
    '-i', videoPath,
    '-vn',
    '-acodec', 'aac',
    '-ar', '16000',
    '-ac', '1',
    '-y',
    audioPath
  ], { timeout: 300000 })

  return audioPath
}

async function callWhisperAPI(
  audioPath: string,
  config: WhisperConfig
): Promise<{ id: number; start: number; end: number; japanese: string }[]> {
  const audioBuffer = await readFile(audioPath)
  const formData = new FormData()
  formData.append('file', new Blob([audioBuffer]), 'audio.m4a')
  formData.append('model', 'whisper-1')
  formData.append('language', 'ja')
  formData.append('response_format', 'verbose_json')
  formData.append('timestamp_granularities[]', 'segment')

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`
    },
    body: formData
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Whisper API error (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  const rawSegments = data.segments ?? []

  return rawSegments.map((seg: { start: number; end: number; text: string }, i: number) => ({
    id: i,
    start: seg.start,
    end: seg.end,
    japanese: seg.text.trim()
  }))
}
