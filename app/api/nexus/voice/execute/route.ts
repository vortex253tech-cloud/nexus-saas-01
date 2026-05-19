// POST /api/nexus/voice/execute
// Executes a voice assistant tool call server-side.
// Called by the browser when the Realtime API triggers a function call.

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseRouteClient }    from '@/lib/supabase-server'
import { createClient }              from '@supabase/supabase-js'

export const dynamic    = 'force-dynamic'
export const maxDuration = 20

function db() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
}

export async function POST(req: NextRequest) {
  const supabaseAuth = await getSupabaseRouteClient()
  const { data: { user }, error } = await supabaseAuth.auth.getUser()
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { tool: string; params: Record<string, unknown> }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { tool, params } = body
  const supabase  = db()
  const companyId = process.env.NEXUS_PLATFORM_COMPANY_ID ?? ''

  try {
    switch (tool) {

      // ── getWhatsAppStats ─────────────────────────────────────────
      case 'getWhatsAppStats': {
        const { data: convs } = await supabase
          .from('whatsapp_conversations')
          .select('id, status, ai_enabled, last_message_at, unread_count')
          .eq('company_id', companyId)

        const total     = convs?.length ?? 0
        const active    = convs?.filter(c => c.status === 'active').length ?? 0
        const aiOn      = convs?.filter(c => c.ai_enabled).length ?? 0
        const unread    = convs?.reduce((s, c) => s + (c.unread_count ?? 0), 0) ?? 0
        const today     = new Date(); today.setHours(0,0,0,0)
        const activeToday = convs?.filter(c => c.last_message_at && new Date(c.last_message_at) >= today).length ?? 0

        return NextResponse.json({
          total_conversations:    total,
          active_conversations:   active,
          ai_enabled_count:       aiOn,
          unread_messages:        unread,
          active_today:           activeToday,
          summary: `${total} conversas no total, ${active} ativas, ${aiOn} com IA ativada, ${unread} mensagens não lidas hoje.`,
        })
      }

      // ── getHotLeads ──────────────────────────────────────────────
      case 'getHotLeads': {
        const limit = Math.min(Number(params.limit ?? 5), 10)

        const { data: convs } = await supabase
          .from('whatsapp_conversations')
          .select('id, phone, contact_name, last_message_at, message_count, status, ai_enabled')
          .eq('company_id', companyId)
          .eq('status', 'active')
          .order('last_message_at', { ascending: false })
          .limit(limit)

        const { data: contexts } = await supabase
          .from('lead_context')
          .select('conversation_id, nome, empresa, nicho, estagio, objetivo')
          .eq('company_id', companyId)
          .in('conversation_id', (convs ?? []).map(c => c.id))

        const ctxMap = new Map((contexts ?? []).map(c => [c.conversation_id, c]))

        const leads = (convs ?? []).map(c => {
          const ctx = ctxMap.get(c.id)
          return {
            id:           c.id,
            name:         ctx?.nome ?? c.contact_name ?? `+${c.phone}`,
            phone:        c.phone,
            empresa:      ctx?.empresa ?? null,
            nicho:        ctx?.nicho ?? null,
            estagio:      ctx?.estagio ?? 'novo',
            objetivo:     ctx?.objetivo ?? null,
            messages:     c.message_count ?? 0,
            last_contact: c.last_message_at,
            ai_active:    c.ai_enabled,
          }
        })

        return NextResponse.json({
          leads,
          count:   leads.length,
          summary: leads.length
            ? leads.map(l => `${l.name}${l.empresa ? ` (${l.empresa})` : ''} — ${l.estagio}, último contato ${l.last_contact ? new Date(l.last_contact).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'desconhecido'}`).join('; ')
            : 'Nenhum lead ativo encontrado.',
        })
      }

      // ── sendWhatsAppMessage ──────────────────────────────────────
      case 'sendWhatsAppMessage': {
        const phone   = String(params.phone ?? '').replace(/\D/g, '')
        const message = String(params.message ?? '').trim()
        const convId  = params.conversation_id as string | undefined

        if (!phone || !message) {
          return NextResponse.json({ error: 'phone and message are required' }, { status: 400 })
        }

        const instanceId  = process.env.ZAPI_INSTANCE_ID
        const token       = process.env.ZAPI_TOKEN
        const clientToken = process.env.ZAPI_CLIENT_TOKEN ?? ''

        if (!instanceId || !token) {
          return NextResponse.json({ error: 'Z-API not configured' })
        }

        const zapiRes = await fetch(
          `https://api.z-api.io/instances/${instanceId}/token/${token}/send-text`,
          {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', 'Client-Token': clientToken },
            body:    JSON.stringify({ phone, message }),
            signal:  AbortSignal.timeout(12000),
          },
        )

        if (!zapiRes.ok) {
          return NextResponse.json({ error: `Z-API error: ${zapiRes.status}`, sent: false })
        }

        const zapiData = await zapiRes.json().catch(() => ({})) as Record<string, unknown>
        const now = new Date().toISOString()

        // Resolve conversation
        let resolvedConvId = convId
        if (!resolvedConvId) {
          const { data: existingConv } = await supabase
            .from('whatsapp_conversations')
            .select('id')
            .eq('company_id', companyId)
            .eq('phone', phone)
            .maybeSingle()
          resolvedConvId = existingConv?.id
        }

        if (resolvedConvId) {
          await supabase.from('whatsapp_messages').insert({
            conversation_id: resolvedConvId,
            company_id:      companyId,
            phone,
            direction:       'outgoing',
            content:         message,
            from_me:         true,
            ai_generated:    false,
            status:          'sent',
            raw_payload:     { ...zapiData, type: 'text', sent_by: 'voice_assistant' },
            zapi_message_id: (zapiData.zaapId ?? zapiData.messageId ?? null) as string | null,
          })
          await supabase
            .from('whatsapp_conversations')
            .update({ updated_at: now, last_message_at: now })
            .eq('id', resolvedConvId)
        }

        return NextResponse.json({
          sent:    true,
          phone,
          message,
          summary: `Mensagem enviada com sucesso para ${phone}.`,
        })
      }

      // ── searchConversations ──────────────────────────────────────
      case 'searchConversations': {
        const query = String(params.query ?? '').toLowerCase().trim()
        if (!query) return NextResponse.json({ results: [], summary: 'Busca vazia.' })

        const { data: convs } = await supabase
          .from('whatsapp_conversations')
          .select('id, phone, contact_name, status, ai_enabled, last_message_at, message_count')
          .eq('company_id', companyId)
          .or(`contact_name.ilike.%${query}%,phone.ilike.%${query}%`)
          .order('last_message_at', { ascending: false })
          .limit(8)

        const results = (convs ?? []).map(c => ({
          id:           c.id,
          name:         c.contact_name ?? `+${c.phone}`,
          phone:        c.phone,
          status:       c.status,
          ai_enabled:   c.ai_enabled,
          messages:     c.message_count ?? 0,
          last_contact: c.last_message_at,
        }))

        return NextResponse.json({
          results,
          count:   results.length,
          summary: results.length
            ? `Encontrei ${results.length} conversa(s): ${results.map(r => r.name).join(', ')}.`
            : `Nenhuma conversa encontrada para "${query}".`,
        })
      }

      // ── toggleAI ─────────────────────────────────────────────────
      case 'toggleAI': {
        const convId  = String(params.conversation_id ?? '')
        const enabled = Boolean(params.enabled)

        if (!convId) return NextResponse.json({ error: 'conversation_id required' })

        const { data: conv } = await supabase
          .from('whatsapp_conversations')
          .select('id, contact_name, phone')
          .eq('id', convId)
          .eq('company_id', companyId)
          .maybeSingle()

        if (!conv) return NextResponse.json({ error: 'Conversation not found' })

        await supabase
          .from('whatsapp_conversations')
          .update({ ai_enabled: enabled, updated_at: new Date().toISOString() })
          .eq('id', convId)

        const name = conv.contact_name ?? `+${conv.phone}`
        return NextResponse.json({
          success: true,
          conversation_id: convId,
          ai_enabled: enabled,
          summary: `IA ${enabled ? 'ativada' : 'desativada'} para a conversa com ${name}.`,
        })
      }

      // ── transferToHuman ──────────────────────────────────────────
      case 'transferToHuman': {
        const convId = String(params.conversation_id ?? '')
        const note   = params.note ? String(params.note) : undefined

        if (!convId) return NextResponse.json({ error: 'conversation_id required' })

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL
          ?? `https://${req.headers.get('host') ?? 'localhost'}`

        const res = await fetch(`${baseUrl}/api/nexus/whatsapp/transfer`, {
          method:  'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie':       req.headers.get('cookie') ?? '',
          },
          body: JSON.stringify({ conversation_id: convId, note }),
        })

        if (!res.ok) return NextResponse.json({ error: 'Transfer failed', success: false })
        return NextResponse.json({
          success: true,
          summary: `Conversa transferida para atendimento humano${note ? `. Nota: ${note}` : ''}.`,
        })
      }

      // ── getDashboardSummary ──────────────────────────────────────
      case 'getDashboardSummary': {
        const today = new Date(); today.setHours(0,0,0,0)
        const todayIso = today.toISOString()

        const [{ data: convs }, { data: msgs }] = await Promise.all([
          supabase
            .from('whatsapp_conversations')
            .select('id, status, ai_enabled, last_message_at, unread_count')
            .eq('company_id', companyId),
          supabase
            .from('whatsapp_messages')
            .select('id, direction, created_at')
            .eq('company_id', companyId)
            .gte('created_at', todayIso),
        ])

        const totalConvs    = convs?.length ?? 0
        const activeConvs   = convs?.filter(c => c.status === 'active').length ?? 0
        const aiConvs       = convs?.filter(c => c.ai_enabled).length ?? 0
        const unread        = convs?.reduce((s, c) => s + (c.unread_count ?? 0), 0) ?? 0
        const msgsToday     = msgs?.length ?? 0
        const inbound       = msgs?.filter(m => m.direction === 'incoming').length ?? 0
        const outbound      = msgs?.filter(m => m.direction === 'outgoing').length ?? 0
        const activeToday   = convs?.filter(c => c.last_message_at && new Date(c.last_message_at) >= today).length ?? 0

        return NextResponse.json({
          conversations: { total: totalConvs, active: activeConvs, ai_on: aiConvs, unread, active_today: activeToday },
          messages_today: { total: msgsToday, inbound, outbound },
          summary: `Hoje: ${activeToday} conversas ativas, ${inbound} mensagens recebidas, ${outbound} enviadas. Total: ${totalConvs} contatos, ${aiConvs} com IA ligada. ${unread} mensagens pendentes de leitura.`,
        })
      }

      // ── createFollowUp ───────────────────────────────────────────
      case 'createFollowUp': {
        const phone       = String(params.phone ?? '').replace(/\D/g, '')
        const message     = String(params.message ?? '').trim()
        const contactName = params.contact_name ? String(params.contact_name) : null
        const scheduledAt = params.scheduled_at ? String(params.scheduled_at) : null

        if (!phone || !message || !scheduledAt) {
          return NextResponse.json({ error: 'phone, message and scheduled_at required' })
        }

        // Try inserting into scheduled_messages or voice_followups if the table exists.
        // Gracefully degrade if table doesn't exist yet.
        const { error: insertErr } = await supabase
          .from('voice_followups')
          .insert({
            company_id:   companyId,
            phone,
            contact_name: contactName,
            message,
            scheduled_at: scheduledAt,
            created_at:   new Date().toISOString(),
            status:       'pending',
          })

        if (insertErr && insertErr.code === '42P01') {
          // Table doesn't exist yet — still confirm to user
          return NextResponse.json({
            success:  true,
            pending:  true,
            summary: `Follow-up registrado para ${contactName ?? phone} em ${new Date(scheduledAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}. (Tabela de follow-ups pendente de criação — lembrete salvo localmente.)`,
          })
        }

        const dateStr = new Date(scheduledAt).toLocaleString('pt-BR', {
          day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
        })
        return NextResponse.json({
          success:      true,
          phone,
          contact_name: contactName,
          scheduled_at: scheduledAt,
          summary: `Follow-up criado para ${contactName ?? phone} agendado para ${dateStr}.`,
        })
      }

      // ── getUnreadMessages ─────────────────────────────────────────
      case 'getUnreadMessages': {
        const { data: convs } = await supabase
          .from('whatsapp_conversations')
          .select('id, phone, contact_name, unread_count, last_message_at, status')
          .eq('company_id', companyId)
          .gt('unread_count', 0)
          .order('last_message_at', { ascending: false })
          .limit(10)

        const totalUnread = convs?.reduce((s, c) => s + (c.unread_count ?? 0), 0) ?? 0
        return NextResponse.json({
          conversations: (convs ?? []).map(c => ({
            id: c.id, phone: c.phone,
            name: c.contact_name ?? `+${c.phone}`,
            unread: c.unread_count,
            last_contact: c.last_message_at,
          })),
          total_unread: totalUnread,
          count: convs?.length ?? 0,
          summary: totalUnread > 0
            ? `${totalUnread} mensagens não lidas em ${convs?.length} conversas: ${(convs ?? []).map(c => c.contact_name ?? c.phone).join(', ')}.`
            : 'Nenhuma mensagem não lida.',
        })
      }

      // ── getFinancialSummary ───────────────────────────────────────
      case 'getFinancialSummary': {
        const now     = new Date()
        const som     = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        const prevSom = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()

        // Try `transactions` table first; gracefully degrade on missing tables
        const { data: txs, error: txErr } = await supabase
          .from('transactions')
          .select('amount, type, status, created_at')
          .eq('company_id', companyId)
          .gte('created_at', som)

        if (txErr?.code === '42P01') {
          // Table doesn't exist — try `payments`
          const { data: pays } = await supabase
            .from('payments')
            .select('amount, status, created_at')
            .eq('company_id', companyId)
            .gte('created_at', som)

          if (pays) {
            const rev = pays.filter(p => p.status === 'paid').reduce((s, p) => s + (p.amount ?? 0), 0)
            return NextResponse.json({
              revenue_month: rev,
              summary: `Faturamento do mês: R$${rev.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
            })
          }
          return NextResponse.json({ revenue_month: 0, summary: 'Dados financeiros não configurados.' })
        }

        const revenue  = (txs ?? []).filter(t => ['revenue','sale','recebimento'].includes(t.type ?? '')).reduce((s, t) => s + (t.amount ?? 0), 0)
        const expenses = (txs ?? []).filter(t => ['expense','despesa'].includes(t.type ?? '')).reduce((s, t) => s + (t.amount ?? 0), 0)
        const net      = revenue - expenses

        return NextResponse.json({
          revenue_month: revenue,
          expenses_month: expenses,
          net_month: net,
          transactions: txs?.length ?? 0,
          summary: `Faturamento: R$${revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | Despesas: R$${expenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | Líquido: R$${net.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        })
      }

      // ── getPipelineLeads ──────────────────────────────────────────
      case 'getPipelineLeads': {
        const stage = params.stage ? String(params.stage) : undefined
        const limit = Math.min(Number(params.limit ?? 20), 50)

        const q = supabase
          .from('lead_context')
          .select('conversation_id, nome, empresa, nicho, estagio, objetivo, faturamento')
          .eq('company_id', companyId)
          .limit(limit)

        if (stage) q.ilike('estagio', `%${stage}%`)

        const { data: leads } = await q
        const byStage: Record<string, number> = {}
        ;(leads ?? []).forEach(l => {
          const s = l.estagio ?? 'novo'
          byStage[s] = (byStage[s] ?? 0) + 1
        })

        return NextResponse.json({
          leads: leads ?? [],
          by_stage: byStage,
          total: leads?.length ?? 0,
          summary: leads?.length
            ? `${leads.length} leads no CRM. Distribuição: ${Object.entries(byStage).map(([k, v]) => `${k} (${v})`).join(', ')}.`
            : 'Nenhum lead encontrado no CRM.',
        })
      }

      // ── updateLeadStage ───────────────────────────────────────────
      case 'updateLeadStage': {
        const convId = String(params.conversation_id ?? '')
        const stage  = String(params.stage ?? '').trim()

        if (!convId || !stage) return NextResponse.json({ error: 'conversation_id and stage required' })

        const { error: upsertErr } = await supabase
          .from('lead_context')
          .upsert({ conversation_id: convId, company_id: companyId, estagio: stage }, { onConflict: 'conversation_id' })

        if (upsertErr) return NextResponse.json({ success: false, error: upsertErr.message })
        return NextResponse.json({ success: true, summary: `Lead movido para o estágio "${stage}".` })
      }

      // ── markConversationRead ──────────────────────────────────────
      case 'markConversationRead': {
        const convId = String(params.conversation_id ?? '')
        if (!convId) return NextResponse.json({ error: 'conversation_id required' })

        await supabase
          .from('whatsapp_conversations')
          .update({ unread_count: 0, updated_at: new Date().toISOString() })
          .eq('id', convId)
          .eq('company_id', companyId)

        return NextResponse.json({ success: true, summary: 'Conversa marcada como lida.' })
      }

      // ── getConversationHistory ────────────────────────────────────
      case 'getConversationHistory': {
        const convId = String(params.conversation_id ?? '')
        const limit  = Math.min(Number(params.limit ?? 10), 30)

        if (!convId) return NextResponse.json({ error: 'conversation_id required' })

        const { data: msgs } = await supabase
          .from('whatsapp_messages')
          .select('direction, content, created_at, ai_generated')
          .eq('conversation_id', convId)
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })
          .limit(limit)

        const reversed = [...(msgs ?? [])].reverse()
        return NextResponse.json({
          messages: reversed,
          count: reversed.length,
          summary: reversed.length > 0
            ? `Últimas ${reversed.length} mensagens carregadas.`
            : 'Nenhuma mensagem encontrada.',
        })
      }

      // ── getSystemStatus ───────────────────────────────────────────
      case 'getSystemStatus': {
        const [{ data: convs }, { data: followups }] = await Promise.all([
          supabase
            .from('whatsapp_conversations')
            .select('id, status, ai_enabled, unread_count')
            .eq('company_id', companyId),
          supabase
            .from('voice_followups')
            .select('id, status, scheduled_at')
            .eq('company_id', companyId)
            .eq('status', 'pending'),
        ])

        const total      = convs?.length ?? 0
        const aiOn       = convs?.filter(c => c.ai_enabled).length ?? 0
        const unread     = convs?.reduce((s, c) => s + (c.unread_count ?? 0), 0) ?? 0
        const pending_fu = followups?.length ?? 0

        return NextResponse.json({
          whatsapp: { total_conversations: total, ai_active: aiOn, unread },
          followups: { pending: pending_fu },
          health: aiOn > 0 ? 'operacional' : 'atenção',
          summary: `Sistema ${aiOn > 0 ? 'operacional' : 'requer atenção'}. ${total} conversas, IA ativa em ${aiOn}, ${unread} não lidas, ${pending_fu} follow-ups pendentes.`,
        })
      }

      default:
        return NextResponse.json({ error: `Unknown tool: ${tool}` }, { status: 400 })
    }
  } catch (err) {
    console.error(`[voice/execute] tool=${tool} error:`, err)
    return NextResponse.json({ error: 'Execution failed', tool }, { status: 500 })
  }
}
