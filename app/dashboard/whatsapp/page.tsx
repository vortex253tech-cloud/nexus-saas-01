'use client'

import { useEffect, useState, useCallback, useRef, memo } from 'react'
import { createClient }            from '@supabase/supabase-js'
import { motion, AnimatePresence } from 'framer-motion'
import { usePlan }                 from '@/lib/hooks/use-plan'
import { canAccess }               from '@/lib/nexus-plan'
import { UpgradeCard }             from '@/components/ui/plan-gate'
import {
  MessageCircle, Bot, Zap, Sparkles, Send, Phone,
  Search, Star, MoreHorizontal, ChevronRight,
  CheckCircle2, Users, TrendingUp, Flame,
  Target, Bell, RefreshCw, Settings, Plus,
  ArrowUpRight, Activity, Circle,
  MessageSquare, X, Loader2, Check, AlertTriangle,
  Smile, Archive, Tag, Wifi,
  Cpu, BarChart3, Brain, DollarSign, Clock,
  Paperclip, Image, FileText, Mic, CalendarClock,
  PhoneCall, UserCheck, Repeat2, ChevronDown,
  ShieldCheck, Globe, Layers,
} from 'lucide-react'
import { cn } from '@/lib/cn'

// ─── Types ────────────────────────────────────────────────────────────

interface Conversation {
  id:              string
  phone:           string
  contact_name:    string | null
  photo_url?:      string | null          // V5: contact photo from WhatsApp
  status:          'active' | 'closed' | 'blocked'
  last_message_at: string | null
  message_count:   number
  ai_enabled:      boolean
  created_at:      string
  unread?:         number
  unread_count?:   number
  label?:          'lead' | 'cliente' | 'negociacao' | 'recuperacao' | null
  temperatura?:    'frio' | 'morno' | 'quente' | 'urgente'
  pipeline_stage?: string | null          // V5: CRM pipeline stage
  estimated_value?: string | null         // V5: deal value
  tags?:           string[]               // V5: contact tags
}

interface SearchResult extends Conversation {
  matched_message?: string | null         // V5: snippet from message search
}

interface Message {
  id:           string
  direction:    'incoming' | 'outgoing'
  content:      string
  from_me:      boolean
  ai_generated: boolean
  status:       string
  created_at:   string
  raw_payload?: {
    media_url?:    string | null
    message_type?: string
    caption?:      string
  } | null
}

interface WAStatus {
  connected: boolean
  phone:     string | null
  status:    string
}

interface ActivityEvent {
  id:    string
  icon:  string
  label: string
  time:  string
  color: string
}

interface LeadIntel {
  name:              string | null
  phone:             string
  empresa:           string | null
  nicho:             string | null
  faturamento:       string | null
  stage:             string
  temperatura:       string
  score:             number
  dores:             string[]
  objetivo:          string | null
  usa_crm:           boolean | null
  usa_automacao:     boolean | null
  perde_whatsapp:    boolean | null
  conversion_pct:    number
  estimated_revenue: string | null
  message_count:     number
  has_real_data:     boolean
}

type AIMode = 'auto' | 'hybrid' | 'manual'

// ─── Supabase browser client (anon — Realtime only) ───────────────

function getSupabaseBrowser() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}

// ─── Helpers ──────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function formatRelative(iso: string | null) {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1)  return 'agora'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

function initials(conv: Conversation) {
  if (conv.contact_name) {
    return conv.contact_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  }
  return conv.phone.slice(-2)
}

function displayName(conv: Conversation) {
  return conv.contact_name ?? `+${conv.phone}`
}

const LABEL_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  lead:        { label: 'Lead quente', color: 'text-orange-400',  bg: 'bg-orange-500/15 border-orange-500/20'  },
  cliente:     { label: 'Cliente',     color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/20' },
  negociacao:  { label: 'Negociação',  color: 'text-violet-400',  bg: 'bg-violet-500/15 border-violet-500/20'  },
  recuperacao: { label: 'Recuperação', color: 'text-amber-400',   bg: 'bg-amber-500/15 border-amber-500/20'    },
}

const STAGE_LABEL: Record<string, string> = {
  novo:          'Novo',
  qualificado:   'Qualificado',
  interessado:   'Interessado',
  negociando:    'Negociando',
  proposta:      'Proposta enviada',
  fechado:       'Fechado',
  perdido:       'Perdido',
  cliente:       'Cliente',
}

// ─── ScoreRing ────────────────────────────────────────────────────

function ScoreRing({ score }: { score: number }) {
  const r    = 22
  const circ = 2 * Math.PI * r
  const pct  = Math.min(100, Math.max(0, score))
  const color = pct >= 70 ? '#34d399' : pct >= 40 ? '#f59e0b' : '#64748b'

  return (
    <div className="relative w-14 h-14 shrink-0">
      <svg width="56" height="56" viewBox="0 0 56 56" className="-rotate-90">
        <circle cx="28" cy="28" r={r} fill="none" stroke="#27272a" strokeWidth="4" />
        <circle
          cx="28" cy="28" r={r} fill="none"
          stroke={color} strokeWidth="4"
          strokeDasharray={`${circ * pct / 100} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.7s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xs font-bold text-white leading-none">{pct}</span>
        <span className="text-[8px] text-zinc-600 leading-none">score</span>
      </div>
    </div>
  )
}

// ─── PhotoAvatar ─────────────────────────────────────────────────
// Shows real WhatsApp profile photo; falls back to colored initials.

function PhotoAvatar({
  conv,
  size = 'md',
  heat = false,
  active = false,
  showOnlineDot = true,
  online = false,
}: {
  conv:          Conversation
  size?:         'sm' | 'md' | 'lg'
  heat?:         boolean
  active?:       boolean
  showOnlineDot?: boolean
  online?:       boolean
}) {
  const [imgErr, setImgErr] = useState(false)
  const sz = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-14 h-14 text-base' : 'w-10 h-10 text-sm'
  const dot = size === 'sm' ? 'w-3 h-3 border-[1.5px]' : 'w-3.5 h-3.5 border-2'

  const hasPhoto = !!conv.photo_url && !imgErr

  return (
    <div className="relative shrink-0">
      {hasPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={conv.photo_url!}
          alt={conv.contact_name ?? conv.phone}
          className={cn('rounded-full object-cover', sz)}
          onError={() => setImgErr(true)}
        />
      ) : (
        <div className={cn(
          'rounded-full flex items-center justify-center font-bold',
          sz,
          heat   ? 'bg-orange-500/20 text-orange-400 ring-1 ring-orange-500/30' :
          active ? 'bg-violet-600/25 text-violet-300' : 'bg-zinc-800 text-zinc-400',
        )}>
          {initials(conv)}
        </div>
      )}
      {showOnlineDot && (
        <span className={cn(
          'absolute -bottom-0.5 -right-0.5 rounded-full border-zinc-950',
          dot,
          online ? 'bg-emerald-500' : conv.ai_enabled ? 'bg-violet-600' : 'bg-zinc-700',
        )} />
      )}
    </div>
  )
}

// ─── GlobalSearchOverlay ──────────────────────────────────────────

function GlobalSearchOverlay({
  query,
  results,
  loading,
  onSelect,
  onClose,
}: {
  query:    string
  results:  SearchResult[]
  loading:  boolean
  onSelect: (r: SearchResult) => void
  onClose:  () => void
}) {
  return (
    <div
      className="absolute inset-0 z-20 bg-zinc-950/95 backdrop-blur-sm flex flex-col"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="p-4 border-b border-zinc-800/60">
        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
          {loading ? 'Buscando…' : results.length > 0 ? `${results.length} resultado${results.length !== 1 ? 's' : ''}` : 'Nenhum resultado'}
        </p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-violet-400 animate-spin" />
          </div>
        ) : results.length === 0 && query.length >= 2 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <Search className="w-8 h-8 text-zinc-700 mb-2" />
            <p className="text-sm text-zinc-500">Sem resultados para <strong className="text-zinc-300">"{query}"</strong></p>
            <p className="text-xs text-zinc-600 mt-1">Tente nome, telefone ou trecho da mensagem</p>
          </div>
        ) : (
          results.map(r => (
            <button
              key={r.id}
              onClick={() => onSelect(r)}
              className="w-full px-4 py-3 flex items-start gap-3 text-left border-b border-zinc-800/30 hover:bg-zinc-800/30 transition"
            >
              <PhotoAvatar conv={r} showOnlineDot={false} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">{r.contact_name ?? `+${r.phone}`}</p>
                <p className="text-xs text-zinc-500">+{r.phone}</p>
                {r.matched_message && (
                  <p className="text-xs text-violet-400/80 mt-0.5 truncate">
                    <span className="text-zinc-600">msg: </span>{r.matched_message}
                  </p>
                )}
              </div>
              {r.pipeline_stage && (
                <span className="text-[10px] text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-full px-2 py-0.5 shrink-0">
                  {r.pipeline_stage}
                </span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  )
}

// ─── Cinematic ConnectModal ───────────────────────────────────────

type ConnectPhase = 'qr' | 'activating' | 'success'
type QRStep = 'loading' | 'showing' | 'scanning'

const ACTIVATION_STEPS = [
  { icon: '📱', text: 'Conectando seu número',    sub: 'Verificando autenticação...'            },
  { icon: '🤖', text: 'IA preparando automações', sub: 'Configurando respostas inteligentes...' },
  { icon: '🔍', text: 'Analisando conversas',     sub: 'Sincronizando histórico de mensagens...' },
  { icon: '⚡', text: 'NEXUS operacional',        sub: 'Sistema ativo. IA monitorando.'         },
]

function ConnectModal({ onClose, onConnected }: { onClose: () => void; onConnected: () => void }) {
  const [phase,            setPhase]           = useState<ConnectPhase>('qr')
  const [qrStep,           setQrStep]          = useState<QRStep>('loading')
  const [qrUrl,            setQrUrl]           = useState<string | null>(null)
  const [qrError,          setQrError]         = useState<string | null>(null)
  const [alreadyConnected, setAlreadyConnected] = useState(false)
  const [disconnecting,    setDisconnecting]   = useState(false)
  const [actStep,          setActStep]         = useState(-1)

  const pollRef    = useRef<ReturnType<typeof setInterval> | null>(null)
  const qrTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const blobRef    = useRef<string | null>(null)

  // Fetch QR via fetch() so we can handle JSON responses properly
  const loadQr = useCallback(async () => {
    if (blobRef.current) { URL.revokeObjectURL(blobRef.current); blobRef.current = null }
    setQrUrl(null)
    setQrError(null)
    setAlreadyConnected(false)
    setQrStep('loading')
    try {
      const res = await fetch('/api/nexus/whatsapp/qr', { cache: 'no-store' })
      if (res.status === 409) {
        setAlreadyConnected(true)
        setQrStep('showing')
        return
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        setQrError(err.error ?? 'qr_failed')
        setQrStep('showing')
        return
      }
      const buf  = await res.arrayBuffer()
      const blob = new Blob([buf], { type: 'image/png' })
      const url  = URL.createObjectURL(blob)
      blobRef.current = url
      setQrUrl(url)
      setQrStep('showing')
    } catch {
      setQrError('timeout')
      setQrStep('showing')
    }
  }, [])

  // Load QR on mount
  useEffect(() => { loadQr() }, [loadQr])

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => { if (blobRef.current) URL.revokeObjectURL(blobRef.current) }
  }, [])

  // Auto-refresh QR every 55s (before Z-API ~60s expiry)
  useEffect(() => {
    if (phase !== 'qr' || alreadyConnected) return
    qrTimerRef.current = setInterval(loadQr, 55_000)
    return () => { qrTimerRef.current && clearInterval(qrTimerRef.current) }
  }, [phase, alreadyConnected, loadQr])

  // Poll connection status every 3s
  useEffect(() => {
    if (phase !== 'qr' || alreadyConnected) return
    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch('/api/nexus/whatsapp/status')
        const data = await res.json() as WAStatus
        if (data.connected) {
          clearInterval(pollRef.current!)
          qrTimerRef.current && clearInterval(qrTimerRef.current)
          fetch('/api/nexus/whatsapp/setup', { method: 'POST' }).catch(() => {})
          setTimeout(() => { setPhase('activating'); setActStep(0) }, 600)
        }
      } catch { /* ignore */ }
    }, 3000)
    return () => { pollRef.current && clearInterval(pollRef.current) }
  }, [phase, alreadyConnected])

  // Advance activation steps every 1400ms
  useEffect(() => {
    if (phase !== 'activating' || actStep < 0) return
    if (actStep >= ACTIVATION_STEPS.length) {
      setPhase('success')
      setTimeout(onConnected, 1400)
      return
    }
    const t = setTimeout(() => setActStep(s => s + 1), 1400)
    return () => clearTimeout(t)
  }, [phase, actStep, onConnected])

  // Disconnect and show fresh QR
  const handleDisconnect = useCallback(async () => {
    setDisconnecting(true)
    try { await fetch('/api/nexus/whatsapp/disconnect') } catch { /* ignore */ }
    setDisconnecting(false)
    await loadQr()
  }, [loadQr])

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm"
        onClick={e => { if (e.target === e.currentTarget && phase === 'qr') onClose() }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1,    y: 0  }}
          exit={{ opacity: 0,   scale: 0.95,  y: 10 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="relative bg-zinc-950 border border-zinc-800 rounded-3xl p-8 w-full max-w-md shadow-2xl overflow-hidden"
        >
          {/* Ambient glow */}
          <motion.div
            animate={{
              background: phase === 'activating' ? 'radial-gradient(circle at 50% 50%, rgba(139,92,246,0.08) 0%, transparent 70%)' :
                          phase === 'success'    ? 'radial-gradient(circle at 50% 50%, rgba(52,211,153,0.08) 0%, transparent 70%)' :
                                                   'transparent',
            }}
            transition={{ duration: 0.8 }}
            className="absolute inset-0 rounded-3xl pointer-events-none"
          />

          {phase === 'qr' && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* ── QR Phase ── */}
          <AnimatePresence mode="wait">
            {phase === 'qr' && (
              <motion.div
                key="qr"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative z-10"
              >
                <div className="flex items-center gap-3 mb-7">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
                    <MessageCircle className="w-5 h-5 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">Conectar WhatsApp</p>
                    <p className="text-xs text-zinc-500">Escaneie o QR com seu celular</p>
                  </div>
                </div>

                <div className="flex flex-col items-center gap-5">
                  {/* QR image */}
                  <div className="relative">
                    <div className={cn(
                      'w-56 h-56 rounded-2xl overflow-hidden border-2 transition-all duration-500',
                      alreadyConnected
                        ? 'border-emerald-500/60 shadow-lg shadow-emerald-500/15'
                        : 'border-violet-500/40 shadow-lg shadow-violet-500/10',
                    )}>
                      {qrStep === 'loading' ? (
                        <div className="w-full h-full bg-zinc-900 flex flex-col items-center justify-center gap-3">
                          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
                          <p className="text-xs text-zinc-500">Gerando QR Code…</p>
                        </div>
                      ) : alreadyConnected ? (
                        <div className="w-full h-full bg-zinc-900 flex flex-col items-center justify-center gap-3 p-4">
                          <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                          <p className="text-xs text-emerald-300 font-semibold text-center">WhatsApp já vinculado</p>
                          <p className="text-[10px] text-zinc-500 text-center">Um número já está conectado a esta conta.</p>
                          <button
                            onClick={handleDisconnect}
                            disabled={disconnecting}
                            className="flex items-center gap-1.5 text-xs text-amber-400 border border-amber-500/30 rounded-lg px-3 py-1.5 hover:bg-amber-500/10 transition disabled:opacity-50"
                          >
                            {disconnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                            Trocar número
                          </button>
                        </div>
                      ) : qrError ? (
                        <div className="w-full h-full bg-zinc-900 flex flex-col items-center justify-center gap-3 p-4">
                          <AlertTriangle className="w-8 h-8 text-amber-400" />
                          <p className="text-xs text-zinc-500 text-center">
                            Não foi possível gerar o QR Code agora.<br />Tente novamente em alguns segundos.
                          </p>
                          <button
                            onClick={loadQr}
                            className="text-xs text-violet-400 border border-violet-500/30 rounded-lg px-3 py-1.5 hover:bg-violet-500/10 transition"
                          >
                            Tentar novamente
                          </button>
                        </div>
                      ) : qrUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={qrUrl}
                          alt="QR Code WhatsApp"
                          className="w-full h-full object-cover bg-white"
                        />
                      ) : null}
                    </div>
                  </div>

                  {!alreadyConnected && !qrError && (
                    <div className="text-center space-y-1.5">
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        1. Abra o WhatsApp no celular<br />
                        2. Vá em <strong className="text-white">Dispositivos vinculados</strong><br />
                        3. Toque em <strong className="text-white">Vincular um dispositivo</strong><br />
                        4. Escaneie este QR Code
                      </p>
                      {qrUrl && (
                        <button
                          onClick={loadQr}
                          className="text-xs text-violet-400 hover:text-violet-300 transition"
                        >
                          ↺ Atualizar QR Code
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-7">
                  {[0, 1, 2, 3].map(i => (
                    <div
                      key={i}
                      className={cn(
                        'h-0.5 rounded-full flex-1 transition-all duration-500',
                        (qrStep === 'loading' ? 0 : qrStep === 'showing' ? 1 : 2) >= i
                          ? 'bg-violet-500' : 'bg-zinc-800',
                      )}
                    />
                  ))}
                </div>
              </motion.div>
            )}

            {/* ── Activating Phase ── */}
            {phase === 'activating' && (
              <motion.div
                key="activating"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="relative z-10"
              >
                <div className="flex flex-col items-center mb-7">
                  <div className="relative mb-4">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                      className="w-16 h-16 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center"
                    >
                      <Cpu className="w-8 h-8 text-violet-400" />
                    </motion.div>
                    <div className="absolute inset-0 rounded-2xl border border-violet-500/20 animate-ping" style={{ animationDuration: '2s' }} />
                  </div>
                  <p className="text-sm font-semibold text-white">Ativando NEXUS AI</p>
                  <p className="text-xs text-zinc-500 mt-1">Configurando o Operation Center…</p>
                </div>

                <div className="space-y-2.5">
                  {ACTIVATION_STEPS.map((step, i) => {
                    const done    = actStep > i
                    const current = actStep === i
                    const future  = actStep < i
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -16 }}
                        animate={{
                          opacity: future ? 0.3 : 1,
                          x: 0,
                        }}
                        transition={{ delay: i * 0.06 }}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-xl border transition-all duration-500',
                          done    ? 'bg-emerald-500/8 border-emerald-500/20'  :
                          current ? 'bg-violet-600/12 border-violet-500/25'   :
                                    'bg-zinc-900/40 border-zinc-800/40',
                        )}
                      >
                        <div className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-sm transition-all duration-300',
                          done    ? 'bg-emerald-500/20' :
                          current ? 'bg-violet-600/20'  : 'bg-zinc-800',
                        )}>
                          {done ? (
                            <motion.span
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: 'spring', stiffness: 400 }}
                            >
                              <Check className="w-4 h-4 text-emerald-400" />
                            </motion.span>
                          ) : current ? (
                            <Loader2 className="w-4 h-4 text-violet-400 animate-spin" />
                          ) : (
                            <span>{step.icon}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            'text-xs font-semibold',
                            done ? 'text-emerald-300' : current ? 'text-white' : 'text-zinc-600',
                          )}>
                            {step.text}
                          </p>
                          <p className={cn(
                            'text-[10px] mt-0.5',
                            done ? 'text-emerald-600' : current ? 'text-zinc-400' : 'text-zinc-700',
                          )}>
                            {done ? 'Concluído' : step.sub}
                          </p>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </motion.div>
            )}

            {/* ── Success Phase ── */}
            {phase === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative z-10 flex flex-col items-center gap-6 py-2"
              >
                <div className="relative">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 280, delay: 0.1 }}
                    className="w-20 h-20 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shadow-xl shadow-emerald-500/20"
                  >
                    <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                  </motion.div>
                  <div className="absolute inset-0 rounded-2xl border border-emerald-500/25 animate-ping" style={{ animationDuration: '1.5s' }} />
                </div>

                <div className="text-center">
                  <p className="text-lg font-bold text-white">NEXUS Operacional</p>
                  <p className="text-sm text-emerald-400 mt-1">IA ativada. Monitorando automaticamente.</p>
                  <p className="text-xs text-zinc-600 mt-3">Abrindo o Operation Center…</p>
                </div>

                <div className="flex items-center gap-8">
                  {[
                    { icon: '🤖', label: 'IA ativa' },
                    { icon: '⚡', label: 'Automação' },
                    { icon: '📊', label: 'Pipeline sync' },
                  ].map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + i * 0.1 }}
                      className="flex flex-col items-center gap-1"
                    >
                      <span className="text-xl">{item.icon}</span>
                      <p className="text-[10px] text-zinc-500">{item.label}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ─── ConfigModal ─────────────────────────────────────────────────

function ConfigModal({
  onClose,
  onReconnect,
  waStatus,
}: {
  onClose:     () => void
  onReconnect: () => void
  waStatus:    WAStatus | null
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-zinc-800 flex items-center justify-center">
              <Settings className="w-4 h-4 text-zinc-400" />
            </div>
            <p className="text-sm font-semibold text-white">Configurações</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Connection status */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-4">
          <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-3">Conexão WhatsApp</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={cn('w-2 h-2 rounded-full', waStatus?.connected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400')}>
              </div>
              <div>
                <p className="text-xs font-medium text-white">{waStatus?.connected ? 'Conectado' : 'Desconectado'}</p>
                {waStatus?.phone && <p className="text-[10px] text-zinc-500">+{waStatus.phone}</p>}
              </div>
            </div>
            <button
              onClick={() => { onClose(); onReconnect() }}
              className="text-[11px] text-violet-400 border border-violet-500/30 rounded-lg px-2.5 py-1 hover:bg-violet-500/10 transition"
            >
              {waStatus?.connected ? 'Reconectar' : 'Conectar'}
            </button>
          </div>
        </div>

        {/* Connection info */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-4">
          <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-3">Conexão</p>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-zinc-500">Número</p>
              <p className="text-[11px] text-zinc-300 font-mono">
                {waStatus?.connected ? '●●●●●●●●' : 'Não conectado'}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-zinc-500">Status</p>
              <p className={cn('text-[11px] font-medium', waStatus?.connected ? 'text-emerald-400' : 'text-red-400')}>
                {waStatus?.connected ? 'Conectado' : 'Desconectado'}
              </p>
            </div>
          </div>
        </div>

        {/* AI settings note */}
        <div className="bg-violet-500/8 border border-violet-500/20 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <Brain className="w-3 h-3 text-violet-400" />
            <p className="text-[11px] font-medium text-violet-300">NEXUS AI</p>
          </div>
          <p className="text-[10px] text-zinc-500 leading-relaxed">
            Configure o modo de operação da IA (Auto, Híbrido, Manual) diretamente no painel lateral de cada conversa.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── NewConvModal ─────────────────────────────────────────────────

function NewConvModal({
  onClose,
  onCreated,
}: {
  onClose:   () => void
  onCreated: (convId: string, phone: string) => void
}) {
  const [phone,   setPhone]   = useState('')
  const [name,    setName]    = useState('')
  const [msg,     setMsg]     = useState('')
  const [sending, setSending] = useState(false)
  const [err,     setErr]     = useState<string | null>(null)

  const handleSend = async () => {
    const cleanPhone = phone.replace(/\D/g, '')
    if (cleanPhone.length < 10) { setErr('Número inválido (mínimo 10 dígitos)'); return }
    if (!msg.trim()) { setErr('Digite a primeira mensagem'); return }

    setSending(true)
    setErr(null)
    try {
      const res = await fetch('/api/nexus/whatsapp/new-conversation', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ phone: cleanPhone, message: msg.trim(), name: name.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { setErr(data.error ?? 'Erro ao enviar'); return }
      onCreated(data.conversation_id, data.phone)
      onClose()
    } catch {
      setErr('Erro de conexão')
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-violet-600/20 flex items-center justify-center">
              <Plus className="w-4 h-4 text-violet-400" />
            </div>
            <p className="text-sm font-semibold text-white">Nova conversa</p>
          </div>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">Número*</label>
            <input
              type="tel"
              placeholder="55 11 99999-9999"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-violet-500/50 transition"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">Nome (opcional)</label>
            <input
              type="text"
              placeholder="João Silva"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-violet-500/50 transition"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block mb-1.5">Primeira mensagem*</label>
            <textarea
              placeholder="Olá! Vi seu interesse e quero te ajudar..."
              value={msg}
              onChange={e => setMsg(e.target.value)}
              rows={3}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-violet-500/50 transition resize-none"
            />
          </div>
          {err && <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</p>}
        </div>

        <div className="flex gap-2 mt-5">
          <button
            onClick={onClose}
            className="flex-1 text-sm text-zinc-400 border border-zinc-800 rounded-xl py-2.5 hover:bg-zinc-800/50 transition"
          >
            Cancelar
          </button>
          <button
            onClick={handleSend}
            disabled={sending}
            className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl py-2.5 transition"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Onboarding ───────────────────────────────────────────────────

const MOCK_CONVS = [
  { name: 'João Silva',    tag: 'Lead quente', tagColor: 'text-orange-400',  msg: 'Olá! Tenho interesse nos seus serviços', time: '14:32', unread: 2 },
  { name: 'Maria Oliveira', tag: 'Cliente',    tagColor: 'text-emerald-400', msg: 'Perfeito! Vamos fechar então',           time: '14:28', unread: 0 },
  { name: 'Carlos Mendes', tag: 'Negociação',  tagColor: 'text-violet-400',  msg: 'Pode me enviar a proposta?',            time: '14:20', unread: 3 },
  { name: 'Ana Costa',     tag: 'Aguardando IA', tagColor: 'text-amber-400', msg: 'Qual o valor do pacote?',               time: '14:15', unread: 1 },
]

function OnboardingView({ onConnect }: { onConnect: () => void }) {
  const features = [
    { icon: Bot,        text: 'IA responde automaticamente 24/7' },
    { icon: TrendingUp, text: 'Detecta e qualifica leads em tempo real' },
    { icon: Zap,        text: 'Follow-ups automáticos e reativação de clientes' },
  ]

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center relative overflow-hidden px-4">
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-violet-600/8 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-1/4 left-1/3 w-[400px] h-[200px] bg-emerald-600/6 rounded-full blur-3xl pointer-events-none" />

      {/* Faded mock conversations */}
      <div className="absolute inset-y-0 right-0 w-80 flex flex-col gap-2 p-6 opacity-20 pointer-events-none hidden lg:flex">
        {MOCK_CONVS.map((c, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 + i * 0.15 }}
            className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-4 flex items-start gap-3"
          >
            <div className="w-9 h-9 rounded-full bg-violet-600/20 flex items-center justify-center text-xs font-bold text-violet-400 shrink-0">
              {c.name.slice(0, 2)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-zinc-200 truncate">{c.name}</p>
                <p className="text-[10px] text-zinc-600 shrink-0 ml-1">{c.time}</p>
              </div>
              <p className="text-[11px] text-zinc-500 truncate mt-0.5">{c.msg}</p>
            </div>
            {c.unread > 0 && (
              <span className="shrink-0 w-4 h-4 rounded-full bg-violet-600 text-[10px] text-white flex items-center justify-center">{c.unread}</span>
            )}
          </motion.div>
        ))}
        <motion.div
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.9 }}
          className="bg-violet-600/15 border border-violet-500/20 rounded-2xl p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <Bot className="w-3.5 h-3.5 text-violet-400" />
            <p className="text-[10px] text-violet-400 font-medium">NEXUS AI · Resposta automática</p>
          </div>
          <p className="text-[11px] text-zinc-300 leading-relaxed">Olá João! 👋 Posso te mostrar como podemos ajudar…</p>
        </motion.div>
      </div>

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 flex flex-col items-center text-center max-w-lg gap-6"
      >
        <div className="relative">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-600/30 to-violet-800/20 border border-violet-500/30 flex items-center justify-center shadow-xl shadow-violet-500/20">
            <Bot className="w-12 h-12 text-violet-400" />
          </div>
          <div className="absolute inset-0 rounded-3xl border border-violet-500/20 animate-ping" style={{ animationDuration: '2s' }} />
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-zinc-950 flex items-center justify-center">
            <span className="text-[8px] font-bold text-white">AI</span>
          </span>
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl font-bold text-white tracking-tight leading-tight">
            Seu WhatsApp<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">
              operado por IA.
            </span>
          </h1>
          <p className="text-zinc-400 text-base leading-relaxed max-w-sm">
            O NEXUS responde, organiza, recupera clientes e identifica oportunidades automaticamente.
          </p>
        </div>

        <div className="flex flex-col gap-2 w-full max-w-xs">
          {features.map(({ icon: Icon, text }, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="flex items-center gap-3 text-left"
            >
              <div className="w-7 h-7 rounded-lg bg-violet-500/15 flex items-center justify-center shrink-0">
                <Icon className="w-3.5 h-3.5 text-violet-400" />
              </div>
              <p className="text-sm text-zinc-400">{text}</p>
            </motion.div>
          ))}
        </div>

        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          onClick={onConnect}
          className="relative group flex items-center gap-3 bg-violet-600 hover:bg-violet-500 text-white font-semibold px-8 py-4 rounded-2xl text-base transition-all duration-200 shadow-xl shadow-violet-600/30 hover:shadow-violet-500/40 hover:scale-[1.02]"
        >
          <MessageCircle className="w-5 h-5" />
          Conectar WhatsApp
          <ArrowUpRight className="w-4 h-4 opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
        </motion.button>

        <p className="text-xs text-zinc-600">Leva menos de 60 segundos · Sem configuração técnica</p>
      </motion.div>
    </div>
  )
}

// ─── Conversation Item ────────────────────────────────────────────

function isOnline(lastAt: string | null) {
  if (!lastAt) return false
  return Date.now() - new Date(lastAt).getTime() < 5 * 60 * 1000
}

const ConvItem = memo(function ConvItem({
  conv, active, onClick,
}: { conv: Conversation; active: boolean; onClick: () => void }) {
  const cfg    = conv.label ? LABEL_CONFIG[conv.label] : null
  const heat   = conv.temperatura === 'quente' || conv.temperatura === 'urgente'
  const unread = conv.unread ?? 0
  const online = isOnline(conv.last_message_at)

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full px-4 py-3 flex items-start gap-3 text-left border-b border-zinc-800/30 last:border-0 transition-all duration-150',
        active
          ? 'bg-violet-600/10 border-l-2 border-l-violet-500'
          : 'hover:bg-zinc-800/25',
      )}
    >
      <div className="mt-0.5">
        <PhotoAvatar conv={conv} heat={heat} active={active} online={online} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <div className="flex items-center gap-1 min-w-0">
            <p className={cn('text-xs font-semibold truncate', unread > 0 ? 'text-white' : 'text-zinc-300')}>
              {displayName(conv)}
            </p>
            {heat && <Flame className="w-2.5 h-2.5 text-orange-400 shrink-0" />}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {unread > 0 && (
              <span className="min-w-[16px] h-4 rounded-full bg-violet-600 text-[9px] font-bold text-white flex items-center justify-center px-1">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
            <span className="text-[9px] text-zinc-700">{formatRelative(conv.last_message_at)}</span>
          </div>
        </div>

        <div className="flex items-center justify-between gap-1">
          {online ? (
            <span className="text-[10px] text-emerald-400 font-medium">online</span>
          ) : cfg ? (
            <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full border', cfg.color, cfg.bg)}>
              {cfg.label}
            </span>
          ) : (
            <span className="text-[10px] text-zinc-600 truncate">
              {conv.ai_enabled ? '🤖 IA ativa' : `${conv.message_count} msgs`}
            </span>
          )}
        </div>
      </div>
    </button>
  )
})

// ─── Message Bubble ───────────────────────────────────────────────

const Bubble = memo(function Bubble({ msg }: { msg: Message }) {
  const isOut    = msg.direction === 'outgoing'
  const isAI     = msg.ai_generated
  const isOpt    = msg.id.startsWith('opt-')
  const mediaUrl = msg.raw_payload?.media_url
  const msgType  = msg.raw_payload?.message_type ?? 'text'
  const isImage  = msgType === 'image' && !!mediaUrl

  return (
    <div className={cn(
      'flex gap-2 max-w-[80%] animate-in fade-in slide-in-from-bottom-1 duration-200',
      isOut ? 'flex-row-reverse ml-auto' : 'mr-auto',
      isOpt && 'opacity-60',
    )}>
      {/* Avatar for incoming messages */}
      {!isOut && (
        <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center shrink-0 mt-auto text-[10px] font-bold text-zinc-400">
          <Phone className="w-3 h-3" />
        </div>
      )}
      <div className={cn('flex flex-col gap-1', isOut ? 'items-end' : 'items-start')}>
        {/* AI label above bubble */}
        {isOut && isAI && (
          <div className="flex items-center gap-1 text-[9px] text-violet-400/60 mb-0.5">
            <Sparkles className="w-2 h-2" />
            NEXUS AI
          </div>
        )}
        {/* Bubble */}
        <div className={cn(
          'text-sm leading-relaxed overflow-hidden',
          isImage ? 'rounded-2xl' : cn(
            'px-3.5 py-2.5',
            isOut ? 'rounded-2xl rounded-tr-sm' : 'rounded-2xl rounded-tl-sm',
          ),
          isOut
            ? isAI
              ? 'bg-gradient-to-br from-violet-600 to-violet-700 text-white shadow-lg shadow-violet-600/25'
              : 'bg-violet-600 text-white shadow-md shadow-violet-600/20'
            : 'bg-zinc-800 text-zinc-100 border border-zinc-700/50 shadow-sm',
        )}>
          {isImage ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mediaUrl!}
                alt="imagem"
                className="max-w-[260px] max-h-[320px] object-cover"
                loading="lazy"
              />
              {msg.raw_payload?.caption && (
                <p className="px-3 py-1.5 text-xs text-white/80">{msg.raw_payload.caption}</p>
              )}
            </>
          ) : (
            msg.content
          )}
        </div>
        {/* Timestamp + delivery */}
        <div className={cn(
          'flex items-center gap-1 text-[9px]',
          isOut ? 'flex-row-reverse' : 'flex-row',
          'text-zinc-600',
        )}>
          {isOut && (
            msg.status === 'read'
              ? <CheckCircle2 className="w-3 h-3 text-violet-400" />
              : <Check className="w-3 h-3" />
          )}
          <span>{formatTime(msg.created_at)}</span>
        </div>
      </div>
    </div>
  )
})

// ─── AI Mode Toggle ───────────────────────────────────────────────

const AI_MODES: { key: AIMode; label: string; desc: string; color: string }[] = [
  { key: 'auto',   label: 'Automático', desc: 'IA responde sozinha',   color: 'text-emerald-400' },
  { key: 'hybrid', label: 'Híbrido',   desc: 'IA sugere, você aprova', color: 'text-violet-400'  },
  { key: 'manual', label: 'Manual',    desc: 'Você controla tudo',     color: 'text-zinc-400'    },
]

function AIModeToggle({ mode, onChange }: { mode: AIMode; onChange: (m: AIMode) => void }) {
  const current = AI_MODES.find(m => m.key === mode)!
  return (
    <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
      {AI_MODES.map(m => (
        <button
          key={m.key}
          onClick={() => onChange(m.key)}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
            mode === m.key
              ? 'bg-zinc-800 text-white shadow-sm'
              : 'text-zinc-600 hover:text-zinc-400',
          )}
        >
          {m.key === 'auto'   && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
          {m.key === 'hybrid' && <span className="w-1.5 h-1.5 rounded-full bg-violet-400" />}
          {m.key === 'manual' && <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />}
          {m.label}
        </button>
      ))}
    </div>
  )
}

// ─── AI Sidebar ───────────────────────────────────────────────────

const QUICK_REPLIES = [
  'Claro! Vou te mostrar como funciona nossa automação e os resultados que podemos gerar.',
  'Posso agendar uma demonstração rápida para você ver na prática. Quando tem 20 minutos?',
  'Ótima pergunta! Nossos planos começam em R$297/mês com ROI médio de 3x em 90 dias.',
]

const SUGGESTED_ACTIONS = [
  { icon: '📋', label: 'Enviar proposta personalizada' },
  { icon: '📅', label: 'Agendar follow-up' },
  { icon: '🎯', label: 'Oferecer demonstração' },
  { icon: '💼', label: 'Enviar case de sucesso' },
]

const TEMP_MAP: Record<string, { label: string; color: string; bg: string }> = {
  urgente: { label: 'Urgente 🔥🔥', color: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20'    },
  quente:  { label: 'Quente 🔥',    color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
  morno:   { label: 'Morno',        color: 'text-amber-400',  bg: 'bg-amber-500/10 border-amber-500/20'  },
  frio:    { label: 'Frio',         color: 'text-zinc-500',   bg: 'bg-zinc-800/60 border-zinc-700/30'    },
}

function ScoreBar({ label, value, max = 100, color = 'bg-violet-500' }: {
  label: string; value: number; max?: number; color?: string
}) {
  const pct = Math.min(100, Math.round((value / max) * 100))
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-[10px] text-zinc-500 shrink-0 w-28">{label}</p>
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className={cn('h-full rounded-full', color)}
        />
      </div>
      <p className="text-[10px] text-zinc-400 tabular-nums w-8 text-right">{pct}%</p>
    </div>
  )
}

function AISidebar({
  conv,
  activityEvents,
  leadData,
  leadLoading,
  aiMode,
  autoClose,
  conversations,
  onAIModeChange,
  onSendImage,
  onTransfer,
  onSendProposal,
}: {
  conv:            Conversation | null
  activityEvents:  ActivityEvent[]
  leadData:        LeadIntel | null
  conversations:   Conversation[]
  autoClose:       boolean
  leadLoading:     boolean
  aiMode:          AIMode
  onAIModeChange:  (m: AIMode) => void
  onSendImage:     () => void
  onTransfer:      () => void
  onSendProposal:  () => void
}) {
  const feedEvents = activityEvents.length > 0 ? activityEvents : [
    { id: 'd1', icon: '✅', label: 'IA respondeu automaticamente',      time: new Date(Date.now() - 60000).toISOString(),   color: 'text-emerald-400' },
    { id: 'd2', icon: '🔥', label: 'Lead quente identificado',          time: new Date(Date.now() - 180000).toISOString(),  color: 'text-orange-400'  },
    { id: 'd3', icon: '📊', label: 'Oportunidade detectada no pipeline', time: new Date(Date.now() - 300000).toISOString(),  color: 'text-violet-400'  },
    { id: 'd4', icon: '⚡', label: 'Follow-up automático enviado',      time: new Date(Date.now() - 600000).toISOString(),   color: 'text-blue-400'    },
  ]

  // AutoClose performance metrics (derived from real conversation data)
  const closedCount   = conversations.filter(c => c.status === 'closed').length
  const activeCount   = conversations.filter(c => c.status === 'active').length
  const aiEnabledCount = conversations.filter(c => c.ai_enabled).length
  const convRate      = conversations.length > 0
    ? Math.round((closedCount / conversations.length) * 100)
    : 0

  const AI_CAPABILITIES = [
    'Responde mensagens automaticamente',
    'Envia textos, áudios e PDFs',
    'Identifica e qualifica leads',
    'Inicia conversas com leads quentes',
    'Envia ofertas e propostas',
    'Faz follow-ups inteligentes',
    'Agenda reuniões e fecha vendas',
    'Trabalha 24 horas por dia',
  ]

  const MEDIA_TYPES = [
    { icon: Image,    label: 'Imagem'    },
    { icon: FileText, label: 'PDF'       },
    { icon: Mic,      label: 'Áudio'     },
    { icon: Globe,    label: 'Link'      },
  ]

  // ── No conversation selected ───────────────────────────────────

  if (!conv) {
    return (
      <div className="flex flex-col h-full overflow-y-auto">

        {/* ── AI Monitoring Hero Block ── */}
        <div className="p-3 border-b border-zinc-800/60">
          <div className="relative rounded-2xl overflow-hidden border border-blue-500/20 bg-gradient-to-br from-blue-950/40 to-violet-950/30 p-4">
            {/* Ambient glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-violet-500/5 pointer-events-none" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                    <Brain className="w-4 h-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">IA monitorando conversas</p>
                    <p className="text-[10px] text-zinc-400">Seleciona e atua nas melhores oportunidades</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] font-semibold text-emerald-400">Processando em tempo real</span>
              </div>
              <p className="text-[10px] text-zinc-300 font-semibold mb-2">A IA faz tudo por você</p>
              <div className="space-y-1.5">
                {AI_CAPABILITIES.map(cap => (
                  <div key={cap} className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                      <span className="text-blue-400 text-[8px]">✓</span>
                    </div>
                    <span className="text-[10px] text-zinc-400">{cap}</span>
                  </div>
                ))}
              </div>
              <button className="mt-3 w-full text-[10px] text-blue-400 hover:text-blue-300 font-semibold transition">
                Ver todas as ações →
              </button>
            </div>
          </div>
        </div>

        {/* AI Mode */}
        <div className="p-3 border-b border-zinc-800/60">
          <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-2">Modo de operação</p>
          <AIModeToggle mode={aiMode} onChange={onAIModeChange} />
        </div>

        {/* AutoClose metrics card — shown when autoClose is ON */}
        {autoClose && (
          <div className="mx-3 mt-3 bg-emerald-500/8 border border-emerald-500/20 rounded-xl p-3">
            <div className="flex items-center gap-1.5 mb-3">
              <Zap className="w-3 h-3 text-emerald-400" />
              <p className="text-[9px] font-semibold text-emerald-400 uppercase tracking-wider">AutoClose · Performance</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Conversas ativas',   value: activeCount,    color: 'text-white'         },
                { label: 'IA respondendo',      value: aiEnabledCount, color: 'text-violet-400'    },
                { label: 'Taxa conversão',      value: `${convRate}%`, color: 'text-emerald-400'   },
                { label: 'Fechadas',            value: closedCount,    color: 'text-zinc-400'      },
              ].map(m => (
                <div key={m.label} className="bg-zinc-950/60 rounded-lg p-2">
                  <p className={cn('text-xs font-bold', m.color)}>{m.value}</p>
                  <p className="text-[9px] text-zinc-600 mt-0.5">{m.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Monitoring */}
        <div className="p-4 border-b border-zinc-800/60">
          <div className="flex flex-col items-center gap-3 py-1">
            <motion.div
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 2.5, repeat: Infinity }}
              className="w-12 h-12 rounded-2xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center"
            >
              <Brain className="w-6 h-6 text-violet-400/60" />
            </motion.div>
            <div className="text-center">
              <p className="text-xs font-medium text-zinc-400">IA monitorando conversas</p>
              <p className="text-[10px] text-zinc-600 mt-0.5">Selecione uma conversa para análise</p>
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 bg-emerald-500/8 border border-emerald-500/15 rounded-full px-3 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Detectando oportunidades
            </div>
          </div>
        </div>

        {/* A IA faz tudo */}
        <div className="p-4 border-b border-zinc-800/60">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-3.5 h-3.5 text-violet-400" />
            <p className="text-xs font-semibold text-zinc-200">A IA faz tudo por você</p>
          </div>
          <div className="space-y-2">
            {AI_CAPABILITIES.map((cap, i) => (
              <div key={i} className="flex items-center gap-2">
                <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                <p className="text-[11px] text-zinc-400">{cap}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Media types */}
        <div className="p-4 border-b border-zinc-800/60">
          <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-3">Tipos de mídia</p>
          <div className="grid grid-cols-4 gap-2">
            {MEDIA_TYPES.map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-1.5">
                <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                  <Icon className="w-4 h-4 text-zinc-500" />
                </div>
                <p className="text-[9px] text-zinc-600">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Activity feed */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-3.5 h-3.5 text-violet-400" />
              <p className="text-xs font-semibold text-zinc-200">Atividade da IA</p>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-emerald-400">ao vivo</span>
            </div>
          </div>
          <div className="space-y-2.5">
            {feedEvents.map(a => (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-start gap-2.5"
              >
                <span className="text-sm shrink-0 mt-0.5">{a.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={cn('text-[11px]', a.color)}>{a.label}</p>
                  <p className="text-[10px] text-zinc-600">{formatRelative(a.time)}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Conversation selected — full lead intelligence panel ───────

  const score   = leadData?.score ?? 0
  const temp    = leadData?.temperatura ?? conv.temperatura ?? 'frio'
  const tempCfg = TEMP_MAP[temp] ?? TEMP_MAP.frio
  const convPct = leadData?.conversion_pct ?? (score >= 70 ? 72 : score >= 40 ? 48 : 28)

  const intentMap: Record<string, string> = {
    negociando: 'Alta', interessado: 'Média', qualificado: 'Média', novo: 'Baixa', cliente: 'Fechado'
  }
  const intentLabel = intentMap[leadData?.stage ?? ''] ?? (score >= 70 ? 'Alta' : score >= 40 ? 'Média' : 'Baixa')
  const intentColor = intentLabel === 'Alta' ? 'text-emerald-400' : intentLabel === 'Média' ? 'text-amber-400' : 'text-zinc-500'

  const momentoLabel = score >= 70 ? '🟢 Agora' : score >= 40 ? '🟡 Em breve' : '⚪ Sem urgência'

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      {/* AI Mode compact */}
      <div className="p-3 border-b border-zinc-800/60">
        <AIModeToggle mode={aiMode} onChange={onAIModeChange} />
      </div>

      {/* Contact card + ScoreRing */}
      <div className="p-4 border-b border-zinc-800/60">
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center gap-0.5 shrink-0">
            {/* V5: show real photo if available, else ScoreRing */}
            {conv.photo_url ? (
              <div className="flex flex-col items-center gap-0.5">
                <PhotoAvatar conv={conv} size="lg" showOnlineDot={false} />
                <ScoreRing score={score} />
              </div>
            ) : (
              <>
                <ScoreRing score={score} />
                <p className={cn('text-[8px] font-semibold', score >= 70 ? 'text-emerald-400' : score >= 40 ? 'text-amber-400' : 'text-zinc-500')}>
                  {score >= 70 ? 'Quente' : score >= 40 ? 'Morno' : 'Frio'}
                </p>
              </>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">
              {leadData?.name ?? displayName(conv)}
            </p>
            <p className="text-[10px] text-zinc-500">+{conv.phone}</p>
            {leadData?.empresa && (
              <p className="text-[10px] text-zinc-500 truncate">{leadData.empresa}</p>
            )}
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              {conv.label && LABEL_CONFIG[conv.label] && (
                <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full border', LABEL_CONFIG[conv.label].color, LABEL_CONFIG[conv.label].bg)}>
                  {LABEL_CONFIG[conv.label].label}
                </span>
              )}
              <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full border', tempCfg.color, tempCfg.bg)}>
                {tempCfg.label}
              </span>
            </div>
          </div>
        </div>
        {/* Opportunity metrics row */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="bg-zinc-900/60 border border-zinc-800/50 rounded-xl px-3 py-2">
            <p className="text-[9px] text-zinc-600 mb-0.5">Prob. fechar</p>
            <p className="text-xs font-bold text-white">{convPct}%</p>
          </div>
          <div className={cn(
            'border rounded-xl px-3 py-2',
            leadData?.estimated_revenue
              ? 'bg-emerald-500/8 border-emerald-500/15'
              : 'bg-zinc-900/60 border-zinc-800/50',
          )}>
            <p className="text-[9px] text-zinc-600 mb-0.5">Valor estimado</p>
            <p className={cn('text-xs font-bold', leadData?.estimated_revenue ? 'text-emerald-400' : 'text-zinc-600')}>
              {leadData?.estimated_revenue ?? '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Lead Analysis */}
      <div className="p-4 border-b border-zinc-800/60">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5 text-violet-400" />
            <p className="text-xs font-semibold text-zinc-200">Análise da IA</p>
          </div>
          {leadLoading ? (
            <Loader2 className="w-3 h-3 text-zinc-600 animate-spin" />
          ) : leadData?.has_real_data ? (
            <span className="text-[9px] text-emerald-400 bg-emerald-500/10 rounded-full px-1.5 py-0.5">IA real</span>
          ) : null}
        </div>

        {leadLoading && !leadData ? (
          <div className="flex items-center gap-2 py-3">
            <motion.div animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 1.5, repeat: Infinity }}>
              <Brain className="w-6 h-6 text-violet-400/40" />
            </motion.div>
            <p className="text-[11px] text-zinc-600">IA analisando conversa…</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            <ScoreBar label="Lead Score" value={score} color={score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-500' : 'bg-zinc-600'} />
            <div className="flex items-center justify-between pt-0.5">
              <p className="text-[10px] text-zinc-500">Intenção de compra</p>
              <p className={cn('text-[10px] font-semibold', intentColor)}>{intentLabel}</p>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-zinc-500">Momento ideal</p>
              <p className="text-[10px] font-medium text-zinc-300">{momentoLabel}</p>
            </div>
            {leadData?.stage && (
              <div className="flex items-center justify-between">
                <p className="text-[10px] text-zinc-500">Etapa</p>
                <p className="text-[10px] font-semibold text-violet-400">{STAGE_LABEL[leadData.stage] ?? leadData.stage}</p>
              </div>
            )}
          </div>
        )}
        {/* Next best action */}
        <div className="mt-3 bg-violet-500/8 border border-violet-500/20 rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles className="w-3 h-3 text-violet-400" />
            <p className="text-[9px] font-semibold text-violet-400 uppercase tracking-wider">Próxima ação sugerida</p>
          </div>
          <p className="text-[11px] text-zinc-300 leading-relaxed">
            {score >= 70
              ? 'Enviar proposta agora — lead demonstrou alto interesse e está pronto para fechar.'
              : score >= 40
              ? 'Follow-up com mais detalhes sobre benefícios e cases de sucesso.'
              : 'Qualificar com perguntas sobre orçamento, prazo e tomador de decisão.'}
          </p>
        </div>
      </div>

      {/* Tags / Context */}
      {leadData?.dores && leadData.dores.length > 0 && (
        <div className="p-4 border-b border-zinc-800/60">
          <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-2">Dores identificadas</p>
          <div className="flex flex-wrap gap-1.5">
            {leadData.dores.slice(0, 5).map((d, i) => (
              <span key={i} className="text-[10px] text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-full px-2 py-0.5">
                {d}
              </span>
            ))}
          </div>
          {leadData.objetivo && (
            <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed">
              <span className="text-zinc-600">Objetivo: </span>{leadData.objetivo}
            </p>
          )}
        </div>
      )}

      {/* Quick actions */}
      <div className="p-4 border-b border-zinc-800/60">
        <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-2.5">Ações rápidas</p>
        <div className="space-y-1.5">
          {[
            { icon: Image,       label: 'Enviar imagem',        color: 'text-blue-400',    action: onSendImage    },
            { icon: FileText,    label: 'Enviar catálogo',       color: 'text-violet-400',  action: onSendImage    },
            { icon: Target,      label: 'Enviar proposta',       color: 'text-emerald-400', action: onSendProposal },
            { icon: PhoneCall,   label: 'Iniciar ligação',       color: 'text-orange-400',  action: () => conv && window.open(`tel:+${conv.phone}`) },
            { icon: UserCheck,   label: 'Transferir atend.',     color: 'text-zinc-400',    action: onTransfer     },
          ].map(({ icon: Icon, label, color, action }) => (
            <button
              key={label}
              onClick={action}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-zinc-900/60 border border-zinc-800/60 hover:border-zinc-700/60 hover:bg-zinc-800/60 text-left transition-all group"
            >
              <Icon className={cn('w-3.5 h-3.5 shrink-0', color)} />
              <span className="text-[11px] text-zinc-400 group-hover:text-zinc-200 transition-colors">{label}</span>
              <ChevronRight className="w-3 h-3 text-zinc-700 ml-auto group-hover:text-zinc-500 transition-colors" />
            </button>
          ))}
        </div>
      </div>

      {/* Key metrics */}
      <div className="p-4 border-b border-zinc-800/60">
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-zinc-900/60 rounded-xl p-2.5">
            <p className="text-[9px] text-zinc-600 mb-0.5">Mensagens</p>
            <p className="text-sm font-bold text-white">{leadData?.message_count ?? conv.message_count}</p>
          </div>
          <div className="bg-zinc-900/60 rounded-xl p-2.5">
            <p className="text-[9px] text-zinc-600 mb-0.5">Último contato</p>
            <p className="text-sm font-bold text-white">{formatRelative(conv.last_message_at)}</p>
          </div>
          {leadData?.empresa && (
            <div className="col-span-2 bg-zinc-900/60 rounded-xl p-2.5">
              <p className="text-[9px] text-zinc-600 mb-0.5">Empresa</p>
              <p className="text-xs font-medium text-white truncate">{leadData.empresa}</p>
            </div>
          )}
        </div>
      </div>

      {/* Activity */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-violet-400" />
            <p className="text-xs font-semibold text-zinc-200">Atividade</p>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] text-emerald-400">ao vivo</span>
          </div>
        </div>
        <div className="space-y-2.5">
          {feedEvents.slice(0, 4).map(a => (
            <motion.div key={a.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} className="flex items-start gap-2.5">
              <span className="text-sm shrink-0 mt-0.5">{a.icon}</span>
              <div className="flex-1 min-w-0">
                <p className={cn('text-[11px]', a.color)}>{a.label}</p>
                <p className="text-[10px] text-zinc-600">{formatRelative(a.time)}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────

export default function WhatsAppPage() {
  const [conversations,  setConversations]  = useState<Conversation[]>([])
  const [messages,       setMessages]       = useState<Message[]>([])
  const [waStatus,       setWaStatus]       = useState<WAStatus | null>(null)
  const [selected,       setSelected]       = useState<Conversation | null>(null)
  const [loading,        setLoading]        = useState(true)
  const [loadingMsgs,    setLoadingMsgs]    = useState(false)
  const [sendingMsg,     setSendingMsg]     = useState(false)
  const [showConnect,    setShowConnect]    = useState(false)
  const [search,         setSearch]         = useState('')
  const [filter,         setFilter]         = useState<string>('all')
  const [inputText,      setInputText]      = useState('')
  const [showSuggestion, setShowSuggestion] = useState(false)
  const [suggestionIdx,  setSuggestionIdx]  = useState(0)
  const [showTyping,     setShowTyping]     = useState(false)
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([])
  const [companyId,      setCompanyId]      = useState<string | null>(null)
  const [leadData,       setLeadData]       = useState<LeadIntel | null>(null)
  const [leadLoading,    setLeadLoading]    = useState(false)
  const [aiMode,           setAiMode]           = useState<AIMode>('auto')
  const [showAutomacoes,   setShowAutomacoes]   = useState(false)
  const [showConfig,       setShowConfig]       = useState(false)
  const [showNewConv,      setShowNewConv]      = useState(false)
  const [aiSuggestion,     setAiSuggestion]     = useState<string | null>(null)
  const [suggestionLoading,setSuggestionLoading]= useState(false)
  const [automations, setAutomations] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {}
    try { return JSON.parse(localStorage.getItem('wa-automations') ?? '{}') } catch { return {} }
  })
  const [autoClose, setAutoClose] = useState(false)

  // V5: pagination + global search
  const [hasMore,        setHasMore]        = useState(false)
  const [loadingMore,    setLoadingMore]    = useState(false)
  const [searchResults,  setSearchResults]  = useState<SearchResult[]>([])
  const [searchLoading,  setSearchLoading]  = useState(false)
  const [searchMode,     setSearchMode]     = useState(false) // true when typing → shows overlay
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const messagesEnd    = useRef<HTMLDivElement>(null)
  const messagesBox    = useRef<HTMLDivElement>(null)
  const inputRef       = useRef<HTMLInputElement>(null)
  const fileInputRef   = useRef<HTMLInputElement>(null)
  const typingTimer    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevMsgCount   = useRef<number>(0)

  // Init autoClose from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setAutoClose(localStorage.getItem('wa_autoclose') === 'true')
    }
  }, [])

  const toggleAutoClose = useCallback(() => {
    const next = !autoClose
    setAutoClose(next)
    if (typeof window !== 'undefined') {
      localStorage.setItem('wa_autoclose', String(next))
    }
    fetch('/api/user/preferences', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ autoCloseEnabled: next }),
    }).catch(() => {})
  }, [autoClose])

  // V5: load more (cursor pagination)
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return
    const cursor = conversations[conversations.length - 1]?.last_message_at
    if (!cursor) return
    setLoadingMore(true)
    try {
      const res  = await fetch(`/api/whatsapp/conversations?cursor=${encodeURIComponent(cursor)}`)
      if (!res.ok) return
      const data = await res.json()
      const more: Conversation[] = data.conversations ?? []
      setHasMore(data.has_more ?? false)
      setConversations(prev => {
        const ids = new Set(prev.map(c => c.id))
        return [...prev, ...more.filter(c => !ids.has(c.id))]
      })
    } catch (e) {
      console.error('[WA] loadMore failed:', e)
    } finally {
      setLoadingMore(false)
    }
  }, [loadingMore, hasMore, conversations])

  // V5: global search (debounced, server-side)
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value)
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (value.trim().length < 2) {
      setSearchMode(false)
      setSearchResults([])
      return
    }
    setSearchMode(true)
    setSearchLoading(true)
    searchTimer.current = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/nexus/whatsapp/search?q=${encodeURIComponent(value.trim())}`)
        const data = await res.json()
        setSearchResults(data.results ?? [])
      } catch { /* ignore */ } finally {
        setSearchLoading(false)
      }
    }, 350)
  }, [])

  // ── Fetchers ──────────────────────────────────────────────────

  const fetchStatus = useCallback(async () => {
    try {
      const res  = await fetch('/api/nexus/whatsapp/status')
      const data = await res.json() as WAStatus
      setWaStatus(data)
    } catch { /* ignore */ }
  }, [])

  const fetchConversations = useCallback(async () => {
    try {
      const res  = await fetch('/api/whatsapp/conversations')
      if (!res.ok) {
        console.error('[WA] conversations API error:', res.status, await res.text().catch(() => ''))
        return
      }
      const data = await res.json()
      const next: Conversation[] = data.conversations ?? []
      setHasMore(data.has_more ?? false)
      setConversations(prev => {
        if (next.length === 0 && prev.length === 0) return prev
        if (
          next.length === prev.length &&
          next.every((c, i) =>
            c.id              === prev[i]?.id &&
            c.last_message_at === prev[i]?.last_message_at &&
            (c.unread ?? 0)   === (prev[i]?.unread ?? 0) &&
            c.status          === prev[i]?.status
          )
        ) return prev
        return next
      })
    } catch (e) {
      console.error('[WA] fetchConversations failed:', e)
    }
  }, [])

  // showSpinner=true only on the first load when opening a conversation.
  // Background polls (every 3s) pass showSpinner=false so the message list
  // never unmounts/remounts and the UI never flickers or jumps.
  const fetchMessages = useCallback(async (convId: string, showSpinner = false) => {
    if (showSpinner) setLoadingMsgs(true)
    try {
      const res  = await fetch(`/api/whatsapp/messages?conversationId=${convId}&limit=100`)
      if (!res.ok) {
        console.error('[WA] messages API error:', res.status, await res.text().catch(() => ''))
        return
      }
      const data = await res.json()
      const next: Message[] = data.messages ?? []
      setMessages(prev => {
        // Strip optimistic messages that now have a real server counterpart.
        // Match by: same content + direction + within 30s of creation.
        const optimistics = prev.filter(m => m.id.startsWith('opt-'))
        const real        = new Set(next.map(m => m.id))

        // For each optimistic, try to find a matching real message
        const reconciledOpts = new Set<string>()
        for (const opt of optimistics) {
          if (real.has(opt.id)) continue  // shouldn't happen but guard
          const optTime = new Date(opt.created_at).getTime()
          const match   = next.find(
            r => r.direction === opt.direction &&
                 r.content   === opt.content   &&
                 Math.abs(new Date(r.created_at).getTime() - optTime) < 30_000
          )
          if (match) reconciledOpts.add(opt.id)
        }

        // If nothing changed at all, bail early (no re-render)
        const prevIds = prev.filter(m => !reconciledOpts.has(m.id)).map(m => m.id)
        const nextIds = next.map(m => m.id)
        const sameContent =
          prevIds.length === nextIds.length &&
          prevIds[prevIds.length - 1] === nextIds[nextIds.length - 1]
        if (sameContent && reconciledOpts.size === 0) return prev

        // Build merged list: keep existing objects where possible
        const prevById    = new Map(prev.map(m => [m.id, m]))
        const withoutOpts = prev.filter(m => !reconciledOpts.has(m.id))
        const prevRealIds = new Set(withoutOpts.filter(m => !m.id.startsWith('opt-')).map(m => m.id))
        const added       = next.filter(m => !prevRealIds.has(m.id))

        // Reuse existing objects for unchanged messages to preserve memo
        const merged = [
          ...withoutOpts.filter(m => m.id.startsWith('opt-')), // keep un-reconciled optimistics
          ...next.map(m => prevById.get(m.id) ?? m),           // prefer cached object
        ].filter((m, i, arr) => arr.findIndex(x => x.id === m.id) === i)   // dedupe

        // Stable check: if merged is identical to prev by IDs, return prev reference
        if (merged.length === prev.length && merged.every((m, i) => m.id === prev[i]?.id)) {
          return prev
        }

        void added  // used implicitly through merged
        return merged
      })
    } catch (e) {
      console.error('[WA] fetchMessages failed:', e)
    } finally {
      if (showSpinner) setLoadingMsgs(false)
    }
  }, [])

  const fetchActivity = useCallback(async () => {
    try {
      const res  = await fetch('/api/nexus/whatsapp/activity')
      const data = await res.json()
      setActivityEvents(data.events ?? [])
    } catch { /* ignore */ }
  }, [])

  const fetchCompanyId = useCallback(async () => {
    try {
      const res  = await fetch('/api/nexus/whatsapp/company')
      const data = await res.json()
      setCompanyId(data.company_id ?? null)
    } catch { /* ignore */ }
  }, [])

  const fetchLeadData = useCallback(async (convId: string) => {
    setLeadLoading(true)
    setLeadData(null)
    try {
      const res  = await fetch(`/api/nexus/whatsapp/lead?conversation_id=${convId}`)
      const data = await res.json()
      setLeadData(data.lead ?? null)
    } catch { /* ignore */ } finally {
      setLeadLoading(false)
    }
  }, [])

  const fetchSuggestion = useCallback(async (convId: string) => {
    setSuggestionLoading(true)
    setAiSuggestion(null)
    try {
      const res  = await fetch('/api/nexus/whatsapp/suggest', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ conversation_id: convId }),
      })
      const data = await res.json()
      setAiSuggestion(data.suggestion ?? null)
    } catch { /* ignore */ } finally {
      setSuggestionLoading(false)
    }
  }, [])

  const toggleAutomation = useCallback((key: string) => {
    setAutomations(prev => {
      const next = { ...prev, [key]: !prev[key] }
      try { localStorage.setItem('wa-automations', JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [])

  // ── Send image ─────────────────────────────────────────────────

  const handleSendImage = useCallback(async (file: File) => {
    if (!selected) return
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = (reader.result as string)
      setSendingMsg(true)
      const caption = ''
      const optimisticMsg: Message = {
        id:           `opt-img-${Date.now()}`,
        direction:    'outgoing',
        content:      '📷 Imagem',
        from_me:      true,
        ai_generated: false,
        status:       'sent',
        created_at:   new Date().toISOString(),
      }
      setMessages(prev => [...prev, optimisticMsg])
      try {
        await fetch('/api/nexus/whatsapp/send-image', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            phone:           selected.phone,
            image:           base64,
            caption,
            conversation_id: selected.id,
          }),
        })
      } catch { /* ignore */ } finally {
        setSendingMsg(false)
      }
    }
    reader.readAsDataURL(file)
  }, [selected])

  const handleTransfer = useCallback(async () => {
    if (!selected) return
    const note = window.prompt('Nota de transferência (opcional):') ?? undefined
    try {
      await fetch('/api/nexus/whatsapp/transfer', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ conversation_id: selected.id, note }),
      })
      setConversations(prev => prev.map(c => c.id === selected.id ? { ...c, ai_enabled: false } : c))
      setSelected(prev => prev ? { ...prev, ai_enabled: false } : prev)
    } catch { /* ignore */ }
  }, [selected])

  const handleSendProposal = useCallback(async () => {
    if (!selected) return
    const proposal =
      `Olá${leadData?.name ? ', ' + leadData.name : ''}! 👋\n\n` +
      `Preparei uma proposta personalizada para você baseada nas suas necessidades.\n\n` +
      `✅ Solução completa para seu negócio\n` +
      `✅ Implementação em até 7 dias\n` +
      `✅ Suporte dedicado\n\n` +
      `Posso te enviar os detalhes por aqui ou prefere uma reunião rápida de 20 minutos?`
    setInputText(proposal)
    inputRef.current?.focus()
  }, [selected, leadData])

  // ── Send message ──────────────────────────────────────────────

  const handleSend = useCallback(async (textOverride?: string) => {
    const text = (textOverride ?? inputText).trim()
    if (!selected || !text || sendingMsg) return

    setInputText('')
    setSendingMsg(true)
    setShowSuggestion(false)

    const optimisticMsg: Message = {
      id:           `opt-${Date.now()}`,
      direction:    'outgoing',
      content:      text,
      from_me:      true,
      ai_generated: false,
      status:       'sent',
      created_at:   new Date().toISOString(),
    }
    setMessages(prev => [...prev, optimisticMsg])

    try {
      const res = await fetch('/api/nexus/whatsapp/send', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          phone:           selected.phone,
          message:         text,
          conversation_id: selected.id,
        }),
      })
      if (!res.ok) {
        setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id))
        setInputText(text)
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== optimisticMsg.id))
      setInputText(text)
    } finally {
      setSendingMsg(false)
    }
  }, [selected, inputText, sendingMsg])

  // ── Realtime subscriptions ────────────────────────────────────

  useEffect(() => {
    if (!companyId) return
    const supabase = getSupabaseBrowser()

    // 1. New messages → append to open chat + refresh conversation list
    const msgChannel = supabase
      .channel(`wa-messages-${companyId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'whatsapp_messages',
        filter: `company_id=eq.${companyId}`,
      }, payload => {
        const newMsg = payload.new as Message & { conversation_id: string }

        setSelected(sel => {
          if (sel && newMsg.conversation_id === sel.id) {
            setMessages(prev => {
              if (prev.some(m => m.id === newMsg.id)) return prev
              // Reconcile optimistic: if a pending optimistic matches this real msg, replace it
              const msgTime = new Date(newMsg.created_at).getTime()
              const optIdx  = prev.findIndex(
                m => m.id.startsWith('opt-') &&
                     m.direction === newMsg.direction &&
                     m.content   === newMsg.content &&
                     Math.abs(new Date(m.created_at).getTime() - msgTime) < 30_000
              )
              if (optIdx !== -1) {
                const next = [...prev]
                next[optIdx] = newMsg
                return next
              }
              return [...prev, newMsg]
            })
            if (newMsg.direction === 'incoming') {
              setShowTyping(true)
              if (typingTimer.current) clearTimeout(typingTimer.current)
              typingTimer.current = setTimeout(() => setShowTyping(false), 5000)
            }
          }
          return sel
        })

        fetchConversations()
        fetchActivity()
      })
      .subscribe()

    // 2. Conversation updates → patch local state without full refetch
    //    (handles last_message_at, unread_count, temperatura, label changes)
    const convChannel = supabase
      .channel(`wa-conversations-${companyId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'whatsapp_conversations',
        filter: `company_id=eq.${companyId}`,
      }, payload => {
        if (payload.eventType === 'INSERT') {
          const c = payload.new as Conversation & { unread_count?: number }
          setConversations(prev => {
            if (prev.some(x => x.id === c.id)) return prev
            return [{ ...c, unread: c.unread_count ?? 0 }, ...prev]
          })
        } else if (payload.eventType === 'UPDATE') {
          const c = payload.new as Conversation & { unread_count?: number }
          setConversations(prev =>
            prev.map(x => x.id === c.id ? { ...c, unread: c.unread_count ?? 0 } : x)
          )
          // Keep selected in sync (name, temperatura, etc.)
          setSelected(sel =>
            sel?.id === c.id ? { ...sel, ...c, unread: c.unread_count ?? 0 } : sel
          )
        }
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(msgChannel)
      void supabase.removeChannel(convChannel)
    }
  }, [companyId, fetchConversations, fetchActivity])

  // ── Init ──────────────────────────────────────────────────────

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetchStatus(),
      fetchConversations(),
      fetchCompanyId(),
      fetchActivity(),
    ]).finally(() => setLoading(false))

    // Refresh conversations more frequently so new ones appear quickly
    const statusTimer   = setInterval(() => { fetchStatus(); fetchConversations() }, 3_000)
    const activityTimer = setInterval(fetchActivity, 15_000)

    return () => { clearInterval(statusTimer); clearInterval(activityTimer) }
  }, [fetchStatus, fetchConversations, fetchCompanyId, fetchActivity])

  // Poll messages every 3s (Realtime fallback)
  useEffect(() => {
    if (!selected) return
    const t = setInterval(() => fetchMessages(selected.id), 3000)
    return () => clearInterval(t)
  }, [selected, fetchMessages])

  // Scroll to bottom ONLY when a genuinely new message arrives
  useEffect(() => {
    const newCount = messages.length
    const oldCount = prevMsgCount.current

    if (newCount > oldCount) {
      const box = messagesBox.current
      const isNearBottom = !box || (box.scrollHeight - box.scrollTop - box.clientHeight < 120)

      if (isNearBottom) {
        messagesEnd.current?.scrollIntoView({ behavior: newCount - oldCount === 1 ? 'smooth' : 'instant' })
      }
    }

    prevMsgCount.current = newCount
  }, [messages])

  // ── Derived ───────────────────────────────────────────────────

  const plan      = usePlan()
  const connected = waStatus?.connected ?? false

  const aiActiveConvs     = conversations.filter(c => c.ai_enabled).length
  const activeAgentsCount = Math.max(1,
    1 +                                     // base NEXUS AI
    (aiMode !== 'manual' ? 1 : 0) +        // AI mode agent
    (autoClose ? 1 : 0) +                  // AutoClose agent
    (aiActiveConvs > 0 ? 1 : 0),           // conversation AI agent
  )

  const FILTERS = [
    { key: 'all',     label: 'Todas',         count: conversations.length },
    { key: 'unread',  label: 'Não lidas',     count: conversations.filter(c => (c.unread ?? 0) > 0).length },
    { key: 'leads',   label: 'Leads quentes', count: conversations.filter(c => c.label === 'lead' || c.temperatura === 'quente').length },
    { key: 'clients', label: 'Clientes',      count: conversations.filter(c => c.label === 'cliente').length },
    { key: 'nego',    label: 'Negociações',   count: conversations.filter(c => c.label === 'negociacao').length },
    { key: 'ai',      label: 'IA ativa',      count: conversations.filter(c => c.ai_enabled).length },
    { key: 'closed',  label: 'Arquivadas',    count: conversations.filter(c => c.status === 'closed').length },
  ]

  const visibleConvs = conversations.filter(c => {
    if (search) return displayName(c).toLowerCase().includes(search.toLowerCase())
    switch (filter) {
      case 'unread':  return (c.unread ?? 0) > 0
      case 'leads':   return c.label === 'lead' || c.temperatura === 'quente'
      case 'clients': return c.label === 'cliente'
      case 'nego':    return c.label === 'negociacao'
      case 'ai':      return c.ai_enabled
      case 'closed':  return c.status === 'closed'
      default:        return true
    }
  })

  const kpis = [
    { label: 'Conversas ativas',    value: conversations.filter(c => c.status === 'active').length,       sub: 'ao vivo',        icon: MessageCircle, color: 'text-violet-400',  glow: 'shadow-violet-500/10'  },
    { label: 'Mensagens',           value: conversations.reduce((a, c) => a + c.message_count, 0),         sub: 'total trocadas', icon: Zap,           color: 'text-blue-400',    glow: 'shadow-blue-500/10'    },
    { label: 'Leads quentes',       value: conversations.filter(c => c.temperatura === 'quente').length,   sub: 'em andamento',   icon: Users,         color: 'text-orange-400',  glow: 'shadow-orange-500/10'  },
    { label: 'Oportunidades',       value: conversations.filter(c => c.label === 'negociacao').length,     sub: 'negociando',     icon: TrendingUp,    color: 'text-emerald-400', glow: 'shadow-emerald-500/10' },
    { label: 'IA respondendo',      value: aiActiveConvs,                                                   sub: 'em tempo real',  icon: Bot,           color: 'text-violet-400',  glow: 'shadow-violet-500/10'  },
  ]

  function handleSelectConv(conv: Conversation) {
    // Optimistically clear unread badge before the server confirms
    setConversations(prev =>
      prev.map(c => c.id === conv.id ? { ...c, unread: 0 } : c)
    )
    setSelected({ ...conv, unread: 0 })
    setMessages([])                         // clear previous conversation messages immediately
    fetchMessages(conv.id, true)            // true = show spinner on first load only
    fetchLeadData(conv.id)
    setAiSuggestion(null)
    setShowSuggestion(aiMode !== 'manual')
    if (aiMode !== 'manual') fetchSuggestion(conv.id)
    setSuggestionIdx(0)
    setShowTyping(false)

    // Fire-and-forget: reset unread_count in DB
    fetch('/api/nexus/whatsapp/read', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ conversation_id: conv.id }),
    }).catch(() => {})
  }

  // ── Plan gate: PRO+ required for WhatsApp ────────────────────────────────

  if (plan && !canAccess(plan, 'whatsapp')) {
    return <UpgradeCard requiredPlan="Pro" feature="WhatsApp AI" />
  }

  // ── Loading ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
          <p className="text-xs text-zinc-600">Carregando NEXUS…</p>
        </div>
      </div>
    )
  }

  // ── Not connected ─────────────────────────────────────────────

  if (!connected) {
    return (
      <>
        <OnboardingView onConnect={() => setShowConnect(true)} />
        {showConnect && (
          <ConnectModal
            onClose={() => setShowConnect(false)}
            onConnected={() => {
              setShowConnect(false)
              fetchStatus()
              fetchConversations()
              fetchActivity()
            }}
          />
        )}
      </>
    )
  }

  // ── Connected: WhatsApp OS ─────────────────────────────────────

  return (
    <div className="h-screen bg-zinc-950 flex flex-col overflow-hidden">

      {/* ── Header ── */}
      <div className="shrink-0 flex items-center justify-between px-6 py-3.5 border-b border-zinc-800/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
            <MessageCircle className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-bold text-white">WhatsApp AI</h1>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-500/15 border border-emerald-500/25 rounded-full px-2 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Conectado
              </div>
              {waStatus?.phone && (
                <span className="text-[11px] text-zinc-500">+{waStatus.phone}</span>
              )}
            </div>
            <p className="text-xs text-zinc-500">Atendimento inteligente · automações · oportunidades em tempo real</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* IA Operacional badge */}
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-full px-3 py-1 mr-1">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            IA Operacional · {activeAgentsCount} agente{activeAgentsCount !== 1 ? 's' : ''} ativo{activeAgentsCount !== 1 ? 's' : ''}
          </div>
          {/* AutoClose toggle */}
          <button
            onClick={toggleAutoClose}
            className={cn(
              'flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition font-medium',
              autoClose
                ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/15 shadow-sm shadow-emerald-500/10'
                : 'text-zinc-400 bg-zinc-900 border-zinc-800 hover:border-zinc-700 hover:text-zinc-200',
            )}
          >
            <Zap className="w-3.5 h-3.5" />
            {autoClose ? 'AutoClose ON' : 'AutoClose'}
          </button>
          <button
            onClick={() => setShowConfig(true)}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition"
          >
            <Settings className="w-3.5 h-3.5" /> Config
          </button>
          <button
            onClick={() => setShowNewConv(true)}
            className="flex items-center gap-1.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 px-4 py-1.5 rounded-lg transition shadow-lg shadow-violet-600/20"
          >
            <Plus className="w-3.5 h-3.5" /> Nova mensagem
          </button>
        </div>
      </div>

      {/* ── KPI row ── */}
      <div className="shrink-0 grid grid-cols-5 gap-2 px-6 py-3 border-b border-zinc-800/60">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon
          // Deterministic mini sparkline based on current value
          const sparkPts = [0.4, 0.55, 0.45, 0.7, 0.6, 0.8, 0.75, 1.0].map((r, i) => {
            const base = Math.max(0, kpi.value - Math.round(kpi.value * (1 - r) * 0.6))
            return base + ((idx * 3 + i * 7) % 5)
          })
          const maxSpark = Math.max(...sparkPts, 1)
          const W = 56, H = 20
          const pts = sparkPts.map((v, i) => `${Math.round((i / (sparkPts.length - 1)) * W)},${Math.round(H - (v / maxSpark) * H)}`).join(' ')
          const deltas = ['+12%', '+18%', '+8%', '+15%', '+5%']
          return (
            <div key={kpi.label} className={cn(
              'relative flex flex-col gap-2 rounded-xl px-3.5 py-3 border overflow-hidden transition-all hover:border-zinc-700/80',
              'bg-gradient-to-br from-zinc-900/90 to-zinc-900/40 border-zinc-800/60',
              'shadow-lg', kpi.glow,
            )}>
              {/* Ambient glow */}
              <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition pointer-events-none"
                style={{ background: `radial-gradient(circle at 50% 0%, ${kpi.color.replace('text-', '').replace('-400', '')} 0%, transparent 60%)`, opacity: 0.04 }} />
              <div className="flex items-start justify-between">
                <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', 'bg-zinc-800/80')}>
                  <Icon className={cn('w-3.5 h-3.5', kpi.color)} />
                </div>
                <span className="text-[10px] font-semibold text-emerald-400">{deltas[idx]}</span>
              </div>
              <div>
                <p className="text-xl font-black text-white leading-none tabular-nums">{kpi.value}</p>
                <p className="text-[10px] text-zinc-500 leading-tight mt-0.5 truncate">{kpi.label}</p>
              </div>
              {/* Sparkline */}
              <svg width={W} height={H} className="opacity-60">
                <polyline points={pts} fill="none" stroke="currentColor"
                  strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                  className={kpi.color} />
              </svg>
            </div>
          )
        })}
      </div>

      {/* ── 3-column layout ── */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Left: Smart Inbox ── */}
        <div className="w-72 shrink-0 flex flex-col border-r border-zinc-800/60 bg-zinc-950 overflow-hidden">

          {/* Connection badge — compact strip */}
          <div className="shrink-0 flex items-center justify-between px-3 py-2 border-b border-zinc-800/60">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-semibold text-emerald-400">WhatsApp Ativo</span>
              {waStatus?.phone && <span className="text-[10px] text-zinc-600">+{waStatus.phone}</span>}
            </div>
            <button
              onClick={() => setShowConnect(true)}
              className="text-[10px] text-violet-400 hover:text-violet-300 border border-violet-500/30 rounded-lg px-2 py-1 transition"
            >
              QR
            </button>
          </div>

          {/* V5 Search — real-time server search */}
          <div className="px-3 pb-2 pt-1">
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800/60 rounded-xl px-3 py-2">
              {searchLoading
                ? <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin shrink-0" />
                : <Search className="w-3.5 h-3.5 text-zinc-500 shrink-0" />}
              <input
                type="text"
                placeholder="Buscar por nome, telefone, mensagem…"
                value={search}
                onChange={e => handleSearchChange(e.target.value)}
                className="flex-1 bg-transparent text-xs text-zinc-300 placeholder-zinc-600 outline-none"
              />
              {search && (
                <button
                  onClick={() => { handleSearchChange(''); setFilter('all') }}
                  className="text-zinc-600 hover:text-zinc-300 transition shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Compact horizontal filter tabs — like WhatsApp Web */}
          <div className="shrink-0 flex gap-1 px-2 pb-2 overflow-x-auto scrollbar-none">
            {FILTERS.map(f => (
              <button
                key={f.key}
                onClick={() => { setFilter(f.key); setSearch('') }}
                className={cn(
                  'shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all whitespace-nowrap',
                  filter === f.key && !search
                    ? 'bg-violet-600 text-white'
                    : 'text-zinc-400 bg-zinc-800/60 hover:bg-zinc-700/60 hover:text-zinc-200',
                )}
              >
                {f.label}
                {f.count > 0 && (
                  <span className={cn(
                    'text-[10px] font-bold tabular-nums',
                    filter === f.key && !search ? 'text-violet-200' : 'text-zinc-500',
                  )}>
                    {f.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Conversation list — with V5 search overlay + pagination */}
          <div className="flex-1 min-h-0 overflow-y-auto border-t border-zinc-800/40 relative">

            {/* V5: Global search overlay */}
            {searchMode && (
              <GlobalSearchOverlay
                query={search}
                results={searchResults}
                loading={searchLoading}
                onSelect={r => {
                  handleSearchChange('')
                  setSearchMode(false)
                  handleSelectConv(r)
                }}
                onClose={() => { handleSearchChange(''); setSearchMode(false) }}
              />
            )}

            {visibleConvs.length === 0 && !searchMode ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
                <motion.div
                  animate={{ opacity: [0.4, 0.9, 0.4] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-10 h-10 rounded-2xl bg-violet-600/10 border border-violet-500/15 flex items-center justify-center"
                >
                  <Bot className="w-5 h-5 text-violet-400/50" />
                </motion.div>
                <div>
                  <p className="text-xs font-medium text-zinc-500">
                    {conversations.length === 0
                      ? 'IA aguardando primeiras mensagens'
                      : 'Nenhuma conversa neste filtro'}
                  </p>
                  {conversations.length === 0 && (
                    <p className="text-[10px] text-zinc-700 mt-1">Quando alguém enviar mensagem, aparece aqui</p>
                  )}
                </div>
                {conversations.length === 0 && (
                  <div className="flex items-center gap-1.5 text-[10px] text-violet-400 bg-violet-500/8 border border-violet-500/15 rounded-full px-3 py-1.5">
                    <span className="w-1 h-1 rounded-full bg-violet-400 animate-pulse" />
                    Monitorando canal
                  </div>
                )}
              </div>
            ) : !searchMode ? (
              <>
                {visibleConvs.map(c => (
                  <ConvItem
                    key={c.id}
                    conv={c}
                    active={selected?.id === c.id}
                    onClick={() => handleSelectConv(c)}
                  />
                ))}
                {/* V5: Load more pagination */}
                {hasMore && !search && (
                  <div className="p-3 text-center">
                    <button
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="flex items-center gap-2 mx-auto text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-800 rounded-xl px-4 py-2 transition hover:border-zinc-700 disabled:opacity-50"
                    >
                      {loadingMore ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      {loadingMore ? 'Carregando…' : 'Carregar mais'}
                    </button>
                  </div>
                )}
              </>
            ) : null}
          </div>

          {/* AUTOMAÇÕES section */}
          <div className="border-t border-zinc-800/60 shrink-0">
            <button
              onClick={() => setShowAutomacoes(v => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-zinc-900/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-violet-400" />
                <span className="text-xs font-semibold text-zinc-300">AUTOMAÇÕES</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <ChevronDown className={cn('w-3.5 h-3.5 text-zinc-500 transition-transform', showAutomacoes && 'rotate-180')} />
              </div>
            </button>
            {showAutomacoes && (
              <div className="px-3 pb-3 space-y-1">
                {[
                  { key: 'auto-replies',  icon: '⚡', label: 'Respostas automáticas', defaultOn: true  },
                  { key: 'scheduled',     icon: '🕐', label: 'Mensagens programadas', defaultOn: false },
                  { key: 'followups',     icon: '🔄', label: 'Follow-ups',            defaultOn: true  },
                  { key: 'campaigns',     icon: '📢', label: 'Campanhas',             defaultOn: false },
                  { key: 'smart-flows',   icon: '🔀', label: 'Fluxos inteligentes',   defaultOn: false },
                ].map(a => {
                  const active = a.key in automations ? automations[a.key] : a.defaultOn
                  return (
                    <div
                      key={a.key}
                      onClick={() => toggleAutomation(a.key)}
                      className="flex items-center justify-between px-3 py-1.5 rounded-lg hover:bg-zinc-800/40 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{a.icon}</span>
                        <span className="text-[11px] text-zinc-400">{a.label}</span>
                      </div>
                      <div className={cn(
                        'w-8 h-4 rounded-full relative transition-colors',
                        active ? 'bg-violet-600' : 'bg-zinc-700',
                      )}>
                        <div className={cn(
                          'absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all shadow-sm',
                          active ? 'left-4.5' : 'left-0.5',
                        )} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="p-3 border-t border-zinc-800/60">
            <button
              onClick={() => setShowNewConv(true)}
              className="w-full flex items-center justify-center gap-2 text-xs text-zinc-600 hover:text-zinc-400 py-2 transition"
            >
              <Plus className="w-3.5 h-3.5" /> Nova conversa
            </button>
          </div>
        </div>

        {/* ── Center: Chat ── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950/50">
          {selected ? (
            <>
              {/* Chat header */}
              <div className="shrink-0 flex items-center justify-between px-5 py-3 border-b border-zinc-800/60 bg-zinc-950">
                <div className="flex items-center gap-3">
                  {/* V5: real photo in chat header */}
                  <PhotoAvatar conv={selected} size="md" online={isOnline(selected.last_message_at)} />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white">{displayName(selected)}</p>
                      {selected.pipeline_stage && (
                        <span className="text-[9px] font-semibold text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-full px-1.5 py-0.5">
                          {STAGE_LABEL[selected.pipeline_stage] ?? selected.pipeline_stage}
                        </span>
                      )}
                      {selected.label && (
                        <span className={cn(
                          'text-[10px] font-medium px-1.5 py-0.5 rounded-full border',
                          LABEL_CONFIG[selected.label]?.color,
                          LABEL_CONFIG[selected.label]?.bg,
                        )}>
                          {LABEL_CONFIG[selected.label]?.label}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-500">
                      {aiMode === 'auto'
                        ? '🤖 IA ativa · Respondendo automaticamente'
                        : aiMode === 'hybrid'
                        ? '🔀 Modo híbrido · IA sugere, você aprova'
                        : `📱 Modo manual · +${selected.phone}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="w-7 h-7 rounded-lg hover:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition">
                    <Star className="w-3.5 h-3.5" />
                  </button>
                  <button className="w-7 h-7 rounded-lg hover:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition">
                    <Tag className="w-3.5 h-3.5" />
                  </button>
                  <button className="w-7 h-7 rounded-lg hover:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition">
                    <Bell className="w-3.5 h-3.5" />
                  </button>
                  <button className="w-7 h-7 rounded-lg hover:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition">
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div ref={messagesBox} className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
                {loadingMsgs ? (
                  <div className="flex items-center justify-center flex-1 gap-3">
                    <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center flex-1 gap-4">
                    <motion.div
                      animate={{ opacity: [0.4, 0.8, 0.4] }}
                      transition={{ duration: 2.5, repeat: Infinity }}
                      className="w-12 h-12 rounded-2xl bg-violet-600/10 border border-violet-500/15 flex items-center justify-center"
                    >
                      <MessageSquare className="w-6 h-6 text-violet-400/40" />
                    </motion.div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-zinc-500">Nenhuma mensagem ainda</p>
                      <p className="text-xs text-zinc-700 mt-1">IA monitorando este canal. Envie a primeira mensagem.</p>
                    </div>
                  </div>
                ) : (
                  messages.map(m => <Bubble key={m.id} msg={m} />)
                )}

                {/* Typing indicator */}
                <AnimatePresence>
                  {showTyping && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      className="flex items-center gap-2.5"
                    >
                      <div className="w-7 h-7 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-400">
                        {initials(selected)}
                      </div>
                      <div className="bg-zinc-800 border border-zinc-700/60 rounded-2xl rounded-tl-md px-4 py-2.5 flex items-center gap-1">
                        {[0, 1, 2].map(i => (
                          <motion.div
                            key={i}
                            animate={{ y: [0, -3, 0] }}
                            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                            className="w-1.5 h-1.5 rounded-full bg-zinc-500"
                          />
                        ))}
                      </div>
                      <p className="text-xs text-zinc-600">{displayName(selected)} digitando…</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div ref={messagesEnd} />
              </div>

              {/* AI suggestion — hybrid & auto mode */}
              <AnimatePresence>
                {showSuggestion && aiMode !== 'manual' && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    className="shrink-0 mx-5 mb-2"
                  >
                    <div className="bg-zinc-900 border border-violet-500/20 rounded-2xl p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="w-3 h-3 text-violet-400" />
                          <p className="text-[11px] text-violet-400 font-medium">
                            {aiMode === 'hybrid' ? 'Rascunho da IA — aguardando aprovação' : 'Resposta inteligente sugerida'}
                          </p>
                        </div>
                        <button onClick={() => setShowSuggestion(false)} className="text-zinc-600 hover:text-zinc-400">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {suggestionLoading ? (
                        <div className="flex items-center gap-2 py-2">
                          <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />
                          <p className="text-[11px] text-zinc-500">IA gerando resposta…</p>
                        </div>
                      ) : (
                        <>
                          <p className="text-xs text-zinc-400 leading-relaxed mb-3">
                            {aiSuggestion ?? QUICK_REPLIES[suggestionIdx]}
                          </p>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => {
                                const text = aiSuggestion ?? QUICK_REPLIES[suggestionIdx]
                                if (aiMode === 'hybrid') {
                                  handleSend(text)
                                } else {
                                  setInputText(text)
                                  setShowSuggestion(false)
                                  inputRef.current?.focus()
                                }
                              }}
                              className="flex items-center gap-1.5 text-xs text-white bg-violet-600 hover:bg-violet-500 px-3 py-1.5 rounded-lg transition"
                            >
                              <Check className="w-3 h-3" />
                              {aiMode === 'hybrid' ? 'Aprovar e Enviar' : 'Usar'}
                            </button>
                            <button
                              onClick={() => { if (selected) fetchSuggestion(selected.id) }}
                              className="text-xs text-zinc-500 hover:text-zinc-300 transition"
                            >
                              ↺ Nova sugestão
                            </button>
                            <button
                              onClick={() => {
                                const text = aiSuggestion ?? QUICK_REPLIES[suggestionIdx]
                                setInputText(text)
                                setShowSuggestion(false)
                                inputRef.current?.focus()
                              }}
                              className="text-xs text-zinc-500 hover:text-zinc-300 transition ml-auto"
                            >
                              ✏️ Editar
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action chips */}
              <div className="shrink-0 px-5 pt-2 pb-1 flex items-center gap-2 overflow-x-auto scrollbar-none">
                {[
                  { icon: '🤖', label: 'Resposta inteligente', onClick: () => { setShowSuggestion(true); setSuggestionIdx(0); if (selected) fetchSuggestion(selected.id) } },
                  { icon: '📄', label: 'Enviar proposta',      onClick: handleSendProposal },
                  { icon: '📷', label: 'Enviar imagem',        onClick: () => fileInputRef.current?.click() },
                  { icon: '🔄', label: 'Transferir',           onClick: handleTransfer },
                ].map(chip => (
                  <button
                    key={chip.label}
                    onClick={chip.onClick}
                    className="flex items-center gap-1.5 text-[11px] text-zinc-400 bg-zinc-900/60 border border-zinc-800/60 hover:border-violet-500/30 hover:text-violet-300 hover:bg-violet-500/5 rounded-full px-3 py-1.5 shrink-0 transition-all"
                  >
                    <span className="text-xs">{chip.icon}</span>
                    {chip.label}
                  </button>
                ))}
              </div>

              {/* Input bar */}
              <div className="shrink-0 px-5 py-3 border-t border-zinc-800/60 bg-zinc-950">
                {/* Hidden file input for image upload */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) handleSendImage(file)
                    e.target.value = ''
                  }}
                />
                <div className="flex items-center gap-3">
                  <button className="w-8 h-8 rounded-lg hover:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition shrink-0">
                    <Smile className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-8 h-8 rounded-lg hover:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition shrink-0"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>
                  <div className="flex-1 bg-zinc-900 border border-zinc-800/60 rounded-2xl px-4 py-2.5 flex items-center gap-2">
                    <input
                      ref={inputRef}
                      type="text"
                      placeholder={
                        aiMode === 'auto'   ? 'IA respondendo automaticamente… ou escreva manualmente' :
                        aiMode === 'hybrid' ? 'Escreva ou use a sugestão da IA acima' :
                                             'Digite sua mensagem...'
                      }
                      value={inputText}
                      onChange={e => setInputText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void handleSend() } }}
                      disabled={sendingMsg}
                      className="flex-1 bg-transparent text-sm text-zinc-200 placeholder-zinc-600 outline-none disabled:opacity-50"
                    />
                    {aiMode !== 'manual' && (
                      <button
                        onClick={() => { setShowSuggestion(true); setSuggestionIdx(0) }}
                        className="flex items-center gap-1 text-[10px] text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-full px-2 py-0.5 hover:bg-violet-500/20 transition shrink-0"
                      >
                        <Bot className="w-2.5 h-2.5" /> IA
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => void handleSend()}
                    disabled={!inputText.trim() || sendingMsg}
                    className="w-9 h-9 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-white transition shadow-lg shadow-violet-600/20 shrink-0"
                  >
                    {sendingMsg
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* No conversation selected — intelligent monitoring state */
            <div className="flex-1 flex flex-col items-center justify-center gap-6 text-center p-8">
              <motion.div
                animate={{ scale: [1, 1.06, 1] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="relative"
              >
                <div className="w-16 h-16 rounded-2xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center">
                  <MessageCircle className="w-8 h-8 text-violet-400/50" />
                </div>
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
              </motion.div>
              <div>
                <p className="text-sm font-semibold text-zinc-300">Selecione uma conversa</p>
                <p className="text-xs text-zinc-600 mt-1">IA monitorando {conversations.length} conversa{conversations.length !== 1 ? 's' : ''} em tempo real</p>
              </div>
              <div className="flex flex-col gap-2 items-center">
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  NEXUS AI ativa · Analisando intenção do cliente
                </div>
                {activityEvents.length > 0 && (
                  <div className="flex items-center gap-1.5 text-xs text-violet-400 bg-violet-500/8 border border-violet-500/15 rounded-full px-3 py-1.5">
                    <Sparkles className="w-3 h-3" />
                    {activityEvents[0]?.label ?? 'Detectando oportunidades'}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Right: AI Sidebar ── */}
        <div className="w-72 shrink-0 border-l border-zinc-800/60 bg-zinc-950 overflow-hidden">
          <AISidebar
            conv={selected}
            activityEvents={activityEvents}
            leadData={leadData}
            leadLoading={leadLoading}
            aiMode={aiMode}
            autoClose={autoClose}
            conversations={conversations}
            onAIModeChange={setAiMode}
            onSendImage={() => fileInputRef.current?.click()}
            onTransfer={handleTransfer}
            onSendProposal={handleSendProposal}
          />
        </div>
      </div>

      {/* ── LiveOperationalFeed ── */}
      <div className="shrink-0 border-t border-zinc-800/60 bg-zinc-950/95">
        {/* Status row */}
        <div className="flex items-center justify-between px-6 py-1.5 border-b border-zinc-800/30">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider">Feed Operacional ao Vivo</span>
          </div>
          <div className="flex items-center gap-3">
            {autoClose && (
              <div className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/8 border border-emerald-500/20 rounded-full px-2 py-0.5">
                <Zap className="w-2.5 h-2.5" /> AutoClose ativo
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Wifi className="w-3 h-3 text-emerald-400" />
              <span className="text-[10px] text-emerald-400">Conectado</span>
            </div>
            <button
              onClick={() => { fetchStatus(); fetchConversations(); fetchActivity() }}
              className="text-zinc-700 hover:text-zinc-500 transition"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
        </div>
        {/* Horizontal events ticker */}
        <div className="flex items-center overflow-x-auto scrollbar-none px-4 py-2 gap-0">
          {activityEvents.length === 0 ? (
            <>
              {[
                { icon: '🤖', label: `NEXUS AI monitorando ${conversations.length} conversa${conversations.length !== 1 ? 's' : ''}` },
                { icon: '⚡', label: `${aiActiveConvs} conversa${aiActiveConvs !== 1 ? 's' : ''} com IA ativa` },
                { icon: '🎯', label: aiMode === 'auto' ? 'Modo automático — respondendo sem intervenção' : aiMode === 'hybrid' ? 'Modo híbrido — IA sugere, você aprova' : 'Modo manual — controle total' },
                { icon: '🔒', label: autoClose ? 'AutoClose ativo — fechando leads qualificados' : 'Pipeline sincronizado em tempo real' },
                { icon: '📡', label: `${activeAgentsCount} agente${activeAgentsCount !== 1 ? 's' : ''} IA operacional` },
              ].map((e, i, arr) => (
                <div key={i} className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs">{e.icon}</span>
                  <span className="text-[10px] text-zinc-500">{e.label}</span>
                  {i < arr.length - 1 && <span className="text-zinc-800 mx-4">·</span>}
                </div>
              ))}
            </>
          ) : (
            activityEvents.concat(activityEvents).map((e, i, arr) => (
              <div key={i} className="flex items-center gap-1.5 shrink-0">
                <span className="text-xs">{(e as ActivityEvent & { icon?: string }).icon ?? '⚡'}</span>
                <span className="text-[10px] text-zinc-500">{e.label}</span>
                {i < arr.length - 1 && <span className="text-zinc-800 mx-4">·</span>}
              </div>
            ))
          )}
        </div>
      </div>

      {showConnect && (
        <ConnectModal
          onClose={() => setShowConnect(false)}
          onConnected={() => { setShowConnect(false); fetchStatus(); fetchConversations() }}
        />
      )}

      {showConfig && (
        <ConfigModal
          onClose={() => setShowConfig(false)}
          onReconnect={() => setShowConnect(true)}
          waStatus={waStatus}
        />
      )}

      {showNewConv && (
        <NewConvModal
          onClose={() => setShowNewConv(false)}
          onCreated={(convId, phone) => {
            fetchConversations()
            // Select the new conversation after a brief delay for DB consistency
            setTimeout(() => {
              const newConv: Conversation = {
                id:              convId,
                phone,
                contact_name:    null,
                status:          'active',
                last_message_at: new Date().toISOString(),
                message_count:   1,
                ai_enabled:      true,
                created_at:      new Date().toISOString(),
                unread:          0,
              }
              handleSelectConv(newConv)
              fetchConversations()
            }, 800)
          }}
        />
      )}
    </div>
  )
}
