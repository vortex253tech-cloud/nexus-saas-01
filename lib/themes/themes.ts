export interface NexusTheme {
  name:        ThemeKey
  label:       string
  description: string
  colors: {
    bg:          string
    card:        string
    cardHover:   string
    primary:     string
    primaryFg:   string
    secondary:   string
    accent:      string
    text:        string
    textMuted:   string
    border:      string
    borderStrong:string
    sidebar:     string
  }
  effects: {
    glow: boolean
    blur: boolean
    neon: boolean
  }
}

export type ThemeKey = 'aiCore' | 'glassLight' | 'cyberpunk'

export const THEMES: Record<ThemeKey, NexusTheme> = {
  aiCore: {
    name:        'aiCore',
    label:       'AI Core',
    description: 'Escuro e sofisticado — o padrão NEXUS',
    colors: {
      bg:           '#05070D',
      card:         '#0B0F1A',
      cardHover:    '#0F1525',
      primary:      '#6C5CE7',
      primaryFg:    '#FFFFFF',
      secondary:    '#00F5D4',
      accent:       '#FF2E63',
      text:         '#EAEAF0',
      textMuted:    '#6B7280',
      border:       'rgba(255,255,255,0.07)',
      borderStrong: 'rgba(255,255,255,0.14)',
      sidebar:      '#080B14',
    },
    effects: { glow: true, blur: false, neon: false },
  },

  glassLight: {
    name:        'glassLight',
    label:       'Glass Light',
    description: 'Limpo e moderno — ideal para o dia a dia',
    colors: {
      bg:           '#EEF2FF',
      card:         'rgba(255,255,255,0.85)',
      cardHover:    'rgba(255,255,255,0.98)',
      primary:      '#3A86FF',
      primaryFg:    '#FFFFFF',
      secondary:    '#8338EC',
      accent:       '#FF006E',
      text:         '#0B0F1A',
      textMuted:    '#5A6275',
      border:       'rgba(0,0,0,0.08)',
      borderStrong: 'rgba(0,0,0,0.16)',
      sidebar:      'rgba(255,255,255,0.95)',
    },
    effects: { glow: false, blur: true, neon: false },
  },

  cyberpunk: {
    name:        'cyberpunk',
    label:       'Cyberpunk',
    description: 'Neon e intenso — para quem quer se destacar',
    colors: {
      bg:           '#0A0A0A',
      card:         '#111111',
      cardHover:    '#161616',
      primary:      '#00D9FF',
      primaryFg:    '#000000',
      secondary:    '#FF006E',
      accent:       '#FFD60A',
      text:         '#FFFFFF',
      textMuted:    '#888899',
      border:       'rgba(0,217,255,0.15)',
      borderStrong: 'rgba(0,217,255,0.30)',
      sidebar:      '#060606',
    },
    effects: { glow: true, blur: false, neon: true },
  },
}

export const THEME_KEYS        = Object.keys(THEMES) as ThemeKey[]
export const DEFAULT_THEME     = 'aiCore' satisfies ThemeKey
export const THEME_STORAGE_KEY = 'nexus-theme'

// ─── Serialised for the inline flash-prevention script ────────────
// Keeps the script in sync with theme definitions automatically.
export const THEMES_INLINE_SCRIPT = `(function(){try{var T=${JSON.stringify(
  Object.fromEntries(
    THEME_KEYS.map(k => [k, THEMES[k].colors]),
  ),
)};var key=localStorage.getItem('nexus-theme')||'aiCore';var t=T[key]||T.aiCore;var r=document.documentElement;Object.keys(t).forEach(function(c){r.style.setProperty('--nexus-'+c,t[c]);});r.setAttribute('data-theme',key);}catch(e){}})();`
