'use client'

// NEXUS Assistant Action Engine
// Central execution layer for voice commands → real actions.
// Handles: tool execution, intent parsing, session memory, UI state broadcast.

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

export interface ActionResult {
  success:  boolean
  summary:  string
  data?:    Record<string, unknown>
  action?:  string  // navigate path, if any
  error?:   string
}

export interface MemoryEntry {
  tool:       string
  params:     Record<string, unknown>
  result:     ActionResult
  timestamp:  string
  transcript?: string
}

export interface SessionState {
  commands:     MemoryEntry[]
  context:      Record<string, unknown>
  ceo_mode:     boolean
  last_entity:  string | null  // last person/contact mentioned
  last_conv_id: string | null  // last conversation_id used
}

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const STORAGE_KEY_COMMANDS = 'nexus_recent_commands'
const STORAGE_KEY_SESSION  = 'nexus_session_state'
const STORAGE_KEY_CEO_MODE = 'nexus_ceo_mode'
const MAX_COMMANDS         = 20

// ─────────────────────────────────────────────────────────────────────────────
// TOOL LABELS — PT-BR display names for all 25 tools
// ─────────────────────────────────────────────────────────────────────────────

export const TOOL_LABELS: Record<string, string> = {
  navigate:               'Navegando',
  getWhatsAppStats:       'Carregando métricas',
  getUnreadMessages:      'Buscando mensagens',
  getHotLeads:            'Buscando leads quentes',
  sendWhatsAppMessage:    'Enviando mensagem',
  searchConversations:    'Buscando conversa',
  getConversationHistory: 'Carregando histórico',
  toggleAI:               'Alternando IA',
  transferToHuman:        'Transferindo para humano',
  markConversationRead:   'Marcando como lida',
  getPipelineLeads:       'Carregando pipeline',
  updateLeadStage:        'Atualizando estágio',
  createFollowUp:         'Criando follow-up',
  getFinancialSummary:    'Carregando financeiro',
  getDashboardSummary:    'Carregando dashboard',
  getSystemStatus:        'Verificando sistema',
  analyzeCompany:         'Analisando empresa',
  orchestrateAgent:       'Acionando agente',
  getAutomations:         'Listando automações',
  triggerAutomation:      'Disparando automação',
  createTask:             'Criando tarefa',
  createAutomation:       'Criando automação',
  scheduleMeeting:        'Agendando reunião',
  generateProposal:       'Gerando proposta',
}

// ─────────────────────────────────────────────────────────────────────────────
// QUICK COMMANDS — 20 voice shortcuts for the UI grid
// ─────────────────────────────────────────────────────────────────────────────

export interface QuickCommand {
  label:   string
  icon:    string
  command: string
  color:   string
}

export const QUICK_COMMANDS: QuickCommand[] = [
  { label: 'Dashboard',       icon: '📊', command: 'Mostra o dashboard executivo',           color: 'from-violet-600 to-purple-700' },
  { label: 'Leads Quentes',   icon: '🔥', command: 'Quais são os leads mais quentes?',       color: 'from-orange-500 to-red-600' },
  { label: 'WhatsApp',        icon: '💬', command: 'Abre o WhatsApp e mostra mensagens',     color: 'from-green-500 to-emerald-600' },
  { label: 'Financeiro',      icon: '💰', command: 'Mostra o resumo financeiro do mês',      color: 'from-yellow-500 to-amber-600' },
  { label: 'Criar Tarefa',    icon: '✅', command: 'Cria uma nova tarefa urgente',            color: 'from-blue-500 to-indigo-600' },
  { label: 'Analisar',        icon: '🧠', command: 'Faz uma análise completa da empresa',    color: 'from-purple-500 to-pink-600' },
  { label: 'Automações',      icon: '⚡', command: 'Lista as automações ativas',              color: 'from-cyan-500 to-blue-600' },
  { label: 'Pipeline',        icon: '📋', command: 'Mostra o pipeline de vendas',             color: 'from-teal-500 to-green-600' },
  { label: 'Não lidas',       icon: '📬', command: 'Quais mensagens não foram lidas?',       color: 'from-red-500 to-rose-600' },
  { label: 'Sistema',         icon: '🖥️', command: 'Verifica a saúde do sistema',            color: 'from-slate-500 to-gray-600' },
  { label: 'Agendar',         icon: '📅', command: 'Agenda uma reunião',                      color: 'from-indigo-500 to-blue-600' },
  { label: 'Proposta',        icon: '📄', command: 'Gera uma proposta comercial',             color: 'from-emerald-500 to-teal-600' },
  { label: 'Automação Nova',  icon: '⚙️', command: 'Cria uma nova automação',                color: 'from-violet-500 to-indigo-600' },
  { label: 'Follow-up',       icon: '🔔', command: 'Cria um follow-up para amanhã',          color: 'from-amber-500 to-orange-600' },
  { label: 'Buscar Lead',     icon: '🔍', command: 'Busca um lead específico',               color: 'from-sky-500 to-blue-600' },
  { label: 'Agentes IA',      icon: '🤖', command: 'Aciona o agente de growth',              color: 'from-fuchsia-500 to-purple-600' },
  { label: 'Projetos',        icon: '🗂️', command: 'Abre os projetos ativos',               color: 'from-lime-500 to-green-600' },
  { label: 'Growth Map',      icon: '🗺️', command: 'Mostra o mapa de crescimento',          color: 'from-rose-500 to-pink-600' },
  { label: 'Enviar MSG',      icon: '📤', command: 'Envia mensagem para um cliente',         color: 'from-green-600 to-teal-600' },
  { label: 'CEO Mode',        icon: '👑', command: 'Ativa o modo CEO com monitoramento',     color: 'from-yellow-600 to-amber-700' },
]

// ─────────────────────────────────────────────────────────────────────────────
// SESSION MEMORY
// ─────────────────────────────────────────────────────────────────────────────

function getSessionState(): SessionState {
  if (typeof window === 'undefined') return emptySession()
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SESSION)
    if (raw) return JSON.parse(raw) as SessionState
  } catch { /* ignore */ }
  return emptySession()
}

function emptySession(): SessionState {
  return { commands: [], context: {}, ceo_mode: false, last_entity: null, last_conv_id: null }
}

function saveSessionState(state: SessionState): void {
  if (typeof window === 'undefined') return
  try {
    // Keep only last MAX_COMMANDS
    const trimmed = { ...state, commands: state.commands.slice(-MAX_COMMANDS) }
    localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(trimmed))
  } catch { /* ignore */ }
}

export function getCeoMode(): boolean {
  if (typeof window === 'undefined') return false
  return localStorage.getItem(STORAGE_KEY_CEO_MODE) === 'true'
}

export function setCeoMode(active: boolean): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY_CEO_MODE, active ? 'true' : 'false')
}

export function getRecentCommands(): MemoryEntry[] {
  return getSessionState().commands
}

export function getSessionContext(): Record<string, unknown> {
  return getSessionState().context
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE EXECUTION FUNCTION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Execute a voice tool call.
 * Called from the DataChannel handler in the assistant page
 * whenever OpenAI emits a response.output_item.done with type='function_call'.
 */
export async function executeTool(
  tool: string,
  params: Record<string, unknown>,
  transcript?: string,
): Promise<ActionResult> {
  const state = getSessionState()

  // ── Context injection — fill in missing params from session memory ──────
  const enrichedParams = enrichParams(tool, params, state)

  try {
    const res = await fetch('/api/nexus/voice/execute', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ tool, params: enrichedParams }),
    })

    const data = await res.json() as Record<string, unknown>

    const result: ActionResult = {
      success: res.ok && !data.error,
      summary: String(data.summary ?? data.error ?? 'Ação executada.'),
      data,
      action:  data.action === 'navigate' ? String(data.path ?? '') : undefined,
      error:   data.error ? String(data.error) : undefined,
    }

    // ── Update session memory ────────────────────────────────────────────
    const entry: MemoryEntry = {
      tool,
      params: enrichedParams,
      result,
      timestamp: new Date().toISOString(),
      transcript,
    }

    state.commands.push(entry)
    updateContextFromResult(state, tool, enrichedParams, data)
    saveSessionState(state)

    // ── Persist recent commands to legacy key ────────────────────────────
    try {
      const recent: string[] = JSON.parse(localStorage.getItem(STORAGE_KEY_COMMANDS) ?? '[]')
      if (transcript) {
        recent.unshift(transcript)
        localStorage.setItem(STORAGE_KEY_COMMANDS, JSON.stringify(recent.slice(0, MAX_COMMANDS)))
      }
    } catch { /* ignore */ }

    return result
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro de conexão'
    return { success: false, summary: `Erro ao executar ${tool}: ${msg}`, error: msg }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT ENRICHMENT — Fill missing params from conversational memory
// ─────────────────────────────────────────────────────────────────────────────

function enrichParams(
  tool: string,
  params: Record<string, unknown>,
  state: SessionState,
): Record<string, unknown> {
  const enriched = { ...params }

  // If a tool needs conversation_id and we have one in memory, inject it
  const needsConvId = ['toggleAI', 'transferToHuman', 'markConversationRead', 'getConversationHistory', 'updateLeadStage', 'generateProposal']
  if (needsConvId.includes(tool) && !enriched.conversation_id && state.last_conv_id) {
    enriched.conversation_id = state.last_conv_id
  }

  // If sendWhatsAppMessage has no phone but we have last_entity in context, try to use it
  if (tool === 'sendWhatsAppMessage' && !enriched.phone && state.context.last_phone) {
    enriched.phone = state.context.last_phone
  }

  // Pass CEO mode hint to analyzeCompany
  if (tool === 'analyzeCompany') {
    enriched._ceo_mode = state.ceo_mode
  }

  return enriched
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTEXT UPDATER — Extract useful info from results to remember
// ─────────────────────────────────────────────────────────────────────────────

function updateContextFromResult(
  state: SessionState,
  tool: string,
  params: Record<string, unknown>,
  data: Record<string, unknown>,
): void {
  // Remember conversation_id from search results
  if (tool === 'searchConversations') {
    const results = data.results as Array<{ id: string; phone?: string; name?: string }> | undefined
    if (results && results.length === 1) {
      state.last_conv_id     = results[0].id
      state.last_entity      = results[0].name ?? null
      state.context.last_phone = results[0].phone ?? null
    }
  }

  // Remember conversation_id from params used
  if (params.conversation_id) {
    state.last_conv_id = String(params.conversation_id)
  }

  // Remember contact context from sendWhatsAppMessage
  if (tool === 'sendWhatsAppMessage' && params.phone) {
    state.context.last_phone = String(params.phone)
  }

  // Remember hot leads for later reference
  if (tool === 'getHotLeads') {
    const leads = data.leads as Array<{ id?: string; phone?: string; name?: string }> | undefined
    if (leads && leads.length > 0) {
      state.context.hot_leads = leads
    }
  }

  // Toggle CEO mode from command
  if (tool === 'analyzeCompany' && data._ceo_mode === true) {
    state.ceo_mode = true
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// INTENT PARSER — Maps quick user text commands to tool calls
// Used for typed quick commands (not voice — voice goes through OpenAI NLP)
// ─────────────────────────────────────────────────────────────────────────────

interface ParsedIntent {
  tool:   string
  params: Record<string, unknown>
}

export function parseQuickIntent(text: string): ParsedIntent | null {
  const t = text.toLowerCase()

  if (t.includes('lead') && (t.includes('quente') || t.includes('hot')))
    return { tool: 'getHotLeads', params: { limit: 5 } }

  if (t.includes('dashboard') || t.includes('resumo executivo'))
    return { tool: 'getDashboardSummary', params: {} }

  if (t.includes('financeiro') || t.includes('faturamento') || t.includes('receita'))
    return { tool: 'getFinancialSummary', params: {} }

  if (t.includes('não lida') || t.includes('mensagem pendente'))
    return { tool: 'getUnreadMessages', params: {} }

  if (t.includes('pipeline') || t.includes('crm'))
    return { tool: 'getPipelineLeads', params: {} }

  if (t.includes('automação') || t.includes('automacoes') || t.includes('fluxo'))
    return { tool: 'getAutomations', params: {} }

  if (t.includes('sistema') || t.includes('saúde') || t.includes('status'))
    return { tool: 'getSystemStatus', params: {} }

  if (t.includes('analisa') || t.includes('análise') || t.includes('ceo mode'))
    return { tool: 'analyzeCompany', params: {} }

  if (t.includes('whatsapp') || t.includes('atendimento'))
    return { tool: 'getWhatsAppStats', params: {} }

  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// NAVIGATE HELPER — extracts navigation path from a result
// ─────────────────────────────────────────────────────────────────────────────

export function extractNavigatePath(result: ActionResult): string | null {
  if (result.action && result.action.startsWith('/')) return result.action
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY BUILDER — formats a result for display in the transcript
// ─────────────────────────────────────────────────────────────────────────────

export function buildDisplaySummary(tool: string, result: ActionResult): string {
  const label = TOOL_LABELS[tool] ?? tool
  if (!result.success) return `❌ ${label}: ${result.error ?? 'Falha'}`
  return result.summary
}

// ─────────────────────────────────────────────────────────────────────────────
// CEO MODE BRIEFING — Generate proactive status report
// ─────────────────────────────────────────────────────────────────────────────

export async function generateCeoBriefing(): Promise<ActionResult> {
  return executeTool('analyzeCompany', { _ceo_mode: true }, 'CEO Mode — briefing executivo')
}

// ─────────────────────────────────────────────────────────────────────────────
// CLEAR SESSION
// ─────────────────────────────────────────────────────────────────────────────

export function clearSession(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY_SESSION)
  localStorage.removeItem(STORAGE_KEY_COMMANDS)
}
