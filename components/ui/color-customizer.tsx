'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Check, Paintbrush, RotateCcw } from 'lucide-react'
import { useTheme } from '@/lib/themes/theme-context'
import { THEMES, type CustomColorOverrides } from '@/lib/themes/themes'

// ─── Field definitions ────────────────────────────────────────────

const FIELDS: {
  key:         keyof CustomColorOverrides
  label:       string
  description: string
}[] = [
  { key: 'primary',   label: 'Cor Primária',   description: 'Botões, links e destaques'          },
  { key: 'secondary', label: 'Cor Secundária',  description: 'Indicadores e badges positivos'     },
  { key: 'accent',    label: 'Cor de Destaque', description: 'Alertas e chamadas de atenção'      },
  { key: 'bg',        label: 'Fundo',           description: 'Cor de fundo da interface'          },
  { key: 'card',      label: 'Cards',           description: 'Superfície dos componentes'         },
]

// ─── Component ────────────────────────────────────────────────────

export default function ColorCustomizer() {
  const { themeKey, customOverrides, setCustomOverride, clearCustomOverrides } = useTheme()
  const baseTheme = THEMES[themeKey]
  const [applied, setApplied] = useState(false)

  function getCurrentColor(field: keyof CustomColorOverrides): string {
    return (
      customOverrides[field] ??
      (baseTheme.colors[field as keyof typeof baseTheme.colors] as string)
    )
  }

  const hasOverrides = Object.keys(customOverrides).length > 0

  function handleApply() {
    setApplied(true)
    setTimeout(() => setApplied(false), 2000)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600/15 border border-violet-600/25">
            <Paintbrush className="h-4 w-4 text-violet-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">Personalização avançada</h3>
            <p className="text-xs text-zinc-500">Ajuste as cores da interface em tempo real</p>
          </div>
        </div>

        <AnimatePresence>
          {hasOverrides && (
            <motion.button
              key="reset"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{   opacity: 0, scale: 0.9 }}
              onClick={clearCustomOverrides}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors"
            >
              <RotateCcw size={11} />
              Restaurar padrão
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Color pickers grid */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {FIELDS.map(({ key, label, description }) => {
          const current = getCurrentColor(key)
          const isOverridden = !!customOverrides[key]

          return (
            <div
              key={key}
              className="group relative flex flex-col gap-2 rounded-xl border bg-zinc-900/60 p-3 transition-colors"
              style={{ borderColor: isOverridden ? 'rgba(139,92,246,0.4)' : 'rgb(39,39,42)' }}
            >
              {isOverridden && (
                <span className="absolute right-2 top-2 rounded-full bg-violet-600/20 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-violet-400">
                  custom
                </span>
              )}

              {/* Colour swatch — click to open native picker */}
              <label className="cursor-pointer">
                <div className="relative h-14 w-full overflow-hidden rounded-lg border border-white/10 shadow-inner transition-transform duration-150 group-hover:scale-[1.02]">
                  <div className="absolute inset-0" style={{ background: current }} />
                  <div className="absolute inset-0 flex items-end justify-end p-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="rounded-full bg-black/50 px-1.5 py-0.5 text-[8px] text-white backdrop-blur-sm">
                      editar
                    </span>
                  </div>
                </div>
                <input
                  type="color"
                  value={current.startsWith('#') ? current : '#6C5CE7'}
                  onChange={(e) => setCustomOverride(key, e.target.value)}
                  className="sr-only"
                />
              </label>

              {/* Label + hex */}
              <div>
                <p className="text-[11px] font-semibold text-white">{label}</p>
                <p className="text-[9px] text-zinc-500">{description}</p>
                <p className="mt-1 font-mono text-[9px] uppercase text-zinc-600">{current}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer actions */}
      <div className="flex items-center gap-3">
        <motion.button
          onClick={handleApply}
          whileHover={{ scale: 1.02 }}
          whileTap={{  scale: 0.97 }}
          className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-colors"
          style={{
            background: applied ? 'rgb(22,163,74)' : 'rgb(124,58,237)',
          }}
        >
          <AnimatePresence mode="wait">
            {applied ? (
              <motion.span
                key="done"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{   opacity: 0, y: -4 }}
                className="flex items-center gap-1.5"
              >
                <Check size={14} />
                Tema criado!
              </motion.span>
            ) : (
              <motion.span
                key="idle"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{   opacity: 0, y: -4 }}
              >
                Criar tema
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>

        <p className="text-xs text-zinc-600">As alterações são aplicadas em tempo real na interface</p>
      </div>
    </div>
  )
}
