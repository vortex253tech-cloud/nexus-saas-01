'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter, useParams } from 'next/navigation'
import {
  ArrowLeft, Plus, Trash2, Loader2, TrendingUp, TrendingDown,
  DollarSign, ShoppingBag, BarChart3, Sparkles, X, RefreshCw,
  AlertTriangle, Lightbulb, Target, Package,
} from 'lucide-react'
import { cn } from '@/lib/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Project {
  id: string; name: string; type: string; description: string; goal: string; created_at: string
}

interface Product {
  id: string; name: string; price: number; cost: number; margin: number; status: string; created_at: string
}

interface Revenue {
  id: string; name: string; value: number; source: string; date: string
}

interface Expense {
  id: string; name: string; value: number; category: string; date: string
}

interface Analysis {
  insights: string[]; alerts: string[]; opportunities: string[]
}

const STATUS_LABELS: Record<string, string> = {
  active:       '🟢 Ativo',
  paused:       '🔴 Pausado',
  discontinued: '⛔ Descontinuado',
}

const SOURCE_LABELS: Record<string, string> = {
  sale:         'Venda',
  subscription: 'Assinatura',
  service:      'Serviço',
  affiliate:    'Afiliado',
  other:        'Outro',
}

const CAT_LABELS: Record<string, string> = {
  marketing:    'Marketing',
  operational:  'Operacional',
  personnel:    'Pessoal',
  technology:   'Tecnologia',
  other:        'Outro',
}

type Tab = 'produtos' | 'financeiro' | 'insights'

// ─── Add Product Modal ────────────────────────────────────────────────────────

function AddProductModal({ projectId, onClose, onAdded }: {
  projectId: string; onClose: () => void; onAdded: (p: Product) => void
}) {
  const [form, setForm] = useState({ name: '', price: '', cost: '', status: 'active' })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Nome é obrigatório'); return }
    setSaving(true); setError('')
    try {
      const res  = await fetch(`/api/projects/${projectId}/products`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, price: parseFloat(form.price) || 0, cost: parseFloat(form.cost) || 0, status: form.status }),
      })
      const data = await res.json() as { product?: Product; error?: string }
      if (!res.ok) { setError(data.error ?? 'Erro'); return }
      onAdded(data.product!)
    } finally { setSaving(false) }
  }

  return (
    <Modal title="Novo produto" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Nome *">
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Curso Online" className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Preço (R$)">
            <input type="number" min="0" step="0.01" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} placeholder="0.00" className={inputCls} />
          </Field>
          <Field label="Custo (R$)">
            <input type="number" min="0" step="0.01" value={form.cost} onChange={e => setForm(f => ({ ...f, cost: e.target.value }))} placeholder="0.00" className={inputCls} />
          </Field>
        </div>
        <Field label="Status">
          <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inputCls}>
            <option value="active">🟢 Ativo</option>
            <option value="paused">🔴 Pausado</option>
            <option value="discontinued">⛔ Descontinuado</option>
          </select>
        </Field>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <ModalFooter onClose={onClose} saving={saving} label="Adicionar" />
      </form>
    </Modal>
  )
}

// ─── Add Revenue Modal ────────────────────────────────────────────────────────

function AddRevenueModal({ projectId, onClose, onAdded }: {
  projectId: string; onClose: () => void; onAdded: (r: Revenue) => void
}) {
  const [form, setForm] = useState({ name: '', value: '', source: 'sale', date: new Date().toISOString().slice(0, 10) })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Nome é obrigatório'); return }
    setSaving(true); setError('')
    try {
      const res  = await fetch(`/api/projects/${projectId}/revenues`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, value: parseFloat(form.value) || 0, source: form.source, date: form.date }),
      })
      const data = await res.json() as { revenue?: Revenue; error?: string }
      if (!res.ok) { setError(data.error ?? 'Erro'); return }
      onAdded(data.revenue!)
    } finally { setSaving(false) }
  }

  return (
    <Modal title="Nova receita" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Descrição *">
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Venda produto X" className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor (R$)">
            <input type="number" min="0" step="0.01" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder="0.00" className={inputCls} />
          </Field>
          <Field label="Data">
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inputCls} />
          </Field>
        </div>
        <Field label="Fonte">
          <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} className={inputCls}>
            <option value="sale">Venda</option>
            <option value="subscription">Assinatura</option>
            <option value="service">Serviço</option>
            <option value="affiliate">Afiliado</option>
            <option value="other">Outro</option>
          </select>
        </Field>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <ModalFooter onClose={onClose} saving={saving} label="Adicionar" />
      </form>
    </Modal>
  )
}

// ─── Add Expense Modal ────────────────────────────────────────────────────────

function AddExpenseModal({ projectId, onClose, onAdded }: {
  projectId: string; onClose: () => void; onAdded: (e: Expense) => void
}) {
  const [form, setForm] = useState({ name: '', value: '', category: 'operational', date: new Date().toISOString().slice(0, 10) })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Nome é obrigatório'); return }
    setSaving(true); setError('')
    try {
      const res  = await fetch(`/api/projects/${projectId}/expenses`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, value: parseFloat(form.value) || 0, category: form.category, date: form.date }),
      })
      const data = await res.json() as { expense?: Expense; error?: string }
      if (!res.ok) { setError(data.error ?? 'Erro'); return }
      onAdded(data.expense!)
    } finally { setSaving(false) }
  }

  return (
    <Modal title="Nova despesa" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Descrição *">
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Anúncio Meta" className={inputCls} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Valor (R$)">
            <input type="number" min="0" step="0.01" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} placeholder="0.00" className={inputCls} />
          </Field>
          <Field label="Data">
            <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} className={inputCls} />
          </Field>
        </div>
        <Field label="Categoria">
          <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inputCls}>
            <option value="marketing">Marketing</option>
            <option value="operational">Operacional</option>
            <option value="personnel">Pessoal</option>
            <option value="technology">Tecnologia</option>
            <option value="other">Outro</option>
          </select>
        </Field>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <ModalFooter onClose={onClose} saving={saving} label="Adicionar" />
      </form>
    </Modal>
  )
}

// ─── Shared UI helpers ────────────────────────────────────────────────────────

const inputCls = 'w-full rounded-lg bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-violet-500'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-400 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-white">{title}</h2>
          <button onClick={onClose} className="p-1.5 text-zinc-500 hover:text-white rounded-lg hover:bg-zinc-800"><X size={15} /></button>
        </div>
        {children}
      </motion.div>
    </div>
  )
}

function ModalFooter({ onClose, saving, label }: { onClose: () => void; saving: boolean; label: string }) {
  return (
    <div className="flex gap-3 pt-1">
      <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium text-zinc-400 bg-zinc-800 hover:bg-zinc-700">Cancelar</button>
      <button type="submit" disabled={saving} className="flex-1 py-2 rounded-lg text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-50 flex items-center justify-center gap-2">
        {saving ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
        {label}
      </button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProjectDetailPage() {
  const router   = useRouter()
  const params   = useParams()
  const id       = params.id as string

  const [project,  setProject]  = useState<Project | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [revenues, setRevenues] = useState<Revenue[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [analysis, setAnalysis] = useState<Analysis | null>(null)

  const [loading,         setLoading]         = useState(true)
  const [analyzing,       setAnalyzing]       = useState(false)
  const [activeTab,       setActiveTab]       = useState<Tab>('produtos')
  const [modal,           setModal]           = useState<'product' | 'revenue' | 'expense' | null>(null)
  const [deletingProduct, setDeletingProduct] = useState<string | null>(null)
  const [deletingRevenue, setDeletingRevenue] = useState<string | null>(null)
  const [deletingExpense, setDeletingExpense] = useState<string | null>(null)

  // ── Load all data ──────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [projRes, prodRes, revRes, expRes] = await Promise.all([
        fetch(`/api/projects/${id}`),
        fetch(`/api/projects/${id}/products`),
        fetch(`/api/projects/${id}/revenues`),
        fetch(`/api/projects/${id}/expenses`),
      ])
      const [proj, prod, rev, exp] = await Promise.all([
        projRes.json() as Promise<{ project?: Project }>,
        prodRes.json() as Promise<{ products?: Product[] }>,
        revRes.json()  as Promise<{ revenues?: Revenue[] }>,
        expRes.json()  as Promise<{ expenses?: Expense[] }>,
      ])
      if (!projRes.ok) { router.push('/dashboard/projects'); return }
      setProject(proj.project ?? null)
      setProducts(prod.products ?? [])
      setRevenues(rev.revenues ?? [])
      setExpenses(exp.expenses ?? [])
    } finally {
      setLoading(false)
    }
  }, [id, router])

  useEffect(() => { void load() }, [load])

  // ── Metrics ───────────────────────────────────────────────────

  const totalRevenue  = revenues.reduce((s, r) => s + r.value, 0)
  const totalExpenses = expenses.reduce((s, e) => s + e.value, 0)
  const profit        = totalRevenue - totalExpenses
  const bestProduct   = [...products].sort((a, b) => (b.price - b.cost) - (a.price - a.cost))[0] ?? null

  const fmtBRL = (v: number) => `R$ ${Math.abs(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  // ── AI analysis ───────────────────────────────────────────────

  async function runAnalysis() {
    setAnalyzing(true)
    try {
      const res  = await fetch('/api/ai/project-analysis', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: id }),
      })
      const data = await res.json() as Analysis & { error?: string }
      if (res.ok) setAnalysis(data)
    } finally {
      setAnalyzing(false)
    }
  }

  // ── Delete helpers ────────────────────────────────────────────

  async function deleteProduct(pid: string) {
    if (!confirm('Remover produto?')) return
    setDeletingProduct(pid)
    await fetch(`/api/projects/${id}/products/${pid}`, { method: 'DELETE' })
    setProducts(p => p.filter(x => x.id !== pid))
    setDeletingProduct(null)
  }

  async function deleteRevenue(rid: string) {
    if (!confirm('Remover receita?')) return
    setDeletingRevenue(rid)
    await fetch(`/api/projects/${id}/revenues/${rid}`, { method: 'DELETE' })
    setRevenues(r => r.filter(x => x.id !== rid))
    setDeletingRevenue(null)
  }

  async function deleteExpense(eid: string) {
    if (!confirm('Remover despesa?')) return
    setDeletingExpense(eid)
    await fetch(`/api/projects/${id}/expenses/${eid}`, { method: 'DELETE' })
    setExpenses(e => e.filter(x => x.id !== eid))
    setDeletingExpense(null)
  }

  // ── Render ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-40">
        <Loader2 size={32} className="animate-spin text-violet-400" />
      </div>
    )
  }

  if (!project) return null

  return (
    <div className="p-6 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <button onClick={() => router.push('/dashboard/projects')} className="mt-1 p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-white truncate">{project.name}</h1>
          {project.goal && <p className="text-zinc-400 text-sm mt-1">🎯 {project.goal}</p>}
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <MetricCard icon={<TrendingUp size={18} className="text-emerald-400" />} label="Receita total" value={fmtBRL(totalRevenue)} color="emerald" />
        <MetricCard icon={<TrendingDown size={18} className="text-red-400" />} label="Custos totais" value={fmtBRL(totalExpenses)} color="red" />
        <MetricCard
          icon={profit >= 0 ? <DollarSign size={18} className="text-emerald-400" /> : <DollarSign size={18} className="text-red-400" />}
          label="Lucro"
          value={(profit < 0 ? '- ' : '') + fmtBRL(profit)}
          color={profit >= 0 ? 'emerald' : 'red'}
        />
        <MetricCard icon={<Package size={18} className="text-violet-400" />} label="Melhor produto" value={bestProduct?.name ?? '—'} color="violet" small />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-zinc-800/40 p-1 rounded-xl w-fit">
        {(['produtos', 'financeiro', 'insights'] as Tab[]).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={cn('px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize',
              activeTab === tab ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-white'
            )}>
            {tab === 'insights' ? '✨ Insights IA' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {activeTab === 'produtos' && (
          <motion.div key="produtos" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <ShoppingBag size={18} className="text-violet-400" /> Produtos
              </h2>
              <button onClick={() => setModal('product')}
                className="flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors">
                <Plus size={13} /> Adicionar
              </button>
            </div>

            {products.length === 0 ? (
              <EmptyState icon={<ShoppingBag size={24} className="text-zinc-600" />} text="Nenhum produto cadastrado" cta="Adicionar produto" onCta={() => setModal('product')} />
            ) : (
              <div className="rounded-2xl border border-zinc-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 bg-zinc-900">
                      <Th>Produto</Th><Th>Preço</Th><Th>Custo</Th><Th>Margem</Th><Th>Status</Th><Th />
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(p => (
                      <tr key={p.id} className="border-b border-zinc-800/60 hover:bg-zinc-800/30 transition-colors">
                        <Td><span className="font-medium text-white">{p.name}</span></Td>
                        <Td>{fmtBRL(p.price)}</Td>
                        <Td><span className="text-red-400">{fmtBRL(p.cost)}</span></Td>
                        <Td>
                          <span className={cn('font-semibold', p.margin >= 30 ? 'text-emerald-400' : p.margin >= 10 ? 'text-yellow-400' : 'text-red-400')}>
                            {p.margin.toFixed(1)}%
                          </span>
                        </Td>
                        <Td><span className="text-xs">{STATUS_LABELS[p.status] ?? p.status}</span></Td>
                        <Td>
                          <button onClick={() => void deleteProduct(p.id)} disabled={deletingProduct === p.id}
                            className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-50">
                            {deletingProduct === p.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          </button>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'financeiro' && (
          <motion.div key="financeiro" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-8">
            {/* Revenues */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <TrendingUp size={18} className="text-emerald-400" /> Receitas
                </h2>
                <button onClick={() => setModal('revenue')}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors">
                  <Plus size={13} /> Adicionar
                </button>
              </div>
              {revenues.length === 0 ? (
                <EmptyState icon={<TrendingUp size={24} className="text-zinc-600" />} text="Nenhuma receita registrada" cta="Adicionar receita" onCta={() => setModal('revenue')} />
              ) : (
                <div className="rounded-2xl border border-zinc-800 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-zinc-800 bg-zinc-900"><Th>Descrição</Th><Th>Fonte</Th><Th>Data</Th><Th>Valor</Th><Th /></tr></thead>
                    <tbody>
                      {revenues.map(r => (
                        <tr key={r.id} className="border-b border-zinc-800/60 hover:bg-zinc-800/30 transition-colors">
                          <Td><span className="font-medium text-white">{r.name}</span></Td>
                          <Td><span className="text-xs bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full">{SOURCE_LABELS[r.source] ?? r.source}</span></Td>
                          <Td><span className="text-zinc-500">{new Date(r.date).toLocaleDateString('pt-BR')}</span></Td>
                          <Td><span className="font-semibold text-emerald-400">{fmtBRL(r.value)}</span></Td>
                          <Td>
                            <button onClick={() => void deleteRevenue(r.id)} disabled={deletingRevenue === r.id}
                              className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-50">
                              {deletingRevenue === r.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                            </button>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Expenses */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <TrendingDown size={18} className="text-red-400" /> Despesas
                </h2>
                <button onClick={() => setModal('expense')}
                  className="flex items-center gap-1.5 rounded-lg bg-red-700 hover:bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors">
                  <Plus size={13} /> Adicionar
                </button>
              </div>
              {expenses.length === 0 ? (
                <EmptyState icon={<TrendingDown size={24} className="text-zinc-600" />} text="Nenhuma despesa registrada" cta="Adicionar despesa" onCta={() => setModal('expense')} />
              ) : (
                <div className="rounded-2xl border border-zinc-800 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-zinc-800 bg-zinc-900"><Th>Descrição</Th><Th>Categoria</Th><Th>Data</Th><Th>Valor</Th><Th /></tr></thead>
                    <tbody>
                      {expenses.map(e => (
                        <tr key={e.id} className="border-b border-zinc-800/60 hover:bg-zinc-800/30 transition-colors">
                          <Td><span className="font-medium text-white">{e.name}</span></Td>
                          <Td><span className="text-xs bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full">{CAT_LABELS[e.category] ?? e.category}</span></Td>
                          <Td><span className="text-zinc-500">{new Date(e.date).toLocaleDateString('pt-BR')}</span></Td>
                          <Td><span className="font-semibold text-red-400">{fmtBRL(e.value)}</span></Td>
                          <Td>
                            <button onClick={() => void deleteExpense(e.id)} disabled={deletingExpense === e.id}
                              className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all disabled:opacity-50">
                              {deletingExpense === e.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                            </button>
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === 'insights' && (
          <motion.div key="insights" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Sparkles size={18} className="text-violet-400" /> Análise com IA
              </h2>
              <button onClick={() => { setActiveTab('insights'); void runAnalysis() }} disabled={analyzing}
                className="flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 px-4 py-2 text-sm font-semibold text-white transition-colors">
                {analyzing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {analyzing ? 'Analisando…' : analysis ? 'Reanalisar' : 'Analisar com IA'}
              </button>
            </div>

            {!analysis && !analyzing && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-600/15 border border-violet-600/30 mb-4">
                  <BarChart3 size={28} className="text-violet-400" />
                </div>
                <h3 className="text-lg font-semibold text-white mb-2">Seu consultor de IA</h3>
                <p className="text-zinc-500 text-sm max-w-sm mb-6">
                  Clique em "Analisar com IA" para receber insights estratégicos, alertas financeiros e oportunidades de crescimento personalizados para este projeto.
                </p>
                <button onClick={() => void runAnalysis()} className="flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-500 px-5 py-2.5 text-sm font-semibold text-white">
                  <Sparkles size={16} /> Organizar meu negócio com IA
                </button>
              </div>
            )}

            {analyzing && (
              <div className="flex flex-col items-center justify-center py-20 gap-4">
                <Loader2 size={36} className="animate-spin text-violet-400" />
                <p className="text-zinc-400 text-sm">Analisando dados do projeto…</p>
              </div>
            )}

            {analysis && !analyzing && (
              <div className="space-y-6">
                {/* Insights */}
                {analysis.insights.length > 0 && (
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5">
                    <h3 className="flex items-center gap-2 font-semibold text-white mb-4">
                      <Lightbulb size={16} className="text-yellow-400" /> Insights
                    </h3>
                    <ul className="space-y-2.5">
                      {analysis.insights.map((ins, i) => (
                        <li key={i} className="flex gap-3 text-sm text-zinc-300">
                          <span className="text-yellow-400 mt-0.5 shrink-0">•</span>
                          {ins}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Alerts */}
                {analysis.alerts.length > 0 && (
                  <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-5">
                    <h3 className="flex items-center gap-2 font-semibold text-white mb-4">
                      <AlertTriangle size={16} className="text-red-400" /> Alertas de risco
                    </h3>
                    <ul className="space-y-2.5">
                      {analysis.alerts.map((a, i) => (
                        <li key={i} className="flex gap-3 text-sm text-zinc-300">
                          <span className="text-red-400 mt-0.5 shrink-0">⚠</span>
                          {a}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Opportunities */}
                {analysis.opportunities.length > 0 && (
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5">
                    <h3 className="flex items-center gap-2 font-semibold text-white mb-4">
                      <Target size={16} className="text-emerald-400" /> Oportunidades
                    </h3>
                    <ul className="space-y-2.5">
                      {analysis.opportunities.map((o, i) => (
                        <li key={i} className="flex gap-3 text-sm text-zinc-300">
                          <span className="text-emerald-400 mt-0.5 shrink-0">→</span>
                          {o}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modals */}
      <AnimatePresence>
        {modal === 'product' && (
          <AddProductModal projectId={id} onClose={() => setModal(null)}
            onAdded={p => { setProducts(prev => [p, ...prev]); setModal(null) }} />
        )}
        {modal === 'revenue' && (
          <AddRevenueModal projectId={id} onClose={() => setModal(null)}
            onAdded={r => { setRevenues(prev => [r, ...prev]); setModal(null) }} />
        )}
        {modal === 'expense' && (
          <AddExpenseModal projectId={id} onClose={() => setModal(null)}
            onAdded={e => { setExpenses(prev => [e, ...prev]); setModal(null) }} />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MetricCard({ icon, label, value, color, small }: {
  icon: React.ReactNode; label: string; value: string; color: string; small?: boolean
}) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-500/10 border-emerald-500/20',
    red:     'bg-red-500/10 border-red-500/20',
    violet:  'bg-violet-500/10 border-violet-500/20',
  }
  return (
    <div className={cn('rounded-2xl border p-4', colors[color] ?? 'bg-zinc-800 border-zinc-700')}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs text-zinc-500">{label}</span>
      </div>
      <p className={cn('font-bold text-white truncate', small ? 'text-sm' : 'text-xl')}>{value}</p>
    </div>
  )
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 uppercase tracking-wide">{children}</th>
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3 text-zinc-300">{children}</td>
}

function EmptyState({ icon, text, cta, onCta }: { icon: React.ReactNode; text: string; cta: string; onCta: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center rounded-2xl border border-dashed border-zinc-800">
      <div className="mb-3">{icon}</div>
      <p className="text-zinc-500 text-sm mb-3">{text}</p>
      <button onClick={onCta} className="flex items-center gap-1.5 text-xs text-violet-400 hover:text-violet-300 font-medium transition-colors">
        <Plus size={13} /> {cta}
      </button>
    </div>
  )
}
