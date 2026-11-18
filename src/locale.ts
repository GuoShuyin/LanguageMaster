import { DEFAULT_LANGUAGE } from './shared/languages'

const KEY = 'lm_native_language'

// The user's native language (translation target). null = not chosen yet (first run).
export function getNativeLanguage(): string | null {
  return localStorage.getItem(KEY)
}

export function getTargetLanguage(): string {
  return getNativeLanguage() ?? DEFAULT_LANGUAGE
}

export function setNativeLanguage(code: string): void {
  localStorage.setItem(KEY, code)
  window.dispatchEvent(new CustomEvent('lm:native-language', { detail: code }))
}
