'use client'

import { useState } from 'react'
import { X, Save } from 'lucide-react'
import type { NodeType } from '@/lib/growth-map-types'

// ─── Field schema per node type ────────────────────────────────────────────────
// Mirrors exactly what each handler reads (see lib/flow-engine/handlers/*.ts and
// lib/flow-engine/actions/*.ts) — not the decorative-only fields some templates
// carry (e.g. `focus`, `question`), which the engine never consumes.

interface FieldSpec {
  key:          string
  label:        string
  kind:         'select' | 'text' | 'textarea' | 'number' | 'checkbox'
  options?:     { value: string; label: string }[]
  placeholder?: string
  helper?:      string
}

const DATA_SOURCE_OPTIONS = [
  { value: 'all_clients',     label: 'Todos os clientes' },
  { value: 'overdue',         label: 'Faturas em atraso' },
  { value: 'invoices',        label: 'Faturas (todas)' },
  { value: 'financial',       label: 'Financeiro (receitas/despesas)' },
  { value: 'inactive',        label: 'Clientes inativos' },
  { value: 'at_risk_clients', label: 'Clientes em risco' },
  { value: 'leads',           label: 'Leads (todos)' },
  { value: 'new_leads',       label: 'Leads novos' },
]

const MESSAGE_TYPE_OPTIONS = [
  { value: 'recovery',     label: 'Cobrança / recuperação' },
  { value: 'upsell',       label: 'Upsell' },
  { value: 'reactivation', label: 'Reativação' },
  { value: 'campaign',     label: 'Campanha geral' },
]

const CHANNEL_OPTIONS = [
  { value: 'email',    label: 'Email' },
  { value: 'whatsapp', label: 'WhatsApp' },
]

const ACTION_TYPE_OPTIONS = [
  { value: '',                    label: 'Automático (pelo canal)' },
  { value: 'SEND_EMAIL',          label: 'Enviar email' },
  { value: 'SEND_WHATSAPP',       label: 'Enviar WhatsApp' },
  { value: 'UPDATE_CLIENT',       label: 'Atualizar cliente' },
  { value: 'UPDATE_FINANCIAL',    label: 'Atualizar registro financeiro' },
  { value: 'CREATE_LEAD',         label: 'Criar lead' },
  { value: 'UPDATE_LEAD_STATUS',  label: 'Mudar status de lead' },
  { value: 'CREATE_PAYMENT_LINK', label: 'Gerar link de pagamento' },
]

const LEAD_STATUS_OPTIONS = [
  { value: 'new',       label: 'Novo' },
  { value: 'contacted', label: 'Contatado' },
  { value: 'converted', label: 'Convertido' },
  { value: 'lost',      label: 'Perdido' },
]

function fieldsFor(type: NodeType, config: Record<string, unknown>): FieldSpec[] {
  switch (type) {
    case 'data_analysis':
    case 'opportunity': {
      const fields: FieldSpec[] = [
        { key: 'dataSource', label: 'Fonte de dados', kind: 'select', options: DATA_SOURCE_OPTIONS },
        { key: 'limit', label: 'Limite de registros', kind: 'number', placeholder: '100' },
      ]
      if (config.dataSource === 'at_risk_clients') {
        fields.push({ key: 'inactiveDays', label: 'Dias sem atividade', kind: 'number', placeholder: '30' })
      }
      if (type === 'opportunity') {
        fields.push({
          key: 'focus', label: 'Foco da análise (anotação)', kind: 'text',
          placeholder: 'ex: recuperação de receita',
          helper: 'Apenas descritivo — não afeta a execução.',
        })
      }
      return fields
    }

    case 'decision': {
      const fields: FieldSpec[] = [
        { key: 'useAI', label: 'Decidir com IA', kind: 'checkbox' },
      ]
      if (config.useAI) {
        fields.push(
          { key: 'aiPrompt', label: 'Pergunta para a IA', kind: 'textarea', placeholder: 'Devemos seguir com esta ação?' },
          { key: 'threshold', label: 'Limite de confiança (0-100)', kind: 'number', placeholder: '70' },
        )
      } else {
        fields.push({
          key: 'condition', label: 'Condição', kind: 'text',
          placeholder: 'lastOutput.count > 500',
          helper: 'Expressão booleana (lastOutput.* ou variables.*). Vazio = sempre segue em frente.',
        })
      }
      return fields
    }

    case 'message_gen':
      return [
        { key: 'messageType', label: 'Tipo de mensagem', kind: 'select', options: MESSAGE_TYPE_OPTIONS },
        { key: 'channel', label: 'Canal', kind: 'select', options: CHANNEL_OPTIONS },
        { key: 'tone', label: 'Tom da mensagem', kind: 'text', placeholder: 'ex: profissional, urgente, amigável' },
      ]

    case 'auto_action': {
      const actionType = (config.actionType as string | undefined) || ''
      const fields: FieldSpec[] = [
        { key: 'actionType', label: 'Ação', kind: 'select', options: ACTION_TYPE_OPTIONS },
      ]

      if (!actionType || actionType === 'SEND_EMAIL') {
        fields.push(
          { key: 'channel', label: 'Canal padrão', kind: 'select', options: CHANNEL_OPTIONS, helper: 'Usado quando "Ação" está em Automático.' },
          { key: 'subject', label: 'Assunto do email (opcional)', kind: 'text', placeholder: 'Deixe vazio para usar o padrão' },
          { key: 'template', label: 'Corpo do email (opcional)', kind: 'textarea', placeholder: 'Use {{nome}}, {{amount}} etc. Vazio = usa o padrão.' },
        )
      }
      if (!actionType || actionType === 'SEND_WHATSAPP') {
        fields.push(
          { key: 'message', label: 'Mensagem de WhatsApp (opcional)', kind: 'textarea', placeholder: 'Use {{nome}} etc. Vazio = usa o padrão.' },
        )
      }
      if (actionType === 'UPDATE_CLIENT' || actionType === 'UPDATE_FINANCIAL') {
        fields.push(
          { key: 'field', label: 'Campo a atualizar', kind: 'text', placeholder: 'ex: status' },
          { key: 'value', label: 'Novo valor', kind: 'text', placeholder: 'ex: contatado' },
          { key: 'table', label: 'Tabela (avançado)', kind: 'text', placeholder: actionType === 'UPDATE_CLIENT' ? 'clients' : 'financeiro' },
          { key: 'idField', label: 'Campo de ID (avançado)', kind: 'text', placeholder: 'id' },
        )
      }
      if (actionType === 'CREATE_LEAD') {
        fields.push(
          { key: 'source', label: 'Origem do lead', kind: 'text', placeholder: 'flow' },
          { key: 'status', label: 'Status inicial', kind: 'select', options: LEAD_STATUS_OPTIONS },
          { key: 'notes', label: 'Notas (opcional)', kind: 'textarea', placeholder: 'Pode usar {{nome}} etc.' },
        )
      }
      if (actionType === 'UPDATE_LEAD_STATUS') {
        fields.push({ key: 'status', label: 'Novo status', kind: 'select', options: LEAD_STATUS_OPTIONS })
      }
      if (actionType === 'CREATE_PAYMENT_LINK') {
        fields.push(
          { key: 'description', label: 'Descrição da fatura', kind: 'text', placeholder: 'Fatura {{id}}' },
          { key: 'invoice_id', label: 'ID da fatura (sem dados de entrada)', kind: 'text' },
          { key: 'amount', label: 'Valor (sem dados de entrada)', kind: 'number' },
        )
      }
      return fields
    }

    default:
      return []
  }
}

// ─── Panel ────────────────────────────────────────────────────────────────────

interface NodeConfigPanelProps {
  nodeType: NodeType
  label:    string
  config:   Record<string, unknown>
  onChange: (config: Record<string, unknown>) => void
  onClose:  () => void
}

export default function NodeConfigPanel({ nodeType, label, config, onChange, onClose }: NodeConfigPanelProps) {
  const [draft, setDraft] = useState<Record<string, unknown>>(config ?? {})
  const fields = fieldsFor(nodeType, draft)

  function setField(key: string, value: string | number | boolean | undefined) {
    const next = { ...draft, [key]: value }
    setDraft(next)
    onChange(next)
  }

  return (
    <div className="absolute right-4 top-4 z-40 w-96 bg-zinc-900/98 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-950">
        <div>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide">Configurar nó</p>
          <p className="text-xs font-bold text-white">{label}</p>
        </div>
        <button onClick={onClose} className="p-1 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-800">
          <X size={14} />
        </button>
      </div>

      <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
        {fields.length === 0 && (
          <p className="text-xs text-zinc-500 text-center py-4">Este tipo de nó não tem parâmetros configuráveis.</p>
        )}

        {fields.map(f => (
          <div key={f.key}>
            {f.kind === 'checkbox' ? (
              <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(draft[f.key])}
                  onChange={e => setField(f.key, e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-800"
                />
                {f.label}
              </label>
            ) : (
              <>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">{f.label}</label>
                {f.kind === 'select' ? (
                  <select
                    value={String(draft[f.key] ?? '')}
                    onChange={e => setField(f.key, e.target.value)}
                    className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-2.5 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-violet-500"
                  >
                    <option value="">Selecione…</option>
                    {f.options?.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                ) : f.kind === 'textarea' ? (
                  <textarea
                    value={String(draft[f.key] ?? '')}
                    onChange={e => setField(f.key, e.target.value)}
                    placeholder={f.placeholder}
                    rows={3}
                    className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-2.5 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-violet-500 resize-none"
                  />
                ) : (
                  <input
                    type={f.kind === 'number' ? 'number' : 'text'}
                    value={String(draft[f.key] ?? '')}
                    onChange={e => setField(
                      f.key,
                      f.kind === 'number' ? (e.target.value === '' ? undefined : Number(e.target.value)) : e.target.value,
                    )}
                    placeholder={f.placeholder}
                    className="w-full rounded-lg bg-zinc-800 border border-zinc-700 px-2.5 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-violet-500"
                  />
                )}
                {f.helper && <p className="text-[10px] text-zinc-600 mt-1">{f.helper}</p>}
              </>
            )}
          </div>
        ))}
      </div>

      <div className="px-4 py-3 border-t border-zinc-800 bg-zinc-950/50">
        <p className="text-[10px] text-zinc-600 flex items-center gap-1.5">
          <Save size={10} /> Alterações aplicadas ao nó — clique em "Salvar" no canvas para persistir.
        </p>
      </div>
    </div>
  )
}
