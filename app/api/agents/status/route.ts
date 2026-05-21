// GET /api/agents/status
// Returns real-time status for all NEXUS agents: activity counts, last actions,
// and recent event feed. Data derived from seller_events with agent. prefix.

import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'
import { AGENTS, type AgentId } from '@/lib/agents'

export const dynamic    = 'force-dynamic'
export const maxDuration = 30

export interface AgentStatus {
  id:          AgentId
  name:        string
  role:        string
  hex:         string
  bg:          string
  border:      string
  icon:        string
  actionsToday: number
  lastAction:  string | null
  lastAt:      string | null
  isActive:    boolean
}

export interface StatusResponse {
  agents:       AgentStatus[]
  recentEvents: Array<{
    agentId:   AgentId
    agentName: string
    hex:       string
    action:    string
    summary:   string
    at:        string
  }>
  totalToday: number
}

export async function GET() {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const db        = getSupabaseServerClient()
    const companyId = ctx.company.id

    // Fetch all agent events from today
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { data: todayEvents } = await db
      .from('seller_events')
      .select('tipo, conteudo, created_at')
      .eq('company_id', companyId)
      .ilike('tipo', 'agent.%')
      .gte('created_at', todayStart.toISOString())
      .order('created_at', { ascending: false })
      .limit(200)

    // Fetch recent events (any time) for the feed
    const { data: recentRaw } = await db
      .from('seller_events')
      .select('tipo, conteudo, created_at')
      .eq('company_id', companyId)
      .ilike('tipo', 'agent.%')
      .order('created_at', { ascending: false })
      .limit(30)

    // Parse agent ID from tipo: "agent.{agentId}.{action}"
    const parseAgentId = (tipo: string): AgentId | null => {
      const parts = tipo.split('.')
      if (parts.length < 3 || parts[0] !== 'agent') return null
      const id = parts[1] as AgentId
      return id in AGENTS ? id : null
    }

    const parseAction = (tipo: string): string => {
      const parts = tipo.split('.')
      return parts.slice(2).join('.') || 'action'
    }

    // Count actions per agent today
    const countsByAgent: Record<AgentId, number> = {} as Record<AgentId, number>
    const lastByAgent: Record<AgentId, { action: string; at: string; summary: string }> = {} as Record<AgentId, { action: string; at: string; summary: string }>

    for (const ev of todayEvents ?? []) {
      const agentId = parseAgentId(ev.tipo)
      if (!agentId) continue
      countsByAgent[agentId] = (countsByAgent[agentId] ?? 0) + 1
      if (!lastByAgent[agentId]) {
        lastByAgent[agentId] = {
          action:  parseAction(ev.tipo),
          at:      ev.created_at,
          summary: ev.conteudo ?? '',
        }
      }
    }

    // Build agent status array
    const agents: AgentStatus[] = Object.values(AGENTS).map(meta => {
      const count = countsByAgent[meta.id] ?? 0
      const last  = lastByAgent[meta.id] ?? null
      return {
        id:           meta.id,
        name:         meta.name,
        role:         meta.role,
        hex:          meta.hex,
        bg:           meta.bg,
        border:       meta.border,
        icon:         meta.icon,
        actionsToday: count,
        lastAction:   last?.action ?? null,
        lastAt:       last?.at ?? null,
        isActive:     count > 0,
      }
    })

    // Build recent event feed
    const recentEvents = (recentRaw ?? []).slice(0, 20).map(ev => {
      const agentId = parseAgentId(ev.tipo)
      if (!agentId) return null
      const meta = AGENTS[agentId]
      return {
        agentId,
        agentName: meta.name,
        hex:       meta.hex,
        action:    parseAction(ev.tipo),
        summary:   (ev.conteudo ?? '').slice(0, 120),
        at:        ev.created_at,
      }
    }).filter(Boolean) as StatusResponse['recentEvents']

    const totalToday = (todayEvents ?? []).length

    return NextResponse.json({ agents, recentEvents, totalToday } satisfies StatusResponse)
  } catch (err) {
    console.error('[agents/status]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
