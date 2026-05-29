'use client'

// lib/nexus/action-engine.ts
// NexusActionEngine — executes tool calls from NexusVoiceEngine

export interface ActionResult {
  success: boolean
  message: string
  data?:   unknown
  action?: string
  path?:   string   // navigation path to open in the app
}

const EXECUTE = '/api/nexus/voice/execute'

async function post(tool: string, params: Record<string, unknown>): Promise<ActionResult> {
  try {
    const r = await fetch(EXECUTE, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ tool, params }),
    })
    if (!r.ok) {
      const b = await r.json().catch(() => ({}) as Record<string, unknown>) as Record<string, unknown>
      return { success: false, message: String(b.error ?? `Erro HTTP ${r.status}`) }
    }
    return await r.json() as ActionResult
  } catch (err) {
    return { success: false, message: err instanceof Error ? err.message : 'Erro de rede' }
  }
}

export class NexusActionEngine {

  async execute(name: string, args: Record<string, unknown>): Promise<ActionResult> {
    switch (name) {
      case 'enviar_mensagem':    return this.enviarMensagem(args)
      case 'criar_tarefa':       return this.criarTarefa(args)
      case 'criar_projeto':      return this.criarProjeto(args)
      case 'abrir_lead':         return this.abrirLead(args)
      case 'abrir_whatsapp':     return this.abrirWhatsapp(args)
      case 'criar_automacao':    return this.criarAutomacao(args)
      case 'gerar_proposta':     return this.gerarProposta(args)
      case 'marcar_reuniao':     return this.marcarReuniao(args)
      case 'consultar_financeiro': return this.consultarFinanceiro(args)
      case 'ativar_modo_ceo':    return this.ativarModoCeo(args)
      default:
        return { success: false, message: `Ação desconhecida: ${name}` }
    }
  }

  private async enviarMensagem(args: Record<string, unknown>): Promise<ActionResult> {
    const result = await post('enviar_mensagem', args)
    return {
      ...result,
      action: 'enviar_mensagem',
      path:   '/dashboard/whatsapp',
    }
  }

  private async criarTarefa(args: Record<string, unknown>): Promise<ActionResult> {
    const result = await post('criar_tarefa', args)
    return {
      ...result,
      action: 'criar_tarefa',
      path:   '/dashboard/tarefas',
    }
  }

  private async criarProjeto(args: Record<string, unknown>): Promise<ActionResult> {
    const result = await post('criar_projeto', args)
    return {
      ...result,
      action: 'criar_projeto',
      path:   '/dashboard/projetos',
    }
  }

  private async abrirLead(args: Record<string, unknown>): Promise<ActionResult> {
    const result = await post('abrir_lead', args)
    return {
      ...result,
      action: 'abrir_lead',
      path:   '/dashboard/crm',
    }
  }

  private async abrirWhatsapp(args: Record<string, unknown>): Promise<ActionResult> {
    const result = await post('abrir_whatsapp', args)
    return {
      ...result,
      action: 'abrir_whatsapp',
      path:   '/dashboard/whatsapp',
    }
  }

  private async criarAutomacao(args: Record<string, unknown>): Promise<ActionResult> {
    const result = await post('criar_automacao', args)
    return {
      ...result,
      action: 'criar_automacao',
      path:   '/dashboard/automacoes',
    }
  }

  private async gerarProposta(args: Record<string, unknown>): Promise<ActionResult> {
    const result = await post('gerar_proposta', args)
    return {
      ...result,
      action: 'gerar_proposta',
      path:   '/dashboard/propostas',
    }
  }

  private async marcarReuniao(args: Record<string, unknown>): Promise<ActionResult> {
    const result = await post('marcar_reuniao', args)
    return {
      ...result,
      action: 'marcar_reuniao',
      path:   '/dashboard/agenda',
    }
  }

  private async consultarFinanceiro(args: Record<string, unknown>): Promise<ActionResult> {
    const result = await post('consultar_financeiro', args)
    return {
      ...result,
      action: 'consultar_financeiro',
      path:   '/dashboard/financeiro',
    }
  }

  private async ativarModoCeo(args: Record<string, unknown>): Promise<ActionResult> {
    const result = await post('ativar_modo_ceo', args)
    return {
      ...result,
      action: 'ativar_modo_ceo',
      path:   '/dashboard',
    }
  }
}
