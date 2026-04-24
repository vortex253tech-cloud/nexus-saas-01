// ─── Automations Execution Engine ────────────────────────────────────────────
// Server-side only.

import { sendEmail } from './email'
import { getSupabaseServerClient } from './supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AutomationStep {
  id: string
  step_order: number
  subject: string
  body_html: string
  delay_days: number
}

export interface Automation {
  id: string
  company_id: string
  name: string
  description: string
  trigger_type: 'manual' | 'new_client' | 'client_overdue'
  status: 'active' | 'inactive' | 'draft'
  steps?: AutomationStep[]
}

// ─── HTML builder for automation emails ───────────────────────────────────────

export function renderAutomationEmail(html: string, vars: Record<string, string>): string {
  return html.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`)
}

export function buildWelcomeEmailHTML(params: {
  clientName: string
  nomeEmpresa: string
}): string {
  const { clientName, nomeEmpresa } = params
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:40px 20px;">
  <div style="max-width:560px;margin:0 auto;background:#18181b;border-radius:16px;overflow:hidden;border:1px solid #27272a;">
    <div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:32px 32px 24px;">
      <span style="background:rgba(255,255,255,0.2);border-radius:8px;padding:6px 10px;font-weight:700;color:#fff;font-size:13px;letter-spacing:1px;">NEXUS</span>
      <h1 style="color:#fff;margin:16px 0 0;font-size:20px;font-weight:700;">Bem-vindo, ${clientName}! 👋</h1>
      <p style="color:rgba(255,255,255,0.75);margin:6px 0 0;font-size:14px;">${nomeEmpresa}</p>
    </div>
    <div style="padding:32px;">
      <p style="color:#d4d4d8;font-size:15px;line-height:1.7;margin:0 0 16px;">Olá <strong style="color:#fff;">${clientName}</strong>,</p>
      <p style="color:#a1a1aa;font-size:14px;line-height:1.7;margin:0 0 24px;">
        É um prazer ter você como cliente da <strong style="color:#d4d4d8;">${nomeEmpresa}</strong>.<br>
        Estamos à disposição para o que precisar.
      </p>
      <p style="color:#52525b;font-size:12px;text-align:center;margin:0;border-top:1px solid #27272a;padding-top:20px;">
        Atenciosamente, <strong style="color:#71717a;">Equipe ${nomeEmpresa}</strong><br><br>
        NEXUS · Inteligência financeira para empresas brasileiras
      </p>
    </div>
  </div>
</body>
</html>`
}

export function buildFollowupEmailHTML(params: {
  clientName: string
  nomeEmpresa: string
}): string {
  const { clientName, nomeEmpresa } = params
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:40px 20px;">
  <div style="max-width:560px;margin:0 auto;background:#18181b;border-radius:16px;overflow:hidden;border:1px solid #27272a;">
    <div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:32px 32px 24px;">
      <span style="background:rgba(255,255,255,0.2);border-radius:8px;padding:6px 10px;font-weight:700;color:#fff;font-size:13px;letter-spacing:1px;">NEXUS</span>
      <h1 style="color:#fff;margin:16px 0 0;font-size:20px;font-weight:700;">Como podemos ajudar?</h1>
      <p style="color:rgba(255,255,255,0.75);margin:6px 0 0;font-size:14px;">${nomeEmpresa}</p>
    </div>
    <div style="padding:32px;">
      <p style="color:#d4d4d8;font-size:15px;line-height:1.7;margin:0 0 16px;">Olá <strong style="color:#fff;">${clientName}</strong>,</p>
      <p style="color:#a1a1aa;font-size:14px;line-height:1.7;margin:0 0 24px;">
        Passamos para saber como está sendo sua experiência conosco.<br>
        Ficamos à disposição para qualquer dúvida ou sugestão.
      </p>
      <p style="color:#52525b;font-size:12px;text-align:center;margin:0;border-top:1px solid #27272a;padding-top:20px;">
        Atenciosamente, <strong style="color:#71717a;">Equipe ${nomeEmpresa}</strong>
      </p>
    </div>
  </div>
</body>
</html>`
}

export function buildReactivationEmailHTML(params: {
  clientName: string
  nomeEmpresa: string
}): string {
  const { clientName, nomeEmpresa } = params
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;padding:40px 20px;">
  <div style="max-width:560px;margin:0 auto;background:#18181b;border-radius:16px;overflow:hidden;border:1px solid #27272a;">
    <div style="background:linear-gradient(135deg,#f59e0b,#ef4444);padding:32px 32px 24px;">
      <span style="background:rgba(255,255,255,0.2);border-radius:8px;padding:6px 10px;font-weight:700;color:#fff;font-size:13px;letter-spacing:1px;">NEXUS</span>
      <h1 style="color:#fff;margin:16px 0 0;font-size:20px;font-weight:700;">Sentimos sua falta, ${clientName}! 💛</h1>
      <p style="color:rgba(255,255,255,0.75);margin:6px 0 0;font-size:14px;">${nomeEmpresa}</p>
    </div>
    <div style="padding:32px;">
      <p style="color:#d4d4d8;font-size:15px;line-height:1.7;margin:0 0 16px;">Olá <strong style="color:#fff;">${clientName}</strong>,</p>
      <p style="color:#a1a1aa;font-size:14px;line-height:1.7;margin:0 0 24px;">
        Faz um tempo que não nos falamos e queríamos saber como você está.<br>
        Temos novidades e estamos aqui para ajudar no que precisar.
      </p>
      <p style="color:#52525b;font-size:12px;text-align:center;margin:0;border-top:1px solid #27272a;padding-top:20px;">
        Atenciosamente, <strong style="color:#71717a;">Equipe ${nomeEmpresa}</strong>
      </p>
    </div>
  </div>
</body>
</html>`
}

// ─── Enroll a client in an automation ─────────────────────────────────────────

export async function enrollClient(params: {
  automationId: string
  clientId: string
  companyId: string
  steps: AutomationStep[]
}): Promise<void> {
  const { automationId, clientId, companyId, steps } = params
  if (!steps.length) return

  const db = getSupabaseServerClient()

  // Skip if already enrolled and active
  const { data: existing } = await db
    .from('automation_enrollments')
    .select('id')
    .eq('automation_id', automationId)
    .eq('client_id', clientId)
    .eq('status', 'active')
    .maybeSingle()

  if (existing) return

  const firstStep = steps[0]
  const nextStepAt = new Date()
  nextStepAt.setDate(nextStepAt.getDate() + (firstStep.delay_days ?? 0))

  await db.from('automation_enrollments').insert({
    automation_id: automationId,
    client_id:     clientId,
    company_id:    companyId,
    current_step:  0,
    status:        'active',
    next_step_at:  nextStepAt.toISOString(),
  })
}

// ─── Process all pending enrollments (called by cron) ─────────────────────────

export async function processAutomationEnrollments(): Promise<{
  processed: number
  sent: number
  failed: number
  completed: number
}> {
  const db  = getSupabaseServerClient()
  const now = new Date().toISOString()

  // Fetch pending enrollments
  const { data: enrollments } = await db
    .from('automation_enrollments')
    .select(`
      id, automation_id, client_id, company_id, current_step,
      automation:automations(id, name, status),
      client:clients(id, name, email),
      company:companies(id, nome)
    `)
    .eq('status', 'active')
    .lte('next_step_at', now)
    .limit(100)

  if (!enrollments?.length) return { processed: 0, sent: 0, failed: 0, completed: 0 }

  let sent = 0, failed = 0, completed = 0

  for (const enrollment of enrollments) {
    const auto = enrollment.automation as unknown as { id: string; name: string; status: string } | null
    if (!auto || auto.status !== 'active') {
      await db.from('automation_enrollments').update({ status: 'cancelled' }).eq('id', enrollment.id)
      continue
    }

    const client  = enrollment.client  as unknown as { id: string; name: string; email: string | null } | null
    const company = enrollment.company as unknown as { id: string; nome: string } | null
    if (!client?.email || !company) {
      await db.from('automation_enrollments').update({ status: 'failed' }).eq('id', enrollment.id)
      failed++
      continue
    }

    // Fetch steps for this automation
    const { data: steps } = await db
      .from('automation_steps')
      .select('id, step_order, subject, body_html, delay_days')
      .eq('automation_id', enrollment.automation_id)
      .order('step_order')

    if (!steps?.length) {
      await db.from('automation_enrollments').update({ status: 'completed', completed_at: now }).eq('id', enrollment.id)
      completed++
      continue
    }

    const currentStep = steps[enrollment.current_step]
    if (!currentStep) {
      // No more steps
      await db.from('automation_enrollments').update({ status: 'completed', completed_at: now }).eq('id', enrollment.id)
      completed++
      continue
    }

    // Render email replacing {nome} and {empresa}
    const vars: Record<string, string> = {
      nome:    client.name,
      empresa: company.nome,
    }
    const subject = renderAutomationEmail(currentStep.subject, vars)
    const html    = currentStep.body_html
      ? renderAutomationEmail(currentStep.body_html, vars)
      : buildFollowupEmailHTML({ clientName: client.name, nomeEmpresa: company.nome })

    const result = await sendEmail({ to: client.email, subject, html })

    if (result.success) {
      sent++
      const nextIdx = enrollment.current_step + 1

      if (nextIdx >= steps.length) {
        // Completed all steps
        await db.from('automation_enrollments')
          .update({ status: 'completed', completed_at: now, current_step: nextIdx })
          .eq('id', enrollment.id)
        completed++
      } else {
        // Advance to next step
        const nextStep   = steps[nextIdx]
        const nextStepAt = new Date()
        nextStepAt.setDate(nextStepAt.getDate() + (nextStep.delay_days ?? 1))
        await db.from('automation_enrollments')
          .update({ current_step: nextIdx, next_step_at: nextStepAt.toISOString() })
          .eq('id', enrollment.id)
      }
    } else {
      failed++
      await db.from('automation_enrollments').update({ status: 'failed' }).eq('id', enrollment.id)
    }
  }

  return { processed: enrollments.length, sent, failed, completed }
}

// ─── Enroll all overdue clients in automations with trigger 'client_overdue' ──

export async function enrollOverdueClients(companyId: string): Promise<void> {
  const db = getSupabaseServerClient()

  const { data: automations } = await db
    .from('automations')
    .select('id')
    .eq('company_id', companyId)
    .eq('trigger_type', 'client_overdue')
    .eq('status', 'active')

  if (!automations?.length) return

  const { data: clients } = await db
    .from('clients')
    .select('id')
    .eq('company_id', companyId)
    .eq('status', 'overdue')
    .not('email', 'is', null)

  if (!clients?.length) return

  for (const auto of automations) {
    const { data: steps } = await db
      .from('automation_steps')
      .select('id, step_order, subject, body_html, delay_days')
      .eq('automation_id', auto.id)
      .order('step_order')

    if (!steps?.length) continue

    for (const client of clients) {
      await enrollClient({
        automationId: auto.id,
        clientId:     client.id,
        companyId,
        steps:        steps as AutomationStep[],
      })
    }
  }
}

// ─── Enroll a new client in 'new_client' automations ─────────────────────────

export async function enrollNewClient(clientId: string, companyId: string): Promise<void> {
  const db = getSupabaseServerClient()

  const { data: automations } = await db
    .from('automations')
    .select('id')
    .eq('company_id', companyId)
    .eq('trigger_type', 'new_client')
    .eq('status', 'active')

  if (!automations?.length) return

  for (const auto of automations) {
    const { data: steps } = await db
      .from('automation_steps')
      .select('id, step_order, subject, body_html, delay_days')
      .eq('automation_id', auto.id)
      .order('step_order')

    if (!steps?.length) continue

    await enrollClient({
      automationId: auto.id,
      clientId,
      companyId,
      steps: steps as AutomationStep[],
    })
  }
}
