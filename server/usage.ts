// Usage metering contract shared by all processing features.
// The billing module replaces the stub bodies; callers must not change.

export type UsageKind =
  | 'subtitles_existing' // video already has subtitles (user SRT or platform captions): Claude only
  | 'subtitles_asr' // no subtitles: ASR (Whisper) + Claude
  | 'agent_capture' // server-side browser agent plays the embed and captures audio, then ASR + Claude

export interface UsageRequest {
  kind: UsageKind
  durationSec: number
  videoKey?: string // e.g. "youtube:dQw4w9WgXcQ" or "upload:<hash>"
}

export class UsageLimitError extends Error {
  status = 402
}

export function estimateCredits(_req: UsageRequest): number {
  return 0
}

// Throws UsageLimitError if the user's weekly allowance would be exceeded.
// Call BEFORE doing expensive work; do not call for cache hits.
export async function consumeCredits(_userId: string, _req: UsageRequest): Promise<void> {}

// Give credits back when processing failed after consumeCredits succeeded.
export async function refundCredits(_userId: string, _req: UsageRequest): Promise<void> {}
