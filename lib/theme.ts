// Theme preference lives in localStorage only. A cookie would let the server
// render the right class, but read-only visitors must receive no cookies
// (NFR-PRIV-02), so the class is applied client-side by THEME_INIT_SCRIPT
// before first paint instead.

export const THEME_STORAGE_KEY = 'pk_theme'

export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const
export type ThemePreference = (typeof THEME_PREFERENCES)[number]
export type ResolvedTheme = 'light' | 'dark'

export const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)'

export function parseThemePreference(raw: unknown): ThemePreference {
  return raw === 'light' || raw === 'dark' ? raw : 'system'
}

export function resolveTheme(
  preference: ThemePreference,
  systemPrefersDark: boolean,
): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light'
  return preference
}

// Serialised into an inline <script> in the root layout, so it must not
// reference anything outside its own body — it runs before any bundle loads.
// Mirrors parseThemePreference + resolveTheme; the unit tests assert parity.
function initTheme(storageKey: string, mediaQuery: string): void {
  const root = document.documentElement
  const media = window.matchMedia(mediaQuery)
  const apply = () => {
    let stored: string | null = null
    try {
      stored = window.localStorage.getItem(storageKey)
    } catch {
      // Storage blocked (private mode, disabled site data) — follow the OS.
    }
    const dark = stored === 'dark' || (stored !== 'light' && media.matches)
    root.classList.toggle('dark', dark)
  }
  apply()
  media.addEventListener('change', apply)
  window.addEventListener('storage', (event) => {
    if (event.key === storageKey) apply()
  })
}

export const THEME_INIT_SCRIPT = `(${initTheme.toString()})(${JSON.stringify(
  THEME_STORAGE_KEY,
)}, ${JSON.stringify(DARK_MEDIA_QUERY)})`

export function readStoredThemePreference(): ThemePreference {
  try {
    return parseThemePreference(window.localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return 'system'
  }
}

/** Returns false when storage is blocked and the choice could not be kept. */
export function storeThemePreference(preference: ThemePreference): boolean {
  try {
    if (preference === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY)
    else window.localStorage.setItem(THEME_STORAGE_KEY, preference)
    return true
  } catch {
    return false
  }
}

export function applyResolvedTheme(theme: ResolvedTheme): void {
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export function systemPrefersDark(): boolean {
  return window.matchMedia(DARK_MEDIA_QUERY).matches
}
