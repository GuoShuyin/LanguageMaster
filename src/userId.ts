const KEY = 'lm_user_id'

// Anonymous pre-launch identity, sent as X-User-Id on every API call.
export function getUserId(): string {
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(KEY, id)
  }
  return id
}

// Use instead of window.fetch for all /api calls.
// A 402 response (weekly usage limit) also fires a global `lm:usage-limit` event for the upgrade prompt.
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.set('X-User-Id', getUserId())
  const res = await fetch(input, { ...init, headers })
  if (res.status === 402) {
    const detail = await res.clone().json().catch(() => ({}))
    window.dispatchEvent(new CustomEvent('lm:usage-limit', { detail }))
  }
  return res
}
