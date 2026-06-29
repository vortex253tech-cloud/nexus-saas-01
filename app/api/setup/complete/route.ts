import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'
import { resolveZApiConfig, zapiSendText } from '@/lib/zapi'

const WELCOME_MESSAGE = `Oi! Aqui é o NEXUS. Sua conta está ativa — esse é um guia rápido do que você pode fazer agora:

1. Atendimento no WhatsApp: conecte seu número (no menu WhatsApp do painel) e a IA passa a responder seus clientes 24h, sem perder mensagem.

2. Cobrança automática: cadastre seus clientes e o NEXUS identifica inadimplentes e cobra sozinho, sem você precisar lembrar.

3. Diagnóstico financeiro: conecte seus dados (planilha ou manual) e a IA mostra onde sua empresa está perdendo dinheiro, com previsão de fluxo de caixa.

4. Assistente de voz: no painel, você fala com a IA como um diretor de operações — ela cria tarefas, agenda reuniões, gera propostas e consulta seu financeiro na hora.

5. Tarefas e projetos: a IA organiza e acompanha a operação do dia a dia, não só conversa.

6. CRM: pipeline de vendas, leads e clientes, tudo num só lugar.

Qualquer dúvida durante os próximos dias, responde aqui mesmo que a equipe te ajuda direto.`

// One-time welcome WhatsApp message on first-ever onboarding completion —
// sent from the platform's own shared instance, since a new account hasn't
// connected its own WhatsApp number yet at this point in the funnel.
async function sendWelcomeWhatsApp(phone: string | null) {
  if (!phone) return
  const config = resolveZApiConfig(null)
  if (!config) return
  try {
    await zapiSendText({ to: phone, body: WELCOME_MESSAGE, config })
  } catch (err) {
    console.error('[setup/complete] welcome WhatsApp send failed:', err)
  }
}

export async function POST() {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const db = getSupabaseServerClient()

    const wasAlreadyCompleted = ctx.user.onboarding_completed

    await db
      .from('users')
      .update({ onboarding_completed: true, onboarding_step: 7 })
      .eq('id', ctx.user.id)

    if (!wasAlreadyCompleted) {
      await sendWelcomeWhatsApp(ctx.company.phone)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[setup/complete]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
