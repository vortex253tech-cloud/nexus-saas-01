// GET /api/nexus/whatsapp/activity — Real AI activity feed
// Returns last 10 AI events: responses sent, leads detected, pipeline updates

import { NextResponse }            from 'next/server'
import { getSupabaseRouteClient }  from '@/lib/supabase-server'
import { createClient }            from '@supabase/supabase-js'

export const dynamic    = 'force-dynamic'
export const maxDuration = 10

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export interface ActivityEvent {
  id:    string
  icon:  string
  label: string
  time:  string
  color: string
}

export async function GET() {
  // ── Auth ──────────────────────────────────────────────────────
  const supabaseAuth = await getSupabaseRouteClient()
  const { data: { user }, error } = await supabaseAuth.auth.getUser()
  if (error || !user) return NextResponse.json({ events: [] })

  const supabase = db()
  const { data: userRow } = await supabase
    .from('users').select('id').eq('auth_id', user.id).maybeSingle()
  if (!userRow) return NextResponse.json({ events: [] })

  const { data: company } = await supabase
    .from('companies').select('id').eq('user_id', userRow.id).maybeSingle()
  if (!company) return NextResponse.json({ events: [] })

  // ── Parallel queries ──────────────────────────────────────────
  const [msgsRes, leadsRes] = await Promise.all([
    // Last 20 messages (incoming + AI-outgoing)
    supabase
      .from('whatsapp_messages')
      .select('id, phone, content, created_at, ai_generated, direction')
      .eq('company_id', company.id)
      .order('created_at', { ascending: false })
      .limit(20),

    // Recently updated leads for stage/heat events
    supabase
      .from('leads')
      .select('id, name, phone, stage, temperatura, updated_at')
      .eq('company_id', company.id)
      .order('updated_at', { ascending: false })
      .limit(10),
  ])

  const msgs  = msgsRes.data  ?? []
  const leads = leadsRes.data ?? []

  // ── Build event stream ────────────────────────────────────────
  type RawEvent = ActivityEvent & { ts: number }
  const events: RawEvent[] = []

  for (const msg of msgs) {
    if (msg.ai_generated && msg.direction === 'outgoing') {
      events.push({
        id:    `msg-${msg.id}`,
        icon:  '✅',
        label: 'IA respondeu automaticamente',
        time:  msg.created_at,
        color: 'text-emerald-400',
        ts:    new Date(msg.created_at).getTime(),
      })
    } else if (msg.direction === 'incoming') {
      events.push({
        id:    `in-${msg.id}`,
        icon:  '💬',
        label: 'Nova mensagem recebida',
        time:  msg.created_at,
        color: 'text-blue-400',
        ts:    new Date(msg.created_at).getTime(),
      })
    }
  }

  for (const lead of leads) {
    const ts = new Date(lead.updated_at).getTime()
    if (lead.temperatura === 'quente' || lead.temperatura === 'urgente') {
      events.push({
        id:    `hot-${lead.id}`,
        icon:  '🔥',
        label: `Lead quente — ${lead.name ?? `+${String(lead.phone).slice(-4)}`}`,
        time:  lead.updated_at,
        color: 'text-orange-400',
        ts,
      })
    }
    if (lead.stage === 'negociando' || lead.stage === 'proposta') {
      events.push({
        id:    `opp-${lead.id}`,
        icon:  '📊',
        label: `Oportunidade — ${lead.name ?? 'Lead'} em ${lead.stage}`,
        time:  lead.updated_at,
        color: 'text-violet-400',
        ts,
      })
    }
    if (lead.stage === 'fechado') {
      events.push({
        id:    `closed-${lead.id}`,
        icon:  '🏆',
        label: `Venda fechada — ${lead.name ?? 'Lead'}`,
        time:  lead.updated_at,
        color: 'text-emerald-400',
        ts,
      })
    }
  }

  // Sort newest first, deduplicate by id, take top 10
  const seen = new Set<string>()
  const top10 = events
    .sort((a, b) => b.ts - a.ts)
    .filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true })
    .slice(0, 10)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    .map(({ ts, ...rest }) => rest)

  return NextResponse.json({ events: top10 })
}
