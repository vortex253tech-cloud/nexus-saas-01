// ─── Flow Engine — Type Definitions ──────────────────────────────────────────

// ─── Node type enum ───────────────────────────────────────────────────────────

export enum FlowNodeType {
  TRIGGER  = 'TRIGGER',
  ANALYSIS = 'ANALYSIS',
  DECISION = 'DECISION',
  ACTION   = 'ACTION',
  RESULT   = 'RESULT',
}

// ─── Node & Edge ──────────────────────────────────────────────────────────────

export interface FlowNode {
  id:       string
  type:     FlowNodeType | string  // string allows legacy node types
  config:   Record<string, unknown>
  position?: { x: number; y: number }
  label?:   string
  data?:    Record<string, unknown>
}

export interface FlowEdge {
  id:         string
  source:     string
  target:     string
  /** Used by DECISION nodes to route branches */
  condition?: 'true' | 'false'
}

// ─── Execution context (shared across all handlers in a run) ─────────────────

export interface ExecutionContext {
  flowId:      string
  executionId: string
  companyId:   string
  /** Arbitrary key-value bag, updated as nodes run */
  variables:   Record<string, unknown>
  /** Accumulated step logs */
  logs:        StepLog[]
  /** Output of the most recently executed node */
  lastOutput:  unknown
}

// ─── Per-node result ─────────────────────────────────────────────────────────

export interface NodeResult {
  success:     boolean
  output:      unknown
  /** DECISION nodes set this to route downstream edges */
  nextBranch?: 'true' | 'false'
  message?:    string
}

// ─── Step log (one per node execution) ───────────────────────────────────────

export interface StepLog {
  nodeId:     string
  nodeType:   string
  status:     'success' | 'error' | 'skipped'
  input:      unknown
  output:     unknown
  durationMs: number
  timestamp:  string
  message?:   string
}

// ─── Flow definition (loaded from DB) ────────────────────────────────────────

export interface FlowDefinition {
  id:        string
  name:      string
  nodes:     FlowNode[]
  edges:     FlowEdge[]
  companyId: string
}

// ─── Execution record (persisted in flow_executions) ─────────────────────────

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'error'

export interface ExecutionRecord {
  id:          string
  flowId:      string
  companyId:   string
  status:      ExecutionStatus
  logs:        StepLog[]
  output:      unknown
  startedAt:   string
  finishedAt?: string
}
