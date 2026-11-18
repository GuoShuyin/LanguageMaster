// Canonical identity for a video link. `key` is the cache key used everywhere
// (subtitle cache, community posts): "youtube:<id>", "bilibili:<BV>[:p<n>]", "file:<hash>", "generic:<hash>".

export type Platform = 'youtube' | 'bilibili' | 'file' | 'generic'

export interface VideoRef {
  platform: Platform
  id: string
  key: string
  url: string // normalized URL
}

const FILE_EXT = /\.(mp4|webm|m4v|mov)$/i
const TRACKING = /^(utm_|si$|feature$|spm_id_from$|vd_source$|share_)/

function hash(s: string): string {
  let h = 0xcbf29ce484222325n
  for (const c of new TextEncoder().encode(s)) {
    h ^= BigInt(c)
    h = (h * 0x100000001b3n) & 0xffffffffffffffffn
  }
  return h.toString(16).padStart(16, '0')
}

export function parseVideoUrl(input: string): VideoRef | null {
  let u: URL
  try {
    u = new URL(input.trim())
  } catch {
    return null
  }
  if (!/^https?:$/.test(u.protocol)) return null
  const host = u.hostname.replace(/^(www\.|m\.)/, '')

  let yt: string | null = null
  if (host === 'youtu.be') yt = u.pathname.slice(1)
  else if (host.endsWith('youtube.com') || host === 'youtube-nocookie.com')
    yt = u.searchParams.get('v') ?? u.pathname.match(/^\/(?:shorts|embed|live)\/([^/?]+)/)?.[1] ?? null
  if (yt && /^[\w-]{11}$/.test(yt))
    return { platform: 'youtube', id: yt, key: `youtube:${yt}`, url: `https://www.youtube.com/watch?v=${yt}` }

  const bv = host.endsWith('bilibili.com') ? u.pathname.match(/\/video\/(BV[0-9A-Za-z]{10})/)?.[1] : undefined
  if (bv) {
    const p = Number(u.searchParams.get('p') || 1)
    const suffix = p > 1 ? `:p${p}` : ''
    return {
      platform: 'bilibili',
      id: bv,
      key: `bilibili:${bv}${suffix}`,
      url: `https://www.bilibili.com/video/${bv}${p > 1 ? `?p=${p}` : ''}`
    }
  }

  u.hash = ''
  for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k)
  const url = u.toString()
  const platform: Platform = FILE_EXT.test(u.pathname) ? 'file' : 'generic'
  const id = hash(url)
  return { platform, id, key: `${platform}:${id}`, url }
}
