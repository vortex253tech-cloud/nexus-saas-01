'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  CreditCard, Zap, Building2, CheckCircle2, XCircle,
  Eye, EyeOff, Loader2, Trash2, FlaskConical, ChevronDown,
  ChevronUp, ArrowLeft, ShieldCheck,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

type Provider = 'stripe' | 'mercadopago' | 'pix'

interface PaymentConfig {
  id:                    string
  provider:              Provider
  is_active:             boolean
  // Stripe (sanitized — secret shown as masked)
  stripe_publishable_key?: string | null
  stripe_secret_key?:      string | null   // always masked from server
  stripe_webhook_secret?:  string | null   // always masked from server
  // Mercado Pago
  mp_access_token?:        string | null   // always masked
  mp_public_key?:          string | null
  // Pix
  pix_key?:                string | null
  pix_key_type?:           string | null
  pix_holder_name?:        string | null
  pix_city?:               string | null
  updated_at:              string
}

interface TestResult {
  ok:      boolean
  message: string
}

// ─── Provider metadata ────────────────────────────────────────────────────────

const PROVIDERS: { id: Provider; label: string; icon: React.ElementType; color: string; description: string }[] = [
  {
    id:          'stripe',
    label:       'Stripe',
    icon:        CreditCard,
    color:       'violet',
    description: 'Cartão de crédito/débito internacional. Recomendado para alto volume.',
  },
  {
    id:          'pix',
    label:       'Pix',
    icon:        Zap,
    color:       'emerald',
    description: 'Pagamento instantâneo via chave Pix. Sem taxas para o vendedor.',
  },
  {
    id:          'mercadopago',
    label:       'Mercado Pago',
    icon:        Building2,
    color:       'blue',
    description: 'Cartão, boleto e Pix via Mercado Pago. Popular no Brasil.',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ configured }: { configured: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
      configured
        ? 'bg-emerald-500/10 text-emerald-400'
        : 'bg-zinc-800 text-zinc-500',
    )}>
      {configured
        ? <><CheckCircle2 size={12} /> Conectado</>
        : <><XCircle size={12} /> Não configurado</>}
    </span>
  )
}

function SecretInput({
  label,
  name,
  value,
  placeholder,
  onChange,
  hint,
}: {
  label:       string
  name:        string
  value:       string
  placeholder: string
  onChange:    (v: string) => void
  hint?:       string
}) {
  const [show, setShow] = useState(false)

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-zinc-400">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          name={name}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          className={cn(
            'w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 pr-10',
            'text-sm text-white placeholder:text-zinc-600',
            'focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600',
            'font-mono',
          )}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
        >
          {show ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
      {hint && <p className="text-xs text-zinc-600">{hint}</p>}
    </div>
  )
}

function TextInput({
  label,
  name,
  value,
  placeholder,
  onChange,
  hint,
}: {
  label:       string
  name:        string
  value:       string
  placeholder: string
  onChange:    (v: string) => void
  hint?:       string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-zinc-400">{label}</label>
      <input
        type="text"
        name={name}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        spellCheck={false}
        className={cn(
          'w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2',
          'text-sm text-white placeholder:text-zinc-600',
          'focus:border-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-600',
        )}
      />
      {hint && <p className="text-xs text-zinc-600">{hint}</p>}
    </div>
  )
}

// ─── Provider Card ────────────────────────────────────────────────────────────

function ProviderCard({
  provider: meta,
  config,
  onSaved,
  onDeleted,
}: {
  provider: typeof PROVIDERS[number]
  config:   PaymentConfig | undefined
  onSaved:  () => void
  onDeleted:(p: Provider) => void
}) {
  const [open,    setOpen]    = useState(false)
  const [fields,  setFields]  = useState<Record<string, string>>({})
  const [saving,  setSaving]  = useState(false)
  const [testing, setTesting] = useState(false)
  const [deleting,setDeleting]= useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<TestResult | null>(null)

  const set = (k: string) => (v: string) => setFields(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const res = await fetch('/api/settings/payments', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ provider: meta.id, ...fields }),
      })
      const data = await res.json() as { error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Erro ao salvar')
      setSuccess('Configuração salva com sucesso.')
      setFields({})
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro inesperado')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/settings/payments/test', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ provider: meta.id }),
      })
      const data = await res.json() as TestResult
      setTestResult(data)
    } catch {
      setTestResult({ ok: false, message: 'Erro de rede ao testar conexão' })
    } finally {
      setTesting(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`Remover configuração do ${meta.label}?`)) return
    setDeleting(true)
    try {
      await fetch(`/api/settings/payments?provider=${meta.id}`, { method: 'DELETE' })
      onDeleted(meta.id)
    } finally {
      setDeleting(false)
    }
  }

  const colors = {
    violet:  { border: 'border-violet-500/30',  icon: 'bg-violet-500/10 text-violet-400'  },
    emerald: { border: 'border-emerald-500/30', icon: 'bg-emerald-500/10 text-emerald-400' },
    blue:    { border: 'border-blue-500/30',    icon: 'bg-blue-500/10 text-blue-400'       },
  }
  const c = colors[meta.color as keyof typeof colors]

  const isConfigured = Boolean(config)

  return (
    <div className={cn(
      'rounded-xl border bg-zinc-900 transition-all',
      isConfigured ? c.border : 'border-zinc-800',
    )}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-4 p-5"
      >
        <div className="flex items-center gap-3">
          <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl', c.icon)}>
            <meta.icon size={20} />
          </div>
          <div className="text-left">
            <p className="font-semibold text-white">{meta.label}</p>
            <p className="text-xs text-zinc-500">{meta.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge configured={isConfigured} />
          {open ? <ChevronUp size={16} className="text-zinc-500" /> : <ChevronDown size={16} className="text-zinc-500" />}
        </div>
      </button>

      {/* Existing config summary */}
      {isConfigured && !open && config && (
        <div className="flex items-center justify-between border-t border-zinc-800 px-5 py-3">
          <p className="text-xs text-zinc-500">
            Atualizado {new Date(config.updated_at).toLocaleDateString('pt-BR')}
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleTest}
              disabled={testing}
              className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
            >
              {testing
                ? <Loader2 size={12} className="animate-spin" />
                : <FlaskConical size={12} />}
              Testar conexão
            </button>
            <button
              onClick={() => setOpen(true)}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-zinc-700"
            >
              Editar
            </button>
          </div>
        </div>
      )}

      {/* Test result */}
      {testResult && !open && (
        <div className={cn(
          'mx-5 mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs',
          testResult.ok
            ? 'bg-emerald-500/10 text-emerald-400'
            : 'bg-red-500/10 text-red-400',
        )}>
          {testResult.ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
          {testResult.message}
        </div>
      )}

      {/* Expandable form */}
      {open && (
        <div className="border-t border-zinc-800 p-5">
          {/* Current masked values if configured */}
          {isConfigured && config && (
            <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
              <p className="mb-2 text-xs font-medium text-zinc-400">Configuração atual</p>
              {meta.id === 'stripe' && (
                <div className="space-y-1 font-mono text-xs text-zinc-500">
                  {config.stripe_publishable_key && <p>pk: {config.stripe_publishable_key}</p>}
                  {config.stripe_secret_key      && <p>sk: {config.stripe_secret_key}</p>}
                </div>
              )}
              {meta.id === 'mercadopago' && config.mp_access_token && (
                <p className="font-mono text-xs text-zinc-500">token: {config.mp_access_token}</p>
              )}
              {meta.id === 'pix' && (
                <div className="space-y-1 text-xs text-zinc-500">
                  {config.pix_key         && <p>Chave: {config.pix_key}</p>}
                  {config.pix_holder_name && <p>Titular: {config.pix_holder_name}</p>}
                </div>
              )}
              <p className="mt-1 text-xs text-zinc-600">Para atualizar, preencha os campos abaixo e salve.</p>
            </div>
          )}

          {/* Form fields per provider */}
          <div className="space-y-3">
            {meta.id === 'stripe' && (
              <>
                <TextInput
                  label="Publishable Key"
                  name="stripe_publishable_key"
                  value={fields['stripe_publishable_key'] ?? ''}
                  placeholder="pk_live_..."
                  onChange={set('stripe_publishable_key')}
                  hint="Começa com pk_live_ ou pk_test_ — segura para uso público"
                />
                <SecretInput
                  label="Secret Key"
                  name="stripe_secret_key"
                  value={fields['stripe_secret_key'] ?? ''}
                  placeholder="sk_live_..."
                  onChange={set('stripe_secret_key')}
                  hint="Começa com sk_live_ ou sk_test_ — nunca exposta ao cliente"
                />
                <SecretInput
                  label="Webhook Secret (opcional)"
                  name="stripe_webhook_secret"
                  value={fields['stripe_webhook_secret'] ?? ''}
                  placeholder="whsec_..."
                  onChange={set('stripe_webhook_secret')}
                  hint="Necessário para confirmar pagamentos via webhook"
                />
              </>
            )}

            {meta.id === 'pix' && (
              <>
                <TextInput
                  label="Chave Pix"
                  name="pix_key"
                  value={fields['pix_key'] ?? ''}
                  placeholder="email@exemplo.com, CPF, CNPJ ou chave aleatória"
                  onChange={set('pix_key')}
                />
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium text-zinc-400">Tipo da chave</label>
                  <select
                    value={fields['pix_key_type'] ?? 'aleatoria'}
                    onChange={e => set('pix_key_type')(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-600 focus:outline-none"
                  >
                    <option value="cpf">CPF</option>
                    <option value="cnpj">CNPJ</option>
                    <option value="email">E-mail</option>
                    <option value="telefone">Telefone</option>
                    <option value="aleatoria">Chave aleatória</option>
                  </select>
                </div>
                <TextInput
                  label="Nome do titular"
                  name="pix_holder_name"
                  value={fields['pix_holder_name'] ?? ''}
                  placeholder="Nome como aparece na conta (sem acentos)"
                  onChange={set('pix_holder_name')}
                  hint="Aparece no QR code e copia-e-cola"
                />
                <TextInput
                  label="Cidade (opcional)"
                  name="pix_city"
                  value={fields['pix_city'] ?? ''}
                  placeholder="SAO PAULO"
                  onChange={set('pix_city')}
                />
              </>
            )}

            {meta.id === 'mercadopago' && (
              <>
                <SecretInput
                  label="Access Token"
                  name="mp_access_token"
                  value={fields['mp_access_token'] ?? ''}
                  placeholder="APP_USR-... ou TEST-..."
                  onChange={set('mp_access_token')}
                  hint="Obtenha em: mercadopago.com.br → Suas Integrações → Credenciais"
                />
                <TextInput
                  label="Public Key (opcional)"
                  name="mp_public_key"
                  value={fields['mp_public_key'] ?? ''}
                  placeholder="APP_USR-..."
                  onChange={set('mp_public_key')}
                  hint="Necessária para o Checkout Pro"
                />
              </>
            )}
          </div>

          {/* Feedback */}
          {error && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
              <XCircle size={12} /> {error}
            </div>
          )}
          {success && (
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
              <CheckCircle2 size={12} /> {success}
            </div>
          )}

          {/* Actions */}
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex gap-2">
              {isConfigured && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs font-medium text-red-400 hover:bg-red-950/60 disabled:opacity-50"
                >
                  {deleting ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  Remover
                </button>
              )}
              {isConfigured && (
                <button
                  onClick={handleTest}
                  disabled={testing}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
                >
                  {testing ? <Loader2 size={12} className="animate-spin" /> : <FlaskConical size={12} />}
                  Testar
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setOpen(false); setError(null); setSuccess(null) }}
                className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-4 py-2 text-xs font-semibold text-black hover:bg-zinc-200 disabled:opacity-50"
              >
                {saving && <Loader2 size={12} className="animate-spin" />}
                Salvar
              </button>
            </div>
          </div>

          {/* Test result inside form */}
          {testResult && (
            <div className={cn(
              'mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-xs',
              testResult.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400',
            )}>
              {testResult.ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
              {testResult.message}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PaymentSettingsPage() {
  const [configs,  setConfigs]  = useState<PaymentConfig[]>([])
  const [loading,  setLoading]  = useState(true)

  const loadConfigs = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/settings/payments')
      const data = await res.json() as { configs?: PaymentConfig[] }
      setConfigs(data.configs ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadConfigs() }, [loadConfigs])

  const configByProvider = (p: Provider) => configs.find(c => c.provider === p)

  const handleDeleted = (p: Provider) => {
    setConfigs(cs => cs.filter(c => c.provider !== p))
  }

  const connectedCount = configs.length

  return (
    <div className="min-h-screen bg-black px-4 py-8 md:px-8">
      <div className="mx-auto max-w-2xl">

        {/* Back */}
        <Link
          href="/dashboard/settings"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-500 hover:text-zinc-300"
        >
          <ArrowLeft size={14} /> Configurações
        </Link>

        {/* Header */}
        <div className="mb-8">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900">
              <CreditCard size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Pagamentos</h1>
              <p className="text-sm text-zinc-500">
                Conecte seu próprio provedor — links gerados pela IA usam sua conta.
              </p>
            </div>
          </div>

          {/* Summary bar */}
          {!loading && (
            <div className="flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3">
              <ShieldCheck size={14} className={connectedCount > 0 ? 'text-emerald-400' : 'text-zinc-600'} />
              <p className="text-xs text-zinc-400">
                {connectedCount === 0
                  ? 'Nenhum provedor configurado — links de pagamento usarão modo manual.'
                  : `${connectedCount} provedor${connectedCount > 1 ? 'es' : ''} conectado${connectedCount > 1 ? 's' : ''} — links serão gerados pela sua conta.`}
              </p>
            </div>
          )}
        </div>

        {/* Provider cards */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-zinc-600" />
          </div>
        ) : (
          <div className="space-y-3">
            {PROVIDERS.map(p => (
              <ProviderCard
                key={p.id}
                provider={p}
                config={configByProvider(p.id)}
                onSaved={loadConfigs}
                onDeleted={handleDeleted}
              />
            ))}
          </div>
        )}

        {/* Security note */}
        <div className="mt-8 flex gap-3 rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
          <ShieldCheck size={16} className="mt-0.5 shrink-0 text-zinc-500" />
          <div>
            <p className="text-xs font-medium text-zinc-400">Suas credenciais são seguras</p>
            <p className="mt-0.5 text-xs text-zinc-600">
              Chaves secretas são criptografadas com AES-256-GCM antes de serem armazenadas
              e nunca são enviadas ao navegador. Apenas versões mascaradas são exibidas.
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
