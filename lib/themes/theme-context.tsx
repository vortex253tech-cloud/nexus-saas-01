'use client'

import {
  createContext, useContext, useEffect, useState, useCallback,
  type ReactNode,
} from 'react'
import {
  THEMES, DEFAULT_THEME, THEME_STORAGE_KEY,
  type ThemeKey, type NexusTheme,
} from './themes'

// ─── Context ──────────────────────────────────────────────────────

interface ThemeCtx {
  themeKey: ThemeKey
  theme:    NexusTheme
  setTheme: (key: ThemeKey) => void
}

const ThemeContext = createContext<ThemeCtx>({
  themeKey: DEFAULT_THEME,
  theme:    THEMES[DEFAULT_THEME],
  setTheme: () => {},
})

// ─── Apply helper (client-only) ───────────────────────────────────

function applyTheme(key: ThemeKey) {
  const theme = THEMES[key]
  const root  = document.documentElement

  // CSS vars used throughout the app
  Object.entries(theme.colors).forEach(([k, v]) => {
    root.style.setProperty(`--nexus-${k}`, v)
  })

  // Effect flags for CSS selectors
  document.body.dataset.glow = String(theme.effects.glow)
  document.body.dataset.blur = String(theme.effects.blur)
  document.body.dataset.neon = String(theme.effects.neon)

  // data-theme attribute for CSS overrides
  root.setAttribute('data-theme', key)

  // Adjust color-scheme so native UI elements follow (scrollbar, inputs, etc.)
  root.style.colorScheme = key === 'glassLight' ? 'light' : 'dark'
}

// ─── Provider ─────────────────────────────────────────────────────

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeKey, setThemeKey] = useState<ThemeKey>(DEFAULT_THEME)

  // On mount: read saved theme and apply (matches the inline flash-prevention script)
  useEffect(() => {
    const raw   = localStorage.getItem(THEME_STORAGE_KEY) ?? DEFAULT_THEME
    const key   = (raw in THEMES ? raw : DEFAULT_THEME) as ThemeKey
    setThemeKey(key)
    applyTheme(key)
  }, [])

  const setTheme = useCallback((key: ThemeKey) => {
    setThemeKey(key)
    applyTheme(key)
    localStorage.setItem(THEME_STORAGE_KEY, key)
  }, [])

  return (
    <ThemeContext.Provider value={{ themeKey, theme: THEMES[themeKey], setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

// ─── Hook ─────────────────────────────────────────────────────────

export function useTheme(): ThemeCtx {
  return useContext(ThemeContext)
}
