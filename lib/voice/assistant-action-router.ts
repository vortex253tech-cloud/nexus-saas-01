'use client'

// NEXUS Assistant Action Router
// Bridges WebRTC tool calls → execute API → UI updates.
// Wraps assistant-action-engine with navigation and module-aware routing.

import { executeTool, TOOL_LABELS, type ActionResult } from './assistant-action-engine'
export type { ActionResult }
export { TOOL_LABELS }

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE TABLE — tool → module path for auto-navigation hints
// ─────────────────────────────────────────────────────────────────────────────

const TOOL_MODULE_MAP: Record<string, string> = {
  getWhatsAppStats:       '/dashboard/whatsapp',
  getUnreadMessages:      '/dashboard/whatsapp',
  sendWhatsAppMessage:    '/dashboard/whatsapp',
  searchConversations:    '/dashboard/whatsapp',
  getConversationHistory: '/dashboard/whatsapp',
  toggleAI:               '/dashboard/whatsapp',
  transferToHuman:        '/dashboard/whatsapp',
  markConversationRead:   '/dashboard/whatsapp',
  getHotLeads:            '/dashboard/leads',
  getPipelineLeads:       '/dashboard/pipeline',
  updateLeadStage:        '/dashboard/pipeline',
  createFollowUp:         '/dashboard/pipeline',
  getFinancialSummary:    '/dashboard/financeiro',
  getDashboardSummary:    '/dashboard/nexus',
  getSystemStatus:        '/dashboard/nexus',
  analyzeCompany:         '/dashboard/nexus',
  orchestrateAgent:       '/dashboard/agents',
  getAutomations:         '/dashboard/automations',
  triggerAutomation:      '/dashboard/automations',
  createAutomation:       '/dashboard/automations',
  createTask:             '/dashboard/projects',
  scheduleMeeting:        '/dashboard/projects',
  generateProposal:       '/dashboard/leads',
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ROUTER
// ─────────────────────────────────────────────────────────────────────────────

export interface RoutedResult extends ActionResult {
  modulePath?: string  // hint: which dashboard module this relates to
  label:       string  // human-readable tool label
}

export async function routeAction(
  tool:       string,
  params:     Record<string, unknown>,
  transcript?: string,
): Promise<RoutedResult> {
  const result = await executeTool(tool, params, transcript)

  const modulePath = tool === 'navigate'
    ? (params.path as string | undefined)
    : TOOL_MODULE_MAP[tool]

  return {
    ...result,
    label:      TOOL_LABELS[tool] ?? tool,
    modulePath: modulePath ?? result.action,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// NAVIGATION EXTRACTOR
// ─────────────────────────────────────────────────────────────────────────────

export function getNavigationPath(result: RoutedResult): string | null {
  if (result.action?.startsWith('/')) return result.action
  if (result.modulePath?.startsWith('/')) return result.modulePath
  return null
}

// ─────────────────────────────────────────────────────────────────────────────
// AGENT DETECTION — returns agent name/task if orchestrateAgent was called
// ─────────────────────────────────────────────────────────────────────────────

export function extractAgentInfo(
  tool:   string,
  params: Record<string, unknown>,
): { agent: string; task: string } | null {
  if (tool !== 'orchestrateAgent') return null
  return {
    agent: (params.agent as string | undefined) ?? 'IA',
    task:  (params.task  as string | undefined) ?? 'Executando…',
  }
}
