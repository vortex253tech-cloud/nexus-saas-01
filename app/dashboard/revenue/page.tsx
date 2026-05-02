'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion }      from 'framer-motion'
import {
  DollarSign, TrendingUp, AlertTriangle, Clock,
  Users, RefreshCw, ExternalLink, CheckCircle2,
  ArrowUpRight, ArrowDownRight, UserPlus,
  BarChart3, Target, ShieldAlert,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/cn'
import { resolveCompanyId } from '@/lib/get-company-id'

// ─── Types ────────────────────────────────────────────────────────────────────

interface InvoiceSummary {
  total_pending:  number
  total_overdue:  number
  total_paid:     number
  count_pending:  number
  count_overdue:  number
  count_paid:     number
}

interface Invoice {
  id:           string
  amount:       number
  status:       string
  due_date:     string
  payment_link: string | null
  customer:     { name: string; email: string | null } | null
}

interface Lead {
  id:     string
  status: string
}

interface Client {
  id:     string
  status: string
}

interface RetentionEvent {
  id:     string
  reason: string
  result: string
}

interface RevenueData {
  invoices:         Invoice[]
  summary:          InvoiceSummary
  leads:            Lead[]
  clients:          Client[]
  retentionEvents:  RetentionEvent[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (n: number) =>
  `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

const fmtPct = (n: number) => `${n.toFixed(1)}%`

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
  trend,
  href,
}: {
  label:   string
  value:   string
  sub?:    string
  icon:    React.ElementType
  color:   string
  trend?:  'up' | 'down' | 'neutral'
  href?:   string
}) {
  const card = (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 flex flex-col gap-3 hover:border-zinc-700 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', color)}>
          <Icon size={16} className="text-white" />
        </div>
        {trend === 'up'   && <ArrowUpRight   size={14} className="text-emerald-400" />}
        {trend === 'down' && <ArrowDownRight  size={14} className="text-red-400" />}
        {href             && <ExternalLink    size={11} className="text-zinc-600" />}
      </div>
      <div>
        <p className="text-xs text-zinc-500 mb-1">{label}</p>
        <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
        {sub && <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>}
      </div>
    </motion.div>
  )

  if (href) return <Link href={href}>{card}</Link>
  return card
}

function InvoiceRow({ inv, onPayLink }: { inv: Invoice; onPayLink: (id: string) => void }) {
  const overdue = inv.status === 'overdue'
  const paid    = inv.status === 'paid'

  return (
    <div className="flex items-center gap-3 rounded-xl border border-zinc-800/70 bg-zinc-900/40 px-4 py-3 hover:border-zinc-700 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate">
          {inv.customer?.name ?? 'Cliente'}
        </p>
        <p className="text-xs text-zinc-500 mt-0.5">
          Vence {new Date(inv.due_date).toLocaleDateString('pt-BR')}
          {inv.customer?.email && ` · ${inv.customer.email}`}
        </p>
      </div>

      <span className={cn(
        'shrink-0 text-sm font-bold',
        paid    ? 'text-emerald-400' :
        overdue ? 'text-red-400'     : 'text-amber-400',
      )}>
        {fmt(Number(inv.amount))}
      </span>

      <span className={cn(
        'shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase',
        paid    ? 'bg-emerald-500/20 text-emerald-400' :
        overdue ? 'bg-red-500/20 text-red-400'         :
                  'bg-amber-500/20 text-amber-400',
      )}>
        {paid ? 'Pago' : overdue ? 'Vencido' : 'Pendente'}
      </span>

      {!paid && (
        inv.payment_link ? (
          <a
            href={inv.payment_link}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-lg border border-violet-500/40 bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium text-violet-300 hover:bg-violet-500/20 transition-colors"
          >
            Link
          </a>
        ) : (
          <button
            onClick={() => onPayLink(inv.id)}
            className="shrink-0 rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:border-violet-500/40 hover:text-violet-300 transition-colors"
          >
            Gerar link
          </button>
        )
      )}
    </div>
  )
}

function SectionHeader({ title, icon: Icon, count }: { title: string; icon: React.ElementType; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={15} className="text-zinc-400" />
      <h2 className="text-sm font-semibold text-white">{title}</h2>
      {count !== undefined && (
        <span className="ml-auto text-xs text-zinc-500">{count} item{count !== 1 ? 's' : ''}</span>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RevenuePage() {
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [data,      setData]      = useState<RevenueData | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [genLoading, setGenLoading] = useState<Record<string, boolean>>({})

  useEffect(() => {
    resolveCompanyId().then(cid => setCompanyId(cid))
  }, [])

  const load = useCallback(async (cid: string) => {
    setLoading(true)
    setError(null)
    try {
      const [invRes, leadsRes, clientsRes, retRes] = await Promise.all([
        fetch(`/api/invoices/list?company_id=${cid}&status=all`),
        fetch(`/api/leads/manage?company_id=${cid}`),
        fetch(`/api/clients?company_id=${cid}`),
        fetch(`/api/retention/events?company_id=${cid}`).catch(() => null),
      ])

      const [invJson, leadsJson, clientsJson] = await Promise.all([
        invRes.ok ? invRes.json() : { invoices: [], summary: {} },
        leadsRes.ok ? leadsRes.json() : { data: [] },
        clientsRes.ok ? clientsRes.json() : { data: [] },
      ])

      let retEvents: RetentionEvent[] = []
      if (retRes?.ok) {
        const retJson = await retRes.json()
        retEvents = retJson.data ?? []
      }

      setData({
        invoices:        invJson.invoices ?? [],
        summary:         invJson.summary ?? {},
        leads:           leadsJson.data ?? [],
        clients:         clientsJson.data ?? [],
        retentionEvents: retEvents,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (companyId) load(companyId)
  }, [companyId, load])

  async function generatePayLink(invoiceId: string) {
    if (!companyId) return
    setGenLoading(prev => ({ ...prev, [invoiceId]: true }))
    try {
      const res = await fetch('/api/invoices/payment-link', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ invoice_id: invoiceId, company_id: companyId }),
      })
      if (res.ok) {
        const json = await res.json() as { payment_link: string }
        setData(prev => {
          if (!prev) return prev
          return {
            ...prev,
            invoices: prev.invoices.map(inv =>
              inv.id === invoiceId ? { ...inv, payment_link: json.payment_link } : inv
            ),
          }
        })
      }
    } finally {
      setGenLoading(prev => {
        const n = { ...prev }
        delete n[invoiceId]
        return n
      })
    }
  }

  // ── Derived metrics ──────────────────────────────────────────────────────

  const totalRevenue   = data?.summary.total_paid    ?? 0
  const totalPending   = data?.summary.total_pending ?? 0
  const totalOverdue   = data?.summary.total_overdue ?? 0
  const countPending   = data?.summary.count_pending ?? 0
  const countOverdue   = data?.summary.count_overdue ?? 0

  const leadsTotal     = data?.leads.length ?? 0
  const leadsConverted = data?.leads.filter(l => l.status === 'converted').length ?? 0
  const convRate       = leadsTotal > 0 ? (leadsConverted / leadsTotal) * 100 : 0

  const clientsTotal   = data?.clients.length ?? 0
  const activeClients  = data?.clients.filter(c => c.status === 'active').length ?? 0
  const retentionRate  = clientsTotal > 0 ? (activeClients / clientsTotal) * 100 : 0

  const atRiskCount    = data?.retentionEvents.filter(e => e.result === 'pending').length ?? 0

  const overdueInvoices  = data?.invoices.filter(i => i.status === 'overdue') ?? []
  const pendingInvoices  = data?.invoices.filter(i => i.status === 'pending') ?? []
  const recentPaid       = data?.invoices.filter(i => i.status === 'paid').slice(0, 5) ?? []

  // ── Loading / Error ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-zinc-500">
          <RefreshCw size={20} className="animate-spin text-violet-400" />
          <p className="text-sm">Carregando métricas de receita...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center space-y-3">
          <AlertTriangle size={24} className="mx-auto text-red-400" />
          <p className="text-sm text-zinc-400">{error}</p>
          <button
            onClick={() => companyId && load(companyId)}
            className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm text-white hover:border-zinc-600 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-6 space-y-8 max-w-6xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard de Receita</h1>
          <p className="text-sm text-zinc-500 mt-1">Visão completa do seu negócio em tempo real</p>
        </div>
        <button
          onClick={() => companyId && load(companyId)}
          className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800/60 px-4 py-2.5 text-sm text-zinc-300 hover:border-zinc-600 hover:text-white transition-colors"
        >
          <RefreshCw size={13} />
          Atualizar
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Receita Total"
          value={fmt(totalRevenue)}
          sub={`${data?.summary.count_paid ?? 0} faturas pagas`}
          icon={DollarSign}
          color="bg-emerald-600"
          trend="up"
          href="/dashboard/financeiro"
        />
        <KpiCard
          label="A Receber"
          value={fmt(totalPending)}
          sub={`${countPending} fatura${countPending !== 1 ? 's' : ''} pendente${countPending !== 1 ? 's' : ''}`}
          icon={Clock}
          color="bg-amber-600"
        />
        <KpiCard
          label="Vencido"
          value={fmt(totalOverdue)}
          sub={`${countOverdue} fatura${countOverdue !== 1 ? 's' : ''} em atraso`}
          icon={AlertTriangle}
          color="bg-red-600"
          trend={countOverdue > 0 ? 'down' : 'neutral'}
        />
        <KpiCard
          label="Taxa de Conversão"
          value={fmtPct(convRate)}
          sub={`${leadsConverted}/${leadsTotal} leads`}
          icon={Target}
          color="bg-violet-600"
          href="/dashboard/leads"
        />
      </div>

      {/* Second row KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KpiCard
          label="Taxa de Retenção"
          value={fmtPct(retentionRate)}
          sub={`${activeClients} de ${clientsTotal} clientes ativos`}
          icon={Users}
          color="bg-blue-600"
          href="/dashboard/clients"
        />
        <KpiCard
          label="Novos Leads"
          value={String(leadsTotal)}
          sub={`${data?.leads.filter(l => l.status === 'new').length ?? 0} aguardando contato`}
          icon={UserPlus}
          color="bg-cyan-600"
          href="/dashboard/leads"
        />
        <KpiCard
          label="Clientes em Risco"
          value={String(atRiskCount)}
          sub="eventos de retenção ativos"
          icon={ShieldAlert}
          color="bg-orange-600"
          trend={atRiskCount > 0 ? 'down' : 'neutral'}
        />
      </div>

      {/* Overdue Invoices */}
      {overdueInvoices.length > 0 && (
        <section>
          <SectionHeader
            title="Faturas Vencidas"
            icon={AlertTriangle}
            count={overdueInvoices.length}
          />
          <div className="space-y-2">
            {overdueInvoices.slice(0, 10).map(inv => (
              <InvoiceRow
                key={inv.id}
                inv={inv}
                onPayLink={genLoading[inv.id] ? () => {} : generatePayLink}
              />
            ))}
          </div>
          {overdueInvoices.length > 10 && (
            <Link
              href="/dashboard/financeiro"
              className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <ExternalLink size={11} />
              Ver todas as {overdueInvoices.length} faturas vencidas
            </Link>
          )}
        </section>
      )}

      {/* Pending Invoices */}
      {pendingInvoices.length > 0 && (
        <section>
          <SectionHeader
            title="Faturas Pendentes"
            icon={Clock}
            count={pendingInvoices.length}
          />
          <div className="space-y-2">
            {pendingInvoices.slice(0, 8).map(inv => (
              <InvoiceRow
                key={inv.id}
                inv={inv}
                onPayLink={genLoading[inv.id] ? () => {} : generatePayLink}
              />
            ))}
          </div>
        </section>
      )}

      {/* Recent Payments */}
      {recentPaid.length > 0 && (
        <section>
          <SectionHeader
            title="Pagamentos Recentes"
            icon={CheckCircle2}
            count={data?.summary.count_paid}
          />
          <div className="space-y-2">
            {recentPaid.map(inv => (
              <InvoiceRow
                key={inv.id}
                inv={inv}
                onPayLink={() => {}}
              />
            ))}
          </div>
        </section>
      )}

      {/* Revenue vs Target bar */}
      <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 size={15} className="text-zinc-400" />
            <h2 className="text-sm font-semibold text-white">Resumo Financeiro</h2>
          </div>
          <Link
            href="/dashboard/advisor"
            className="flex items-center gap-1.5 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-[11px] font-medium text-violet-300 hover:bg-violet-500/20 transition-colors"
          >
            <TrendingUp size={11} />
            Análise IA
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Recebido',  value: totalRevenue,  color: 'bg-emerald-500' },
            { label: 'Pendente',  value: totalPending,  color: 'bg-amber-500'   },
            { label: 'Vencido',   value: totalOverdue,  color: 'bg-red-500'     },
          ].map(item => {
            const total = totalRevenue + totalPending + totalOverdue
            const pct   = total > 0 ? (item.value / total) * 100 : 0
            return (
              <div key={item.label}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-zinc-400">{item.label}</span>
                  <span className="font-semibold text-white">{fmt(item.value)}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all duration-700', item.color)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="text-[10px] text-zinc-600 mt-1">{fmtPct(pct)} do total</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* Flow automation callout */}
      <div className="rounded-2xl border border-violet-500/20 bg-violet-500/5 p-5">
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/20">
            <TrendingUp size={18} className="text-violet-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-white mb-1">Automação de Receita</h3>
            <p className="text-xs text-zinc-400 leading-relaxed mb-3">
              Use o Flow Engine para cobrar clientes automaticamente, enviar lembretes de pagamento e
              ativar campanhas de retenção quando clientes ficam inativos.
            </p>
            <div className="flex flex-wrap gap-2 text-[11px]">
              {['CREATE_PAYMENT_LINK', 'CLIENT_AT_RISK', 'SEND_WHATSAPP', 'UPDATE_LEAD_STATUS'].map(action => (
                <span key={action} className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-0.5 font-mono text-violet-300">
                  {action}
                </span>
              ))}
            </div>
          </div>
          <Link
            href="/dashboard/actions"
            className="shrink-0 rounded-xl border border-violet-500/40 bg-violet-500/10 px-4 py-2 text-xs font-medium text-violet-300 hover:bg-violet-500/20 transition-colors"
          >
            Criar Fluxo
          </Link>
        </div>
      </div>
    </div>
  )
}
