'use client'

// app/dashboard/nexus-os/page.tsx
// NEXUS OS — Sistema Operacional de Inteligência Artificial
// Arquitetura: NexusVoiceEngine + NexusActionEngine
// Fluxo: microfone → WebSocket → transcrição → tool call → ação → resposta de voz

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence }                   from 'framer-motion'
import {
  Mic, MicOff, Zap, MessageSquare, CheckSquare, FolderOpen,
  Users, Phone, Cog, FileText, Calendar, DollarSign, BarChart2,
} from 'lucide-react'

import { NexusVoiceEngine, NexusOSState } from '@/lib/nexus/voice-engine'
import { NexusActionEngine, ActionResult } from '@/lib/nexus/action-engine'
import { useRouter }                       from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

interface TranscriptLine {
  id:     number
  role:   'user' | 'assistant'
  text:   string
  final:  boolean
}

interface ActionLog {
  id:      number
  name:    string
  message: string
  success: boolean
  ts:      Date
}

// ── Quick commands ─────────────────────────────────────────────────────────────

const COMMANDS = [
  { icon: MessageSquare, label: 'Mensagem',    text: 'Enviar mensagem no WhatsApp' },
  { icon: CheckSquare,   label: 'Tarefa',      text: 'Criar uma nova tarefa' },
  { icon: FolderOpen,    label: 'Projeto',     text: 'Criar um novo projeto' },
  { icon: Users,         label: 'Lead',        text: 'Abrir lead no CRM' },
  { icon: Phone,         label: 'WhatsApp',    text: 'Abrir central WhatsApp' },
  { icon: Cog,           label: 'Automação',   text: 'Criar automação inteligente' },
  { icon: FileText,      label: 'Proposta',    text: 'Gerar proposta comercial' },
  { icon: Calendar,      label: 'Reunião',     text: 'Marcar uma reunião' },
  { icon: DollarSign,    label: 'Financeiro',  text: 'Consultar dados financeiros' },
  { icon: BarChart2,     label: 'Modo CEO',    text: 'Ativar monitoramento CEO' },
]

// ── State label helpers ────────────────────────────────────────────────────────

const STATE_LABEL: Record<NexusOSState, string> = {
  connecting:   'Conectando...',
  ready:        'Pronto',
  listening:    'Ouvindo',
  processing:   'Processando',
  speaking:     'Respondendo',
  executing:    'Executando',
  error:        'Erro',
  disconnected: 'Desconectado',
}

const STATE_COLOR: Record<NexusOSState, string> = {
  connecting:   'text-yellow-400',
  ready:        'text-emerald-400',
  listening:    'text-blue-400',
  processing:   'text-purple-400',
  speaking:     'text-cyan-400',
  executing:    'text-orange-400',
  error:        'text-red-400',
  disconnected: 'text-slate-500',
}

// ── Orb component ─────────────────────────────────────────────────────────────

function Orb({ state, levels }: { state: NexusOSState; levels: number[] }) {
  const active   = state !== 'disconnected' && state !== 'error'
  const pulsing  = state === 'listening' || state === 'processing'
  const speaking = state === 'speaking'

  return (
    <div className="relative flex items-center justify-center w-40 h-40 mx-auto">
      {/* Outer glow rings */}
      {active && (
        <>
          <motion.div
            className="absolute inset-0 rounded-full border border-cyan-500/20"
            animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.1, 0.3] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute inset-[-12px] rounded-full border border-cyan-500/10"
            animate={{ scale: [1, 1.08, 1], opacity: [0.2, 0.05, 0.2] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 0.5 }}
          />
        </>
      )}

      {/* Waveform bars (speaking / listening) */}
      {(pulsing || speaking) && (
        <div className="absolute inset-[-24px] flex items-center justify-center gap-[2px]">
          {levels.slice(0, 20).map((lvl, i) => (
            <motion.div
              key={i}
              className="w-[3px] rounded-full bg-cyan-400/60"
              style={{ height: `${Math.max(4, lvl * 48)}px` }}
              animate={{ scaleY: [1, 1 + lvl, 1] }}
              transition={{ duration: 0.15, repeat: Infinity, delay: i * 0.02 }}
            />
          ))}
        </div>
      )}

      {/* Core orb */}
      <motion.div
        className="relative w-24 h-24 rounded-full flex items-center justify-center"
        style={{
          background: active
            ? 'radial-gradient(circle at 35% 35%, #06b6d4 0%, #0891b2 40%, #164e63 100%)'
            : 'radial-gradient(circle at 35% 35%, #334155 0%, #1e293b 100%)',
          boxShadow: active
            ? '0 0 40px rgba(6,182,212,0.4), 0 0 80px rgba(6,182,212,0.2), inset 0 1px 0 rgba(255,255,255,0.15)'
            : 'inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
        animate={pulsing ? { scale: [1, 1.04, 1] } : {}}
        transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Zap
          className={`w-8 h-8 transition-colors duration-300 ${active ? 'text-white' : 'text-slate-600'}`}
          fill={active ? 'currentColor' : 'none'}
        />
      </motion.div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function NexusOSPage() {
  const router = useRouter()

  const engineRef = useRef<NexusVoiceEngine | null>(null)
  const actionRef = useRef<NexusActionEngine>(new NexusActionEngine())

  const [osState,    setOsState]    = useState<NexusOSState>('disconnected')
  const [levels,     setLevels]     = useState<number[]>(new Array(24).fill(0))
  const [transcript, setTranscript] = useState<TranscriptLine[]>([])
  const [actionLog,  setActionLog]  = useState<ActionLog[]>([])
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null)
  const idRef = useRef(0)

  // ── Callbacks ──────────────────────────────────────────────────────────────

  const onState = useCallback((s: NexusOSState) => {
    setOsState(s)
    if (s !== 'error') setErrorMsg(null)
  }, [])

  const onTranscript = useCallback((role: 'user' | 'assistant', text: string, final: boolean) => {
    setTranscript(prev => {
      // Update last partial or append new line
      if (!final) {
        const last = prev[prev.length - 1]
        if (last && last.role === role && !last.final) {
          return [...prev.slice(0, -1), { ...last, text }]
        }
      }
      idRef.current += 1
      const next: TranscriptLine = { id: idRef.current, role, text, final }
      const capped = prev.length >= 50 ? prev.slice(-49) : prev
      return [...capped, next]
    })
  }, [])

  const onToolCall = useCallback(async (name: string, args: Record<string, unknown>): Promise<unknown> => {
    const result: ActionResult = await actionRef.current.execute(name, args)
    idRef.current += 1
    setActionLog(prev => {
      const capped = prev.length >= 20 ? prev.slice(-19) : prev
      return [...capped, { id: idRef.current, name, message: result.message, success: result.success, ts: new Date() }]
    })
    if (result.path) router.push(result.path)
    return result
  }, [router])

  const onAudioLevels = useCallback((lvls: number[]) => setLevels(lvls), [])

  const onError = useCallback((msg: string) => {
    setErrorMsg(msg)
    setOsState('error')
  }, [])

  // ── Engine lifecycle ───────────────────────────────────────────────────────

  const startNexus = useCallback(async () => {
    if (engineRef.current) return
    setErrorMsg(null)
    const engine = new NexusVoiceEngine({ onState, onTranscript, onToolCall, onAudioLevels, onError })
    engineRef.current = engine
    await engine.connect()
  }, [onState, onTranscript, onToolCall, onAudioLevels, onError])

  const stopNexus = useCallback(() => {
    engineRef.current?.disconnect()
    engineRef.current = null
    setLevels(new Array(24).fill(0))
  }, [])

  useEffect(() => () => { engineRef.current?.disconnect() }, [])

  const isOn = osState !== 'disconnected'

  // ── Quick command handler ──────────────────────────────────────────────────

  const sendCommand = useCallback((text: string) => {
    engineRef.current?.sendText(text)
  }, [])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#080c14] text-white flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-slate-800/60">
        <div className="flex items-center gap-3">
          <Zap className="w-6 h-6 text-cyan-400" fill="currentColor" />
          <span className="text-lg font-semibold tracking-wide text-white/90">NEXUS OS</span>
          <span className="text-xs text-slate-500 font-mono ml-1">v4.0</span>
        </div>
        <div className={`text-sm font-medium ${STATE_COLOR[osState]}`}>
          {STATE_LABEL[osState]}
        </div>
      </div>

      {/* Main layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left panel — Orb + controls + error */}
        <div className="w-80 flex-shrink-0 flex flex-col items-center justify-start pt-12 px-6 border-r border-slate-800/40 gap-8">

          <Orb state={osState} levels={levels} />

          {/* Power button */}
          <motion.button
            onClick={isOn ? stopNexus : startNexus}
            className={`w-full py-3 rounded-xl text-sm font-semibold tracking-wider transition-all duration-300 ${
              isOn
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'
                : 'bg-cyan-500 hover:bg-cyan-400 text-black border border-transparent shadow-[0_0_20px_rgba(6,182,212,0.4)]'
            }`}
            whileTap={{ scale: 0.97 }}
          >
            {isOn ? (
              <span className="flex items-center justify-center gap-2">
                <MicOff className="w-4 h-4" />
                Desativar NEXUS
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Mic className="w-4 h-4" />
                Ativar NEXUS
              </span>
            )}
          </motion.button>

          {/* Error */}
          <AnimatePresence>
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="w-full bg-red-950/60 border border-red-800/60 rounded-xl p-4 text-xs text-red-300 leading-relaxed"
              >
                <p className="font-semibold text-red-400 mb-1">Erro de conexão</p>
                {errorMsg}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quick commands */}
          <div className="w-full">
            <p className="text-xs text-slate-500 uppercase tracking-widest mb-3 font-medium">Comandos rápidos</p>
            <div className="grid grid-cols-2 gap-2">
              {COMMANDS.map(({ icon: Icon, label, text }) => (
                <motion.button
                  key={label}
                  onClick={() => isOn && sendCommand(text)}
                  disabled={!isOn}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl text-xs font-medium transition-all border ${
                    isOn
                      ? 'bg-slate-900 hover:bg-slate-800 border-slate-700/60 text-slate-300 cursor-pointer'
                      : 'bg-slate-900/40 border-slate-800/40 text-slate-600 cursor-not-allowed'
                  }`}
                  whileTap={isOn ? { scale: 0.95 } : {}}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </motion.button>
              ))}
            </div>
          </div>
        </div>

        {/* Right panel — transcript + action log */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Transcript */}
          <div className="flex-1 overflow-y-auto px-8 py-6 space-y-4 scroll-smooth" id="nexus-transcript">
            <AnimatePresence initial={false}>
              {transcript.length === 0 && (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center justify-center h-full text-center py-24"
                >
                  <Zap className="w-12 h-12 text-slate-700 mb-4" />
                  <p className="text-slate-600 text-sm">
                    {isOn ? 'Diga algo para começar...' : 'Ative o NEXUS e fale um comando'}
                  </p>
                </motion.div>
              )}
              {transcript.map(line => (
                <motion.div
                  key={line.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className={`flex ${line.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      line.role === 'user'
                        ? 'bg-cyan-600/20 border border-cyan-500/30 text-cyan-100'
                        : 'bg-slate-800/80 border border-slate-700/40 text-slate-200'
                    } ${!line.final ? 'opacity-60' : ''}`}
                  >
                    <span className={`block text-[10px] font-semibold uppercase tracking-widest mb-1 ${
                      line.role === 'user' ? 'text-cyan-400/70' : 'text-slate-500'
                    }`}>
                      {line.role === 'user' ? 'Você' : 'NEXUS'}
                    </span>
                    {line.text}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>

          {/* Action log */}
          {actionLog.length > 0 && (
            <div className="border-t border-slate-800/60 px-8 py-4 max-h-40 overflow-y-auto">
              <p className="text-xs text-slate-500 uppercase tracking-widest mb-3 font-medium">Ações executadas</p>
              <div className="space-y-2">
                {actionLog.map(entry => (
                  <div key={entry.id} className="flex items-start gap-3">
                    <span className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${entry.success ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-mono text-slate-400">{entry.name}</span>
                      <span className="text-xs text-slate-500 ml-2">{entry.message}</span>
                    </div>
                    <span className="text-[10px] text-slate-600 flex-shrink-0">
                      {entry.ts.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
