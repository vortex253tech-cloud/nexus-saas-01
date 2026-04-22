'use client'

import { useEffect, useState } from 'react'
import { resolveCompanyId } from '@/lib/get-company-id'

interface Metrics {
  total_pending: number
  total_overdue: number
  total_paid: number
  total_invoiced: number
  default_rate: string
  customer_count: number
}
interface Debtor { name: string; total_overdue: number; invoice_count: number }
interface AIAnalysis { risk_level: string; risk_reason: string; summary: string; top_actions: string[]; alert?: string }

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

const RISK_COLORS: Record<string, string> = {
  baixo: 'bg-green-100 text-green-800',
  médio: 'bg-yellow-100 text-yellow-800',
  alto: 'bg-orange-100 text-orange-800',
  crítico: 'bg-red-100 text-red-800',
}

export default function FinanceiroPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [debtors, setDebtors] = useState<Debtor[]>([])
  const [ai, setAi] = useState<AIAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  const [companyId, setCompanyId] = useState<string | null>(null)

  useEffect(() => {
    void resolveCompanyId().then(cid => { if (cid) setCompanyId(cid) })
  }, [])

  useEffect(() => { if (companyId) load() }, [companyId])

  async function load() {
    setLoading(true)
    try {
      const res = await fetch('/api/ai/financial-insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company_id: companyId }),
      })
      const data = await res.json()
      setMetrics(data.metrics)
      setDebtors(data.top_debtors ?? [])
      setAi(data.ai_analysis)
    } finally {
      setLoading(false)
    }
  }

  async function runAutopilot() {
    setRunning(true)
    try {
      const res = await fetch('/api/cron/charge')
      const data = await res.json()
      alert(`✅ Auto-Pilot executado!\n${data.charges_sent} cobranças enviadas\n${data.marked_overdue} novas vencidas detectadas`)
      load()
    } finally {
      setRunning(false)
    }
  }

  if (loading) return <div className="p-8 text-gray-500">Carregando análise financeira...</div>

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard Financeiro</h1>
        <button onClick={runAutopilot} disabled={running}
          className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-blue-700 disabled:opacity-50 transition">
          {running ? '⚙️ Executando...' : '🚀 Iniciar Auto-Pilot'}
        </button>
      </div>

      {/* Alerta IA */}
      {ai?.alert && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800 text-sm">
          ⚠️ <strong>Alerta:</strong> {ai.alert}
        </div>
      )}

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard label="Total a Receber" value={fmt(metrics?.total_pending ?? 0)} color="blue" />
        <MetricCard label="Total Vencido" value={fmt(metrics?.total_overdue ?? 0)} color="red" />
        <MetricCard label="Total Recebido" value={fmt(metrics?.total_paid ?? 0)} color="green" />
        <MetricCard label="% Inadimplência" value={metrics?.default_rate ?? '0%'} color={parseFloat(metrics?.default_rate ?? '0') > 20 ? 'red' : 'yellow'} />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* IA Insights */}
        {ai && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Análise IA</h2>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${RISK_COLORS[ai.risk_level] ?? 'bg-gray-100 text-gray-700'}`}>
                Risco {ai.risk_level}
              </span>
            </div>
            <p className="text-sm text-gray-600">{ai.summary}</p>
            {ai.top_actions.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">AÇÕES RECOMENDADAS</p>
                <ul className="space-y-1">
                  {ai.top_actions.map((a, i) => (
                    <li key={i} className="text-sm text-gray-700 flex gap-2">
                      <span className="text-blue-500 font-bold">{i + 1}.</span> {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Top Devedores */}
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Maiores Devedores</h2>
          {debtors.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum devedor em atraso.</p>
          ) : (
            <div className="space-y-3">
              {debtors.map((d, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{d.name}</p>
                    <p className="text-xs text-gray-500">{d.invoice_count} fatura(s)</p>
                  </div>
                  <span className="text-sm font-bold text-red-600">{fmt(d.total_overdue)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Links rápidos */}
      <div className="flex gap-3 flex-wrap">
        <a href="/dashboard/assistant" className="text-sm text-blue-600 border border-blue-200 rounded-lg px-4 py-2 hover:bg-blue-50">
          💬 Perguntar à IA
        </a>
        <button onClick={load} className="text-sm text-gray-600 border border-gray-200 rounded-lg px-4 py-2 hover:bg-gray-50">
          🔄 Atualizar
        </button>
      </div>
    </div>
  )
}

function MetricCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'border-blue-200 bg-blue-50',
    red: 'border-red-200 bg-red-50',
    green: 'border-green-200 bg-green-50',
    yellow: 'border-yellow-200 bg-yellow-50',
  }
  const text: Record<string, string> = {
    blue: 'text-blue-700', red: 'text-red-700', green: 'text-green-700', yellow: 'text-yellow-700',
  }
  return (
    <div className={`border rounded-xl p-4 ${colors[color] ?? 'bg-white border-gray-200'}`}>
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${text[color] ?? 'text-gray-900'}`}>{value}</p>
    </div>
  )
}
