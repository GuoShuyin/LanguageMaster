import type { ProcessResult } from '../../shared/types'
import { stripFurigana } from '../../src/shared/furigana'

interface ClaudeConfig {
  apiKey: string
  model: string
}

interface BatchItem {
  id: number
  japanese: string
}

/**
 * Call Claude API to generate furigana and/or Chinese translation for subtitle lines.
 * Uses the 漢字[かんじ] notation for furigana.
 */
export async function processSubtitlesWithClaude(
  items: BatchItem[],
  config: ClaudeConfig,
  options: { translate: boolean; furigana: boolean }
): Promise<ProcessResult[]> {
  const { translate, furigana } = options
  const results: ProcessResult[] = []

  // Process in chunks to avoid too-large requests
  const CHUNK_SIZE = 15
  const chunks: BatchItem[][] = []
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    chunks.push(items.slice(i, i + CHUNK_SIZE))
  }

  // Process chunks in parallel (with limited concurrency)
  const MAX_CONCURRENT = 3
  for (let i = 0; i < chunks.length; i += MAX_CONCURRENT) {
    const batch = chunks.slice(i, i + MAX_CONCURRENT)
    const batchResults = await Promise.all(batch.map((chunk) => processChunk(chunk, config, translate, furigana)))
    for (const chunkResult of batchResults) {
      results.push(...chunkResult)
    }
  }

  return results
}

async function processChunk(
  chunk: BatchItem[],
  config: ClaudeConfig,
  translate: boolean,
  furigana: boolean
): Promise<ProcessResult[]> {
  const results = await requestChunk(chunk, config, translate, furigana)
  if (!furigana) return results

  const norm = (t: string) => t.replace(/\s+/g, '')
  const isValid = (r: ProcessResult, i: number) =>
    !r.furigana || norm(stripFurigana(r.furigana)) === norm(chunk[i].japanese)
  const badIdx = results.map((r, i) => (isValid(r, i) ? -1 : i)).filter((i) => i >= 0)
  if (badIdx.length === 0) return results

  const retried = await requestChunk(badIdx.map((i) => chunk[i]), config, false, true).catch(() => [])
  retried.forEach((r, j) => {
    const i = badIdx[j]
    if (r.furigana && isValid(r, i)) results[i] = { ...results[i], furigana: r.furigana }
  })
  return results
}

async function requestChunk(
  chunk: BatchItem[],
  config: ClaudeConfig,
  translate: boolean,
  furigana: boolean
): Promise<ProcessResult[]> {
  const linesText = chunk.map((item) => `${item.id}: ${item.japanese}`).join('\n')

  const tasks: string[] = []
  if (furigana) {
    tasks.push(
      '"furigana": the original line with kanji readings annotated using the format 漢字[かんじ]. Rules: ' +
        '(1) annotate each kanji word separately, with the reading in brackets immediately after its kanji; ' +
        '(2) the part before "[" must be kanji only — okurigana and other kana stay outside the brackets, e.g. 楽[たの]しく not 楽し[たのし]く, 合[あ]った not 合った[あった]; ' +
        '(3) the reading must be hiragana; ' +
        '(4) do NOT alter, add, or remove any character of the original line (keep punctuation, spaces and symbols exactly) — removing the [readings] must give back the original line exactly. ' +
        'Example: 気[き]の合[あ]った友達[ともだち]とでなくちゃ楽[たの]しくやれないよ'
    )
  }
  if (translate) {
    tasks.push('"chinese": a natural Chinese (Simplified) translation of the Japanese line')
  }

  const systemPrompt =
    'You are a Japanese language assistant. You help language learners by annotating Japanese text with furigana readings and providing Chinese translations. You return only valid JSON.'

  const userPrompt = `For each Japanese subtitle line below, provide ${tasks.join(' and ')}.

Return a JSON array of objects, one per line, with the "id" field matching the input. Do not include any text outside the JSON array.

Lines:
${linesText}`

  const body = {
    model: config.model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }]
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': config.apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify(body)
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Claude API error (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  const text = data.content?.[0]?.text ?? ''

  // Extract JSON array from response
  const jsonMatch = text.match(/\[[\s\S]*\]/)
  if (!jsonMatch) {
    throw new Error(`Claude did not return valid JSON: ${text}`)
  }

  const parsed = JSON.parse(jsonMatch[0]) as ProcessResult[]

  // Map back to ensure all IDs are covered
  const resultMap = new Map<number, ProcessResult>()
  for (const item of parsed) {
    resultMap.set(item.id, item)
  }

  return chunk.map((item) => resultMap.get(item.id) ?? { id: item.id })
}
