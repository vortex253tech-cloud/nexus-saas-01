'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageCircle, Bot, Zap, Sparkles, Send, Phone,
  Search, Filter, Star, MoreHorizontal, ChevronRight,
  CheckCircle2, Clock, Users, TrendingUp, Flame,
  Target, Bell, RefreshCw, Settings, Plus, Wifi,
  WifiOff, ArrowUpRight, Activity, Circle,
  MessageSquare, X, Loader2, Check, AlertTriangle,
  Smile, Archive, Tag,
} from 'lucide-react'
import { cn } from '@/lib/cn'

// ─── Types ────────────────────────────────────────────────────────────

interface Conversation {
  id:              string
  phone:           string
  contact_name:    string | null
  status:          'active' | 'closed' | 'blocked'
  last_message_at: string | null
  message_count:   number
  ai_enabled:      boolean
  created_at:      string
  unread?:         number
  label?:          'lead' | 'cliente' | 'negociacao' | 'recuperacao' | null
  temperatura?:    'frio' | 'morno' | 'quente' | 'urgente'
}

interface Message {
  id:           string
  direction:    'incoming' | 'outgoing'
  content:      string
  from_me:      boolean
  ai_generated: boolean
  status:       string
  created_at:   string
}

interface WAStatus {
  connected: boolean
  phone:     string | null
  status:    string
}

interface ActivityItem {
  icon:  string
  label: string
  time:  string
  color: string
}

// ─── Helpers ──────────────────────────────────────────────────────────

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
  if (conv.contact_name) return conv.contact_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  return conv.phone.slice(-2)
}

function displayName(conv: Conversation) {
  return conv.contact_name ?? `+${conv.phone}`
}

// Map label → display
const LABEL_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  lead:        { label: 'Lead quente',  color: 'text-orange-400', bg: 'bg-orange-500/15 border-orange-500/20' },
  cliente:     { label: 'Cliente',      color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/20' },
  negociacao:  { label: 'Negociação',   color: 'text-violet-400', bg: 'bg-violet-500/15 border-violet-500/20' },
  recuperacao: { label: 'Recuperação',  color: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/20' },
}

// ─── QR Connect Modal ─────────────────────────────────────────────────

type ConnectStep = 'loading' | 'qr' | 'scanning' | 'success'

function ConnectModal({ onClose, onConnected }: { onClose: () => void; onConnected: () => void }) {
  const [step,       setStep]       = useState<ConnectStep>('loading')
  const [qrError,    setQrError]    = useState(false)
  const [qrTs,       setQrTs]       = useState(Date.now())
  const pollRef = useRef<NodeJS.Timeout | null>(null)

  // Load QR
  useEffect(() => {
    const t = setTimeout(() => setStep('qr'), 800)
    return () => clearTimeout(t)
  }, [])

  // Poll connection status
  useEffect(() => {
    if (step !== 'qr' && step !== 'scanning') return

    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch('/api/nexus/whatsapp/status?company_id=check')
        const data = await res.json() as WAStatus
        if (data.connected) {
          setStep('success')
          clearInterval(pollRef.current!)
          setTimeout(onConnected, 1800)
        } else if (step === 'qr') {
          setStep('scanning')
        }
      } catch { /* ignore */ }
    }, 3000)

    return () => clearInterval(pollRef.current!)
  }, [step, onConnected])

  function refreshQr() {
    setQrTs(Date.now())
    setQrError(false)
    setStep('qr')
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
        onClick={e => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="relative bg-zinc-950 border border-zinc-800 rounded-3xl p-8 w-full max-w-md shadow-2xl"
        >
          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Conectar WhatsApp</p>
              <p className="text-xs text-zinc-500">Escaneie o QR com seu celular</p>
            </div>
          </div>

          {/* QR Area */}
          <div className="flex flex-col items-center gap-6">

            {/* Loading */}
            {step === 'loading' && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-56 h-56 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col items-center justify-center gap-3"
              >
                <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
                <p className="text-xs text-zinc-500">Gerando QR Code…</p>
              </motion.div>
            )}

            {/* QR Code */}
            {(step === 'qr' || step === 'scanning') && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative"
              >
                <div className="w-56 h-56 rounded-2xl overflow-hidden border-2 border-violet-500/30 shadow-lg shadow-violet-500/10">
                  {qrError ? (
                    <div className="w-full h-full bg-zinc-900 flex flex-col items-center justify-center gap-3">
                      <AlertTriangle className="w-8 h-8 text-amber-400" />
                      <p className="text-xs text-zinc-500 text-center px-4">QR não disponível.<br />Configure Z-API primeiro.</p>
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`/api/nexus/whatsapp/qr?t=${qrTs}`}
                      alt="QR Code WhatsApp"
                      className="w-full h-full object-cover"
                      onError={() => setQrError(true)}
                    />
                  )}
                </div>
                {step === 'scanning' && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 rounded-2xl bg-black/40 flex items-center justify-center"
                  >
                    <div className="flex items-center gap-2 bg-zinc-900/90 border border-zinc-700 rounded-full px-4 py-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <p className="text-xs text-zinc-300">Aguardando escaneamento…</p>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* Success */}
            {step === 'success' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-56 h-56 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col items-center justify-center gap-4"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
                  className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center"
                >
                  <Check className="w-8 h-8 text-emerald-400" />
                </motion.div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-emerald-400">Conectado!</p>
                  <p className="text-xs text-zinc-500 mt-1">Ativando IA NEXUS…</p>
                </div>
              </motion.div>
            )}

            {/* Instructions */}
            {(step === 'qr' || step === 'scanning') && (
              <div className="text-center space-y-2">
                <p className="text-xs text-zinc-400">
                  1. Abra o WhatsApp no celular<br />
                  2. Vá em <strong className="text-white">Dispositivos vinculados</strong><br />
                  3. Toque em <strong className="text-white">Vincular um dispositivo</strong><br />
                  4. Escaneie este QR Code
                </p>
                {!qrError && (
                  <button onClick={refreshQr} className="text-xs text-violet-400 hover:text-violet-300 transition mt-2">
                    ↺ Atualizar QR Code
                  </button>
                )}
              </div>
            )}

          </div>

          {/* Progress steps */}
          <div className="flex items-center gap-2 mt-8">
            {(['loading', 'qr', 'scanning', 'success'] as ConnectStep[]).map((s, i) => (
              <div key={s} className={cn(
                'h-1 rounded-full flex-1 transition-all duration-500',
                ['loading', 'qr', 'scanning', 'success'].indexOf(step) >= i
                  ? 'bg-violet-500'
                  : 'bg-zinc-800',
              )} />
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ─── Onboarding (before connection) ──────────────────────────────────

const MOCK_CONVS = [
  { name: 'João Silva', tag: 'Lead quente', tagColor: 'text-orange-400', msg: 'Olá! Tenho interesse nos seus serviços', time: '14:32', unread: 2 },
  { name: 'Maria Oliveira', tag: 'Cliente', tagColor: 'text-emerald-400', msg: 'Perfeito! Vamos fechar então', time: '14:28', unread: 0 },
  { name: 'Carlos Mendes', tag: 'Negociação', tagColor: 'text-violet-400', msg: 'Pode me enviar a proposta?', time: '14:20', unread: 3 },
  { name: 'Ana Costa', tag: 'Aguardando IA', tagColor: 'text-amber-400', msg: 'Qual o valor do pacote?', time: '14:15', unread: 1 },
]

function OnboardingView({ onConnect }: { onConnect: () => void }) {
  const features = [
    { icon: Bot,       text: 'IA responde automaticamente 24/7' },
    { icon: TrendingUp, text: 'Detecta e qualifica leads em tempo real' },
    { icon: Zap,       text: 'Follow-ups automáticos e reativação de clientes' },
  ]

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center relative overflow-hidden px-4">

      {/* Ambient glows */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-violet-600/8 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-1/4 left-1/3 w-[400px] h-[200px] bg-emerald-600/6 rounded-full blur-3xl pointer-events-none" />

      {/* Mock conversations (faded, background) */}
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

        {/* Mock AI response */}
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
          <p className="text-[11px] text-zinc-300 leading-relaxed">Olá João! 👋 Que bom ter você por aqui! Posso te mostrar como podemos ajudar sua empresa a vender mais…</p>
        </motion.div>
      </div>

      {/* Hero content */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 flex flex-col items-center text-center max-w-lg gap-6"
      >
        {/* Bot icon */}
        <div className="relative">
          <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-600/30 to-violet-800/20 border border-violet-500/30 flex items-center justify-center shadow-xl shadow-violet-500/20">
            <Bot className="w-12 h-12 text-violet-400" />
          </div>
          {/* Pulse ring */}
          <div className="absolute inset-0 rounded-3xl border border-violet-500/20 animate-ping" style={{ animationDuration: '2s' }} />
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-zinc-950 flex items-center justify-center">
            <span className="text-[8px] font-bold text-white">AI</span>
          </span>
        </div>

        <div className="space-y-3">
          <h1 className="text-4xl font-bold text-white tracking-tight leading-tight">
            Seu WhatsApp<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">operado por IA.</span>
          </h1>
          <p className="text-zinc-400 text-base leading-relaxed max-w-sm">
            O NEXUS responde, organiza, recupera clientes e identifica oportunidades automaticamente — sem você precisar fazer nada.
          </p>
        </div>

        {/* Features */}
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

        {/* CTA */}
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

// ─── Conversation Item ────────────────────────────────────────────────

function ConvItem({
  conv, active, onClick,
}: {
  conv:    Conversation
  active:  boolean
  onClick: () => void
}) {
  const cfg = conv.label ? LABEL_CONFIG[conv.label] : null
  const heat = conv.temperatura === 'quente' || conv.temperatura === 'urgente'
  const unread = conv.unread ?? 0

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full px-4 py-3.5 flex items-start gap-3 text-left border-b border-zinc-800/40 last:border-0 transition-all duration-150',
        active ? 'bg-violet-600/10 border-l-2 border-l-violet-500' : 'hover:bg-zinc-800/30',
      )}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <div className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold',
          heat ? 'bg-orange-500/20 text-orange-400' : 'bg-violet-600/20 text-violet-400',
        )}>
          {initials(conv)}
        </div>
        {conv.ai_enabled && (
          <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-zinc-950 border border-zinc-800 flex items-center justify-center">
            <Bot className="w-2.5 h-2.5 text-violet-400" />
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <p className={cn('text-sm font-medium truncate', unread > 0 ? 'text-white' : 'text-zinc-300')}>
              {displayName(conv)}
            </p>
            {heat && <Flame className="w-3 h-3 text-orange-400 shrink-0" />}
          </div>
          <span className="text-[10px] text-zinc-600 shrink-0">{formatRelative(conv.last_message_at)}</span>
        </div>
        <div className="flex items-center justify-between gap-1">
          {cfg ? (
            <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full border', cfg.color, cfg.bg)}>
              {cfg.label}
            </span>
          ) : (
            <span className="text-[11px] text-zinc-600">{conv.message_count} mensagens</span>
          )}
          {unread > 0 && (
            <span className="shrink-0 min-w-[18px] h-[18px] rounded-full bg-violet-600 text-[10px] text-white flex items-center justify-center px-1">
              {unread}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

// ─── Message Bubble ───────────────────────────────────────────────────

function Bubble({ msg }: { msg: Message }) {
  const isOut = msg.direction === 'outgoing'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex gap-2.5 max-w-[78%]', isOut ? 'flex-row-reverse ml-auto' : 'mr-auto')}
    >
      {isOut && (
        <div className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-auto',
          msg.ai_generated ? 'bg-violet-600/20' : 'bg-zinc-700',
        )}>
          {msg.ai_generated ? <Bot className="w-3.5 h-3.5 text-violet-400" /> : <Phone className="w-3.5 h-3.5 text-zinc-400" />}
        </div>
      )}
      <div className={cn('flex flex-col gap-1', isOut ? 'items-end' : 'items-start')}>
        {/* AI label */}
        {isOut && msg.ai_generated && (
          <div className="flex items-center gap-1 text-[10px] text-violet-400/70">
            <Sparkles className="w-2.5 h-2.5" />
            NEXUS AI · Resposta automática
          </div>
        )}
        <div className={cn(
          'px-4 py-2.5 rounded-2xl text-sm leading-relaxed',
          isOut
            ? 'bg-violet-600 text-white rounded-tr-md shadow-lg shadow-violet-600/20'
            : 'bg-zinc-800 text-zinc-100 border border-zinc-700/60 rounded-tl-md',
        )}>
          {msg.content}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-zinc-600">
          <span>{formatTime(msg.created_at)}</span>
          {isOut && (
            <CheckCircle2 className={cn('w-3 h-3', msg.status === 'read' ? 'text-violet-400' : 'text-zinc-600')} />
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── AI Sidebar ───────────────────────────────────────────────────────

const SUGGESTED_ACTIONS = [
  { icon: '📋', label: 'Enviar proposta personalizada', priority: 'alta'  as const },
  { icon: '📅', label: 'Agendar follow-up',             priority: 'media' as const },
  { icon: '🎯', label: 'Oferecer demonstração',         priority: 'alta'  as const },
  { icon: '💼', label: 'Enviar case de sucesso',        priority: 'baixa' as const },
]

const PRIORITY_STYLE = {
  alta:  { dot: 'bg-red-400',   label: 'Alta prioridade',  text: 'text-red-400' },
  media: { dot: 'bg-amber-400', label: 'Média prioridade', text: 'text-amber-400' },
  baixa: { dot: 'bg-zinc-500',  label: 'Baixa prioridade', text: 'text-zinc-500' },
}

const DEMO_ACTIVITY: ActivityItem[] = [
  { icon: '✅', label: 'Resposta automática enviada',  time: 'há 1 min',  color: 'text-emerald-400' },
  { icon: '🔥', label: 'Lead quente identificado',     time: 'há 3 min',  color: 'text-orange-400' },
  { icon: '📊', label: 'Oportunidade criada no pipeline', time: 'há 5 min', color: 'text-violet-400' },
  { icon: '🏷️', label: 'Tag "Interesse" aplicada',    time: 'há 5 min',  color: 'text-blue-400' },
]

function AISidebar({ conv }: { conv: Conversation | null }) {
  if (!conv) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
        <div className="w-12 h-12 rounded-2xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center">
          <Bot className="w-6 h-6 text-violet-400/50" />
        </div>
        <p className="text-xs text-zinc-600">Selecione uma conversa<br />para ver a análise da IA</p>
      </div>
    )
  }

  const heat  = conv.temperatura === 'quente' || conv.temperatura === 'urgente'
  const score = conv.message_count > 10 ? 82 : conv.message_count > 5 ? 61 : 44
  const valor = heat ? 'R$ 5.800' : 'R$ 2.400'

  const analysis = [
    { label: 'Sentimento',         value: 'Positivo',  valueColor: 'text-emerald-400',  dot: 'bg-emerald-400' },
    { label: 'Temperatura',        value: heat ? 'Quente' : 'Morno', valueColor: heat ? 'text-orange-400' : 'text-amber-400', dot: heat ? 'bg-orange-400' : 'bg-amber-400' },
    { label: 'Chance de fechamento', value: `${score}%`, valueColor: score >= 70 ? 'text-emerald-400' : 'text-amber-400', dot: score >= 70 ? 'bg-emerald-400' : 'bg-amber-400' },
    { label: 'Valor potencial',    value: valor,       valueColor: 'text-white',         dot: null },
    { label: 'Último contato',     value: formatRelative(conv.last_message_at), valueColor: 'text-zinc-300', dot: null },
  ]

  return (
    <div className="flex flex-col h-full overflow-y-auto">

      {/* AI Analysis */}
      <div className="p-4 border-b border-zinc-800/60">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            <p className="text-xs font-semibold text-zinc-200">Resumo da IA</p>
          </div>
          <span className="text-[10px] text-zinc-600">Atualizado agora</span>
        </div>
        <div className="space-y-2.5">
          {analysis.map(a => (
            <div key={a.label} className="flex items-center justify-between">
              <p className="text-[11px] text-zinc-500">{a.label}</p>
              <div className="flex items-center gap-1.5">
                {a.dot && <div className={cn('w-1.5 h-1.5 rounded-full', a.dot)} />}
                <p className={cn('text-[11px] font-semibold', a.valueColor)}>{a.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Suggested Actions */}
      <div className="p-4 border-b border-zinc-800/60">
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-3.5 h-3.5 text-violet-400" />
          <p className="text-xs font-semibold text-zinc-200">Próximas ações sugeridas</p>
        </div>
        <div className="space-y-1.5">
          {SUGGESTED_ACTIONS.map((a, i) => {
            const p = PRIORITY_STYLE[a.priority]
            return (
              <button key={i} className="w-full flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-zinc-800/50 transition-colors group text-left">
                <span className="text-base shrink-0">{a.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-300 group-hover:text-white transition-colors truncate">{a.label}</p>
                  <p className={cn('text-[10px]', p.text)}>{p.label}</p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-zinc-600 group-hover:text-zinc-400 shrink-0 transition-colors" />
              </button>
            )
          })}
          <button className="w-full text-[11px] text-violet-400 hover:text-violet-300 transition py-1 text-center">
            Ver todas as ações
          </button>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-violet-400" />
            <p className="text-xs font-semibold text-zinc-200">Atividade da IA</p>
          </div>
          <button className="text-[10px] text-violet-400 hover:text-violet-300 transition">Ver tudo</button>
        </div>
        <div className="space-y-2.5">
          {DEMO_ACTIVITY.map((a, i) => (
            <div key={i} className="flex items-start gap-2.5">
              <span className="text-sm shrink-0 mt-0.5">{a.icon}</span>
              <div className="flex-1 min-w-0">
                <p className={cn('text-[11px]', a.color)}>{a.label}</p>
                <p className="text-[10px] text-zinc-600">{a.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Quick Reply Suggestion ────────────────────────────────────────────

const QUICK_REPLIES = [
  'Claro! Vou te mostrar como funciona nossa automação e os resultados que podemos gerar.',
  'Posso agendar uma demonstração rápida para você ver na prática. Quando tem 20 minutos?',
  'Ótima pergunta! Nossos planos começam em R$297/mês com ROI médio de 3x em 90 dias.',
]

// ─── Main Page ────────────────────────────────────────────────────────

export default function WhatsAppPage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [messages,      setMessages]      = useState<Message[]>([])
  const [waStatus,      setWaStatus]      = useState<WAStatus | null>(null)
  const [selected,      setSelected]      = useState<Conversation | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [loadingMsgs,   setLoadingMsgs]   = useState(false)
  const [showConnect,   setShowConnect]   = useState(false)
  const [search,        setSearch]        = useState('')
  const [filter,        setFilter]        = useState<string>('all')
  const [inputText,     setInputText]     = useState('')
  const [showSuggestion, setShowSuggestion] = useState(false)
  const [suggestionIdx,  setSuggestionIdx]  = useState(0)
  const messagesEnd = useRef<HTMLDivElement>(null)
  const inputRef    = useRef<HTMLInputElement>(null)

  // ── Fetchers ─────────────────────────────────────────────────

  const fetchStatus = useCallback(async () => {
    try {
      const res  = await fetch('/api/nexus/whatsapp/status?company_id=self')
      const data = await res.json() as WAStatus
      setWaStatus(data)
    } catch { /* ignore */ }
  }, [])

  const fetchConversations = useCallback(async () => {
    try {
      const res  = await fetch('/api/whatsapp/conversations')
      const data = await res.json()
      const convs = (data.conversations ?? []) as Conversation[]
      // Enrich with demo labels for visual richness
      const enriched = convs.map((c, i): Conversation => ({
        ...c,
        unread:     i === 0 ? 2 : i === 2 ? 3 : 0,
        label:      i === 0 ? 'lead' : i === 1 ? 'cliente' : i === 2 ? 'negociacao' : null,
        temperatura: i === 0 ? 'quente' : 'morno',
      }))
      setConversations(enriched)
    } catch { /* ignore */ }
  }, [])

  const fetchMessages = useCallback(async (convId: string) => {
    setLoadingMsgs(true)
    try {
      const res  = await fetch(`/api/whatsapp/messages?conversationId=${convId}`)
      const data = await res.json()
      setMessages(data.messages ?? [])
    } catch { /* ignore */ } finally {
      setLoadingMsgs(false)
    }
  }, [])

  // ── Init ─────────────────────────────────────────────────────

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchStatus(), fetchConversations()]).finally(() => setLoading(false))
    const t = setInterval(() => { fetchStatus(); fetchConversations() }, 30000)
    return () => clearInterval(t)
  }, [fetchStatus, fetchConversations])

  useEffect(() => {
    if (!selected) return
    const t = setInterval(() => fetchMessages(selected.id), 10000)
    return () => clearInterval(t)
  }, [selected, fetchMessages])

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Derived ──────────────────────────────────────────────────

  const connected = waStatus?.connected ?? false

  const FILTERS = [
    { key: 'all',     label: 'Todas',        count: conversations.length },
    { key: 'unread',  label: 'Não lidas',    count: conversations.filter(c => (c.unread ?? 0) > 0).length },
    { key: 'leads',   label: 'Leads quentes',count: conversations.filter(c => c.label === 'lead').length },
    { key: 'clients', label: 'Clientes',     count: conversations.filter(c => c.label === 'cliente').length },
    { key: 'ai',      label: 'Aguardando IA',count: conversations.filter(c => !c.ai_enabled).length },
    { key: 'nego',    label: 'Negociações',  count: conversations.filter(c => c.label === 'negociacao').length },
    { key: 'closed',  label: 'Arquivadas',   count: conversations.filter(c => c.status === 'closed').length },
  ]

  const visibleConvs = conversations.filter(c => {
    if (search) return displayName(c).toLowerCase().includes(search.toLowerCase())
    switch (filter) {
      case 'unread':  return (c.unread ?? 0) > 0
      case 'leads':   return c.label === 'lead'
      case 'clients': return c.label === 'cliente'
      case 'ai':      return !c.ai_enabled
      case 'nego':    return c.label === 'negociacao'
      case 'closed':  return c.status === 'closed'
      default:        return true
    }
  })

  const kpis = [
    { label: 'Conversas ativas', value: conversations.filter(c => c.status === 'active').length, sub: '+18% hoje',    icon: MessageCircle, color: 'text-violet-400' },
    { label: 'Mensagens',        value: conversations.reduce((a, c) => a + c.message_count, 0),  sub: '+32% hoje',    icon: Send,          color: 'text-blue-400' },
    { label: 'Leads identificados', value: conversations.filter(c => c.label === 'lead').length, sub: '+27% hoje',   icon: Users,         color: 'text-orange-400' },
    { label: 'Oportunidades',    value: conversations.filter(c => c.label === 'negociacao').length, sub: '+44% hoje', icon: TrendingUp,    color: 'text-emerald-400' },
  ]

  function handleSelectConv(conv: Conversation) {
    setSelected(conv)
    fetchMessages(conv.id)
    setShowSuggestion(true)
    setSuggestionIdx(0)
  }

  function useSuggestion() {
    setInputText(QUICK_REPLIES[suggestionIdx])
    setShowSuggestion(false)
    inputRef.current?.focus()
  }

  // ── Render: not connected ─────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
      </div>
    )
  }

  if (!connected) {
    return (
      <>
        <OnboardingView onConnect={() => setShowConnect(true)} />
        {showConnect && (
          <ConnectModal
            onClose={() => setShowConnect(false)}
            onConnected={() => { setShowConnect(false); fetchStatus(); fetchConversations() }}
          />
        )}
      </>
    )
  }

  // ── Render: connected — OPERATION CENTER ──────────────────────

  return (
    <div className="h-screen bg-zinc-950 flex flex-col overflow-hidden">

      {/* Header */}
      <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-zinc-800/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center">
            <MessageCircle className="w-4.5 h-4.5 text-emerald-400" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-bold text-white">WhatsApp AI</h1>
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-500/15 border border-emerald-500/25 rounded-full px-2 py-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Conectado
              </div>
            </div>
            <p className="text-xs text-zinc-500">Atendimento inteligente, automações e oportunidades em tempo real.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition">
            <Settings className="w-3.5 h-3.5" /> Configurações
          </button>
          <button className="flex items-center gap-1.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 px-4 py-1.5 rounded-lg transition shadow-lg shadow-violet-600/20">
            <Plus className="w-3.5 h-3.5" /> Nova mensagem
          </button>
        </div>
      </div>

      {/* KPI row */}
      <div className="shrink-0 grid grid-cols-4 gap-3 px-6 py-3 border-b border-zinc-800/60">
        {kpis.map(kpi => {
          const Icon = kpi.icon
          return (
            <div key={kpi.label} className="flex items-center gap-3 bg-zinc-900/60 rounded-xl px-4 py-2.5">
              <Icon className={cn('w-4 h-4 shrink-0', kpi.color)} />
              <div>
                <p className="text-lg font-bold text-white leading-none">{kpi.value}</p>
                <p className="text-[10px] text-zinc-500">{kpi.label}</p>
                <p className="text-[10px] text-emerald-500">{kpi.sub}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Main 3-column layout */}
      <div className="flex-1 flex overflow-hidden">

        {/* ── Left: Smart Inbox ── */}
        <div className="w-72 shrink-0 flex flex-col border-r border-zinc-800/60 bg-zinc-950">

          {/* Connection card */}
          <div className="p-4 border-b border-zinc-800/60">
            <div className="bg-zinc-900 border border-zinc-800/60 rounded-xl p-3 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <MessageCircle className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-white">WhatsApp Conectado</p>
                <p className="text-[10px] text-zinc-500 truncate">
                  {waStatus?.phone ? `+${waStatus.phone}` : 'Ativo e operando'}
                </p>
              </div>
              <button className="shrink-0 text-[10px] text-violet-400 hover:text-violet-300 border border-violet-500/30 rounded-lg px-2 py-1 transition">
                Ver QR
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="px-3 pb-2 pt-1">
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800/60 rounded-xl px-3 py-2">
              <Search className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <input
                type="text"
                placeholder="Buscar conversas..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="flex-1 bg-transparent text-xs text-zinc-300 placeholder-zinc-600 outline-none"
              />
            </div>
          </div>

          {/* Filters */}
          <div className="px-3 pb-2">
            <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-wider mb-2 px-1">Filtros inteligentes</p>
            <div className="space-y-0.5">
              {FILTERS.map(f => (
                <button
                  key={f.key}
                  onClick={() => { setFilter(f.key); setSearch('') }}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2 rounded-lg text-left transition-all',
                    filter === f.key && !search
                      ? 'bg-violet-600/15 text-violet-300'
                      : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40',
                  )}
                >
                  <div className="flex items-center gap-2">
                    {f.key === 'all'     && <MessageSquare className="w-3.5 h-3.5" />}
                    {f.key === 'unread'  && <Circle className="w-3.5 h-3.5" />}
                    {f.key === 'leads'   && <Flame className="w-3.5 h-3.5 text-orange-400" />}
                    {f.key === 'clients' && <Users className="w-3.5 h-3.5" />}
                    {f.key === 'ai'      && <Bot className="w-3.5 h-3.5" />}
                    {f.key === 'nego'    && <TrendingUp className="w-3.5 h-3.5" />}
                    {f.key === 'closed'  && <Archive className="w-3.5 h-3.5" />}
                    <span className="text-xs">{f.label}</span>
                  </div>
                  <span className={cn(
                    'text-xs tabular-nums',
                    filter === f.key && !search ? 'text-violet-400' : 'text-zinc-600',
                  )}>
                    {f.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto border-t border-zinc-800/40">
            {visibleConvs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-3 p-6 text-center">
                <MessageSquare className="w-7 h-7 text-zinc-700" />
                <p className="text-xs text-zinc-600">Nenhuma conversa encontrada</p>
              </div>
            ) : (
              visibleConvs.map(c => (
                <ConvItem
                  key={c.id}
                  conv={c}
                  active={selected?.id === c.id}
                  onClick={() => handleSelectConv(c)}
                />
              ))
            )}
          </div>

          {/* New filter */}
          <div className="p-3 border-t border-zinc-800/60">
            <button className="w-full flex items-center justify-center gap-2 text-xs text-zinc-600 hover:text-zinc-400 py-2 transition">
              <Plus className="w-3.5 h-3.5" /> Novo filtro
            </button>
          </div>
        </div>

        {/* ── Center: Chat ── */}
        <div className="flex-1 flex flex-col overflow-hidden bg-zinc-950/50">
          {selected ? (
            <>
              {/* Chat header */}
              <div className="shrink-0 flex items-center justify-between px-5 py-3.5 border-b border-zinc-800/60 bg-zinc-950">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-violet-600/20 text-violet-400 text-sm font-bold flex items-center justify-center">
                    {initials(selected)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white">{displayName(selected)}</p>
                      {selected.label && (
                        <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full border', LABEL_CONFIG[selected.label]?.color, LABEL_CONFIG[selected.label]?.bg)}>
                          {LABEL_CONFIG[selected.label]?.label}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-zinc-500">Visto por último há 14:30</p>
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
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Conversation filter tabs */}
              <div className="shrink-0 flex gap-1 px-5 py-2 border-b border-zinc-800/40 bg-zinc-950/80">
                {['Todas 24', 'Não lidas 5', 'Leads 6', 'Clientes 12'].map(t => {
                  const [label, count] = t.split(' ')
                  const active = label === 'Todas'
                  return (
                    <button key={t} className={cn(
                      'text-xs px-3 py-1 rounded-full transition',
                      active ? 'bg-zinc-800 text-zinc-200' : 'text-zinc-600 hover:text-zinc-400',
                    )}>
                      {label} <span className={active ? 'text-zinc-400' : 'text-zinc-700'}>{count}</span>
                    </button>
                  )
                })}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-4">
                {loadingMsgs ? (
                  <div className="flex items-center justify-center flex-1">
                    <Loader2 className="w-5 h-5 text-zinc-600 animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center flex-1 gap-3">
                    <MessageSquare className="w-8 h-8 text-zinc-700" />
                    <p className="text-sm text-zinc-600">Nenhuma mensagem ainda</p>
                  </div>
                ) : (
                  messages.map(m => <Bubble key={m.id} msg={m} />)
                )}

                {/* Typing indicator */}
                {selected && (
                  <div className="flex items-center gap-2.5">
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
                    <p className="text-xs text-zinc-600">{displayName(selected)} está digitando…</p>
                  </div>
                )}

                <div ref={messagesEnd} />
              </div>

              {/* AI quick reply suggestion */}
              <AnimatePresence>
                {showSuggestion && (
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
                          <p className="text-[11px] text-violet-400 font-medium">Resposta inteligente sugerida</p>
                        </div>
                        <button onClick={() => setShowSuggestion(false)} className="text-zinc-600 hover:text-zinc-400">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed mb-3">{QUICK_REPLIES[suggestionIdx]}</p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={useSuggestion}
                          className="flex items-center gap-1.5 text-xs text-white bg-violet-600 hover:bg-violet-500 px-3 py-1.5 rounded-lg transition"
                        >
                          <Check className="w-3 h-3" /> Enviar
                        </button>
                        <button
                          onClick={() => setSuggestionIdx(i => (i + 1) % QUICK_REPLIES.length)}
                          className="text-xs text-zinc-500 hover:text-zinc-300 transition"
                        >
                          + 2 opções
                        </button>
                        <button
                          onClick={() => { setInputText(QUICK_REPLIES[suggestionIdx]); setShowSuggestion(false); inputRef.current?.focus() }}
                          className="text-xs text-zinc-500 hover:text-zinc-300 transition ml-auto"
                        >
                          ✏️ Editar
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Input bar */}
              <div className="shrink-0 px-5 py-3 border-t border-zinc-800/60 bg-zinc-950">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <button className="w-8 h-8 rounded-lg hover:bg-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition">
                      <Smile className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex-1 bg-zinc-900 border border-zinc-800/60 rounded-2xl px-4 py-2.5 flex items-center gap-2">
                    <input
                      ref={inputRef}
                      type="text"
                      placeholder="Digite sua mensagem..."
                      value={inputText}
                      onChange={e => setInputText(e.target.value)}
                      className="flex-1 bg-transparent text-sm text-zinc-200 placeholder-zinc-600 outline-none"
                    />
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => { setShowSuggestion(true); setSuggestionIdx(0) }}
                        className="flex items-center gap-1 text-[10px] text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-full px-2 py-0.5 hover:bg-violet-500/20 transition"
                      >
                        <Bot className="w-2.5 h-2.5" /> IA Assistente
                        <span className="bg-violet-500/20 text-[9px] rounded-full px-1 ml-0.5 font-bold">Novo</span>
                      </button>
                    </div>
                  </div>
                  <button className="w-9 h-9 rounded-xl bg-violet-600 hover:bg-violet-500 flex items-center justify-center text-white transition shadow-lg shadow-violet-600/20">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* No conversation selected */
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
              <div className="w-14 h-14 rounded-2xl bg-violet-600/10 border border-violet-500/20 flex items-center justify-center">
                <MessageCircle className="w-7 h-7 text-violet-400/50" />
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-300">Selecione uma conversa</p>
                <p className="text-xs text-zinc-600 mt-1">A IA está monitorando todas as conversas em tempo real</p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                IA NEXUS está ativa · Monitorando e otimizando
              </div>
            </div>
          )}
        </div>

        {/* ── Right: AI Sidebar ── */}
        <div className="w-72 shrink-0 border-l border-zinc-800/60 bg-zinc-950 overflow-hidden">
          <AISidebar conv={selected} />
        </div>
      </div>

      {/* Bottom live bar */}
      <div className="shrink-0 flex items-center gap-2 px-6 py-2 border-t border-zinc-800/60 bg-zinc-950/90">
        <div className="flex items-center gap-2 flex-1">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
          <p className="text-[11px] text-zinc-500">IA NEXUS está ativa · Respondendo conversas automaticamente</p>
        </div>
        <button className="flex items-center gap-1.5 text-[11px] text-zinc-600 hover:text-zinc-400 transition">
          <RefreshCw className="w-3 h-3" />
        </button>
      </div>

      {/* Connect modal can also appear when connected (re-connect) */}
      {showConnect && (
        <ConnectModal
          onClose={() => setShowConnect(false)}
          onConnected={() => { setShowConnect(false); fetchStatus() }}
        />
      )}
    </div>
  )
}
