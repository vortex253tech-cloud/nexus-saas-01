'use client'

import { useEffect, useRef, useState, useCallback, memo } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic, MicOff, Activity, AlertCircle, X, RefreshCw, Loader2,
  Volume2, BrainCircuit, Crown, BarChart2, TrendingUp, MessageSquare,
  DollarSign, CheckSquare, Zap, GitBranch, Bell, Monitor, Calendar,
  FileText, Settings2, Clock, Search, Bot, Layers, Map, Send,
  ArrowRight, ChevronRight, Cpu, Shield, Target, Wifi,
  MessageCircle, CheckCircle, CircleAlert, Timer, Sparkles,
} from 'lucide-react'
import {
  NexusRealtimeClient,
  type NexusState,
} from '@/lib/realtime/nexus-realtime-client'
import {
  routeAction,
  getNavigationPath,
  extractAgentInfo,
  type RoutedResult,
} from '@/lib/voice/assistant-action-router'
import { QUICK_COMMANDS } from '@/lib/voice/assistant-action-engine'

// ── utils ─────────────────────────────────────────────────────────────────────

function cn(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(' ')
}

function fmt(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, '0')
  return `${m}:${(s % 60).toString().padStart(2, '0')}`
}

function time12(ts: number) {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface TranscriptEntry {
  id: string; role: 'user' | 'assistant'; text: string; ts: number; final: boolean
}

interface ActionLog {
  id: string; tool: string; label: string; ts: number; ok: boolean; detail?: string
}

interface LiveMetrics {
  conversations: number; unread: number; ai_active: number; hot_leads: number
  system_ok: boolean; health_score: number; loaded: boolean
}

// ── Command definitions with lucide icons (no emojis) ─────────────────────────

type LucideIcon = React.ComponentType<{ className?: string; strokeWidth?: number; style?: React.CSSProperties }>

interface OpsCommand {
  label:    string
  sub:      string
  icon:     LucideIcon
  command:  string
  category: string
  accent:   string  // tailwind color token
}

const OPS_COMMANDS: OpsCommand[] = [
  { label: 'Dashboard Executivo',  sub: 'Visão geral da empresa',      icon: BarChart2,    command: 'Mostra o dashboard executivo',          category: 'operações',   accent: 'violet' },
  { label: 'Análise de Empresa',   sub: 'IA analisa todas as métricas',icon: BrainCircuit, command: 'Faz uma análise completa da empresa',   category: 'operações',   accent: 'violet' },
  { label: 'Status do Sistema',    sub: 'Saúde operacional em tempo real',icon: Monitor,   command: 'Verifica a saúde do sistema',           category: 'operações',   accent: 'slate'  },
  { label: 'Modo CEO',             sub: 'Monitoramento executivo ativo', icon: Crown,      command: 'Ativa o modo CEO com monitoramento',    category: 'operações',   accent: 'amber'  },
  { label: 'Leads Quentes',        sub: 'Prospects com maior atividade',icon: TrendingUp,  command: 'Quais são os leads mais quentes?',      category: 'vendas',      accent: 'orange' },
  { label: 'Pipeline de Vendas',   sub: 'Distribuição por estágio',     icon: GitBranch,   command: 'Mostra o pipeline de vendas',           category: 'vendas',      accent: 'blue'   },
  { label: 'Gerar Proposta',       sub: 'Proposta comercial inteligente',icon: FileText,   command: 'Gera uma proposta comercial',           category: 'vendas',      accent: 'emerald'},
  { label: 'Criar Follow-up',      sub: 'Agendar próximo contato',      icon: Clock,       command: 'Cria um follow-up para amanhã',         category: 'vendas',      accent: 'amber'  },
  { label: 'Buscar Contato',       sub: 'Localizar lead ou cliente',    icon: Search,      command: 'Busca um lead específico',              category: 'vendas',      accent: 'sky'    },
  { label: 'WhatsApp',             sub: 'Central de atendimento',       icon: MessageSquare, command: 'Abre o WhatsApp e mostra mensagens', category: 'comunicação', accent: 'green'  },
  { label: 'Mensagens Pendentes',  sub: 'Conversas não respondidas',    icon: Bell,        command: 'Quais mensagens não foram lidas?',      category: 'comunicação', accent: 'red'    },
  { label: 'Enviar Mensagem',      sub: 'Contato direto via WhatsApp',  icon: Send,        command: 'Envia mensagem para um cliente',        category: 'comunicação', accent: 'teal'   },
  { label: 'Resumo Financeiro',    sub: 'Receita, despesas e resultado',icon: DollarSign,  command: 'Mostra o resumo financeiro do mês',    category: 'financeiro',  accent: 'yellow' },
  { label: 'Automações Ativas',    sub: 'Fluxos em execução',           icon: Zap,         command: 'Lista as automações ativas',            category: 'automações',  accent: 'cyan'   },
  { label: 'Nova Automação',       sub: 'Criar fluxo inteligente',      icon: Settings2,   command: 'Cria uma nova automação',              category: 'automações',  accent: 'indigo' },
  { label: 'Agentes de IA',        sub: 'Especialistas em ação',        icon: Bot,         command: 'Aciona o agente de growth',            category: 'automações',  accent: 'fuchsia'},
  { label: 'Criar Tarefa',         sub: 'Nova ação operacional',        icon: CheckSquare, command: 'Cria uma nova tarefa urgente',          category: 'projetos',    accent: 'blue'   },
  { label: 'Projetos',             sub: 'Gestão de iniciativas',        icon: Layers,      command: 'Abre os projetos ativos',              category: 'projetos',    accent: 'lime'   },
  { label: 'Agendar Reunião',      sub: 'Gestão de agenda executiva',   icon: Calendar,    command: 'Agenda uma reunião',                   category: 'projetos',    accent: 'indigo' },
  { label: 'Growth Map',           sub: 'Mapa estratégico de crescimento',icon: Map,       command: 'Mostra o mapa de crescimento',         category: 'projetos',    accent: 'rose'   },
]

// Accent color map → Tailwind classes (safe for Tailwind JIT)
const ACCENT: Record<string, { border: string; bg: string; text: string; icon: string; glow: string }> = {
  violet:  { border: 'hover:border-violet-500/30', bg: 'hover:bg-violet-500/6',  text: 'group-hover:text-violet-300',  icon: 'group-hover:text-violet-400',  glow: 'shadow-violet-500/10'  },
  orange:  { border: 'hover:border-orange-500/30', bg: 'hover:bg-orange-500/6',  text: 'group-hover:text-orange-300',  icon: 'group-hover:text-orange-400',  glow: 'shadow-orange-500/10'  },
  green:   { border: 'hover:border-green-500/30',  bg: 'hover:bg-green-500/6',   text: 'group-hover:text-green-300',   icon: 'group-hover:text-green-400',   glow: 'shadow-green-500/10'   },
  yellow:  { border: 'hover:border-yellow-500/30', bg: 'hover:bg-yellow-500/6',  text: 'group-hover:text-yellow-300',  icon: 'group-hover:text-yellow-400',  glow: 'shadow-yellow-500/10'  },
  blue:    { border: 'hover:border-blue-500/30',   bg: 'hover:bg-blue-500/6',    text: 'group-hover:text-blue-300',    icon: 'group-hover:text-blue-400',    glow: 'shadow-blue-500/10'    },
  emerald: { border: 'hover:border-emerald-500/30',bg: 'hover:bg-emerald-500/6', text: 'group-hover:text-emerald-300', icon: 'group-hover:text-emerald-400', glow: 'shadow-emerald-500/10' },
  cyan:    { border: 'hover:border-cyan-500/30',   bg: 'hover:bg-cyan-500/6',    text: 'group-hover:text-cyan-300',    icon: 'group-hover:text-cyan-400',    glow: 'shadow-cyan-500/10'    },
  teal:    { border: 'hover:border-teal-500/30',   bg: 'hover:bg-teal-500/6',    text: 'group-hover:text-teal-300',    icon: 'group-hover:text-teal-400',    glow: 'shadow-teal-500/10'    },
  red:     { border: 'hover:border-red-500/30',    bg: 'hover:bg-red-500/6',     text: 'group-hover:text-red-300',     icon: 'group-hover:text-red-400',     glow: 'shadow-red-500/10'     },
  slate:   { border: 'hover:border-slate-400/25',  bg: 'hover:bg-slate-500/6',   text: 'group-hover:text-slate-300',   icon: 'group-hover:text-slate-400',   glow: 'shadow-slate-500/10'   },
  indigo:  { border: 'hover:border-indigo-500/30', bg: 'hover:bg-indigo-500/6',  text: 'group-hover:text-indigo-300',  icon: 'group-hover:text-indigo-400',  glow: 'shadow-indigo-500/10'  },
  amber:   { border: 'hover:border-amber-500/30',  bg: 'hover:bg-amber-500/6',   text: 'group-hover:text-amber-300',   icon: 'group-hover:text-amber-400',   glow: 'shadow-amber-500/10'   },
  sky:     { border: 'hover:border-sky-500/30',    bg: 'hover:bg-sky-500/6',     text: 'group-hover:text-sky-300',     icon: 'group-hover:text-sky-400',     glow: 'shadow-sky-500/10'     },
  fuchsia: { border: 'hover:border-fuchsia-500/30',bg: 'hover:bg-fuchsia-500/6', text: 'group-hover:text-fuchsia-300', icon: 'group-hover:text-fuchsia-400', glow: 'shadow-fuchsia-500/10' },
  lime:    { border: 'hover:border-lime-500/30',   bg: 'hover:bg-lime-500/6',    text: 'group-hover:text-lime-300',    icon: 'group-hover:text-lime-400',    glow: 'shadow-lime-500/10'    },
  rose:    { border: 'hover:border-rose-500/30',   bg: 'hover:bg-rose-500/6',    text: 'group-hover:text-rose-300',    icon: 'group-hover:text-rose-400',    glow: 'shadow-rose-500/10'    },
}

// ── Orb state config ───────────────────────────────────────────────────────────

const ORB_CFG: Record<NexusState | 'off', {
  gradient: string; glowColor: string; label: string; sublabel: string
  pulse: boolean; ring: string
}> = {
  off:          { gradient: 'from-slate-800 via-slate-900 to-black',          glowColor: '#334155',   label: 'NEXUS OS',     sublabel: 'Aguardando ativação',   pulse: false, ring: '#1e293b'   },
  disconnected: { gradient: 'from-slate-800 via-slate-900 to-black',          glowColor: '#334155',   label: 'NEXUS OS',     sublabel: 'Aguardando ativação',   pulse: false, ring: '#1e293b'   },
  connecting:   { gradient: 'from-violet-700 via-purple-800 to-indigo-900',   glowColor: '#7c3aed',   label: 'CONECTANDO',   sublabel: 'Estabelecendo link',    pulse: true,  ring: '#6d28d9'   },
  idle:         { gradient: 'from-emerald-600 via-teal-700 to-cyan-900',      glowColor: '#059669',   label: 'ONLINE',       sublabel: 'IA pronta para operar', pulse: false, ring: '#10b981'   },
  listening:    { gradient: 'from-cyan-500 via-sky-600 to-blue-800',          glowColor: '#06b6d4',   label: 'OUVINDO',      sublabel: 'Processando áudio',     pulse: true,  ring: '#22d3ee'   },
  processing:   { gradient: 'from-violet-600 via-purple-700 to-indigo-900',   glowColor: '#7c3aed',   label: 'PROCESSANDO',  sublabel: 'IA em processamento',   pulse: true,  ring: '#8b5cf6'   },
  executing:    { gradient: 'from-amber-500 via-orange-600 to-red-800',       glowColor: '#d97706',   label: 'EXECUTANDO',   sublabel: 'Ação em andamento',     pulse: true,  ring: '#f59e0b'   },
  speaking:     { gradient: 'from-emerald-500 via-teal-600 to-cyan-800',      glowColor: '#10b981',   label: 'RESPONDENDO',  sublabel: 'NEXUS transmitindo',    pulse: true,  ring: '#34d399'   },
  error:        { gradient: 'from-red-600 via-rose-700 to-red-900',           glowColor: '#dc2626',   label: 'ERRO',         sublabel: 'Falha na conexão',      pulse: false, ring: '#ef4444'   },
}

// ── Orb component ─────────────────────────────────────────────────────────────

function NexusOrb({ state, onClick }: { state: NexusState | 'off'; onClick: () => void }) {
  const cfg = ORB_CFG[state]
  const isActive = state !== 'off' && state !== 'disconnected'

  return (
    <div className="relative flex items-center justify-center select-none" style={{ width: 200, height: 200 }}>

      {/* Outermost ambient glow */}
      <motion.div
        className="absolute rounded-full"
        style={{ width: 180, height: 180, background: `radial-gradient(circle, ${cfg.glowColor}22 0%, transparent 70%)` }}
        animate={{ opacity: isActive ? 1 : 0.3, scale: cfg.pulse ? [1, 1.12, 1] : 1 }}
        transition={{ duration: 2.5, repeat: cfg.pulse ? Infinity : 0, ease: 'easeInOut' }}
      />

      {/* Pulsing rings when active */}
      {cfg.pulse && (
        <>
          {[1, 2, 3].map(i => (
            <motion.div key={i}
              className="absolute rounded-full border"
              style={{
                width: 100 + i * 28, height: 100 + i * 28,
                borderColor: cfg.glowColor + '55',
              }}
              animate={{ scale: [0.85, 1.25], opacity: [0.6, 0] }}
              transition={{ duration: 2.2 + i * 0.35, repeat: Infinity, delay: i * 0.55, ease: 'easeOut' }}
            />
          ))}
        </>
      )}

      {/* Outer rotating ring */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 148, height: 148,
          border: `1px solid ${cfg.ring}40`,
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
      >
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ width: 5, height: 5, background: cfg.ring, boxShadow: `0 0 6px ${cfg.ring}` }}
        />
        <div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 rounded-full opacity-40"
          style={{ width: 3, height: 3, background: cfg.ring }}
        />
      </motion.div>

      {/* Counter-rotating inner ring */}
      <motion.div
        className="absolute rounded-full"
        style={{ width: 128, height: 128, border: `1px solid ${cfg.ring}25` }}
        animate={{ rotate: -360 }}
        transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
      />

      {/* Main orb surface */}
      <motion.button
        onClick={onClick}
        whileHover={{ scale: 1.04 }}
        whileTap={{ scale: 0.96 }}
        className={cn(
          'relative z-10 rounded-full overflow-hidden cursor-pointer',
          `bg-gradient-to-br ${cfg.gradient}`,
        )}
        style={{
          width: 108, height: 108,
          boxShadow: `0 0 40px 12px ${cfg.glowColor}35, inset 0 1px 0 rgba(255,255,255,0.1)`,
        }}
        animate={{ boxShadow: isActive
          ? [`0 0 40px 12px ${cfg.glowColor}35`, `0 0 55px 18px ${cfg.glowColor}50`, `0 0 40px 12px ${cfg.glowColor}35`]
          : `0 0 20px 6px ${cfg.glowColor}20`
        }}
        transition={{ duration: 2, repeat: isActive ? Infinity : 0, ease: 'easeInOut' }}
      >
        {/* Inner glass overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-white/10" />
        {/* Inner glow */}
        <div className="absolute inset-0 rounded-full" style={{ background: `radial-gradient(circle at 35% 30%, ${cfg.glowColor}30, transparent 65%)` }} />

        <div className="relative z-10 flex flex-col items-center justify-center h-full gap-1">
          {state === 'connecting'  && <Loader2     className="w-9 h-9 text-white animate-spin" strokeWidth={1.5} />}
          {(state === 'off' || state === 'disconnected') && <Mic className="w-9 h-9 text-white/70" strokeWidth={1.5} />}
          {state === 'idle'        && <Volume2      className="w-9 h-9 text-white"    strokeWidth={1.5} />}
          {state === 'listening'   && <Mic          className="w-9 h-9 text-white"    strokeWidth={1.5} />}
          {state === 'processing'  && <BrainCircuit className="w-9 h-9 text-white"    strokeWidth={1.5} />}
          {state === 'executing'   && <Zap          className="w-9 h-9 text-white"    strokeWidth={1.5} />}
          {state === 'speaking'    && <Volume2      className="w-9 h-9 text-white"    strokeWidth={1.5} />}
          {state === 'error'       && <AlertCircle  className="w-9 h-9 text-white"    strokeWidth={1.5} />}
        </div>
      </motion.button>
    </div>
  )
}

// ── Waveform ───────────────────────────────────────────────────────────────────

const Waveform = memo(function Waveform({ state, levels }: { state: NexusState | 'off'; levels: number[] }) {
  const active = state === 'listening' || state === 'speaking' || state === 'processing'
  const color  =
    state === 'listening'  ? '#22d3ee' :
    state === 'speaking'   ? '#34d399' :
    state === 'processing' ? '#a78bfa' :
    state === 'executing'  ? '#f59e0b' : '#64748b'

  return (
    <div className="flex items-center justify-center gap-[3px]" style={{ height: 36 }}>
      {Array.from({ length: 20 }).map((_, i) => {
        const real = active && levels[i] > 0.02
        return (
          <motion.div
            key={i}
            className="rounded-full"
            style={{ width: 2.5, height: 32, background: color, transformOrigin: 'center' }}
            animate={active && !real
              ? { scaleY: [0.08, 0.5 + (i % 5) * 0.1, 0.08], opacity: [0.15, 0.7, 0.15] }
              : { scaleY: real ? Math.max(0.08, levels[i]) : 0.08, opacity: real ? 0.9 : 0.12 }
            }
            transition={active && !real
              ? { duration: 0.9 + (i % 4) * 0.15, repeat: Infinity, delay: (i * 0.05) % 0.6, ease: 'easeInOut' }
              : { duration: 0.06, ease: 'linear' }
            }
          />
        )
      })}
    </div>
  )
})

// ── State label badge ─────────────────────────────────────────────────────────

function StateLabel({ state }: { state: NexusState | 'off' }) {
  const cfg = ORB_CFG[state]
  const dotColor =
    state === 'idle'        ? '#10b981' :
    state === 'listening'   ? '#22d3ee' :
    state === 'processing'  ? '#8b5cf6' :
    state === 'executing'   ? '#f59e0b' :
    state === 'speaking'    ? '#34d399' :
    state === 'error'       ? '#ef4444' :
    state === 'connecting'  ? '#7c3aed' : '#475569'

  const isActive = state !== 'off' && state !== 'disconnected'

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-center gap-2">
        <div
          className="w-1.5 h-1.5 rounded-full"
          style={{
            background: dotColor,
            boxShadow: isActive ? `0 0 6px ${dotColor}` : 'none',
          }}
        />
        <span className="text-[11px] font-bold tracking-[0.2em] uppercase" style={{ color: dotColor }}>
          {cfg.label}
        </span>
      </div>
      <span className="text-[10px] text-white/25 tracking-wide">{cfg.sublabel}</span>
    </div>
  )
}

// ── Ops command card ───────────────────────────────────────────────────────────

const OpsCard = memo(function OpsCard({
  cmd, onClick, isActive,
}: { cmd: OpsCommand; onClick: () => void; isActive: boolean }) {
  const ac = ACCENT[cmd.accent] ?? ACCENT.slate
  const Icon = cmd.icon

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.015, y: -1 }}
      whileTap={{ scale: 0.985 }}
      className={cn(
        'group relative flex flex-col gap-3 p-4 rounded-2xl text-left cursor-pointer',
        'border border-white/[0.06] bg-white/[0.025]',
        'backdrop-blur-sm transition-all duration-200',
        'hover:shadow-lg',
        ac.border, ac.bg, ac.glow,
      )}
    >
      {/* Top row: icon + arrow */}
      <div className="flex items-start justify-between">
        <div className={cn(
          'w-9 h-9 rounded-xl flex items-center justify-center',
          'bg-white/[0.05] border border-white/[0.06] transition-all duration-200',
          'group-hover:border-current/20 group-hover:bg-white/[0.08]',
        )}>
          <Icon className={cn('w-4 h-4 text-white/40 transition-colors duration-200', ac.icon)} />
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-white/15 group-hover:text-white/35 transition-all duration-200 group-hover:translate-x-0.5" />
      </div>

      {/* Label */}
      <div>
        <p className={cn('text-[12.5px] font-semibold text-white/70 leading-snug transition-colors duration-200', ac.text)}>
          {cmd.label}
        </p>
        <p className="text-[10.5px] text-white/25 leading-snug mt-0.5">{cmd.sub}</p>
      </div>

      {/* Bottom: category tag */}
      <div className="flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-[0.12em] text-white/15 font-medium">
          {cmd.category}
        </span>
        {isActive && (
          <div className="flex items-center gap-1">
            <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[9px] text-emerald-400/60">pronto</span>
          </div>
        )}
      </div>
    </motion.button>
  )
})

// ── Transcript bubble ──────────────────────────────────────────────────────────

const TranscriptBubble = memo(function TranscriptBubble({ entry }: { entry: TranscriptEntry }) {
  const isUser = entry.role === 'user'
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={cn('flex items-end gap-2', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      <div className={cn(
        'w-5 h-5 rounded-full border flex items-center justify-center shrink-0',
        isUser ? 'bg-violet-500/15 border-violet-500/20' : 'bg-emerald-500/10 border-emerald-500/15',
      )}>
        {isUser
          ? <Mic className="w-2.5 h-2.5 text-violet-400" strokeWidth={2} />
          : <Cpu className="w-2.5 h-2.5 text-emerald-400" strokeWidth={2} />
        }
      </div>
      <div className={cn(
        'max-w-[82%] px-3.5 py-2 rounded-2xl text-[12px] leading-relaxed',
        isUser
          ? 'bg-violet-500/12 border border-violet-500/18 text-white/85 rounded-tr-sm'
          : 'bg-white/[0.04] border border-white/[0.07] text-white/65 rounded-tl-sm',
      )}>
        {entry.text}
        {!entry.final && (
          <span className="inline-flex gap-0.5 ml-1.5 opacity-50">
            {[0, 0.2, 0.4].map(d => (
              <motion.span key={d} className="w-0.5 h-0.5 rounded-full bg-current"
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.1, delay: d, repeat: Infinity }} />
            ))}
          </span>
        )}
      </div>
    </motion.div>
  )
})

// ── Action log item ────────────────────────────────────────────────────────────

const LogItem = memo(function LogItem({ log }: { log: ActionLog }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className="flex items-start gap-2.5 py-2.5 border-b border-white/[0.04] last:border-0"
    >
      {/* Status dot */}
      <div className="mt-0.5 shrink-0">
        {log.ok
          ? <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 4px #10b981' }} />
          : <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
        }
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <p className="text-[11px] font-medium text-white/65 truncate">{log.label}</p>
          <span className="text-[9px] text-white/20 font-mono shrink-0">{time12(log.ts)}</span>
        </div>
        {log.detail && (
          <p className="text-[10px] text-white/25 mt-0.5 leading-snug truncate">{log.detail}</p>
        )}
      </div>
    </motion.div>
  )
})

// ── Main page ──────────────────────────────────────────────────────────────────

export default function AssistantPage() {
  const router = useRouter()

  const [nexusState,   setNexusState]   = useState<NexusState | 'off'>('off')
  const [transcript,   setTranscript]   = useState<TranscriptEntry[]>([])
  const [actionLog,    setActionLog]    = useState<ActionLog[]>([])
  const [errorMsg,     setErrorMsg]     = useState<string | null>(null)
  const [sessionDur,   setDuration]     = useState(0)
  const [audioLevels,  setAudioLevels]  = useState<number[]>(Array(32).fill(0))
  const [activeAgent,  setActiveAgent]  = useState<{ agent: string; task: string } | null>(null)
  const [metrics,      setMetrics]      = useState<LiveMetrics>({
    conversations: 0, unread: 0, ai_active: 0, hot_leads: 0,
    system_ok: true, health_score: 0, loaded: false,
  })
  const [showTranscript, setShowTranscript] = useState(false)

  const clientRef       = useRef<NexusRealtimeClient | null>(null)
  const timerRef        = useRef<ReturnType<typeof setInterval> | null>(null)
  const transcriptRef   = useRef<HTMLDivElement>(null)
  const sessionStartRef = useRef<number>(0)

  // ── Tool handler ───────────────────────────────────────────────────────────
  const handleToolCall = useCallback(async (
    tool: string, params: Record<string, unknown>, _callId: string,
  ): Promise<unknown> => {
    const agentInfo = extractAgentInfo(tool, params)
    if (agentInfo) setActiveAgent(agentInfo)

    const result: RoutedResult = await routeAction(tool, params)

    setActionLog(prev => [{
      id:     `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      tool, label: result.label, ts: Date.now(),
      ok:     result.success,
      detail: result.summary,
    }, ...prev].slice(0, 50))

    const navPath = getNavigationPath(result)
    if (navPath) router.push(navPath)
    if (agentInfo) setTimeout(() => setActiveAgent(null), 6000)

    return result
  }, [router])

  // ── Transcript handler ─────────────────────────────────────────────────────
  const handleTranscript = useCallback((role: 'user' | 'assistant', text: string, final: boolean) => {
    setShowTranscript(true)
    setTranscript(prev => {
      if (!final && role === 'assistant') {
        const last = prev[prev.length - 1]
        if (last?.role === 'assistant' && !last.final)
          return [...prev.slice(0, -1), { ...last, text: last.text + text }]
        return [...prev, { id: `ai-${Date.now()}`, role, text, ts: Date.now(), final }]
      }
      if (final && role === 'assistant') {
        const last = prev[prev.length - 1]
        if (last?.role === 'assistant' && !last.final)
          return [...prev.slice(0, -1), { ...last, final: true }]
      }
      return [...prev, { id: `${role}-${Date.now()}`, role, text, ts: Date.now(), final }]
    })
  }, [])

  // ── Client ─────────────────────────────────────────────────────────────────
  const getOrCreateClient = useCallback(() => {
    if (clientRef.current) return clientRef.current
    const c = new NexusRealtimeClient({
      onState:       (s) => setNexusState(s),
      onTranscript:  handleTranscript,
      onToolCall:    handleToolCall,
      onAudioLevels: setAudioLevels,
      onError:       (msg) => setErrorMsg(msg),
    })
    clientRef.current = c
    return c
  }, [handleTranscript, handleToolCall])

  const startSession = useCallback(async () => {
    if (nexusState !== 'off' && nexusState !== 'disconnected' && nexusState !== 'error') return
    setErrorMsg(null)
    sessionStartRef.current = Date.now()
    setDuration(0)
    timerRef.current = setInterval(() =>
      setDuration(Math.floor((Date.now() - sessionStartRef.current) / 1000)), 1000)
    await getOrCreateClient().connect()
  }, [nexusState, getOrCreateClient])

  const stopSession = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    clientRef.current?.disconnect()
    clientRef.current = null
    setNexusState('off')
    setAudioLevels(Array(32).fill(0))
    setActiveAgent(null)
  }, [])

  const sendCmd = useCallback((text: string) => {
    const c = clientRef.current
    if (!c || nexusState === 'off' || nexusState === 'disconnected' || nexusState === 'error') {
      startSession().then(() => setTimeout(() => clientRef.current?.sendText(text), 1500))
      return
    }
    c.sendText(text)
  }, [nexusState, startSession])

  const handleOrbClick = useCallback(() => {
    if (nexusState === 'off' || nexusState === 'disconnected' || nexusState === 'error') startSession()
    else stopSession()
  }, [nexusState, startSession, stopSession])

  // ── Load metrics ───────────────────────────────────────────────────────────
  const loadMetrics = useCallback(async () => {
    try {
      const res = await fetch('/api/nexus/voice/execute', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'getDashboardSummary', params: {} }),
      })
      if (!res.ok) return
      const data = await res.json() as Record<string, unknown>
      const stats = data.stats as Record<string, unknown> | undefined
      if (stats) setMetrics({
        conversations: Number(stats.total_conversations ?? 0),
        unread:        Number(stats.unread_count ?? 0),
        ai_active:     Number(stats.ai_active ?? 0),
        hot_leads:     Number(stats.hot_leads ?? 0),
        system_ok:     Boolean(stats.system_ok !== false),
        health_score:  Number(stats.health_score ?? 72),
        loaded:        true,
      })
      else setMetrics(m => ({ ...m, loaded: true }))
    } catch { setMetrics(m => ({ ...m, loaded: true })) }
  }, [])

  useEffect(() => { loadMetrics() }, [loadMetrics])

  useEffect(() => {
    if (transcriptRef.current)
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight
  }, [transcript])

  useEffect(() => () => { stopSession() }, [stopSession])

  const isActive = nexusState !== 'off' && nexusState !== 'disconnected'

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="min-h-screen text-white flex flex-col overflow-hidden"
      style={{ background: 'radial-gradient(ellipse at 20% 0%, #0f0a1e 0%, #060608 50%, #040406 100%)' }}
    >

      {/* ── Topbar ──────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-6 py-3 shrink-0 border-b"
        style={{ borderColor: 'rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(20px)' }}
      >
        <div className="flex items-center gap-3">
          {/* Logo mark */}
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(6,182,212,0.1))',
              border: '1px solid rgba(16,185,129,0.2)',
              boxShadow: '0 0 12px rgba(16,185,129,0.1)',
            }}
          >
            <Cpu className="w-4 h-4" style={{ color: '#10b981' }} strokeWidth={1.5} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-bold tracking-[0.22em] text-white/90 uppercase">NEXUS</span>
              <span
                className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: '#10b981' }}
              >
                OS v3.0
              </span>
              <span
                className="text-[9px] font-mono px-1.5 py-0.5 rounded"
                style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)', color: '#a78bfa' }}
              >
                GA
              </span>
            </div>
            <p className="text-[9.5px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
              Sistema Operacional de IA · 20 módulos · 25 ferramentas
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Metrics pills */}
          {metrics.loaded && (
            <div className="hidden lg:flex items-center gap-1.5">
              {[
                { val: metrics.conversations, label: 'conv',      color: '#60a5fa' },
                { val: metrics.unread,        label: 'pendentes', color: '#fbbf24' },
                { val: metrics.hot_leads,     label: 'hot leads', color: '#fb923c' },
              ].map(({ val, label, color }) => (
                <div
                  key={label}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <span className="text-[11px] font-bold" style={{ color }}>{val}</span>
                  <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.2)' }}>{label}</span>
                </div>
              ))}
            </div>
          )}

          {/* Session timer */}
          {isActive && (
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] font-mono" style={{ color: 'rgba(255,255,255,0.3)' }}>{fmt(sessionDur)}</span>
            </div>
          )}

          <button onClick={loadMetrics}
            className="p-1.5 rounded-lg transition-all"
            style={{ color: 'rgba(255,255,255,0.2)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}
          >
            <RefreshCw className="w-3.5 h-3.5" strokeWidth={1.5} />
          </button>

          {isActive && (
            <button
              onClick={stopSession}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium transition-all"
              style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.2)',
                color: '#f87171',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.18)' }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.1)' }}
            >
              <MicOff className="w-3 h-3" strokeWidth={1.5} />
              Encerrar
            </button>
          )}
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Left panel: Orb + status ────────────────────────────────────── */}
        <div
          className="w-64 flex flex-col items-center gap-0 border-r shrink-0 overflow-y-auto hidden md:flex"
          style={{ borderColor: 'rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.25)' }}
        >
          {/* Orb section */}
          <div className="flex flex-col items-center gap-4 py-8 px-4 border-b w-full" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
            <NexusOrb state={nexusState} onClick={handleOrbClick} />
            <StateLabel state={nexusState} />
            <Waveform state={nexusState} levels={audioLevels} />

            {/* Active agent */}
            <AnimatePresence>
              {activeAgent && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl w-full"
                  style={{ background: 'rgba(139,92,246,0.1)', border: '1px solid rgba(139,92,246,0.2)' }}
                >
                  <BrainCircuit className="w-3 h-3 shrink-0" style={{ color: '#a78bfa' }} strokeWidth={1.5} />
                  <span className="text-[10px] font-medium truncate" style={{ color: '#c4b5fd' }}>{activeAgent.agent}</span>
                  <Loader2 className="w-2.5 h-2.5 shrink-0 animate-spin" style={{ color: '#a78bfa', opacity: 0.6 }} strokeWidth={2} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Connect button when off */}
            {(nexusState === 'off' || nexusState === 'disconnected') && (
              <button
                onClick={startSession}
                className="flex items-center gap-2 px-4 py-2 rounded-xl w-full justify-center text-[12px] font-semibold transition-all"
                style={{
                  background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(6,182,212,0.1))',
                  border: '1px solid rgba(16,185,129,0.3)',
                  color: '#10b981',
                  letterSpacing: '0.08em',
                }}
              >
                <Mic className="w-3.5 h-3.5" strokeWidth={1.5} />
                INICIAR NEXUS
              </button>
            )}
          </div>

          {/* Operational metrics */}
          {metrics.loaded && (
            <div className="flex flex-col gap-0 w-full border-b" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
              <div className="px-4 py-2">
                <span className="text-[9px] uppercase tracking-[0.18em] font-medium" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  Métricas Operacionais
                </span>
              </div>
              {[
                { label: 'Conversas ativas',  val: metrics.conversations, color: '#60a5fa',  dot: '#3b82f6' },
                { label: 'Mensagens pendentes',val: metrics.unread,       color: '#fbbf24',  dot: '#f59e0b' },
                { label: 'Instâncias de IA',  val: metrics.ai_active,    color: '#a78bfa',  dot: '#8b5cf6' },
                { label: 'Leads quentes',     val: metrics.hot_leads,    color: '#fb923c',  dot: '#f97316' },
              ].map(({ label, val, color, dot }) => (
                <div key={label}
                  className="flex items-center justify-between px-4 py-2.5 border-b"
                  style={{ borderColor: 'rgba(255,255,255,0.03)' }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full" style={{ background: dot }} />
                    <span className="text-[10.5px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{label}</span>
                  </div>
                  <span className="text-[12px] font-bold tabular-nums" style={{ color }}>{val}</span>
                </div>
              ))}
              <div className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <div
                    className="w-1 h-1 rounded-full animate-pulse"
                    style={{ background: metrics.system_ok ? '#10b981' : '#ef4444' }}
                  />
                  <span className="text-[10.5px]" style={{ color: 'rgba(255,255,255,0.3)' }}>Saúde do sistema</span>
                </div>
                <span className="text-[12px] font-bold tabular-nums"
                  style={{ color: metrics.health_score >= 70 ? '#10b981' : metrics.health_score >= 40 ? '#f59e0b' : '#ef4444' }}>
                  {metrics.health_score}%
                </span>
              </div>
            </div>
          )}

          {/* Bottom links */}
          <div className="flex flex-col gap-0 w-full mt-auto">
            {[
              { label: 'Diagnóstico API',  href: '/api/nexus/voice/debug', icon: Shield },
              { label: 'Configurações',    href: '/dashboard/settings',    icon: Settings2 },
            ].map(({ label, href, icon: Icon }) => (
              <a key={label} href={href} target="_blank"
                className="flex items-center gap-2.5 px-4 py-3 border-t transition-all"
                style={{ borderColor: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.2)' }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.4)'; (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.02)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = 'rgba(255,255,255,0.2)'; (e.currentTarget as HTMLAnchorElement).style.background = 'transparent' }}
              >
                <Icon className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span className="text-[10.5px]">{label}</span>
                <ArrowRight className="w-3 h-3 ml-auto" strokeWidth={1.5} />
              </a>
            ))}
          </div>
        </div>

        {/* ── Center: command grid + transcript ───────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">

          {/* Error banner */}
          <AnimatePresence>
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="shrink-0 border-b"
                style={{ borderColor: 'rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.06)' }}
              >
                <div className="flex items-start gap-3 px-5 py-3">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" style={{ color: '#f87171' }} strokeWidth={1.5} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] leading-relaxed" style={{ color: '#fca5a5' }}>{errorMsg}</p>
                    {(errorMsg.includes('Beta') || errorMsg.includes('403') || errorMsg.includes('401') || errorMsg.toLowerCase().includes('key')) && (
                      <p className="text-[11px] mt-1 leading-relaxed" style={{ color: 'rgba(248,113,113,0.55)' }}>
                        Possíveis causas: (1) <code className="bg-red-900/30 px-1 rounded">OPENAI_API_KEY</code> sem acesso à Realtime GA API —
                        verifique em platform.openai.com. (2) Cache de deploy — force refresh (Ctrl+Shift+R).
                        <a href="/api/nexus/voice/debug" target="_blank" className="ml-1 underline opacity-70">Ver diagnóstico →</a>
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => { setErrorMsg(null); startSession() }}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] transition-all"
                      style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                      <RefreshCw className="w-2.5 h-2.5" strokeWidth={2} />
                      Reconectar
                    </button>
                    <button onClick={() => setErrorMsg(null)}>
                      <X className="w-4 h-4" style={{ color: 'rgba(248,113,113,0.4)' }} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Transcript panel */}
          <AnimatePresence>
            {showTranscript && transcript.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="shrink-0 border-b"
                style={{ borderColor: 'rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.3)' }}
              >
                <div className="flex items-center justify-between px-5 py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] uppercase tracking-[0.15em] font-medium" style={{ color: 'rgba(255,255,255,0.25)' }}>
                      Transcrição ao vivo
                    </span>
                  </div>
                  <button onClick={() => setShowTranscript(false)}>
                    <X className="w-3 h-3" style={{ color: 'rgba(255,255,255,0.2)' }} strokeWidth={1.5} />
                  </button>
                </div>
                <div ref={transcriptRef}
                  className="px-5 pb-3 flex flex-col gap-2 max-h-[180px] overflow-y-auto scroll-smooth">
                  {transcript.slice(-8).map(e => <TranscriptBubble key={e.id} entry={e} />)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Section header */}
          <div
            className="flex items-center justify-between px-5 py-3 border-b shrink-0"
            style={{ borderColor: 'rgba(255,255,255,0.04)' }}
          >
            <div className="flex items-center gap-2.5">
              <Sparkles className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.2)' }} strokeWidth={1.5} />
              <span className="text-[10px] uppercase tracking-[0.18em] font-semibold" style={{ color: 'rgba(255,255,255,0.25)' }}>
                Módulos Operacionais
              </span>
              <span
                className="text-[9px] font-mono px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.2)' }}
              >
                {OPS_COMMANDS.length}
              </span>
            </div>
            <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.15)' }}>
              Clique para executar por voz
            </span>
          </div>

          {/* Command grid */}
          <div className="flex-1 overflow-y-auto p-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {OPS_COMMANDS.map((cmd, i) => (
                <OpsCard key={i} cmd={cmd} onClick={() => sendCmd(cmd.command)} isActive={isActive} />
              ))}
            </div>

            {/* Offline hint */}
            {!isActive && !errorMsg && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="mt-6 flex items-center gap-2 justify-center"
              >
                <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.04)' }} />
                <div className="flex items-center gap-2 px-3">
                  <Mic className="w-3.5 h-3.5" style={{ color: 'rgba(255,255,255,0.15)' }} strokeWidth={1.5} />
                  <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.18)' }}>
                    Ative o NEXUS no painel esquerdo ou clique em qualquer módulo
                  </span>
                </div>
                <div className="h-px flex-1" style={{ background: 'rgba(255,255,255,0.04)' }} />
              </motion.div>
            )}
          </div>
        </div>

        {/* ── Right panel: execution log ───────────────────────────────────── */}
        <div
          className="w-72 flex flex-col border-l shrink-0 overflow-hidden hidden lg:flex"
          style={{ borderColor: 'rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.25)' }}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 border-b shrink-0" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
            <Activity className="w-3.5 h-3.5" style={{ color: '#f59e0b' }} strokeWidth={1.5} />
            <span className="text-[10px] uppercase tracking-[0.18em] font-semibold" style={{ color: 'rgba(255,255,255,0.25)' }}>
              Execução em Tempo Real
            </span>
            {actionLog.length > 0 && (
              <span className="ml-auto text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>
                {actionLog.length}
              </span>
            )}
          </div>

          {/* Log list */}
          <div className="flex-1 overflow-y-auto px-4 py-2">
            {actionLog.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-10">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <Activity className="w-5 h-5" style={{ color: 'rgba(255,255,255,0.12)' }} strokeWidth={1.5} />
                </div>
                <p className="text-[10px] text-center leading-relaxed" style={{ color: 'rgba(255,255,255,0.18)' }}>
                  As ações executadas pelo NEXUS aparecerão aqui em tempo real
                </p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {actionLog.map(log => <LogItem key={log.id} log={log} />)}
              </AnimatePresence>
            )}
          </div>

          {/* System status footer */}
          <div className="px-4 py-3 border-t shrink-0" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
            <div className="flex items-center gap-2">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: nexusState === 'idle' || nexusState === 'listening' ||
                              nexusState === 'speaking' || nexusState === 'processing' ||
                              nexusState === 'executing' ? '#10b981' :
                              nexusState === 'error' ? '#ef4444' :
                              nexusState === 'connecting' ? '#8b5cf6' : '#475569',
                  boxShadow: isActive ? '0 0 5px #10b981' : 'none',
                  animation: isActive && nexusState !== 'idle' ? 'pulse 2s infinite' : 'none',
                }}
              />
              <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.2)' }}>
                {ORB_CFG[nexusState].label}
              </span>
              {metrics.loaded && (
                <span className="ml-auto text-[10px]"
                  style={{ color: metrics.system_ok ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)' }}>
                  {metrics.system_ok ? 'Sistema OK' : 'Alerta'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
