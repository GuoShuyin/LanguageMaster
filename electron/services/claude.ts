import type { ProcessResult } from '../../shared/types'

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
  const linesText = chunk.map((item) => `${item.id}: ${item.japanese}`).join('\n')

  const tasks: string[] = []
  if (furigana) {
    tasks.push(
      '"furigana": the Japanese text with kanji readings annotated using the format 漢字[かんじ]. ' +
        'Only add readings for kanji (and kanji compounds). Leave kana and punctuation as-is. ' +
        'Example: 私[わたし]は日本語[にほんご]を勉強[べんきょう]します。'
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
