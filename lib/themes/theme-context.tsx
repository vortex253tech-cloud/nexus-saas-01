'use client'

import {
  createContext, useContext, useEffect, useState, useCallback, useRef,
  type ReactNode,
} from 'react'
import {
  THEMES, DEFAULT_THEME, THEME_STORAGE_KEY,
  type ThemeKey, type NexusTheme, type CustomColorOverrides,
} from './themes'

// ─── Context shape ────────────────────────────────────────────────

interface ThemeCtx {
  /** The saved (committed) theme key */
  themeKey:       ThemeKey
  theme:          NexusTheme
  /** Key being previewed while hovering a card (null = no preview) */
  previewKey:     ThemeKey | null
  /** Commit a theme: persist to localStorage + sync to DB */
  setTheme:       (key: ThemeKey) => void
  /** Apply CSS vars temporarily without saving */
  previewTheme:   (key: ThemeKey) => void
  /** Restore the committed theme after a preview */
  clearPreview:   () => void
  /** White-label / custom override support */
  customOverrides:   CustomColorOverrides
  setCustomOverride: (k: keyof CustomColorOverrides, v: string) => void
}

const ThemeContext = createContext<ThemeCtx>({
  themeKey:          DEFAULT_THEME,
  theme:             THEMES[DEFAULT_THEME],
  previewKey:        null,
  setTheme:          () => {},
  previewTheme:      () => {},
  clearPreview:      () => {},
  customOverrides:   {},
  setCustomOverride: () => {},
})

// ─── Low-level CSS applier (client-only) ─────────────────────────

function applyCSSVars(key: ThemeKey, overrides: CustomColorOverrides = {}) {
  const theme = THEMES[key]
  const root  = document.documentElement

  // Apply base theme colors
  const merged = { ...theme.colors, ...overrides }
  Object.entries(merged).forEach(([k, v]) => {
    root.style.setProperty(`--nexus-${k}`, v as string)
  })

  // Effect flags consumed by globals.css selectors
  document.body.dataset.glow = String(theme.effects.glow)
  document.body.dataset.blur = String(theme.effects.blur)
  document.body.dataset.neon = String(theme.effects.neon)

  root.setAttribute('data-theme', key)
  root.style.colorScheme = key === 'glassLight' ? 'light' : 'dark'
}

// ─── Background DB sync (fire-and-forget) ────────────────────────

async function syncThemeToDatabase(key: ThemeKey) {
  try {
    await fetch('/api/user/preferences', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ themeKey: key }),
    })
  } catch { /* silent — DB not required for core function */ }
}

// ─── Provider ─────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeKey, setThemeKey]         = useState<ThemeKey>(DEFAULT_THEME)
  const [previewKey, setPreviewKey]     = useState<ThemeKey | null>(null)
  const [customOverrides, setOverrides] = useState<CustomColorOverrides>({})
  const committedKey = useRef<ThemeKey>(DEFAULT_THEME)

  // On mount: read saved theme (localStorage primary, then flash-script already set CSS vars)
  useEffect(() => {
    const raw = localStorage.getItem(THEME_STORAGE_KEY) ?? DEFAULT_THEME
    const key = (raw in THEMES ? raw : DEFAULT_THEME) as ThemeKey
    committedKey.current = key
    setThemeKey(key)
    applyCSSVars(key, {})
  }, [])

  // ── Commit a theme (save + sync) ─────────────────────────────────
  const setTheme = useCallback((key: ThemeKey) => {
    committedKey.current = key
    setThemeKey(key)
    setPreviewKey(null)
    applyCSSVars(key, customOverrides)
    localStorage.setItem(THEME_STORAGE_KEY, key)
    // Non-blocking — if user isn't logged in this silently 401s
    syncThemeToDatabase(key)
  }, [customOverrides])

  // ── Hover preview (temporary, no save) ───────────────────────────
  const previewTheme = useCallback((key: ThemeKey) => {
    if (key === committedKey.current) return
    setPreviewKey(key)
    applyCSSVars(key, {})  // don't merge custom overrides in preview
  }, [])

  // ── Restore committed theme ───────────────────────────────────────
  const clearPreview = useCallback(() => {
    setPreviewKey(null)
    applyCSSVars(committedKey.current, customOverrides)
  }, [customOverrides])

  // ── Custom colour override (white-label) ─────────────────────────
  const setCustomOverride = useCallback((k: keyof CustomColorOverrides, v: string) => {
    setOverrides(prev => {
      const next = { ...prev, [k]: v }
      applyCSSVars(committedKey.current, next)
      return next
    })
  }, [])

  return (
    <ThemeContext.Provider value={{
      themeKey,
      theme: THEMES[themeKey],
      previewKey,
      setTheme,
      previewTheme,
      clearPreview,
      customOverrides,
      setCustomOverride,
    }}>
      {children}
    </ThemeContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────

export function useTheme(): ThemeCtx {
  return useContext(ThemeContext)
}
