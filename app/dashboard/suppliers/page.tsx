'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package, TrendingDown, TrendingUp, AlertTriangle, Minus,
  Loader2, RefreshCw, Sparkles, Plus, X, ChevronDown,
  ChevronRight, DollarSign, BarChart3, Zap, MessageSquare,
  Mail, Phone, Trash2, Edit2, ArrowUpRight, ArrowDownRight,
  ShieldAlert, CheckCircle2, Target, PiggyBank, Activity,
} from 'lucide-react'
import { cn } from '@/lib/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SupplierCost {
  id:        string
  amount:    number
  frequency: 'monthly' | 'weekly' | 'one-time'
  date:      string
}

interface Supplier {
  id:               string
  name:             string
  category:         string
  type:             'recurring' | 'one-time'
  contact_email:    string | null
  contact_whatsapp: string | null
  created_at:       string
  costs:            SupplierCost[]
}

interface ScoredSupplier extends Supplier {
  monthlyCost:  number
  trend:        'up' | 'down' | 'stable'
  trendPct:     number
  riskLabel:    'high_cost_risk' | 'medium' | 'efficient'
  score:        number
  shareOfTotal: number
  costHistory:  { date: string; amount: number }[]
}

interface Insight {
  supplier_id:  string | null
  type:         'high_cost' | 'increase' | 'inefficiency' | 'dependency' | 'duplicate'
  message:      string
  impact_value: number
}

interface Analysis {
  totalMonthlyCost:   number
  savingsOpportunity: number
  scored:             ScoredSupplier[]
  topThree:           ScoredSupplier[]
  categoryBreakdown:  { category: string; total: number; share: number }[]
  insights:           Insight[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  n >= 1_000_000
    ? `R$ ${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000
    ? `R$ ${(n / 1_000).toFixed(1)}k`
    : `R$ ${Math.round(n).toLocaleString('pt-BR')}`

const fmtFull = (n: number) =>
  `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const RISK_CONFIG = {
  high_cost_risk: {
    label:  'Alto Risco',
    color:  'text-red-400',
    bg:     'bg-red-500/10',
    border: 'border-red-500/30',
    dot:    'bg-red-500',
    ring:   'ring-red-500/40',
  },
  medium: {
    label:  'Médio',
    color:  'text-yellow-400',
    bg:     'bg-yellow-500/10',
    border: 'border-yellow-500/30',
    dot:    'bg-yellow-500',
    ring:   'ring-yellow-500/40',
  },
  efficient: {
    label:  'Eficiente',
    color:  'text-emerald-400',
    bg:     'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    dot:    'bg-emerald-500',
    ring:   'ring-emerald-500/40',
  },
}

const INSIGHT_ICONS = {
  high_cost:   ShieldAlert,
  increase:    TrendingUp,
  inefficiency:Activity,
  dependency:  AlertTriangle,
  duplicate:   Package,
}

const FREQ_LABELS: Record<string, string> = {
  monthly:  'mensal',
  weekly:   'semanal',
  'one-time': 'único',
}

const CATEGORIES = [
  'Marketing', 'Tecnologia', 'Operações', 'RH', 'Jurídico',
  'Financeiro', 'Logística', 'Fornecedor', 'Serviços', 'Outro',
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, icon: Icon, color, trend,
}: {
  label: string; value: string; sub?: string
  icon: React.ElementType; color: string; trend?: 'up' | 'down' | 'neutral'
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-5 flex flex-col gap-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-white/40 uppercase tracking-wider">{label}</span>
        <div className={cn('p-2 rounded-xl', color.replace('text-', 'bg-').replace('400', '500/15'))}>
          <Icon className={cn('w-4 h-4', color)} />
        </div>
      </div>
      <div>
        <p className={cn('text-2xl font-semibold', color)}>{value}</p>
        {sub && (
          <p className="text-xs text-white/40 mt-1 flex items-center gap-1">
            {trend === 'up' && <TrendingUp className="w-3 h-3 text-red-400" />}
            {trend === 'down' && <TrendingDown className="w-3 h-3 text-emerald-400" />}
            {sub}
          </p>
        )}
      </div>
    </motion.div>
  )
}

function RiskBadge({ risk }: { risk: 'high_cost_risk' | 'medium' | 'efficient' }) {
  const cfg = RISK_CONFIG[risk]
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border', cfg.bg, cfg.border, cfg.color)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  )
}

function TrendBadge({ trend, pct }: { trend: 'up' | 'down' | 'stable'; pct: number }) {
  if (trend === 'stable') return <span className="text-white/30 text-xs flex items-center gap-1"><Minus className="w-3 h-3" />Estável</span>
  const up = trend === 'up'
  return (
    <span className={cn('text-xs flex items-center gap-0.5', up ? 'text-red-400' : 'text-emerald-400')}>
      {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

// ─── Add Supplier Modal ───────────────────────────────────────────────────────

function AddSupplierModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: '', category: CATEGORIES[0], contact_email: '',
    contact_whatsapp: '', type: 'recurring' as 'recurring' | 'one-time',
    initialCost: '', frequency: 'monthly' as 'monthly' | 'weekly' | 'one-time',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Nome obrigatório'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/suppliers', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      onSaved()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[#0f1117] border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-white">Novo Fornecedor</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label className="text-xs text-white/50 mb-1 block">Nome *</label>
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="ex: Google Ads, AWS, Contador..."
              className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/20"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50 mb-1 block">Categoria</label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/20"
              >
                {CATEGORIES.map(c => <option key={c} value={c} className="bg-[#0f1117]">{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Tipo</label>
              <select
                value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as 'recurring' | 'one-time' }))}
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/20"
              >
                <option value="recurring" className="bg-[#0f1117]">Recorrente</option>
                <option value="one-time" className="bg-[#0f1117]">Único</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-white/50 mb-1 block">Email de contato</label>
            <input
              type="email"
              value={form.contact_email}
              onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
              placeholder="contato@fornecedor.com"
              className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/20"
            />
          </div>

          <div>
            <label className="text-xs text-white/50 mb-1 block">WhatsApp</label>
            <input
              value={form.contact_whatsapp}
              onChange={e => setForm(f => ({ ...f, contact_whatsapp: e.target.value }))}
              placeholder="+55 11 99999-9999"
              className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/20"
            />
          </div>

          <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4">
            <p className="text-xs text-white/50 mb-3">Custo inicial (opcional)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-white/30 mb-1 block">Valor (R$)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.initialCost}
                  onChange={e => setForm(f => ({ ...f, initialCost: e.target.value }))}
                  placeholder="0,00"
                  className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/20"
                />
              </div>
              <div>
                <label className="text-xs text-white/30 mb-1 block">Frequência</label>
                <select
                  value={form.frequency}
                  onChange={e => setForm(f => ({ ...f, frequency: e.target.value as 'monthly' | 'weekly' | 'one-time' }))}
                  className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/20"
                >
                  <option value="monthly" className="bg-[#0f1117]">Mensal</option>
                  <option value="weekly" className="bg-[#0f1117]">Semanal</option>
                  <option value="one-time" className="bg-[#0f1117]">Único</option>
                </select>
              </div>
            </div>
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-3 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm text-white/50 border border-white/10 hover:bg-white/[0.03] transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-xl text-sm text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {saving ? 'Salvando...' : 'Adicionar'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Add Cost Modal ───────────────────────────────────────────────────────────

function AddCostModal({ supplier, onClose, onSaved }: {
  supplier: Supplier; onClose: () => void; onSaved: () => void
}) {
  const [form, setForm] = useState({ amount: '', frequency: 'monthly' as 'monthly' | 'weekly' | 'one-time', date: new Date().toISOString().slice(0, 10) })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.amount || Number(form.amount) <= 0) { setError('Valor inválido'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/suppliers/${supplier.id}/costs`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      onSaved()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[#0f1117] border border-white/10 rounded-2xl w-full max-w-sm p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-white">Novo Registro de Custo</h2>
            <p className="text-xs text-white/40 mt-0.5">{supplier.name}</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-white/50 mb-1 block">Valor (R$) *</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                placeholder="0,00"
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/20"
              />
            </div>
            <div>
              <label className="text-xs text-white/50 mb-1 block">Frequência</label>
              <select
                value={form.frequency}
                onChange={e => setForm(f => ({ ...f, frequency: e.target.value as 'monthly' | 'weekly' | 'one-time' }))}
                className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/20"
              >
                <option value="monthly" className="bg-[#0f1117]">Mensal</option>
                <option value="weekly" className="bg-[#0f1117]">Semanal</option>
                <option value="one-time" className="bg-[#0f1117]">Único</option>
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Data</label>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full bg-white/[0.05] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/20"
            />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex gap-3 mt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl text-sm text-white/50 border border-white/10 hover:bg-white/[0.03] transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="flex-1 px-4 py-2.5 rounded-xl text-sm text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {saving ? 'Salvando...' : 'Registrar'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Supplier Card ────────────────────────────────────────────────────────────

function SupplierCard({
  supplier, onAddCost, onDelete, onReload,
}: {
  supplier: ScoredSupplier
  onAddCost: (s: Supplier) => void
  onDelete:  (id: string) => void
  onReload:  () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const cfg = RISK_CONFIG[supplier.riskLabel]

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('bg-white/[0.02] border rounded-2xl overflow-hidden transition-colors', cfg.border)}
    >
      {/* Main row */}
      <div className="p-4 flex items-center gap-4">
        {/* Risk dot */}
        <div className={cn('w-2.5 h-2.5 rounded-full shrink-0', cfg.dot)} />

        {/* Name + category */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{supplier.name}</p>
          <p className="text-xs text-white/35">{supplier.category}</p>
        </div>

        {/* Monthly cost */}
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold text-white">{fmt(supplier.monthlyCost)}<span className="text-white/30 font-normal text-xs">/mês</span></p>
          <div className="flex items-center justify-end gap-1 mt-0.5">
            <TrendBadge trend={supplier.trend} pct={supplier.trendPct} />
          </div>
        </div>

        {/* Share bar */}
        <div className="w-16 shrink-0 hidden sm:block">
          <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
            <div
              className={cn('h-full rounded-full transition-all', cfg.dot)}
              style={{ width: `${Math.round(supplier.shareOfTotal * 100)}%` }}
            />
          </div>
          <p className="text-xs text-white/30 mt-1 text-center">{Math.round(supplier.shareOfTotal * 100)}%</p>
        </div>

        {/* Risk badge */}
        <div className="shrink-0 hidden md:block">
          <RiskBadge risk={supplier.riskLabel} />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => onAddCost(supplier)}
            className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-colors"
            title="Registrar custo"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setExpanded(e => !e)}
            className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[0.06] p-4 flex flex-col gap-4">
              {/* Contact row */}
              <div className="flex flex-wrap gap-3">
                {supplier.contact_email && (
                  <a
                    href={`mailto:${supplier.contact_email}`}
                    className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white transition-colors"
                  >
                    <Mail className="w-3.5 h-3.5" />
                    {supplier.contact_email}
                  </a>
                )}
                {supplier.contact_whatsapp && (
                  <a
                    href={`https://wa.me/${supplier.contact_whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs text-white/50 hover:text-emerald-400 transition-colors"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    {supplier.contact_whatsapp}
                  </a>
                )}
                {!supplier.contact_email && !supplier.contact_whatsapp && (
                  <span className="text-xs text-white/25">Sem contato cadastrado</span>
                )}
              </div>

              {/* Cost history */}
              {supplier.costs.length > 0 ? (
                <div>
                  <p className="text-xs text-white/35 mb-2 uppercase tracking-wider">Histórico de Custos</p>
                  <div className="flex flex-col gap-1.5">
                    {[...supplier.costs]
                      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                      .slice(0, 6)
                      .map(c => (
                        <div key={c.id} className="flex items-center justify-between text-xs">
                          <span className="text-white/40">{new Date(c.date).toLocaleDateString('pt-BR')}</span>
                          <span className="text-white/60">{FREQ_LABELS[c.frequency]}</span>
                          <span className="text-white font-medium">{fmtFull(c.amount)}</span>
                        </div>
                      ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-white/25">Nenhum custo registrado ainda.</p>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-2 pt-1">
                {supplier.contact_whatsapp && (
                  <a
                    href={`https://wa.me/${supplier.contact_whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Olá! Gostaria de conversar sobre a revisão do nosso contrato com vocês.`)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                  >
                    <MessageSquare className="w-3 h-3" />
                    Renegociar via WA
                  </a>
                )}
                {supplier.contact_email && (
                  <a
                    href={`mailto:${supplier.contact_email}?subject=Revisão de contrato&body=Olá! Gostaria de conversar sobre a revisão do nosso contrato com vocês.`}
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
                  >
                    <Mail className="w-3 h-3" />
                    Email
                  </a>
                )}
                <button
                  onClick={() => onDelete(supplier.id)}
                  className="ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Remover
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Simulator ────────────────────────────────────────────────────────────────

function CostSimulator({ suppliers }: { suppliers: ScoredSupplier[] }) {
  const [cuts, setCuts] = useState<Record<string, number>>({})

  const totalSaved = suppliers.reduce((acc, s) => {
    const pct = cuts[s.id] ?? 0
    return acc + (s.monthlyCost * pct / 100)
  }, 0)

  return (
    <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-4 h-4 text-violet-400" />
        <h3 className="text-sm font-semibold text-white">Simulador de Cortes</h3>
      </div>
      <p className="text-xs text-white/40 mb-5">Arraste para simular reduções percentuais em cada fornecedor.</p>

      <div className="flex flex-col gap-4">
        {suppliers.slice(0, 5).map(s => (
          <div key={s.id}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-white/60 truncate max-w-[140px]">{s.name}</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs text-white/40">{fmt(s.monthlyCost)}</span>
                {(cuts[s.id] ?? 0) > 0 && (
                  <span className="text-xs text-emerald-400">-{fmt(s.monthlyCost * (cuts[s.id]!) / 100)}</span>
                )}
              </div>
            </div>
            <input
              type="range"
              min={0}
              max={50}
              step={5}
              value={cuts[s.id] ?? 0}
              onChange={e => setCuts(prev => ({ ...prev, [s.id]: Number(e.target.value) }))}
              className="w-full h-1.5 accent-violet-500 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-white/20 mt-0.5">
              <span>0%</span>
              <span>{cuts[s.id] ?? 0}% de corte</span>
              <span>50%</span>
            </div>
          </div>
        ))}
      </div>

      <div className={cn(
        'mt-5 rounded-xl p-4 border transition-all',
        totalSaved > 0 ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/[0.03] border-white/[0.06]'
      )}>
        <p className="text-xs text-white/40">Economia mensal simulada</p>
        <p className={cn('text-xl font-bold mt-0.5', totalSaved > 0 ? 'text-emerald-400' : 'text-white/20')}>
          {fmt(totalSaved)}
        </p>
        {totalSaved > 0 && (
          <p className="text-xs text-emerald-400/70 mt-1">{fmt(totalSaved * 12)}/ano</p>
        )}
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [analysis,  setAnalysis]  = useState<Analysis | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [showAdd,   setShowAdd]   = useState(false)
  const [addCostFor, setAddCostFor] = useState<Supplier | null>(null)
  const [filter,    setFilter]    = useState<'all' | 'high_cost_risk' | 'medium' | 'efficient'>('all')
  const [search,    setSearch]    = useState('')
  const [activeTab, setActiveTab] = useState<'list' | 'insights' | 'simulator'>('list')

  const loadSuppliers = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/suppliers')
      const data = await res.json()
      setSuppliers(data.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  const runAnalysis = useCallback(async () => {
    setAnalyzing(true)
    try {
      const res  = await fetch('/api/suppliers/analyze', { method: 'POST' })
      const data = await res.json()
      setAnalysis(data.data)
    } finally {
      setAnalyzing(false)
    }
  }, [])

  useEffect(() => {
    void loadSuppliers()
    // Load cached analysis (GET)
    void fetch('/api/suppliers/analyze')
      .then(r => r.json())
      .then(d => {
        if (Array.isArray(d.data) && d.data.length > 0) {
          // Only set if we have useful data (array of insights — reconstruct minimal view)
        }
      })
  }, [loadSuppliers])

  async function deleteSupplier(id: string) {
    if (!confirm('Remover este fornecedor?')) return
    await fetch(`/api/suppliers/${id}`, { method: 'DELETE' })
    await loadSuppliers()
    setAnalysis(null)
  }

  // Use scored list from analysis if available, else raw list
  const scored: ScoredSupplier[] = analysis?.scored ?? suppliers.map(s => ({
    ...s,
    monthlyCost:  0,
    trend:        'stable' as const,
    trendPct:     0,
    riskLabel:    'efficient' as const,
    score:        0,
    shareOfTotal: 0,
    costHistory:  [],
  }))

  const filtered = scored.filter(s => {
    const matchFilter = filter === 'all' || s.riskLabel === filter
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.category.toLowerCase().includes(search.toLowerCase())
    return matchFilter && matchSearch
  })

  const totalMonthlyCost   = analysis?.totalMonthlyCost   ?? 0
  const savingsOpportunity = analysis?.savingsOpportunity ?? 0

  const tabs = [
    { id: 'list',      label: 'Fornecedores', count: suppliers.length },
    { id: 'insights',  label: 'Insights IA',  count: analysis?.insights?.length ?? 0 },
    { id: 'simulator', label: 'Simulador',    count: null },
  ] as const

  return (
    <div className="min-h-screen bg-[#080a0f] p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto flex flex-col gap-6">

        {/* ─── Header ─── */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-semibold text-white flex items-center gap-2">
              <Package className="w-5 h-5 text-violet-400" />
              Controle de Custos
            </h1>
            <p className="text-sm text-white/40 mt-0.5">Inteligência de fornecedores e otimização de margens</p>
          </div>
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={runAnalysis}
              disabled={analyzing || suppliers.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm bg-white/[0.05] border border-white/10 text-white/70 hover:text-white hover:bg-white/[0.08] disabled:opacity-40 transition-colors"
            >
              {analyzing
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <Sparkles className="w-4 h-4 text-violet-400" />}
              {analyzing ? 'Analisando...' : 'Analisar com IA'}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm bg-violet-600 hover:bg-violet-500 text-white transition-colors"
            >
              <Plus className="w-4 h-4" />
              Fornecedor
            </motion.button>
          </div>
        </div>

        {/* ─── KPI Cards ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            label="Custo Mensal Total"
            value={fmt(totalMonthlyCost)}
            sub={suppliers.length > 0 ? `${suppliers.length} fornecedores` : 'Sem dados'}
            icon={DollarSign}
            color="text-white"
          />
          <KpiCard
            label="Potencial de Economia"
            value={fmt(savingsOpportunity)}
            sub={savingsOpportunity > 0 ? `${fmt(savingsOpportunity * 12)}/ano` : 'Rode análise IA'}
            icon={PiggyBank}
            color="text-emerald-400"
            trend="down"
          />
          <KpiCard
            label="Alto Risco"
            value={String(scored.filter(s => s.riskLabel === 'high_cost_risk').length)}
            sub="acima de 30% do custo total"
            icon={ShieldAlert}
            color="text-red-400"
            trend="up"
          />
          <KpiCard
            label="Insights Ativos"
            value={String(analysis?.insights?.length ?? 0)}
            sub={analysis ? 'última análise' : 'rode a análise IA'}
            icon={Zap}
            color="text-violet-400"
          />
        </div>

        {/* ─── Category Breakdown ─── */}
        {analysis && analysis.categoryBreakdown.length > 0 && (
          <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-white/40" />
              <h3 className="text-sm font-semibold text-white">Distribuição por Categoria</h3>
            </div>
            <div className="flex flex-col gap-3">
              {analysis.categoryBreakdown.map(cat => (
                <div key={cat.category} className="flex items-center gap-3">
                  <span className="text-xs text-white/50 w-28 truncate">{cat.category}</span>
                  <div className="flex-1 h-2 bg-white/[0.05] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.round(cat.share * 100)}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                      className="h-full rounded-full bg-violet-500"
                    />
                  </div>
                  <span className="text-xs text-white/40 w-10 text-right">{Math.round(cat.share * 100)}%</span>
                  <span className="text-xs text-white/60 w-20 text-right">{fmt(cat.total)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Tabs ─── */}
        <div className="flex items-center gap-1 bg-white/[0.03] border border-white/[0.06] rounded-xl p-1 self-start">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                'px-4 py-2 rounded-lg text-sm transition-colors flex items-center gap-2',
                activeTab === t.id
                  ? 'bg-white/[0.08] text-white'
                  : 'text-white/40 hover:text-white/70'
              )}
            >
              {t.label}
              {t.count !== null && t.count > 0 && (
                <span className={cn('text-xs px-1.5 py-0.5 rounded-full', activeTab === t.id ? 'bg-violet-500/30 text-violet-300' : 'bg-white/[0.08] text-white/40')}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ─── Tab: Supplier List ─── */}
        {activeTab === 'list' && (
          <div className="flex flex-col gap-4">
            {/* Filter + Search */}
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar fornecedor..."
                className="bg-white/[0.04] border border-white/[0.08] rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-white/20 w-48"
              />
              {(['all', 'high_cost_risk', 'medium', 'efficient'] as const).map(f => {
                const isAll = f === 'all'
                const riskCfg = isAll ? null : RISK_CONFIG[f]
                return (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      'px-3 py-1.5 rounded-lg text-xs transition-colors border',
                      filter === f
                        ? isAll
                          ? 'bg-white/[0.08] border-white/20 text-white'
                          : cn(riskCfg!.bg, riskCfg!.border, riskCfg!.color)
                        : 'border-white/[0.06] text-white/35 hover:text-white/60'
                    )}
                  >
                    {isAll ? 'Todos' : riskCfg!.label}
                  </button>
                )
              })}
            </div>

            {/* List */}
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-white/30" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                  <Package className="w-8 h-8 text-white/20" />
                </div>
                <div>
                  <p className="text-sm text-white/50">
                    {suppliers.length === 0 ? 'Nenhum fornecedor cadastrado ainda.' : 'Nenhum resultado.'}
                  </p>
                  {suppliers.length === 0 && (
                    <p className="text-xs text-white/25 mt-1">Adicione seu primeiro fornecedor para começar a análise de custos.</p>
                  )}
                </div>
                {suppliers.length === 0 && (
                  <button
                    onClick={() => setShowAdd(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm bg-violet-600/20 border border-violet-500/30 text-violet-400 hover:bg-violet-600/30 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Adicionar primeiro fornecedor
                  </button>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {!analysis && suppliers.length > 0 && (
                  <div className="flex items-center gap-3 bg-violet-500/5 border border-violet-500/20 rounded-xl px-4 py-3 text-xs text-violet-300">
                    <Sparkles className="w-3.5 h-3.5 shrink-0" />
                    Rode &quot;Analisar com IA&quot; para ver scores de risco, tendências e oportunidades de economia.
                  </div>
                )}
                <AnimatePresence>
                  {filtered.map(s => (
                    <SupplierCard
                      key={s.id}
                      supplier={s}
                      onAddCost={setAddCostFor}
                      onDelete={deleteSupplier}
                      onReload={loadSuppliers}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {/* ─── Tab: Insights ─── */}
        {activeTab === 'insights' && (
          <div className="flex flex-col gap-3">
            {!analysis ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                <div className="p-4 rounded-2xl bg-violet-500/10 border border-violet-500/20">
                  <Sparkles className="w-8 h-8 text-violet-400" />
                </div>
                <div>
                  <p className="text-sm text-white/60">Análise IA não executada ainda.</p>
                  <p className="text-xs text-white/30 mt-1">Clique em &quot;Analisar com IA&quot; para gerar insights personalizados.</p>
                </div>
                <button
                  onClick={runAnalysis}
                  disabled={analyzing || suppliers.length === 0}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-40 transition-colors"
                >
                  {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {analyzing ? 'Analisando...' : 'Analisar Agora'}
                </button>
              </div>
            ) : analysis.insights.length === 0 ? (
              <div className="text-center py-12">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-3" />
                <p className="text-sm text-white/50">Nenhum alerta. Seus custos estão bem distribuídos.</p>
              </div>
            ) : (
              <AnimatePresence>
                {analysis.insights.map((insight, i) => {
                  const Icon = INSIGHT_ICONS[insight.type] ?? Zap
                  const related = scored.find(s => s.id === insight.supplier_id)
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className={cn(
                        'flex gap-4 p-4 rounded-2xl border',
                        insight.type === 'high_cost' || insight.type === 'increase'
                          ? 'bg-red-500/5 border-red-500/20'
                          : insight.type === 'dependency'
                          ? 'bg-orange-500/5 border-orange-500/20'
                          : 'bg-yellow-500/5 border-yellow-500/20'
                      )}
                    >
                      <div className={cn(
                        'p-2 rounded-xl shrink-0 h-fit',
                        insight.type === 'high_cost' || insight.type === 'increase' ? 'bg-red-500/10' : 'bg-yellow-500/10'
                      )}>
                        <Icon className={cn('w-4 h-4', insight.type === 'high_cost' || insight.type === 'increase' ? 'text-red-400' : 'text-yellow-400')} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className="text-sm text-white">{insight.message}</p>
                          <span className="text-xs text-emerald-400 shrink-0 font-medium">{fmt(insight.impact_value)}/mês</span>
                        </div>
                        {related && (
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-xs text-white/30">{related.category}</span>
                            <RiskBadge risk={related.riskLabel} />
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            )}
          </div>
        )}

        {/* ─── Tab: Simulator ─── */}
        {activeTab === 'simulator' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CostSimulator suppliers={analysis?.scored ?? []} />
            {/* Profit connection panel */}
            <div className="bg-white/[0.02] border border-white/[0.07] rounded-2xl p-5 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-white">Conexão com Lucro</h3>
              </div>
              <p className="text-xs text-white/40">Impacto direto dos seus custos de fornecedores na margem da empresa.</p>

              {totalMonthlyCost > 0 ? (
                <div className="flex flex-col gap-4">
                  <div className="bg-white/[0.03] rounded-xl p-4 flex flex-col gap-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-white/40">Custo mensal fornecedores</span>
                      <span className="text-red-400 font-medium">{fmt(totalMonthlyCost)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-white/40">Potencial de redução</span>
                      <span className="text-emerald-400 font-medium">{fmt(savingsOpportunity)}</span>
                    </div>
                    <div className="border-t border-white/[0.06] pt-3 flex justify-between text-sm">
                      <span className="text-white/60 font-medium">Custo anual atual</span>
                      <span className="text-white font-semibold">{fmt(totalMonthlyCost * 12)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-white/60 font-medium">Se reduzir oportunidade</span>
                      <span className="text-emerald-400 font-semibold">{fmt((totalMonthlyCost - savingsOpportunity) * 12)}</span>
                    </div>
                  </div>

                  <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                    <p className="text-xs text-emerald-400/70 mb-1">Economia anual potencial</p>
                    <p className="text-2xl font-bold text-emerald-400">{fmt(savingsOpportunity * 12)}</p>
                    <p className="text-xs text-white/30 mt-1">Execute &quot;Analisar com IA&quot; para atualizar cálculos.</p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-xs text-white/25 text-center">Adicione fornecedores e rode a análise IA para ver o impacto no lucro.</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ─── Modals ─── */}
      <AnimatePresence>
        {showAdd && (
          <AddSupplierModal
            onClose={() => setShowAdd(false)}
            onSaved={() => { void loadSuppliers(); setAnalysis(null) }}
          />
        )}
        {addCostFor && (
          <AddCostModal
            supplier={addCostFor}
            onClose={() => setAddCostFor(null)}
            onSaved={() => { void loadSuppliers(); setAnalysis(null) }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
