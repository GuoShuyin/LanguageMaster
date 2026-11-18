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
export function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  headers.set('X-User-Id', getUserId())
  return fetch(input, { ...init, headers })
}
