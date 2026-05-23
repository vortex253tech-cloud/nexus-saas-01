'use client'

import { useEffect, useRef, useState, useCallback, memo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic, MicOff, Zap, MessageSquare, Activity, Navigation,
  Users, Send, Search, ToggleLeft, UserCheck, BarChart2,
  Calendar, Loader2, Volume2, AlertCircle, X, ChevronRight,
  TrendingUp, DollarSign, Bell, CheckCircle, Wifi, WifiOff,
  MessageCircle, GitBranch, Eye, Clock, Bot, Cpu, Shield,
  Star, Target, Layers, RefreshCw, Play, Settings, Plus,
  Sparkles, Crown, AreaChart, Rocket, BrainCircuit,
} from 'lucide-react'

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

// ── Types ──────────────────────────────────────────────────────────────────

type VoiceState = 'off' | 'connecting' | 'idle' | 'listening' | 'thinking' | 'speaking' | 'error'

interface TranscriptEntry {
  id:   string
  role: 'user' | 'assistant'
  text: string
  ts:   number
}

interface ActionLog {
  id:      string
  tool:    string
  label:   string
  ts:      number
  ok:      boolean
  detail?: string
  agent?:  string
}

interface LiveMetrics {
  conversations: number
  unread:        number
  ai_active:     number
  hot_leads:     number
  system_ok:     boolean
  health_score:  number
  loaded:        boolean
}

interface CompanyAlert {
  type:    'warning' | 'opportunity' | 'info'
  message: string
}

// ── Orb config per state ───────────────────────────────────────────────────

const ORB: Record<VoiceState, { gradient: string; glow: string; label: string; pulse: boolean; ringColor: string }> = {
  off:        { gradient: 'from-slate-700 via-slate-800 to-slate-900', glow: 'rgba(100,100,120,0.25)', label: 'NEXUS OS',    pulse: false, ringColor: 'rgba(100,100,120,0.15)' },
  connecting: { gradient: 'from-violet-500 via-violet-700 to-purple-900', glow: 'rgba(139,92,246,0.5)',  label: 'Iniciando…', pulse: true,  ringColor: 'rgba(139,92,246,0.2)'  },
  idle:       { gradient: 'from-violet-500 via-purple-600 to-violet-800', glow: 'rgba(139,92,246,0.4)',  label: 'Aguardando', pulse: false, ringColor: 'rgba(139,92,246,0.12)' },
  listening:  { gradient: 'from-cyan-400 via-blue-500 to-blue-700',       glow: 'rgba(34,211,238,0.55)', label: 'Ouvindo',    pulse: true,  ringColor: 'rgba(34,211,238,0.15)' },
  thinking:   { gradient: 'from-amber-400 via-orange-500 to-orange-700',  glow: 'rgba(251,191,36,0.5)',  label: 'Analisando', pulse: true,  ringColor: 'rgba(251,191,36,0.15)' },
  speaking:   { gradient: 'from-emerald-400 via-teal-500 to-teal-700',    glow: 'rgba(52,211,153,0.55)', label: 'Executando', pulse: true,  ringColor: 'rgba(52,211,153,0.15)' },
  error:      { gradient: 'from-red-500 via-rose-600 to-red-800',         glow: 'rgba(239,68,68,0.4)',   label: 'Reconectando', pulse: false, ringColor: 'rgba(239,68,68,0.12)' },
}

const TOOL_LABELS: Record<string, string> = {
  navigate:             'Navegando para módulo',
  getWhatsAppStats:     'Lendo stats WhatsApp',
  getHotLeads:          'Buscando leads quentes',
  sendWhatsAppMessage:  'Enviando mensagem',
  searchConversations:  'Pesquisando conversa',
  toggleAI:             'Ajustando IA',
  transferToHuman:      'Transferindo para humano',
  getDashboardSummary:  'Resumo executivo',
  createFollowUp:       'Criando follow-up',
  getUnreadMessages:    'Verificando não lidas',
  getFinancialSummary:  'Analisando financeiro',
  getPipelineLeads:     'Lendo pipeline',
  updateLeadStage:      'Movendo lead',
  markConversationRead: 'Marcando como lida',
  getConversationHistory: 'Carregando histórico',
  getSystemStatus:      'Verificando sistema',
  analyzeCompany:       'Analisando empresa',
  orchestrateAgent:     'Acionando agente IA',
  getAutomations:       'Lendo automações',
  triggerAutomation:    'Disparando automação',
  createTask:           'Criando tarefa',
}

const REALTIME_MODEL = 'gpt-4o-realtime-preview'

// Session update via DataChannel (tools already set in session, this confirms)
const SESSION_UPDATE = {
  type:    'session.update',
  session: {
    voice:       'alloy',
    tool_choice: 'auto',
    input_audio_transcription: { model: 'whisper-1' },
    turn_detection: {
      type:                'server_vad',
      threshold:           0.5,
      prefix_padding_ms:   300,
      silence_duration_ms: 700,
    },
  },
} as const

// ── Quick commands (5×4 grid = 20) ────────────────────────────────────────

const QUICK: { icon: React.ElementType; label: string; prompt: string; color: string }[] = [
  { icon: BarChart2,    label: 'Resumo do dia',    prompt: 'NEXUS, qual é o resumo executivo do dia?',           color: 'violet'  },
  { icon: Users,        label: 'Leads quentes',    prompt: 'NEXUS, mostra os leads mais quentes',                color: 'cyan'    },
  { icon: Bell,         label: 'Não lidas',        prompt: 'NEXUS, tem mensagem não lida?',                      color: 'amber'   },
  { icon: DollarSign,   label: 'Financeiro',       prompt: 'NEXUS, como está o faturamento do mês?',             color: 'emerald' },
  { icon: Activity,     label: 'Stats WhatsApp',   prompt: 'NEXUS, como está o WhatsApp?',                       color: 'blue'    },
  { icon: GitBranch,    label: 'Pipeline',         prompt: 'NEXUS, mostra a distribuição do pipeline',           color: 'purple'  },
  { icon: Navigation,   label: 'Abrir WhatsApp',   prompt: 'NEXUS, abre o painel do WhatsApp',                   color: 'teal'    },
  { icon: Search,       label: 'Buscar conversa',  prompt: 'NEXUS, busca uma conversa',                          color: 'indigo'  },
  { icon: Send,         label: 'Enviar mensagem',  prompt: 'NEXUS, quero enviar uma mensagem WhatsApp',          color: 'sky'     },
  { icon: TrendingUp,   label: 'Status sistema',   prompt: 'NEXUS, qual é o status do sistema?',                 color: 'green'   },
  { icon: Calendar,     label: 'Follow-up',        prompt: 'NEXUS, cria um follow-up para hoje',                 color: 'orange'  },
  { icon: CheckCircle,  label: 'Marcar lida',      prompt: 'NEXUS, marca conversas não lidas como lidas',        color: 'rose'    },
  { icon: BrainCircuit, label: 'Analisar empresa', prompt: 'NEXUS, faz uma análise executiva completa da empresa', color: 'violet' },
  { icon: Rocket,       label: 'Agente Growth',    prompt: 'NEXUS, aciona o Growth IA para identificar oportunidades de crescimento', color: 'cyan' },
  { icon: Layers,       label: 'Automações',       prompt: 'NEXUS, lista as automações ativas',                  color: 'amber'   },
  { icon: Target,       label: 'Fechar leads',     prompt: 'NEXUS, quais leads estão em negociação prontos para fechar?', color: 'emerald' },
  { icon: Bot,          label: 'Agente Marketing', prompt: 'NEXUS, aciona o Marketing IA para analisar oportunidades de campanha', color: 'blue' },
  { icon: Plus,         label: 'Criar tarefa',     prompt: 'NEXUS, cria uma tarefa urgente para hoje',           color: 'purple'  },
  { icon: AreaChart,    label: 'Relatório',        prompt: 'NEXUS, gera um relatório executivo completo',        color: 'teal'    },
  { icon: Crown,        label: 'CEO Mode',         prompt: 'NEXUS, ativa modo CEO e monitora a empresa',         color: 'indigo'  },
]

const COLOR_MAP: Record<string, string> = {
  violet:  'hover:border-violet-500/40 hover:text-violet-300  hover:bg-violet-500/8',
  cyan:    'hover:border-cyan-500/40   hover:text-cyan-300    hover:bg-cyan-500/8',
  amber:   'hover:border-amber-500/40  hover:text-amber-300   hover:bg-amber-500/8',
  emerald: 'hover:border-emerald-500/40 hover:text-emerald-300 hover:bg-emerald-500/8',
  blue:    'hover:border-blue-500/40   hover:text-blue-300    hover:bg-blue-500/8',
  purple:  'hover:border-purple-500/40 hover:text-purple-300  hover:bg-purple-500/8',
  teal:    'hover:border-teal-500/40   hover:text-teal-300    hover:bg-teal-500/8',
  indigo:  'hover:border-indigo-500/40 hover:text-indigo-300  hover:bg-indigo-500/8',
  sky:     'hover:border-sky-500/40    hover:text-sky-300     hover:bg-sky-500/8',
  green:   'hover:border-green-500/40  hover:text-green-300   hover:bg-green-500/8',
  orange:  'hover:border-orange-500/40 hover:text-orange-300  hover:bg-orange-500/8',
  rose:    'hover:border-rose-500/40   hover:text-rose-300    hover:bg-rose-500/8',
}

// ── Components ─────────────────────────────────────────────────────────────

const WaveformBars = memo(function WaveformBars({ active, color }: { active: boolean; color: string }) {
  return (
    <div className="flex items-center justify-center gap-[2.5px] h-10">
      {Array.from({ length: 32 }).map((_, i) => (
        <motion.div
          key={i}
          className={`w-[2.5px] rounded-full ${color}`}
          animate={active ? {
            scaleY: [0.12, 1, 0.12],
            opacity: [0.3, 1, 0.3],
          } : { scaleY: 0.12, opacity: 0.15 }}
          transition={active ? {
            duration: 0.7 + (i % 6) * 0.1,
            repeat: Infinity,
            delay: (i * 0.035) % 0.55,
            ease: 'easeInOut',
          } : { duration: 0.25 }}
          style={{ height: 32 }}
        />
      ))}
    </div>
  )
})

// Floating pulse rings around the orb
const FloatingRings = memo(function FloatingRings({
  active, glow,
}: { active: boolean; glow: string }) {
  if (!active) return null
  return (
    <>
      {[1, 2, 3].map(i => (
        <motion.div
          key={i}
          className="absolute rounded-full border"
          style={{
            width: 160 + i * 60,
            height: 160 + i * 60,
            borderColor: glow,
            opacity: 0,
          }}
          animate={{ scale: [0.85, 1.2], opacity: [0.5, 0] }}
          transition={{
            duration: 2 + i * 0.4,
            repeat: Infinity,
            delay: i * 0.6,
            ease: 'easeOut',
          }}
        />
      ))}
    </>
  )
})

function VoiceOrb({ state, onClick }: { state: VoiceState; onClick: () => void }) {
  const cfg   = ORB[state]
  const isOff = state === 'off'

  return (
    <div className="relative flex items-center justify-center select-none" style={{ width: 260, height: 260 }}>
      {/* Ambient glow blur */}
      <motion.div
        className="absolute rounded-full blur-3xl"
        style={{ width: 180, height: 180, background: cfg.glow }}
        animate={{ opacity: isOff ? 0.15 : 0.6, scale: cfg.pulse ? [1, 1.12, 1] : 1 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Floating rings */}
      <FloatingRings active={cfg.pulse} glow={cfg.glow} />

      {/* Outer decorative ring */}
      <motion.div
        className="absolute rounded-full border border-white/5"
        style={{ width: 220, height: 220 }}
        animate={{ rotate: 360 }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      >
        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white/20" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-1 h-1 rounded-full bg-white/10" />
      </motion.div>

      {/* Main orb button */}
      <motion.button
        onClick={onClick}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        className={cn(
          'relative z-10 flex flex-col items-center justify-center gap-2.5 rounded-full',
          `bg-gradient-to-br ${cfg.gradient}`,
          'shadow-2xl cursor-pointer border border-white/10 overflow-hidden',
        )}
        style={{ width: 160, height: 160 }}
        animate={{ boxShadow: `0 0 50px 15px ${cfg.glow}` }}
        transition={{ duration: 0.5 }}
      >
        {/* Inner shimmer */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-white/10 rounded-full" />

        <div className="relative z-10 flex flex-col items-center gap-1.5">
          {isOff ? (
            <Mic className="w-11 h-11 text-white/80" />
          ) : state === 'connecting' ? (
            <Loader2 className="w-11 h-11 text-white animate-spin" />
          ) : state === 'error' ? (
            <RefreshCw className="w-11 h-11 text-white" />
          ) : state === 'thinking' ? (
            <BrainCircuit className="w-11 h-11 text-white" />
          ) : state === 'speaking' ? (
            <Cpu className="w-11 h-11 text-white" />
          ) : (
            <Volume2 className="w-11 h-11 text-white" />
          )}
          <span className="text-[10px] font-bold text-white/70 tracking-[0.2em] uppercase">
            {cfg.label}
          </span>
        </div>
      </motion.button>
    </div>
  )
}

const TranscriptBubble = memo(function TranscriptBubble({ entry }: { entry: TranscriptEntry }) {
  const isUser = entry.role === 'user'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.2 }}
      className={cn('flex', isUser ? 'justify-end' : 'justify-start')}
    >
      {!isUser && (
        <div className="w-5 h-5 rounded-full bg-violet-600/30 border border-violet-500/30 flex items-center justify-center mr-1.5 mt-0.5 shrink-0">
          <Cpu className="w-2.5 h-2.5 text-violet-400" />
        </div>
      )}
      <div className={cn(
        'max-w-[82%] px-3.5 py-2 rounded-2xl text-[13px] leading-relaxed',
        isUser
          ? 'bg-violet-600/60 text-white rounded-br-sm border border-violet-500/20'
          : 'bg-white/6 text-white/85 border border-white/8 rounded-bl-sm',
      )}>
        {entry.text}
      </div>
    </motion.div>
  )
})

function LiveMetricsBar({ metrics }: { metrics: LiveMetrics }) {
  if (!metrics.loaded) {
    return (
      <div className="flex items-center gap-4 px-6 py-2 border-b border-white/4 bg-black/20">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-3 w-20 rounded bg-white/6 animate-pulse" />
        ))}
      </div>
    )
  }

  const items = [
    { icon: MessageCircle, label: 'Conversas',  value: metrics.conversations, color: 'text-violet-400' },
    { icon: Bell,          label: 'Não lidas',  value: metrics.unread,        color: metrics.unread > 0 ? 'text-amber-400' : 'text-white/30' },
    { icon: Zap,           label: 'IA ativa',   value: metrics.ai_active,     color: 'text-emerald-400' },
    { icon: Target,        label: 'Leads hot',  value: metrics.hot_leads,     color: metrics.hot_leads > 0 ? 'text-orange-400' : 'text-white/30' },
    { icon: metrics.system_ok ? Shield : AlertCircle, label: 'Sistema', value: metrics.system_ok ? 'Online' : 'Alerta', color: metrics.system_ok ? 'text-emerald-400' : 'text-red-400' },
  ]

  return (
    <div className="flex items-center gap-5 px-6 py-2 border-b border-white/4 bg-black/20">
      {items.map(item => {
        const Icon = item.icon
        return (
          <div key={item.label} className="flex items-center gap-1.5">
            <Icon className={cn('w-3 h-3', item.color)} />
            <span className="text-[10px] text-white/30">{item.label}</span>
            <span className={cn('text-[10px] font-bold tabular-nums', item.color)}>{item.value}</span>
          </div>
        )
      })}
      {/* Health score */}
      <div className="flex items-center gap-1.5 ml-auto">
        <Star className="w-3 h-3 text-amber-400" />
        <span className="text-[10px] text-white/30">Saúde</span>
        <span className={cn(
          'text-[10px] font-bold',
          metrics.health_score >= 70 ? 'text-emerald-400' :
          metrics.health_score >= 40 ? 'text-amber-400' : 'text-red-400',
        )}>
          {metrics.health_score}/100
        </span>
      </div>
    </div>
  )
}

const ActionCard = memo(function ActionCard({ a }: { a: ActionLog }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'flex items-start gap-2 px-3 py-2.5 rounded-xl border transition-all',
        a.ok
          ? 'bg-white/3 border-white/6 hover:bg-white/5'
          : 'bg-red-500/5 border-red-500/15',
      )}
    >
      <div className={cn('w-1.5 h-1.5 rounded-full mt-1.5 shrink-0', a.ok ? 'bg-emerald-400' : 'bg-red-400')} />
      <div className="flex-1 min-w-0">
        {a.agent && (
          <p className="text-[9px] font-semibold text-violet-400/70 uppercase tracking-wider mb-0.5">
            {a.agent}
          </p>
        )}
        <p className="text-[11px] text-white/70 leading-tight">{a.label}</p>
        {a.detail && (
          <p className="text-[10px] text-white/35 leading-tight mt-0.5 truncate">{a.detail}</p>
        )}
        <p className="text-[9px] text-white/25 flex items-center gap-1 mt-0.5">
          <Clock className="w-2 h-2" />
          {new Date(a.ts).toLocaleTimeString('pt-BR', {
            hour: '2-digit', minute: '2-digit', second: '2-digit',
          })}
        </p>
      </div>
    </motion.div>
  )
})

// CEO Mode panel — shows company alerts + opportunities
function CeoPanel({
  metrics, alerts, onCommand,
}: {
  metrics:   LiveMetrics
  alerts:    CompanyAlert[]
  onCommand: (cmd: string) => void
}) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="overflow-hidden border-b border-amber-500/20 bg-gradient-to-r from-amber-500/5 via-orange-500/4 to-transparent"
    >
      <div className="flex items-start gap-4 px-6 py-3">
        <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
          <Crown className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">CEO Mode</span>
        </div>
        <div className="flex-1 flex flex-wrap gap-2">
          {alerts.length === 0 ? (
            <span className="text-[11px] text-white/40">Empresa saudável — nenhum alerta crítico.</span>
          ) : (
            alerts.map((a, i) => (
              <button
                key={i}
                onClick={() => onCommand(`NEXUS, ${a.message.replace(/^[^\s]+\s/, '')}`)}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] border transition-all hover:scale-[1.02]',
                  a.type === 'warning'
                    ? 'bg-red-500/8 border-red-500/20 text-red-300 hover:bg-red-500/12'
                    : a.type === 'opportunity'
                    ? 'bg-emerald-500/8 border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/12'
                    : 'bg-white/4 border-white/10 text-white/50 hover:bg-white/6',
                )}
              >
                {a.message}
              </button>
            ))
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <div className={cn(
            'text-[10px] font-bold px-2 py-0.5 rounded-full border',
            metrics.health_score >= 70 ? 'text-emerald-400 bg-emerald-500/8 border-emerald-500/20'
            : metrics.health_score >= 40 ? 'text-amber-400 bg-amber-500/8 border-amber-500/20'
            : 'text-red-400 bg-red-500/8 border-red-500/20',
          )}>
            {metrics.health_score}/100
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// Agent route display
function AgentBadge({ agent, task }: { agent: string; task: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="mx-3 mt-2 p-2.5 rounded-xl bg-violet-500/8 border border-violet-500/20 flex items-center gap-2"
    >
      <BrainCircuit className="w-3.5 h-3.5 text-violet-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold text-violet-400">{agent}</p>
        <p className="text-[10px] text-white/40 truncate">{task}</p>
      </div>
      <Loader2 className="w-3 h-3 text-violet-400/50 animate-spin shrink-0" />
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
  const [ceoMode, setCeoMode]          = useState(false)
  const [alerts, setAlerts]            = useState<CompanyAlert[]>([])
  const [activeAgent, setActiveAgent]  = useState<{ agent: string; task: string } | null>(null)
  const [metrics, setMetrics]          = useState<LiveMetrics>({
    conversations: 0, unread: 0, ai_active: 0, hot_leads: 0,
    system_ok: true, health_score: 0, loaded: false,
  })
  const [recentCommands, setRecentCommands] = useState<string[]>([])

  const pcRef            = useRef<RTCPeerConnection | null>(null)
  const dcRef            = useRef<RTCDataChannel | null>(null)
  const audioElRef       = useRef<HTMLAudioElement | null>(null)
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null)
  const transcriptRef    = useRef<HTMLDivElement>(null)
  const reconnectCountRef = useRef(0)
  const stoppedRef       = useRef(false)

  // ── localStorage memory ───────────────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem('nexus_recent_commands')
      if (saved) setRecentCommands(JSON.parse(saved) as string[])
      const ceo = localStorage.getItem('nexus_ceo_mode')
      if (ceo === 'true') setCeoMode(true)
    } catch {}
  }, [])

  // ── Load live metrics ─────────────────────────────────────────────────────
  const loadMetrics = useCallback(async () => {
    try {
      const [summaryRes, analysisRes] = await Promise.all([
        fetch('/api/nexus/voice/execute', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool: 'getDashboardSummary', params: {} }),
        }),
        fetch('/api/nexus/voice/execute', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool: 'analyzeCompany', params: {} }),
        }),
      ])
      const summary  = await summaryRes.json()  as Record<string, unknown>
      const analysis = await analysisRes.json() as Record<string, unknown>

      const convs  = summary.conversations    as Record<string, number> | undefined
      const aData  = analysis as {
        health_score?: number
        conversations?: { hot?: number }
        alerts?: string[]
        opportunities?: string[]
        system_ok?: boolean
      }

      const alertsList: CompanyAlert[] = [
        ...(aData.alerts ?? []).map(a => ({ type: 'warning' as const, message: a })),
        ...(aData.opportunities ?? []).map(a => ({ type: 'opportunity' as const, message: a })),
      ]
      setAlerts(alertsList)

      setMetrics({
        conversations: convs?.total    ?? 0,
        unread:        convs?.unread   ?? 0,
        ai_active:     convs?.ai_on    ?? convs?.ai_active ?? 0,
        hot_leads:     aData.conversations?.hot ?? 0,
        system_ok:     aData.system_ok !== false,
        health_score:  aData.health_score ?? 0,
        loaded:        true,
      })
    } catch {
      setMetrics(m => ({ ...m, loaded: true }))
    }
  }, [])

  useEffect(() => { loadMetrics() }, [loadMetrics])

  // Auto-refresh metrics every 60s
  useEffect(() => {
    const t = setInterval(loadMetrics, 60000)
    return () => clearInterval(t)
  }, [loadMetrics])

  // ── Auto-scroll transcript ────────────────────────────────────────────────
  useEffect(() => {
    if (transcriptRef.current) {
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
    }
  }, [transcript])

  // ── Session timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (voiceState !== 'off' && voiceState !== 'error') {
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      if (voiceState === 'off') setDuration(0)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [voiceState])

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

  // ── CEO mode toggle ───────────────────────────────────────────────────────
  const toggleCeoMode = useCallback(() => {
    setCeoMode(prev => {
      const next = !prev
      try { localStorage.setItem('nexus_ceo_mode', String(next)) } catch {}
      return next
    })
  }, [])

  // ── Tool execution ────────────────────────────────────────────────────────
  const executeTool = useCallback(async (toolName: string, params: Record<string, unknown>) => {
    const logId = `act-${Date.now()}`
    setActionLog(prev => [{
      id:    logId,
      tool:  toolName,
      label: TOOL_LABELS[toolName] ?? toolName,
      ts:    Date.now(),
      ok:    true,
    }, ...prev.slice(0, 49)])

    if (toolName === 'navigate') {
      const path = params.path as string
      if (path) router.push(path)
      return { success: true, summary: `Navegando para ${params.page_name ?? path}` }
    }

    if (toolName === 'orchestrateAgent') {
      const agentLabel = String(params.agent ?? 'IA')
      const task       = String(params.task ?? '')
      setActiveAgent({ agent: `${agentLabel} IA`, task })
      setTimeout(() => setActiveAgent(null), 6000)
    }

    try {
      const res  = await fetch('/api/nexus/voice/execute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: toolName, params }),
      })
      const data = await res.json() as Record<string, unknown>

      // Update action log with detail
      const detail = (data.summary as string | undefined) ?? (data.error as string | undefined)
      setActionLog(prev => prev.map(a => a.id === logId
        ? { ...a, detail: detail?.slice(0, 80), ok: !data.error }
        : a,
      ))

      // Refresh metrics after mutating tools
      const mutating = ['sendWhatsAppMessage', 'toggleAI', 'updateLeadStage', 'markConversationRead', 'createTask', 'triggerAutomation']
      if (mutating.includes(toolName)) {
        setTimeout(loadMetrics, 1800)
      }

      return data
    } catch {
      setActionLog(prev => prev.map(a => a.id === logId ? { ...a, ok: false } : a))
      return { error: 'Falha na execução' }
    }
  }, [router, loadMetrics])

  // ── DataChannel handler ───────────────────────────────────────────────────
  const handleDCMessage = useCallback((ev: MessageEvent) => {
    let msg: Record<string, unknown>
    try { msg = JSON.parse(ev.data as string) } catch { return }
    const type = msg.type as string

    if (type === 'input_audio_buffer.speech_started') setVoiceState('listening')
    if (type === 'input_audio_buffer.speech_stopped')  setVoiceState('thinking')

    if (type === 'conversation.item.input_audio_transcription.completed') {
      const text = (msg.transcript as string | undefined)?.trim()
      if (text) setTranscript(prev => [...prev, { id: `u-${Date.now()}`, role: 'user', text, ts: Date.now() }])
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
          return [...prev, { id: `ai-stream-${Date.now()}`, role: 'assistant', text: delta, ts: Date.now() }]
        })
      }
    }

    if (type === 'response.done') setVoiceState('idle')

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
            item: { type: 'function_call_output', call_id: item.call_id, output: JSON.stringify(result) },
          }))
          dc.send(JSON.stringify({ type: 'response.create' }))
        })
      }
    }

    if (type === 'error') {
      const err = msg.error as Record<string, unknown> | undefined
      console.error('[NEXUS realtime] error:', err)
      setVoiceState('error')
      setErrorMsg((err?.message as string) ?? 'Erro desconhecido')
    }
  }, [executeTool])

  // ── Session control ───────────────────────────────────────────────────────
  const stopSession = useCallback(() => {
    stoppedRef.current = true
    dcRef.current?.close()
    dcRef.current = null
    pcRef.current?.close()
    pcRef.current = null
    if (audioElRef.current) { audioElRef.current.srcObject = null; audioElRef.current = null }
    setVoiceState('off')
    reconnectCountRef.current = 0
  }, [])

  const startSession = useCallback(async () => {
    if (voiceState !== 'off' && voiceState !== 'error') return
    stoppedRef.current = false
    setVoiceState('connecting')
    setErrorMsg(null)

    try {
      const sessionRes = await fetch('/api/nexus/voice/session', { method: 'POST' })
      if (!sessionRes.ok) {
        const body = await sessionRes.json().catch(() => ({})) as Record<string, unknown>
        throw new Error((body.error as string) ?? `HTTP ${sessionRes.status}`)
      }
      const sessionData = await sessionRes.json() as Record<string, unknown>

      const ephemeralKey = sessionData?.ephemeral_key as string | undefined
        ?? (sessionData?.client_secret as { value?: string } | undefined)?.value
      if (!ephemeralKey) {
        throw new Error(`Sem chave efêmera: ${JSON.stringify(sessionData).slice(0, 200)}`)
      }

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

      dc.onopen = () => {
        dc.send(JSON.stringify(SESSION_UPDATE))
        setVoiceState('idle')
        reconnectCountRef.current = 0
      }
      dc.onclose = () => {
        // Silent auto-reconnect (max 3 attempts)
        if (!stoppedRef.current && reconnectCountRef.current < 3) {
          reconnectCountRef.current++
          setVoiceState('connecting')
          setTimeout(() => startSession(), 1500 * reconnectCountRef.current)
        } else if (!stoppedRef.current) {
          setVoiceState('off')
        }
      }
      dc.onmessage = handleDCMessage

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)

      // Correct SDP endpoint: /v1/realtime?model=...
      const model = (sessionData.model as string | undefined) ?? REALTIME_MODEL
      const sdpRes = await fetch(`https://api.openai.com/v1/realtime?model=${model}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ephemeralKey}`,
          'Content-Type':  'application/sdp',
        },
        body: offer.sdp,
      })
      if (!sdpRes.ok) {
        const errText = await sdpRes.text().catch(() => '')
        throw new Error(`OpenAI SDP ${sdpRes.status}: ${errText.slice(0, 200)}`)
      }

      const answerSdp = await sdpRes.text()
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })

    } catch (err) {
      console.error('[NEXUS] startSession error:', err)
      setVoiceState('error')
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao iniciar sessão')
      stopSession()
    }
  }, [voiceState, handleDCMessage, stopSession])

  const sendTextCommand = useCallback((prompt: string) => {
    const dc = dcRef.current
    if (!dc || dc.readyState !== 'open') return
    dc.send(JSON.stringify({
      type: 'conversation.item.create',
      item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: prompt }] },
    }))
    dc.send(JSON.stringify({ type: 'response.create' }))
    setTranscript(prev => [...prev, { id: `u-cmd-${Date.now()}`, role: 'user', text: prompt, ts: Date.now() }])
    setRecentCommands(prev => {
      const updated = [prompt, ...prev.filter(p => p !== prompt)].slice(0, 12)
      try { localStorage.setItem('nexus_recent_commands', JSON.stringify(updated)) } catch {}
      return updated
    })
  }, [])

  const isActive = voiceState !== 'off' && voiceState !== 'error'
  const waveColor = voiceState === 'listening' ? 'bg-cyan-400' : voiceState === 'speaking' ? 'bg-emerald-400' : 'bg-violet-400/30'

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#08080d] text-white flex flex-col overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-white/4 bg-black/30 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600/30 to-purple-900/30 border border-violet-500/25 flex items-center justify-center shadow-lg shadow-violet-500/10">
            <Cpu className="w-4 h-4 text-violet-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[13px] font-bold tracking-widest text-white/90 uppercase">NEXUS</h1>
              <span className="text-[9px] text-white/25 font-mono">OS v2.0</span>
            </div>
            <p className="text-[10px] text-white/35">Sistema Operacional de IA · 21 ferramentas · Execução em tempo real</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* CEO Mode toggle */}
          <button
            onClick={toggleCeoMode}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-semibold border transition-all',
              ceoMode
                ? 'text-amber-400 bg-amber-500/10 border-amber-500/25 shadow-sm shadow-amber-500/10'
                : 'text-white/35 bg-white/3 border-white/8 hover:border-white/15 hover:text-white/50',
            )}
          >
            <Crown className={cn('w-3.5 h-3.5', ceoMode && 'animate-pulse')} />
            CEO Mode
          </button>

          {/* Refresh */}
          <button onClick={loadMetrics} className="p-1.5 rounded-lg text-white/20 hover:text-white/40 hover:bg-white/5 transition-all">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          {/* Session info + stop */}
          {isActive && (
            <>
              <div className="flex items-center gap-1.5 text-[11px] text-white/40">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {fmt(sessionDuration)}
              </div>
              <button
                onClick={stopSession}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-[11px] font-medium hover:bg-red-500/15 transition-all"
              >
                <MicOff className="w-3.5 h-3.5" />
                Encerrar
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Live metrics ── */}
      <LiveMetricsBar metrics={metrics} />

      {/* ── CEO Mode panel ── */}
      <AnimatePresence>
        {ceoMode && (
          <CeoPanel metrics={metrics} alerts={alerts} onCommand={sendTextCommand} />
        )}
      </AnimatePresence>

      {/* ── Main content ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left: Orb + Waveform + Transcript + Quick ── */}
        <div className="flex flex-1 flex-col items-center overflow-hidden">

          {/* Orb zone */}
          <div className="flex flex-col items-center gap-4 py-5 shrink-0">
            <VoiceOrb state={voiceState} onClick={() => {
              if (voiceState === 'off' || voiceState === 'error') startSession()
              else stopSession()
            }} />

            {/* Waveform */}
            <WaveformBars
              active={voiceState === 'listening' || voiceState === 'speaking'}
              color={waveColor}
            />

            {/* Error message */}
            <AnimatePresence>
              {errorMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col gap-1.5 px-4 py-3 rounded-2xl bg-red-500/8 border border-red-500/20 text-red-400 text-[11px] max-w-sm mx-4"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span className="flex-1 leading-relaxed">{errorMsg}</span>
                    <button onClick={() => setErrorMsg(null)}><X className="w-3 h-3" /></button>
                  </div>
                  {(errorMsg.toLowerCase().includes('model') || errorMsg.includes('403') || errorMsg.includes('401') || errorMsg.includes('api key')) && (
                    <p className="text-red-400/60 text-[9px] pl-5">
                      Verifique <code className="bg-red-500/15 px-1 rounded">OPENAI_API_KEY</code> no Vercel. Conta precisa de acesso à Realtime API.
                    </p>
                  )}
                  <button
                    onClick={() => { setErrorMsg(null); startSession() }}
                    className="ml-5 flex items-center gap-1 text-[10px] text-red-300/70 hover:text-red-300 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" /> Tentar novamente
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {voiceState === 'off' && !errorMsg && (
              <p className="text-white/20 text-[11px] text-center">
                Clique para ativar o Sistema Operacional de IA
              </p>
            )}
          </div>

          {/* Transcript */}
          <div className="flex-1 w-full max-w-2xl px-5 overflow-hidden flex flex-col min-h-0">
            <div className="flex items-center gap-2 mb-2.5">
              <MessageSquare className="w-3 h-3 text-white/20" />
              <span className="text-[9px] text-white/20 uppercase tracking-widest font-semibold">Transcrição em tempo real</span>
            </div>
            <div
              ref={transcriptRef}
              className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-thin scrollbar-thumb-white/8"
            >
              {transcript.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-20 gap-2 text-white/15 text-[11px]">
                  <Cpu className="w-6 h-6 opacity-30" />
                  Inicie uma sessão para ativar o NEXUS
                </div>
              ) : (
                transcript.map(e => <TranscriptBubble key={e.id} entry={e} />)
              )}
            </div>
          </div>

          {/* Quick commands — 5×4 grid */}
          <div className="w-full max-w-2xl px-5 py-4 border-t border-white/4 shrink-0">
            <p className="text-[9px] text-white/20 uppercase tracking-widest font-semibold mb-2.5">Comandos rápidos</p>
            <div className="grid grid-cols-5 gap-1.5">
              {QUICK.map(q => {
                const Icon     = q.icon
                const colorCls = COLOR_MAP[q.color] ?? ''
                return (
                  <button
                    key={q.label}
                    disabled={!isActive}
                    onClick={() => sendTextCommand(q.prompt)}
                    className={cn(
                      'flex flex-col items-center gap-1 p-2 rounded-xl bg-white/3 border border-white/6 text-white/40 transition-all',
                      'disabled:opacity-25 disabled:cursor-not-allowed text-[9px] leading-tight text-center',
                      colorCls,
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span className="leading-none">{q.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Right: Action Log + Memory ── */}
        <div className="w-72 border-l border-white/4 flex flex-col overflow-hidden shrink-0 bg-black/10">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/4">
            <div className="flex items-center gap-2">
              <Activity className="w-3 h-3 text-white/25" />
              <span className="text-[9px] text-white/25 uppercase tracking-widest font-semibold">Execução em tempo real</span>
            </div>
            {actionLog.length > 0 && (
              <button onClick={() => setActionLog([])} className="text-white/15 hover:text-white/30 text-[9px] transition-colors">
                Limpar
              </button>
            )}
          </div>

          {/* Active agent indicator */}
          <AnimatePresence>
            {activeAgent && (
              <AgentBadge agent={activeAgent.agent} task={activeAgent.task} />
            )}
          </AnimatePresence>

          {/* Action log */}
          <div className="flex-1 overflow-y-auto px-2.5 py-2 space-y-1.5 scrollbar-thin scrollbar-thumb-white/6">
            {actionLog.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-24 gap-2 text-white/15 text-[10px]">
                <Zap className="w-5 h-5 opacity-30" />
                Nenhuma ação executada
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {actionLog.map(a => <ActionCard key={a.id} a={a} />)}
              </AnimatePresence>
            )}
          </div>

          {/* Memory */}
          {recentCommands.length > 0 && (
            <div className="border-t border-white/4">
              <div className="flex items-center gap-1.5 px-4 py-2">
                <Eye className="w-3 h-3 text-white/20" />
                <span className="text-[9px] text-white/20 uppercase tracking-widest font-semibold">Memória de sessão</span>
              </div>
              <div className="px-2.5 pb-3 space-y-0.5">
                {recentCommands.slice(0, 6).map((cmd, i) => (
                  <button
                    key={i}
                    disabled={!isActive}
                    onClick={() => sendTextCommand(cmd)}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg text-[10px] text-white/30 hover:bg-white/5 hover:text-white/55 transition-all truncate disabled:opacity-20 disabled:cursor-not-allowed"
                  >
                    {cmd}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Status footer */}
          <div className="px-4 py-2.5 border-t border-white/4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-white/15" />
                <span className="text-[9px] text-white/20 font-mono">{REALTIME_MODEL}</span>
              </div>
              <div className={cn('flex items-center gap-1 text-[9px]', isActive ? 'text-emerald-400/70' : 'text-white/20')}>
                <div className={cn('w-1.5 h-1.5 rounded-full', isActive ? 'bg-emerald-400 animate-pulse' : 'bg-white/15')} />
                {isActive ? 'Online' : 'Offline'}
              </div>
            </div>

            {/* Action count */}
            {actionLog.length > 0 && (
              <div className="flex items-center justify-between mt-1.5">
                <span className="text-[9px] text-white/15">{actionLog.length} ações executadas</span>
                <span className="text-[9px] text-emerald-400/50">
                  {actionLog.filter(a => a.ok).length} ok
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
