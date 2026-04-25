// ─── Action Runner ─────────────────────────────────────────────────────────────
// Server-only. Executes real actions against Supabase/Resend.
// Called by the AI chat route when intent is detected.

import { runEmailCollections } from '@/lib/collections'
import { buildFinancialContext, fmtBRL, type ClientCtx } from '@/lib/services/context-builder'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type ActionType = 'GET_OVERDUE' | 'RUN_RECOVERY' | 'GET_SUMMARY'

export interface ActionResult {
  type:    ActionType
  success: boolean
  /** Human-readable summary — passed verbatim to the AI prompt */
  summary: string
  /** Structured data for building rich responses */
  data: {
    charged?:       number
    failed?:        number
    skipped?:       number
    total_overdue?: number
    total_pending?: number
    clients?:      Pick<ClientCtx, 'nome' | 'valor' | 'email' | 'dias_atraso'>[]
  }
}

// ─── Intent detection ──────────────────────────────────────────────────────────

const RECOVERY_PATTERN =
  /cobr(ar?|ança|ei|e|ou|ando)|recuper(ar?|ar clientes)|enviar (cobrança|email|mensagem)|notificar|manda.*email|cobra.*cliente|quero cobrar/i

const OVERDUE_PATTERN =
  /quem (me )?deve|lista.*inadimplent|mostrar.*(devedor|inadimplent)|ver.*atras|clientes.*atras/i

const SUMMARY_PATTERN =
  /resumo|visão geral|panorama|situação (atual|financeira)|como (está|tá) (minha empresa|o negócio)/i

export function detectIntent(message: string): ActionType | null {
  if (RECOVERY_PATTERN.test(message)) return 'RUN_RECOVERY'
  if (OVERDUE_PATTERN.test(message))  return 'GET_OVERDUE'
  if (SUMMARY_PATTERN.test(message))  return 'GET_SUMMARY'
  return null
}

// ─── Runner ────────────────────────────────────────────────────────────────────

export async function runAction(
  type: ActionType,
  companyId: string,
): Promise<ActionResult> {
  console.log(`[action-runner] executing ${type} for company ${companyId}`)

  switch (type) {

    // ── GET_OVERDUE — return list of overdue clients ──────────────────────────
    case 'GET_OVERDUE': {
      const ctx = await buildFinancialContext(companyId)

      if (ctx.clientes_inadimplentes.length === 0) {
        return {
          type, success: true,
          summary: 'Nenhum cliente inadimplente no momento.',
          data: { clients: [], total_overdue: 0 },
        }
      }

      const clients = ctx.clientes_inadimplentes.map(c => ({
        nome: c.nome, valor: c.valor, email: c.email, dias_atraso: c.dias_atraso,
      }))

      const summary =
        `${ctx.stats.inadimplentes} cliente${ctx.stats.inadimplentes > 1 ? 's' : ''} inadimplente${ctx.stats.inadimplentes > 1 ? 's' : ''} ` +
        `| total: ${fmtBRL(ctx.total_inadimplente)} ` +
        `| maior devedor: ${ctx.stats.maior_devedor?.nome ?? '-'} (${fmtBRL(ctx.stats.maior_devedor?.valor ?? 0)})`

      console.log(`[action-runner] GET_OVERDUE → ${summary}`)
      return {
        type, success: true, summary,
        data: { clients, total_overdue: ctx.total_inadimplente },
      }
    }

    // ── RUN_RECOVERY — send collection emails to all overdue clients ──────────
    case 'RUN_RECOVERY': {
      const [emailResult, ctx] = await Promise.all([
        runEmailCollections(companyId),
        buildFinancialContext(companyId),
      ])

      const chargedClients = emailResult.results
        .filter(r => r.success)
        .map(r => {
          const match = ctx.clientes_inadimplentes.find(c => c.id === r.clientId)
          return {
            nome:       r.clientName,
            valor:      match?.valor ?? 0,
            email:      match?.email ?? null,
            dias_atraso: match?.dias_atraso ?? 0,
          }
        })

      const skipped = emailResult.skipped ?? 0
      const summary =
        emailResult.charged === 0
          ? skipped > 0
            ? `${skipped} cliente${skipped > 1 ? 's' : ''} já cobrado${skipped > 1 ? 's' : ''} hoje — nenhum novo envio necessário`
            : `Nenhum cliente cobrado (${emailResult.failed > 0 ? `${emailResult.failed} falha${emailResult.failed > 1 ? 's' : ''}` : 'sem inadimplentes com email cadastrado'})`
          : `${emailResult.charged} cliente${emailResult.charged > 1 ? 's' : ''} cobrado${emailResult.charged > 1 ? 's' : ''} com sucesso por e-mail` +
            (emailResult.failed  > 0 ? ` | ${emailResult.failed} falha${emailResult.failed > 1 ? 's' : ''}` : '') +
            (skipped             > 0 ? ` | ${skipped} já cobrado${skipped > 1 ? 's' : ''} hoje (pulado${skipped > 1 ? 's' : ''})` : '')

      console.log(`[action-runner] RUN_RECOVERY → charged: ${emailResult.charged}, failed: ${emailResult.failed}, skipped: ${skipped}`)
      chargedClients.forEach(c =>
        console.log(`  ✉ ${c.nome} <${c.email ?? 'sem email'}> — ${fmtBRL(c.valor)}`)
      )

      return {
        type, success: true, summary,
        data: {
          charged:       emailResult.charged,
          failed:        emailResult.failed,
          skipped,
          total_overdue: ctx.total_inadimplente,
          clients:       chargedClients,
        },
      }
    }

    // ── GET_SUMMARY — full financial snapshot ─────────────────────────────────
    case 'GET_SUMMARY': {
      const ctx = await buildFinancialContext(companyId)

      const fin = ctx.financeiro_atual
      const summary =
        `${ctx.stats.total_clientes} clientes | ` +
        `${fmtBRL(ctx.total_inadimplente)} inadimplente | ` +
        `${fmtBRL(ctx.total_pendente)} pendente | ` +
        `taxa de inadimplência: ${ctx.taxa_inadimplencia}%` +
        (fin ? ` | faturamento atual: ${fmtBRL(fin.receita)} (lucro ${fmtBRL(fin.lucro)})` : '')

      console.log(`[action-runner] GET_SUMMARY → ${summary}`)
      return {
        type, success: true, summary,
        data: {
          total_overdue: ctx.total_inadimplente,
          total_pending: ctx.total_pendente,
          clients: ctx.clientes_inadimplentes,
        },
      }
    }
  }
}

// ─── Smart formatter (no AI key fallback) ─────────────────────────────────────

export function formatActionResult(result: ActionResult): string {
  const { type, data } = result

  if (type === 'RUN_RECOVERY') {
    if (!data.charged || data.charged === 0) {
      return `Sem clientes para cobrar agora. ${data.failed ? `(${data.failed} falha${data.failed > 1 ? 's' : ''})` : 'Todos já foram notificados hoje ou não há inadimplentes.'}`
    }
    const lista = (data.clients ?? [])
      .filter(c => c.valor > 0)
      .map(c => `• **${c.nome}** — ${fmtBRL(c.valor)}${c.dias_atraso ? ` (${c.dias_atraso}d em atraso)` : ''}`)
      .join('\n')
    return (
      `✅ **${data.charged} cliente${data.charged > 1 ? 's' : ''} cobrado${data.charged > 1 ? 's' : ''} com sucesso!**\n\n` +
      (lista ? `${lista}\n\n` : '') +
      `**Total em cobrança: ${fmtBRL(data.total_overdue ?? 0)}**\n\n` +
      (data.failed  ? `⚠️ ${data.failed} envio${data.failed > 1 ? 's' : ''} falhou (sem e-mail cadastrado).\n\n` : '') +
      (data.skipped ? `ℹ️ ${data.skipped} cliente${data.skipped > 1 ? 's' : ''} já cobrado${data.skipped > 1 ? 's' : ''} hoje — pulado${data.skipped > 1 ? 's' : ''}.\n\n` : '') +
      `Acompanhe as respostas na aba **Mensagens**.`
    )
  }

  if (type === 'GET_OVERDUE') {
    const clients = data.clients ?? []
    if (clients.length === 0) return '✅ Nenhum cliente inadimplente no momento!'
    const lista = clients.map(c =>
      `• **${c.nome}** — ${fmtBRL(c.valor)}${c.dias_atraso ? ` (${c.dias_atraso}d em atraso)` : ''}`
    ).join('\n')
    return (
      `Você tem **${clients.length} cliente${clients.length > 1 ? 's' : ''} inadimplente${clients.length > 1 ? 's' : ''}**:\n\n` +
      `${lista}\n\n` +
      `**Total: ${fmtBRL(data.total_overdue ?? 0)}**\n\n` +
      `Quer que eu envie e-mails de cobrança para todos? É só pedir.`
    )
  }

  if (type === 'GET_SUMMARY') {
    return (
      `**Resumo financeiro atual:**\n\n` +
      `• Inadimplente: **${fmtBRL(data.total_overdue ?? 0)}**\n` +
      `• A vencer: **${fmtBRL(data.total_pending ?? 0)}**\n` +
      `• Total a receber: **${fmtBRL((data.total_overdue ?? 0) + (data.total_pending ?? 0))}**`
    )
  }

  return result.summary
}
