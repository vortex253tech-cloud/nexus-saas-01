'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import {
  Activity, ArrowLeft, Plus, Trash2, TrendingUp,
  TrendingDown, DollarSign, CheckCircle2, Loader2, BarChart3,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import type { DBFinancialData } from '@/lib/db'
import { AIStatus } from '@/components/ui/ai-status'

// ─── Month options ─────────────────────────────────────────────

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function currentYearOptions(): number[] {
  const y = new Date().getFullYear()
  return [y - 2, y - 1, y]
}

// ─── Bar chart inline ─────────────────────────────────────────

function MiniChart({ data }: { data: DBFinancialData[] }) {
  if (data.length < 2) return null
  const sorted = [...data].sort((a, b) => a.period_date.localeCompare(b.period_date))
  const maxVal = Math.max(...sorted.map(d => d.revenue))
  return (
    <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
      <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">
        Evolução — receita vs lucro
      </p>
      <div className="flex items-end gap-2">
        {sorted.map(d => {
          const revPct = maxVal > 0 ? (d.revenue / maxVal) * 100 : 0
          const profPct = maxVal > 0 ? (d.profit / maxVal) * 100 : 0
          return (
            <div key={d.id} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex w-full items-end gap-0.5" style={{ height: 80 }}>
                <motion.div
                  className="flex-1 rounded-t bg-violet-600/60"
                  initial={{ height: 0 }}
                  animate={{ height: `${revPct}%` }}
                  transition={{ duration: 0.5 }}
                />
                <motion.div
                  className={cn('flex-1 rounded-t', d.profit >= 0 ? 'bg-emerald-500/70' : 'bg-red-500/70')}
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.abs(profPct)}%` }}
                  transition={{ duration: 0.5, delay: 0.1 }}
                />
              </div>
              <span className="text-[10px] text-zinc-600 truncate w-full text-center">
                {d.period_label.split(' ')[0].slice(0, 3)}
              </span>
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex items-center gap-4">
        <span className="flex items-center gap-1 text-xs text-zinc-500">
          <div className="h-2.5 w-2.5 rounded-sm bg-violet-600/60" /> Receita
        </span>
        <span className="flex items-center gap-1 text-xs text-zinc-500">
          <div className="h-2.5 w-2.5 rounded-sm bg-emerald-500/70" /> Lucro
        </span>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────

export default function DadosPage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [records, setRecords] = useState<DBFinancialData[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [revenue, setRevenue] = useState('')
  const [costs, setCosts] = useState('')
  const [note, setNote] = useState('')
  const [month, setMonth] = useState(MONTHS[new Date().getMonth()])
  const [year, setYear] = useState(new Date().getFullYear())

  const profit = (() => {
    const r = parseFloat(revenue.replace(/\./g, '').replace(',', '.')) || 0
    const c = parseFloat(costs.replace(/\./g, '').replace(',', '.')) || 0
    return r - c
  })()

  // Load company_id from sessionStorage
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem('nexus_resultado')
      if (!raw) { setLoading(false); return }
      const d = JSON.parse(raw)
      const cid = d.company_id ?? d.companyId ?? null
      setCompanyId(cid)
      if (cid) fetchRecords(cid)
      else setLoading(false)
    } catch { setLoading(false) }
  }, [])

  async function fetchRecords(cid: string) {
    setLoading(true)
    try {
      const res = await fetch(`/api/financial-data?company_id=${cid}`)
      const json = await res.json()
      setRecords(json.data ?? [])
    } finally {
      setLoading(false)
    }
  }

  function parseBR(val: string): number {
    return parseFloat(val.replace(/\./g, '').replace(',', '.')) || 0
  }

  async function handleSave() {
    if (!companyId) {
      setError('Empresa não identificada. Volte ao diagnóstico.')
      return
    }
    const r = parseBR(revenue)
    const c = parseBR(costs)
    if (!r || !c) {
      setError('Preencha receita e custos.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      const periodDate = `${year}-${String(MONTHS.indexOf(month) + 1).padStart(2, '0')}-01`
      const res = await fetch('/api/financial-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_id: companyId,
          revenue: r,
          costs: c,
          profit: r - c,
          period_label: `${month} ${year}`,
          period_date: periodDate,
          note: note || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setRecords(prev => [json.data, ...prev])
      setRevenue('')
      setCosts('')
      setNote('')
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      await fetch(`/api/financial-data?id=${id}`, { method: 'DELETE' })
      setRecords(prev => prev.filter(r => r.id !== id))
    } finally {
      setDeleting(null)
    }
  }

  const fmtBRL = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute -left-64 top-0 h-96 w-96 rounded-full bg-violet-700/6 blur-[100px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-2xl px-4 py-8 md:px-6">
        {/* Nav */}
        <div className="mb-8 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white">
            <ArrowLeft className="h-4 w-4" /> Voltar ao dashboard
          </Link>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600">
            <Activity className="h-3.5 w-3.5 text-white" />
          </div>
        </div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-white">Dados Financeiros</h1>
            <AIStatus state={saving ? 'processing' : loading ? 'analyzing' : 'idle'} label={saving ? 'Salvando' : loading ? 'Carregando' : undefined} />
          </div>
          <p className="text-sm text-zinc-400">
            Insira seus dados mensais para que a IA gere diagnósticos baseados em dados reais.
          </p>
        </motion.div>

        {/* Form */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6"
        >
          <p className="mb-4 text-sm font-semibold text-white">Novo registro</p>

          {/* Period */}
          <div className="mb-4 flex gap-3">
            <div className="flex-1">
              <label className="mb-1.5 block text-xs text-zinc-500">Mês</label>
              <select
                value={month}
                onChange={e => setMonth(e.target.value)}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"
              >
                {MONTHS.map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="w-28">
              <label className="mb-1.5 block text-xs text-zinc-500">Ano</label>
              <select
                value={year}
                onChange={e => setYear(Number(e.target.value))}
                className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white outline-none focus:border-violet-500"
              >
                {currentYearOptions().map(y => <option key={y}>{y}</option>)}
              </select>
            </div>
          </div>

          {/* Financial inputs */}
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-xs text-zinc-500">Receita (R$)</label>
              <div className="relative">
                <TrendingUp className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  inputMode="numeric"
                  value={revenue}
                  onChange={e => setRevenue(e.target.value)}
                  placeholder="50.000"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 py-2.5 pl-9 pr-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-zinc-500">Custos totais (R$)</label>
              <div className="relative">
                <TrendingDown className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  inputMode="numeric"
                  value={costs}
                  onChange={e => setCosts(e.target.value)}
                  placeholder="30.000"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-800 py-2.5 pl-9 pr-3 text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500"
                />
              </div>
            </div>
          </div>

          {/* Auto-calculated profit */}
          <div className={cn(
            'mb-4 flex items-center justify-between rounded-xl border px-4 py-3',
            profit > 0 ? 'border-emerald-800/50 bg-emerald-950/30' : profit < 0 ? 'border-red-800/50 bg-red-950/30' : 'border-zinc-800 bg-zinc-800/40',
          )}>
            <div className="flex items-center gap-2">
              <DollarSign className={cn('h-4 w-4', profit > 0 ? 'text-emerald-400' : profit < 0 ? 'text-red-400' : 'text-zinc-500')} />
              <span className="text-sm text-zinc-400">Lucro calculado</span>
            </div>
            <span className={cn('text-sm font-bold', profit > 0 ? 'text-emerald-300' : profit < 0 ? 'text-red-300' : 'text-zinc-500')}>
              {fmtBRL(profit)}
            </span>
          </div>

          {/* Note */}
          <div className="mb-5">
            <label className="mb-1.5 block text-xs text-zinc-500">Observação (opcional)</label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="Ex: mês atípico por sazonalidade"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-violet-500"
            />
          </div>

          {error && (
            <p className="mb-4 rounded-lg border border-red-800/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">{error}</p>
          )}

          {!companyId && (
            <p className="mb-4 rounded-lg border border-amber-800/50 bg-amber-950/30 px-3 py-2 text-xs text-amber-300">
              Complete o diagnóstico primeiro para vincular os dados à sua empresa.{' '}
              <Link href="/onboarding" className="underline">Fazer diagnóstico</Link>
            </p>
          )}

          <button
            onClick={handleSave}
            disabled={saving || !companyId}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all',
              saved
                ? 'bg-emerald-600 text-white'
                : 'bg-violet-600 text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            {saving ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Salvando...</>
            ) : saved ? (
              <><CheckCircle2 className="h-4 w-4" /> Dados salvos!</>
            ) : (
              <><Plus className="h-4 w-4" /> Salvar período</>
            )}
          </button>
        </motion.div>

        {/* Chart */}
        {records.length >= 2 && <MiniChart data={records} />}

        {/* History */}
        <div className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-white">Histórico</p>
            <div className="flex items-center gap-1 text-xs text-zinc-500">
              <BarChart3 className="h-3.5 w-3.5" />
              {records.length} {records.length === 1 ? 'registro' : 'registros'}
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-zinc-600" />
            </div>
          ) : records.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 py-12 text-center">
              <BarChart3 className="mx-auto mb-3 h-8 w-8 text-zinc-700" />
              <p className="text-sm text-zinc-500">Nenhum dado inserido ainda.</p>
              <p className="mt-1 text-xs text-zinc-600">Adicione seu primeiro período acima.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {records.map((rec, i) => {
                  const margin = rec.revenue > 0 ? ((rec.profit / rec.revenue) * 100).toFixed(1) : '0'
                  return (
                    <motion.div
                      key={rec.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{rec.period_label}</p>
                          {rec.note && <p className="mt-0.5 text-xs text-zinc-500">{rec.note}</p>}
                        </div>
                        <button
                          onClick={() => handleDelete(rec.id)}
                          disabled={deleting === rec.id}
                          className="rounded-lg p-1.5 text-zinc-600 transition hover:text-red-400"
                        >
                          {deleting === rec.id
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-3">
                        {[
                          { label: 'Receita', value: fmtBRL(rec.revenue), color: 'text-white' },
                          { label: 'Custos', value: fmtBRL(rec.costs), color: 'text-zinc-300' },
                          { label: `Lucro (${margin}%)`, value: fmtBRL(rec.profit), color: rec.profit >= 0 ? 'text-emerald-400' : 'text-red-400' },
                        ].map(item => (
                          <div key={item.label}>
                            <p className="text-xs text-zinc-600">{item.label}</p>
                            <p className={cn('mt-0.5 text-sm font-semibold', item.color)}>{item.value}</p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* CTA to re-generate insights */}
        {records.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-6 rounded-2xl border border-violet-800/40 bg-violet-950/20 p-5 text-center"
          >
            <p className="mb-1 font-semibold text-white">Dados atualizados?</p>
            <p className="mb-4 text-sm text-zinc-400">
              Volte ao dashboard e clique em "Gerar análise" para que a IA analise seus novos dados.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500"
            >
              Ir para o dashboard →
            </Link>
          </motion.div>
        )}
      </div>
    </div>
  )
}
