// NEXUS Core Engine — Shared Types
// All engines import from here. Single source of truth.

// ─── Event Bus ────────────────────────────────────────────────────────────────

export type NexusEventType =
  | 'conversation.created'
  | 'conversation.updated'
  | 'message.received'
  | 'message.sent'
  | 'lead.updated'
  | 'lead.created'
  | 'campaign.started'
  | 'campaign.completed'
  | 'assistant.command'
  | 'automation.executed'
  | 'automation.triggered'
  | 'whatsapp.connected'
  | 'whatsapp.disconnected'
  | 'payment.received'
  | 'payment.failed'
  | 'ai.action.completed'
  | 'ai.action.failed'

export interface NexusEvent<T = Record<string, unknown>> {
  id:          string
  type:        NexusEventType
  company_id:  string
  payload:     T
  source:      string          // which module emitted (e.g. 'whatsapp', 'crm', 'voice')
  created_at:  string
}

// ─── Actions ─────────────────────────────────────────────────────────────────

export type NexusActionType =
  | 'send_message'
  | 'update_lead'
  | 'create_followup'
  | 'run_automation'
  | 'generate_content'
  | 'navigate'
  | 'analyze_lead'
  | 'send_campaign'
  | 'toggle_ai'

export interface NexusAction {
  type:       NexusActionType
  company_id: string
  payload:    Record<string, unknown>
  triggered_by?: string   // event_id or 'manual'
  ai_session?: string     // voice/chat session id
}

export interface ActionResult {
  success: boolean
  data?:   Record<string, unknown>
  error?:  string
  action:  NexusActionType
}

// ─── Memory ───────────────────────────────────────────────────────────────────

export type MemoryType =
  | 'user_context'
  | 'ai_history'
  | 'recent_action'
  | 'current_state'
  | 'operational_context'
  | 'lead_context'

export interface MemoryEntry {
  id?:         string
  company_id:  string
  type:        MemoryType
  key:         string
  value:       Record<string, unknown>
  ttl_seconds?: number
  expires_at?: string
  created_at?: string
  updated_at?: string
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface AnalyticsEvent {
  company_id:  string
  metric:      string
  value:       number
  dimensions?: Record<string, string>
  recorded_at: string
}

export interface DashboardMetrics {
  conversations:    { total: number; active: number; ai_enabled: number }
  messages:         { total: number; ai_generated: number; today: number }
  leads:            { total: number; hot: number; converted: number }
  revenue:          { month: number; formatted: string }
  automations:      { active: number; executions_today: number }
  ai_performance:   { response_rate: string; conversion_rate: string }
}

// ─── Realtime ─────────────────────────────────────────────────────────────────

export interface RealtimeMessage {
  type:       'update' | 'notification' | 'typing' | 'sync'
  company_id: string
  channel:    string
  data:       Record<string, unknown>
  timestamp:  string
}
