'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic, MicOff, Zap, MessageSquare, Activity, Navigation,
  Users, Send, Search, ToggleLeft, UserCheck, BarChart2,
  Calendar, Loader2, Volume2, AlertCircle, X, ChevronRight,
} from 'lucide-react'

// ── Types ──────────────────────────────────────────────────────────────────

type VoiceState = 'off' | 'connecting' | 'idle' | 'listening' | 'thinking' | 'speaking' | 'error'

interface TranscriptEntry {
  id:   string
  role: 'user' | 'assistant'
  text: string
  ts:   number
}

interface ActionLog {
  id:    string
  tool:  string
  label: string
  ts:    number
  ok:    boolean
}

// ── Orb config per state ───────────────────────────────────────────────────

const ORB: Record<VoiceState, { gradient: string; glow: string; label: string; pulse: boolean }> = {
  off:        { gradient: 'from-slate-700 to-slate-900',    glow: 'rgba(100,100,120,0.3)',  label: 'NEXUS',        pulse: false },
  connecting: { gradient: 'from-violet-600 to-purple-800',  glow: 'rgba(139,92,246,0.4)',   label: 'Conectando…',  pulse: true  },
  idle:       { gradient: 'from-purple-500 to-violet-700',  glow: 'rgba(139,92,246,0.5)',   label: 'Aguardando',   pulse: false },
  listening:  { gradient: 'from-cyan-400 to-blue-600',      glow: 'rgba(34,211,238,0.6)',   label: 'Ouvindo',      pulse: true  },
  thinking:   { gradient: 'from-amber-400 to-orange-600',   glow: 'rgba(251,191,36,0.5)',   label: 'Processando',  pulse: true  },
  speaking:   { gradient: 'from-emerald-400 to-teal-600',   glow: 'rgba(52,211,153,0.6)',   label: 'Respondendo',  pulse: true  },
  error:      { gradient: 'from-red-500 to-rose-700',       glow: 'rgba(239,68,68,0.5)',    label: 'Erro',         pulse: false },
}

const TOOL_LABELS: Record<string, string> = {
  navigate:             'Navegando',
  getWhatsAppStats:     'Stats WhatsApp',
  getHotLeads:          'Buscando leads',
  sendWhatsAppMessage:  'Enviando mensagem',
  searchConversations:  'Pesquisando',
  toggleAI:             'Ajustando IA',
  transferToHuman:      'Transferindo',
  getDashboardSummary:  'Resumo executivo',
  createFollowUp:       'Criando follow-up',
}

const QUICK: { icon: React.ElementType; label: string; prompt: string }[] = [
  { icon: BarChart2,  label: 'Resumo do dia',   prompt: 'NEXUS, qual é o resumo do dia?' },
  { icon: Users,      label: 'Leads quentes',    prompt: 'NEXUS, mostra os leads mais quentes' },
  { icon: Activity,   label: 'Stats WhatsApp',   prompt: 'NEXUS, como está o WhatsApp?' },
  { icon: Navigation, label: 'Abrir WhatsApp',   prompt: 'NEXUS, abre o painel do WhatsApp' },
  { icon: Search,     label: 'Buscar conversa',  prompt: 'NEXUS, busca uma conversa' },
  { icon: Send,       label: 'Enviar mensagem',  prompt: 'NEXUS, quero enviar uma mensagem' },
  { icon: ToggleLeft, label: 'Controlar IA',     prompt: 'NEXUS, ativa a IA em uma conversa' },
  { icon: Calendar,   label: 'Follow-up',        prompt: 'NEXUS, cria um follow-up' },
]

// ── WaveformBars ───────────────────────────────────────────────────────────

function WaveformBars({ active }: { active: boolean }) {
  return (
    <div className="flex items-center justify-center gap-[3px] h-10">
      {Array.from({ length: 28 }).map((_, i) => (
        <motion.div
          key={i}
          className="w-[3px] rounded-full bg-current"
          animate={active ? {
            scaleY: [0.15, 1, 0.15],
            opacity: [0.4, 1, 0.4],
          } : { scaleY: 0.15, opacity: 0.2 }}
          transition={active ? {
            duration: 0.8 + (i % 5) * 0.12,
            repeat: Infinity,
            delay: (i * 0.04) % 0.6,
            ease: 'easeInOut',
          } : { duration: 0.3 }}
          style={{ height: 32 }}
        />
      ))}
    </div>
  )
}

// ── VoiceOrb ───────────────────────────────────────────────────────────────

function VoiceOrb({ state, onClick }: { state: VoiceState; onClick: () => void }) {
  const cfg   = ORB[state]
  const isOff = state === 'off'

  return (
    <div className="relative flex items-center justify-center select-none" style={{ width: 220, height: 220 }}>
      {cfg.pulse && (
        <motion.div
          className="absolute rounded-full border border-white/10"
          style={{ width: 200, height: 200 }}
          animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      <motion.div
        className="absolute rounded-full blur-2xl"
        style={{ width: 160, height: 160, background: cfg.glow }}
        animate={{ opacity: isOff ? 0.2 : 0.7, scale: cfg.pulse ? [1, 1.1, 1] : 1 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.button
        onClick={onClick}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`relative z-10 flex flex-col items-center justify-center gap-2 rounded-full bg-gradient-to-br ${cfg.gradient} shadow-2xl cursor-pointer border border-white/10`}
        style={{ width: 160, height: 160 }}
        animate={{ boxShadow: `0 0 40px 10px ${cfg.glow}` }}
        transition={{ duration: 0.4 }}
      >
        {isOff ? (
          <Mic className="w-12 h-12 text-white/80" />
        ) : state === 'connecting' ? (
          <Loader2 className="w-12 h-12 text-white animate-spin" />
        ) : state === 'error' ? (
          <AlertCircle className="w-12 h-12 text-white" />
        ) : (
          <Volume2 className="w-12 h-12 text-white" />
        )}
        <span className="text-xs font-semibold text-white/80 tracking-widest uppercase">
          {cfg.label}
        </span>
      </motion.button>
    </div>
  )
}

// ── TranscriptBubble ───────────────────────────────────────────────────────

function TranscriptBubble({ entry }: { entry: TranscriptEntry }) {
  const isUser = entry.role === 'user'
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[85%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed ${
          isUser
            ? 'bg-violet-600/70 text-white rounded-br-sm'
            : 'bg-white/8 text-white/90 border border-white/10 rounded-bl-sm'
        }`}
      >
        {entry.text}
      </div>
    </motion.div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────

export default function AssistantPage() {
  const router = useRouter()

  const [voiceState, setVoiceState]    = useState<VoiceState>('off')
  const [transcript, setTranscript]    = useState<TranscriptEntry[]>([])
  const [actionLog, setActionLog]      = useState<ActionLog[]>([])
  const [errorMsg, setErrorMsg]        = useState<string | null>(null)
  const [sessionDuration, setDuration] = useState(0)

  const pcRef          = useRef<RTCPeerConnection | null>(null)
  const dcRef          = useRef<RTCDataChannel | null>(null)
  const audioElRef     = useRef<HTMLAudioElement | null>(null)
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null)
  const transcriptRef  = useRef<HTMLDivElement>(null)

  // Auto-scroll transcript
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [transcript])

  // Session timer
  useEffect(() => {
    if (voiceState !== 'off' && voiceState !== 'error') {
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      if (voiceState === 'off') setDuration(0)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [voiceState])

  const formatDuration = (s: number) => {
    const m   = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  // ── Tool execution ─────────────────────────────────────────────────────

  const executeTool = useCallback(async (toolName: string, params: Record<string, unknown>) => {
    const logId = `act-${Date.now()}`
    setActionLog(prev => [{
      id: logId, tool: toolName,
      label: TOOL_LABELS[toolName] ?? toolName,
      ts: Date.now(), ok: true,
    }, ...prev.slice(0, 19)])

    if (toolName === 'navigate') {
      const path = params.path as string
      if (path) router.push(path)
      return { success: true, summary: `Navegando para ${params.page_name ?? path}` }
    }

    try {
      const res = await fetch('/api/nexus/voice/execute', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tool: toolName, params }),
      })
      return await res.json()
    } catch {
      setActionLog(prev => prev.map(a => a.id === logId ? { ...a, ok: false } : a))
      return { error: 'Falha na execução' }
    }
  }, [router])

  // ── DataChannel message handler ────────────────────────────────────────

  const handleDCMessage = useCallback((ev: MessageEvent) => {
    let msg: Record<string, unknown>
    try { msg = JSON.parse(ev.data as string) } catch { return }

    const type = msg.type as string

    if (type === 'input_audio_buffer.speech_started') {
      setVoiceState('listening')
    }

    if (type === 'input_audio_buffer.speech_stopped') {
      setVoiceState('thinking')
    }

    if (type === 'conversation.item.input_audio_transcription.completed') {
      const text = (msg.transcript as string | undefined)?.trim()
      if (text) {
        setTranscript(prev => [...prev, {
          id: `u-${Date.now()}`, role: 'user', text, ts: Date.now(),
        }])
      }
    }

    if (type === 'response.audio_transcript.delta') {
      const delta = msg.delta as string | undefined
      if (delta) {
        setVoiceState('speaking')
        setTranscript(prev => {
          const last = prev[prev.length - 1]
          if (last?.role === 'assistant' && last.id.startsWith('ai-stream')) {
            return [...prev.slice(0, -1), { ...last, text: last.text + delta }]
          }
          return [...prev, {
            id: `ai-stream-${Date.now()}`, role: 'assistant', text: delta, ts: Date.now(),
          }]
        })
      }
    }

    if (type === 'response.done') {
      setVoiceState('idle')
    }

    if (type === 'response.output_item.done') {
      const item = msg.item as Record<string, unknown> | undefined
      if (item?.type === 'function_call') {
        const toolName = item.name as string
        let params: Record<string, unknown> = {}
        try { params = JSON.parse(item.arguments as string) } catch {}

        executeTool(toolName, params).then(result => {
          const dc = dcRef.current
          if (!dc || dc.readyState !== 'open') return
          dc.send(JSON.stringify({
            type: 'conversation.item.create',
            item: {
              type:    'function_call_output',
              call_id: item.call_id,
              output:  JSON.stringify(result),
            },
          }))
          dc.send(JSON.stringify({ type: 'response.create' }))
        })
      }
    }

    if (type === 'error') {
      const err = msg.error as Record<string, unknown> | undefined
      console.error('[NEXUS voice] error event:', err)
      setVoiceState('error')
      setErrorMsg((err?.message as string) ?? 'Erro desconhecido')
    }
  }, [executeTool])

  // ── Start session ──────────────────────────────────────────────────────

  const stopSession = useCallback(() => {
    dcRef.current?.close()
    dcRef.current = null
    pcRef.current?.close()
    pcRef.current = null
    if (audioElRef.current) {
      audioElRef.current.srcObject = null
      audioElRef.current = null
    }
    setVoiceState('off')
  }, [])

  const startSession = useCallback(async () => {
    if (voiceState !== 'off' && voiceState !== 'error') return
    setVoiceState('connecting')
    setErrorMsg(null)

    try {
      const sessionRes = await fetch('/api/nexus/voice/session', { method: 'POST' })
      if (!sessionRes.ok) {
        const body = await sessionRes.json().catch(() => ({})) as Record<string, unknown>
        const msg = (body.error as string) ?? `HTTP ${sessionRes.status}`
        // Surface the actual OpenAI error so the user knows what to fix
        throw new Error(msg)
      }
      const { client_secret } = await sessionRes.json() as {
        client_secret: { value: string }
      }
      const ephemeralKey = client_secret.value

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

      const pc = new RTCPeerConnection()
      pcRef.current = pc

      const audioEl = new Audio()
      audioEl.autoplay = true
      audioElRef.current = audioEl
      pc.ontrack = (e) => { audioEl.srcObject = e.streams[0] }

      stream.getTracks().forEach(t => pc.addTrack(t, stream))

      const dc = pc.createDataChannel('oai-events')
      dcRef.current = dc
      dc.onopen    = () => setVoiceState('idle')
      dc.onclose   = () => { if (pcRef.current) setVoiceState('off') }
      dc.onmessage = handleDCMessage

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      const sdpRes = await fetch(
        'https://api.openai.com/v1/realtime/calls',
        {
          method:  'POST',
          headers: {
            'Authorization': `Bearer ${ephemeralKey}`,
            'Content-Type':  'application/sdp',
          },
          body: offer.sdp,
        },
      )
      if (!sdpRes.ok) {
        const errText = await sdpRes.text().catch(() => '')
        throw new Error(`OpenAI SDP error ${sdpRes.status}: ${errText.slice(0, 200)}`)
      }

      const answerSdp = await sdpRes.text()
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })

    } catch (err) {
      console.error('[NEXUS voice] startSession error:', err)
      setVoiceState('error')
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao iniciar sessão')
      stopSession()
    }
  }, [voiceState, handleDCMessage, stopSession])

  const handleOrbClick = () => {
    if (voiceState === 'off' || voiceState === 'error') startSession()
    else stopSession()
  }

  const sendTextCommand = useCallback((prompt: string) => {
    const dc = dcRef.current
    if (!dc || dc.readyState !== 'open') return
    dc.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type:    'message',
        role:    'user',
        content: [{ type: 'input_text', text: prompt }],
      },
    }))
    dc.send(JSON.stringify({ type: 'response.create' }))
    setTranscript(prev => [...prev, {
      id: `u-cmd-${Date.now()}`, role: 'user', text: prompt, ts: Date.now(),
    }])
  }, [])

  const isActive = voiceState !== 'off' && voiceState !== 'error'

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-violet-600/20 border border-violet-500/30 flex items-center justify-center">
            <Zap className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-wider text-white/90 uppercase">NEXUS Assistant</h1>
            <p className="text-xs text-white/40">COO de IA Executivo</p>
          </div>
        </div>

        {isActive && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs text-white/50">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Sessão ativa · {formatDuration(sessionDuration)}
            </div>
            <button
              onClick={stopSession}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs hover:bg-red-500/20 transition-colors"
            >
              <MicOff className="w-3.5 h-3.5" />
              Encerrar
            </button>
          </div>
        )}
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left — Orb + transcript */}
        <div className="flex flex-1 flex-col items-center overflow-hidden">

          {/* Orb section */}
          <div className="flex flex-col items-center gap-6 py-8">
            <VoiceOrb state={voiceState} onClick={handleOrbClick} />

            <div
              className={`transition-colors duration-300 ${
                voiceState === 'listening' ? 'text-cyan-400'
                : voiceState === 'speaking' ? 'text-emerald-400'
                : 'text-white/20'
              }`}
            >
              <WaveformBars active={voiceState === 'listening' || voiceState === 'speaking'} />
            </div>

            <AnimatePresence>
              {errorMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs max-w-sm"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span className="flex-1 leading-relaxed">{errorMsg}</span>
                    <button onClick={() => setErrorMsg(null)} className="flex-shrink-0"><X className="w-3 h-3" /></button>
                  </div>
                  {(errorMsg.toLowerCase().includes('model') || errorMsg.toLowerCase().includes('api key') || errorMsg.toLowerCase().includes('auth') || errorMsg.toLowerCase().includes('403') || errorMsg.toLowerCase().includes('401')) && (
                    <p className="text-red-400/70 text-[10px] pl-5">
                      Verifique se <code className="bg-red-500/20 px-1 rounded">OPENAI_API_KEY</code> está configurada no Vercel e se a conta tem acesso à Realtime API (requer plano pago).
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {voiceState === 'off' && !errorMsg && (
              <p className="text-white/30 text-xs text-center">
                Clique no orb para iniciar o assistente
              </p>
            )}
          </div>

          {/* Transcript */}
          <div className="flex-1 w-full max-w-2xl px-4 overflow-hidden flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <MessageSquare className="w-3.5 h-3.5 text-white/30" />
              <span className="text-xs text-white/30 uppercase tracking-wider">Transcrição</span>
            </div>
            <div
              ref={transcriptRef}
              className="flex-1 overflow-y-auto space-y-2.5 pr-1 scrollbar-thin scrollbar-thumb-white/10"
            >
              {transcript.length === 0 ? (
                <div className="flex items-center justify-center h-24 text-white/20 text-xs">
                  Inicie uma conversa com o NEXUS
                </div>
              ) : (
                transcript.map(e => <TranscriptBubble key={e.id} entry={e} />)
              )}
            </div>
          </div>

          {/* Quick commands */}
          <div className="w-full max-w-2xl px-4 py-4 border-t border-white/5">
            <p className="text-xs text-white/30 uppercase tracking-wider mb-3">Comandos rápidos</p>
            <div className="grid grid-cols-4 gap-2">
              {QUICK.map(q => {
                const Icon = q.icon
                return (
                  <button
                    key={q.label}
                    disabled={!isActive}
                    onClick={() => sendTextCommand(q.prompt)}
                    className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl bg-white/4 border border-white/8 text-white/50 hover:bg-white/8 hover:text-white/80 hover:border-violet-500/30 transition-all disabled:opacity-30 disabled:cursor-not-allowed text-[10px] leading-tight text-center"
                  >
                    <Icon className="w-4 h-4" />
                    {q.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Right — Action log */}
        <div className="w-72 border-l border-white/5 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
            <Activity className="w-3.5 h-3.5 text-white/30" />
            <span className="text-xs text-white/30 uppercase tracking-wider">Ações executadas</span>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 scrollbar-thin scrollbar-thumb-white/10">
            {actionLog.length === 0 ? (
              <div className="flex items-center justify-center h-24 text-white/20 text-xs">
                Nenhuma ação ainda
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {actionLog.map(a => (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/4 border border-white/6"
                  >
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${a.ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white/70 truncate">{a.label}</p>
                      <p className="text-[10px] text-white/30">
                        {new Date(a.ts).toLocaleTimeString('pt-BR', {
                          hour: '2-digit', minute: '2-digit', second: '2-digit',
                        })}
                      </p>
                    </div>
                    <ChevronRight className="w-3 h-3 text-white/20 flex-shrink-0" />
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>

          <div className="px-4 py-3 border-t border-white/5">
            <div className="flex items-center justify-between text-[10px] text-white/25">
              <span>GPT-4o Realtime</span>
              <span className={`flex items-center gap-1 ${isActive ? 'text-emerald-400/60' : ''}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-white/20'}`} />
                {isActive ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
