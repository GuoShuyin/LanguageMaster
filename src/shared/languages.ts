// Native languages a user can pick. `name` is what we pass to Claude as the translation target.
export interface Language {
  code: string // BCP-47
  name: string // English name (used in prompts)
  label: string // name in that language (shown in UI)
}

export const LANGUAGES: Language[] = [
  { code: 'zh-CN', name: 'Simplified Chinese', label: '简体中文' },
  { code: 'zh-TW', name: 'Traditional Chinese', label: '繁體中文' },
  { code: 'en', name: 'English', label: 'English' },
  { code: 'ko', name: 'Korean', label: '한국어' },
  { code: 'es', name: 'Spanish', label: 'Español' },
  { code: 'fr', name: 'French', label: 'Français' },
  { code: 'de', name: 'German', label: 'Deutsch' },
  { code: 'pt', name: 'Portuguese', label: 'Português' },
  { code: 'it', name: 'Italian', label: 'Italiano' },
  { code: 'ru', name: 'Russian', label: 'Русский' },
  { code: 'vi', name: 'Vietnamese', label: 'Tiếng Việt' },
  { code: 'th', name: 'Thai', label: 'ไทย' },
  { code: 'id', name: 'Indonesian', label: 'Bahasa Indonesia' },
  { code: 'ar', name: 'Arabic', label: 'العربية' },
  { code: 'hi', name: 'Hindi', label: 'हिन्दी' }
]

export const DEFAULT_LANGUAGE = 'zh-CN'

export function languageName(code: string | undefined): string {
  return (LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0]).name
}
