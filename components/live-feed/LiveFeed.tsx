'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Crown, TrendingUp, Megaphone, DollarSign, FolderKanban,
  Headphones, PenLine, BarChart3, Zap, MessageSquare,
  Users, CreditCard, Settings, Activity,
} from 'lucide-react'
import { getSupabaseClient } from '@/lib/supabase'
import { cn } from '@/lib/cn'

// ─── Event types and formatting ───────────────────────────────────────────────

export interface FeedEvent {
  id:        string
  tipo:      string
  canal:     string
  conteudo:  string
  created_at: string
}

interface FormattedEvent {
  id:       string
  icon:     React.ElementType
  iconBg:   string
  iconColor: string
  label:    string
  sub:      string
  badge?:   { text: string; color: string }
  ts:       string
  isLive?:  boolean
}

// Icon and color registry for agent events
const AGENT_META: Record<string, { icon: React.ElementType; color: string; name: string }> = {
  ceo:       { icon: Crown,        color: '#7c3aed', name: 'CEO Agent' },
  sales:     { icon: TrendingUp,   color: '#059669', name: 'Sales Agent' },
  marketing: { icon: Megaphone,    color: '#f59e0b', name: 'Marketing Agent' },
  finance:   { icon: DollarSign,   color: '#dc2626', name: 'Finance Agent' },
  projects:  { icon: FolderKanban, color: '#0891b2', name: 'Projects Agent' },
  support:   { icon: Headphones,   color: '#8b5cf6', name: 'Support Agent' },
  content:   { icon: PenLine,      color: '#ec4899', name: 'Content Agent' },
  analytics: { icon: BarChart3,    color: '#16a34a', name: 'Analytics Agent' },
}

function parseAgentId(tipo: string): string | null {
  // Pattern: agent.{agentId}.{action}
  const parts = tipo.split('.')
  if (parts[0] === 'agent' && parts.length >= 3) return parts[1]
  return null
}

function formatActionLabel(tipo: string): string {
  const parts = tipo.split('.')
  const action = parts.slice(2).join('_')
  const map: Record<string, string> = {
    'get_leads':              'analisando pipeline',
    'create_lead':            'criou novo lead',
    'update_lead':            'atualizou lead',
    'get_business_overview':  'verificou empresa',
    'get_projects':           'revisou projetos',
    'create_project':         'criou projeto',
    'create_task':            'criou tarefa',
    'get_financial_summary':  'analisou finanças',
    'get_recent_activity':    'verificou atividade',
    'generate_content':       'gerou conteúdo',
    'navigate_to':            'navegando',
    'cascade':                'cascata executada',
    'analysis':               'executou análise',
  }
  // Match any key that the action contains
  for (const [key, label] of Object.entries(map)) {
    if (action.includes(key)) return label
  }
  return action.replace(/_/g, ' ')
}

function formatEvent(ev: FeedEvent): FormattedEvent {
  const agentId = parseAgentId(ev.tipo)

  if (agentId && AGENT_META[agentId]) {
    const meta = AGENT_META[agentId]
    const actionLabel = formatActionLabel(ev.tipo)
    const snippet = ev.conteudo ? ev.conteudo.slice(0, 80) : ''
    return {
      id:        ev.id,
      icon:      meta.icon,
      iconBg:    `${meta.color}18`,
      iconColor: meta.color,
      label:     `${meta.name} — ${actionLabel}`,
      sub:       snippet,
      badge:     { text: 'Agente IA', color: meta.color },
      ts:        ev.created_at,
    }
  }

  // Regular platform events
  const iconMap: Record<string, { icon: React.ElementType; color: string }> = {
    whatsapp:  { icon: MessageSquare, color: '#25d366' },
    mensagem:  { icon: MessageSquare, color: '#25d366' },
    lead:      { icon: Users,         color: '#059669' },
    pagamento: { icon: CreditCard,    color: '#f59e0b' },
    payment:   { icon: CreditCard,    color: '#f59e0b' },
    projeto:   { icon: FolderKanban,  color: '#0891b2' },
    automacao: { icon: Zap,           color: '#7c3aed' },
    config:    { icon: Settings,      color: '#6b7280' },
  }

  let icon: React.ElementType = Activity
  let color = '#6b7280'
  const lower = (ev.tipo + ' ' + ev.canal).toLowerCase()
  for (const [key, val] of Object.entries(iconMap)) {
    if (lower.includes(key)) { icon = val.icon; color = val.color; break }
  }

  return {
    id:        ev.id,
    icon,
    iconBg:    `${color}18`,
    iconColor: color,
    label:     ev.conteudo?.slice(0, 80) || ev.tipo,
    sub:       ev.canal,
    ts:        ev.created_at,
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}min`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

// ─── Single feed item ─────────────────────────────────────────────────────────

function FeedRow({ ev, isNew }: { ev: FormattedEvent; isNew?: boolean }) {
  const Icon = ev.icon
  return (
    <motion.div
      layout
      initial={isNew ? { opacity: 0, y: -12, scale: 0.97 } : false}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
      className="group flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors rounded-lg"
    >
      {/* Icon */}
      <div
        className="relative mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110"
        style={{ background: ev.iconBg }}
      >
        <Icon className="w-3.5 h-3.5" style={{ color: ev.iconColor }} />
        {isNew && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-[#0a0a0f] animate-pulse" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-white/75 leading-snug truncate font-medium">{ev.label}</p>
        {ev.sub && <p className="text-xs text-white/30 mt-0.5 truncate">{ev.sub}</p>}
      </div>

      {/* Right */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        {ev.badge && (
          <span
            className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full uppercase tracking-wide"
            style={{ color: ev.badge.color, background: `${ev.badge.color}18`, border: `1px solid ${ev.badge.color}33` }}
          >
            {ev.badge.text}
          </span>
        )}
        <span className="text-[11px] text-white/20 tabular-nums">{timeAgo(ev.ts)}</span>
      </div>
    </motion.div>
  )
}

// ─── Live dot pulse ───────────────────────────────────────────────────────────

function LiveDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
    </span>
  )
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

const FILTERS = [
  { key: 'all',    label: 'Tudo' },
  { key: 'agent',  label: 'Agentes' },
  { key: 'sales',  label: 'Vendas' },
  { key: 'system', label: 'Sistema' },
]

// ─── LiveFeed props ───────────────────────────────────────────────────────────

interface LiveFeedProps {
  companyId:   string
  initialData?: FeedEvent[]
  maxItems?:   number
  compact?:    boolean
  showFilter?: boolean
  className?:  string
}

export function LiveFeed({
  companyId,
  initialData = [],
  maxItems = 30,
  compact = false,
  showFilter = true,
  className,
}: LiveFeedProps) {
  const supabase      = getSupabaseClient()
  const [events, setEvents]   = useState<FeedEvent[]>(initialData)
  const [newIds, setNewIds]   = useState<Set<string>>(new Set())
  const [filter, setFilter]   = useState<string>('all')
  const [paused, setPaused]   = useState(false)
  const pausedRef = useRef(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  pausedRef.current = paused

  // Initial load
  const loadInitial = useCallback(async () => {
    const { data } = await supabase
      .from('seller_events')
      .select('id, tipo, canal, conteudo, created_at')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(maxItems)
    if (data) setEvents(data)
  }, [supabase, companyId, maxItems])

  useEffect(() => {
    if (!initialData.length) loadInitial()
  }, [loadInitial, initialData.length])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`live-feed-${companyId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'seller_events',
          filter: `company_id=eq.${companyId}`,
        },
        (payload: { new: unknown }) => {
          if (pausedRef.current) return
          const ev = payload.new as FeedEvent
          setEvents(prev => [ev, ...prev].slice(0, maxItems))
          setNewIds(prev => {
            const next = new Set(prev)
            next.add(ev.id)
            return next
          })
          // Clear "new" flag after animation
          setTimeout(() => {
            setNewIds(prev => {
              const next = new Set(prev)
              next.delete(ev.id)
              return next
            })
          }, 3000)
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, companyId, maxItems])

  // Filter logic
  const filtered = events.filter(ev => {
    if (filter === 'all') return true
    if (filter === 'agent') return ev.tipo.startsWith('agent.')
    if (filter === 'sales') return ev.tipo.includes('lead') || ev.tipo.includes('sale') || ev.canal?.toLowerCase().includes('whatsapp')
    if (filter === 'system') return !ev.tipo.startsWith('agent.') && !ev.tipo.includes('lead')
    return true
  })

  const formatted = filtered.map(ev => formatEvent(ev))
  const liveCount = events.filter(ev => {
    const diff = Date.now() - new Date(ev.created_at).getTime()
    return diff < 60000 // last 60s
  }).length

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Header */}
      {!compact && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <LiveDot />
            <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">Feed Operacional</span>
            {liveCount > 0 && (
              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5 font-medium">
                {liveCount} ao vivo
              </span>
            )}
          </div>
          <button
            onClick={() => setPaused(p => !p)}
            className={cn(
              'text-[10px] px-2 py-1 rounded-md transition-all font-medium',
              paused
                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                : 'bg-white/5 text-white/30 hover:text-white/50',
            )}
          >
            {paused ? '▶ retomar' : '⏸ pausar'}
          </button>
        </div>
      )}

      {/* Filter tabs */}
      {showFilter && !compact && (
        <div className="flex gap-1 px-4 py-2 border-b border-white/5">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                'text-[11px] px-2.5 py-1 rounded-md transition-all font-medium',
                filter === f.key
                  ? 'bg-violet-600/20 text-violet-300 border border-violet-500/30'
                  : 'text-white/30 hover:text-white/50',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Feed */}
      <div ref={scrollRef} className="overflow-y-auto flex-1">
        {!formatted.length && (
          <div className="py-12 text-center text-white/20 text-xs">
            Aguardando atividade…
          </div>
        )}
        <AnimatePresence mode="popLayout" initial={false}>
          {formatted.map(ev => (
            <FeedRow key={ev.id} ev={ev} isNew={newIds.has(ev.id)} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
