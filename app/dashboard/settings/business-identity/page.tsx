'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Mail, Globe, Phone, Palette, Server, MessageSquare,
  CheckCircle2, XCircle, Loader2, Save, RefreshCw, Eye, EyeOff,
} from 'lucide-react'

// ─── Types ──────────────────────────────────────────────────────

interface FormState {
  // Company info
  companyName: string
  slogan: string
  website: string
  supportPhone: string
  // Branding
  logoUrl: string
  primaryColor: string
  secondaryColor: string
  // Email sender
  senderName: string
  senderEmail: string
  supportEmail: string
  replyToEmail: string
  customSenderEnabled: boolean
  // SMTP
  smtpEnabled: boolean
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpPassword: string
  smtpSecure: boolean
  // Resend
  resendApiKey: string
  resendFromDomain: string
  // WhatsApp
  whatsappNumber: string
  whatsappDisplayName: string
  // Z-API
  zapiInstanceId: string
  zapiToken: string
  zapiClientToken: string
}

const DEFAULTS: FormState = {
  companyName: '', slogan: '', website: '', supportPhone: '',
  logoUrl: '', primaryColor: '#6366f1', secondaryColor: '#8b5cf6',
  senderName: '', senderEmail: '', supportEmail: '', replyToEmail: '',
  customSenderEnabled: false,
  smtpEnabled: false, smtpHost: '', smtpPort: 587, smtpUser: '',
  smtpPassword: '', smtpSecure: false,
  resendApiKey: '', resendFromDomain: '',
  whatsappNumber: '', whatsappDisplayName: '',
  zapiInstanceId: '', zapiToken: '', zapiClientToken: '',
}

// ─── Small helpers ───────────────────────────────────────────────

function Section({ icon, title, children }: {
  icon: React.ReactNode; title: string; children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
      <div className="mb-5 flex items-center gap-2.5 border-b border-zinc-800 pb-4">
        <span className="text-violet-400">{icon}</span>
        <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  )
}

function Field({ label, hint, children }: {
  label: string; hint?: string; children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-medium text-zinc-400">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-zinc-600">{hint}</p>}
    </div>
  )
}

const inputCls = 'w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/30 transition'

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={inputCls} />
}

function Toggle({ checked, onChange, label }: {
  checked: boolean; onChange: (v: boolean) => void; label: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors ${checked ? 'bg-violet-600' : 'bg-zinc-700'}`}
    >
      <span className={`pointer-events-none inline-block h-4 w-4 translate-x-0 transform rounded-full bg-white shadow-lg transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      <span className="sr-only">{label}</span>
    </button>
  )
}

function VerificationBadge({ verified }: { verified: boolean }) {
  return verified
    ? <span className="inline-flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 size={12} />Verificado</span>
    : <span className="inline-flex items-center gap-1 text-xs text-zinc-500"><XCircle size={12} />Não verificado</span>
}

// ─── Page ────────────────────────────────────────────────────────

export default function BusinessIdentityPage() {
  const [form, setForm] = useState<FormState>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSmtpPw, setShowSmtpPw] = useState(false)
  const [showResendKey, setShowResendKey] = useState(false)
  const [showZapiToken, setShowZapiToken] = useState(false)
  const [zapiStatus, setZapiStatus] = useState<'idle' | 'checking' | 'connected' | 'disconnected'>('idle')

  const [dnsStatus, setDnsStatus] = useState({
    domainVerified: false,
    spfVerified: false,
    dkimVerified: false,
    dmarcVerified: false,
  })

  // ── Load ─────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/settings/business-identity')
      const json = await res.json() as { data: Record<string, unknown> | null }
      if (json.data) {
        const d = json.data
        setForm({
          companyName:          (d.company_name          as string) ?? '',
          slogan:               (d.slogan                as string) ?? '',
          website:              (d.website               as string) ?? '',
          supportPhone:         (d.support_phone         as string) ?? '',
          logoUrl:              (d.logo_url              as string) ?? '',
          primaryColor:         (d.primary_color         as string) ?? '#6366f1',
          secondaryColor:       (d.secondary_color       as string) ?? '#8b5cf6',
          senderName:           (d.sender_name           as string) ?? '',
          senderEmail:          (d.sender_email          as string) ?? '',
          supportEmail:         (d.support_email         as string) ?? '',
          replyToEmail:         (d.reply_to_email        as string) ?? '',
          customSenderEnabled:  (d.custom_sender_enabled as boolean) ?? false,
          smtpEnabled:          (d.smtp_enabled          as boolean) ?? false,
          smtpHost:             (d.smtp_host             as string) ?? '',
          smtpPort:             (d.smtp_port             as number) ?? 587,
          smtpUser:             (d.smtp_user             as string) ?? '',
          smtpPassword:         '',
          smtpSecure:           (d.smtp_secure           as boolean) ?? false,
          resendApiKey:         '',
          resendFromDomain:     (d.resend_from_domain    as string) ?? '',
          whatsappNumber:       (d.whatsapp_number       as string) ?? '',
          whatsappDisplayName:  (d.whatsapp_display_name as string) ?? '',
          zapiInstanceId:       (d.zapi_instance_id      as string) ?? '',
          zapiToken:            '',
          zapiClientToken:      (d.zapi_client_token     as string) ?? '',
        })
        setDnsStatus({
          domainVerified: (d.domain_verified as boolean) ?? false,
          spfVerified:    (d.spf_verified    as boolean) ?? false,
          dkimVerified:   (d.dkim_verified   as boolean) ?? false,
          dmarcVerified:  (d.dmarc_verified  as boolean) ?? false,
        })
      }
    } catch { /* silently keep defaults */ }
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  // ── Save ─────────────────────────────────────────────────────
  async function save() {
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/settings/business-identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json() as { error?: string }
      if (json.error) { setError(json.error); return }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  // ── Verify domain ─────────────────────────────────────────────
  async function verifyDomain() {
    if (!form.senderEmail) return
    const domain = form.senderEmail.split('@')[1]
    if (!domain) return
    setVerifying(true)
    try {
      const res = await fetch('/api/settings/business-identity/verify-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      })
      const json = await res.json() as typeof dnsStatus
      setDnsStatus(json)
    } catch { /* ignore */ }
    setVerifying(false)
  }

  const set = (key: keyof FormState, value: unknown) =>
    setForm(prev => ({ ...prev, [key]: value }))

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 size={22} className="animate-spin text-zinc-500" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-100">Identidade da empresa</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Configure como sua empresa aparece nos e-mails e mensagens enviados aos clientes.
          </p>
        </div>
        <button
          onClick={() => void save()}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-500 disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saved ? 'Salvo!' : 'Salvar'}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-800/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {/* ── Company info ── */}
      <Section icon={<Globe size={15} />} title="Informações da empresa">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nome da empresa">
            <Input
              value={form.companyName}
              onChange={e => set('companyName', e.target.value)}
              placeholder="Minha Empresa Ltda"
            />
          </Field>
          <Field label="Slogan">
            <Input
              value={form.slogan}
              onChange={e => set('slogan', e.target.value)}
              placeholder="Soluções que transformam"
            />
          </Field>
          <Field label="Website">
            <Input
              value={form.website}
              onChange={e => set('website', e.target.value)}
              placeholder="https://minhaempresa.com.br"
            />
          </Field>
          <Field label="Telefone de suporte">
            <Input
              value={form.supportPhone}
              onChange={e => set('supportPhone', e.target.value)}
              placeholder="+55 11 99999-9999"
            />
          </Field>
        </div>
      </Section>

      {/* ── Branding ── */}
      <Section icon={<Palette size={15} />} title="Identidade visual">
        <Field label="URL do logotipo" hint="Hospede a imagem e cole o link público aqui">
          <Input
            value={form.logoUrl}
            onChange={e => set('logoUrl', e.target.value)}
            placeholder="https://minhaempresa.com.br/logo.png"
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Cor primária">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.primaryColor}
                onChange={e => set('primaryColor', e.target.value)}
                className="h-9 w-9 cursor-pointer rounded-lg border border-zinc-700 bg-transparent p-0.5"
              />
              <Input
                value={form.primaryColor}
                onChange={e => set('primaryColor', e.target.value)}
                placeholder="#6366f1"
              />
            </div>
          </Field>
          <Field label="Cor secundária">
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={form.secondaryColor}
                onChange={e => set('secondaryColor', e.target.value)}
                className="h-9 w-9 cursor-pointer rounded-lg border border-zinc-700 bg-transparent p-0.5"
              />
              <Input
                value={form.secondaryColor}
                onChange={e => set('secondaryColor', e.target.value)}
                placeholder="#8b5cf6"
              />
            </div>
          </Field>
        </div>
      </Section>

      {/* ── Email sender ── */}
      <Section icon={<Mail size={15} />} title="Remetente de e-mail">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-300">Usar remetente personalizado</p>
            <p className="text-xs text-zinc-500">Os e-mails aparecerão como enviados pela sua empresa</p>
          </div>
          <Toggle
            checked={form.customSenderEnabled}
            onChange={v => set('customSenderEnabled', v)}
            label="Remetente personalizado"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Nome do remetente">
            <Input
              value={form.senderName}
              onChange={e => set('senderName', e.target.value)}
              placeholder="Equipe Minha Empresa"
              disabled={!form.customSenderEnabled}
            />
          </Field>
          <Field label="E-mail do remetente">
            <Input
              type="email"
              value={form.senderEmail}
              onChange={e => set('senderEmail', e.target.value)}
              placeholder="contato@minhaempresa.com.br"
              disabled={!form.customSenderEnabled}
            />
          </Field>
          <Field label="E-mail de suporte">
            <Input
              type="email"
              value={form.supportEmail}
              onChange={e => set('supportEmail', e.target.value)}
              placeholder="suporte@minhaempresa.com.br"
              disabled={!form.customSenderEnabled}
            />
          </Field>
          <Field label="Responder para (reply-to)">
            <Input
              type="email"
              value={form.replyToEmail}
              onChange={e => set('replyToEmail', e.target.value)}
              placeholder="nao-responda@minhaempresa.com.br"
              disabled={!form.customSenderEnabled}
            />
          </Field>
        </div>

        {/* DNS verification */}
        {form.customSenderEnabled && form.senderEmail && (
          <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/40 p-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-semibold text-zinc-400">Verificação DNS do domínio</p>
              <button
                onClick={() => void verifyDomain()}
                disabled={verifying}
                className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-2.5 py-1 text-xs text-zinc-300 transition hover:bg-zinc-700"
              >
                {verifying ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                Verificar agora
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2 text-zinc-400">SPF <VerificationBadge verified={dnsStatus.spfVerified} /></div>
              <div className="flex items-center gap-2 text-zinc-400">DKIM <VerificationBadge verified={dnsStatus.dkimVerified} /></div>
              <div className="flex items-center gap-2 text-zinc-400">DMARC <VerificationBadge verified={dnsStatus.dmarcVerified} /></div>
              <div className="flex items-center gap-2 text-zinc-400">Domínio <VerificationBadge verified={dnsStatus.domainVerified} /></div>
            </div>
          </div>
        )}
      </Section>

      {/* ── SMTP ── */}
      <Section icon={<Server size={15} />} title="SMTP personalizado">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-zinc-300">Usar servidor SMTP próprio</p>
            <p className="text-xs text-zinc-500">Envie e-mails pelo servidor da sua empresa</p>
          </div>
          <Toggle
            checked={form.smtpEnabled}
            onChange={v => set('smtpEnabled', v)}
            label="SMTP ativo"
          />
        </div>

        {form.smtpEnabled && (
          <div className="grid grid-cols-2 gap-4">
            <Field label="Host SMTP">
              <Input
                value={form.smtpHost}
                onChange={e => set('smtpHost', e.target.value)}
                placeholder="smtp.minhaempresa.com.br"
              />
            </Field>
            <Field label="Porta">
              <Input
                type="number"
                value={form.smtpPort}
                onChange={e => set('smtpPort', Number(e.target.value))}
                placeholder="587"
              />
            </Field>
            <Field label="Usuário SMTP">
              <Input
                value={form.smtpUser}
                onChange={e => set('smtpUser', e.target.value)}
                placeholder="contato@minhaempresa.com.br"
              />
            </Field>
            <Field label="Senha SMTP" hint="Criptografada em AES-256-GCM">
              <div className="relative">
                <Input
                  type={showSmtpPw ? 'text' : 'password'}
                  value={form.smtpPassword}
                  onChange={e => set('smtpPassword', e.target.value)}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowSmtpPw(p => !p)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {showSmtpPw ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </Field>
            <div className="col-span-2 flex items-center gap-3">
              <Toggle
                checked={form.smtpSecure}
                onChange={v => set('smtpSecure', v)}
                label="TLS/SSL"
              />
              <span className="text-sm text-zinc-400">TLS/SSL (porta 465)</span>
            </div>
          </div>
        )}
      </Section>

      {/* ── Resend custom domain ── */}
      <Section icon={<Mail size={15} />} title="Resend — domínio personalizado">
        <Field label="API Key do Resend" hint="Substitui a chave global da plataforma. Criptografada em AES-256-GCM.">
          <div className="relative">
            <Input
              type={showResendKey ? 'text' : 'password'}
              value={form.resendApiKey}
              onChange={e => set('resendApiKey', e.target.value)}
              placeholder="re_••••••••"
            />
            <button
              type="button"
              onClick={() => setShowResendKey(p => !p)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
            >
              {showResendKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
        </Field>
        <Field label="Domínio verificado no Resend" hint="Exemplo: minhaempresa.com.br">
          <Input
            value={form.resendFromDomain}
            onChange={e => set('resendFromDomain', e.target.value)}
            placeholder="minhaempresa.com.br"
          />
        </Field>
      </Section>

      {/* ── WhatsApp via Z-API ── */}
      <Section icon={<MessageSquare size={15} />} title="WhatsApp via Z-API">
        <div className="rounded-xl border border-zinc-700/40 bg-zinc-800/30 px-4 py-3 text-xs text-zinc-400">
          Crie sua instância em{' '}
          <span className="text-violet-400">app.z-api.io</span>
          {' '}e cole as credenciais abaixo. Cada empresa pode ter sua própria instância.
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Número WhatsApp" hint="Formato E.164: +5511999999999">
            <Input
              value={form.whatsappNumber}
              onChange={e => set('whatsappNumber', e.target.value)}
              placeholder="+5511999999999"
            />
          </Field>
          <Field label="Nome de exibição">
            <Input
              value={form.whatsappDisplayName}
              onChange={e => set('whatsappDisplayName', e.target.value)}
              placeholder="Suporte Minha Empresa"
            />
          </Field>
          <Field label="Instance ID" hint="Visível no painel Z-API → sua instância">
            <Input
              value={form.zapiInstanceId}
              onChange={e => set('zapiInstanceId', e.target.value)}
              placeholder="3A123BC456DE7"
            />
          </Field>
          <Field label="Token da instância" hint="Criptografado em AES-256-GCM">
            <div className="relative">
              <Input
                type={showZapiToken ? 'text' : 'password'}
                value={form.zapiToken}
                onChange={e => set('zapiToken', e.target.value)}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowZapiToken(p => !p)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                {showZapiToken ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </Field>
          <Field label="Client-Token" hint="Opcional — exigido em alguns planos Z-API">
            <Input
              value={form.zapiClientToken}
              onChange={e => set('zapiClientToken', e.target.value)}
              placeholder="F••••••••"
            />
          </Field>
        </div>

        {/* Test connection */}
        {form.zapiInstanceId && (
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={async () => {
                setZapiStatus('checking')
                try {
                  const res = await fetch('/api/settings/business-identity/zapi-status', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      instanceId:  form.zapiInstanceId,
                      token:       form.zapiToken,
                      clientToken: form.zapiClientToken,
                    }),
                  })
                  const json = await res.json() as { connected: boolean }
                  setZapiStatus(json.connected ? 'connected' : 'disconnected')
                } catch { setZapiStatus('disconnected') }
              }}
              className="flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-700"
            >
              {zapiStatus === 'checking'
                ? <Loader2 size={11} className="animate-spin" />
                : <RefreshCw size={11} />}
              Testar conexão
            </button>
            {zapiStatus === 'connected'    && <span className="flex items-center gap-1 text-xs text-emerald-400"><CheckCircle2 size={12} />Conectado</span>}
            {zapiStatus === 'disconnected' && <span className="flex items-center gap-1 text-xs text-red-400"><XCircle size={12} />Desconectado — verifique as credenciais</span>}
          </div>
        )}
      </Section>

      {/* Bottom save */}
      <div className="flex justify-end pb-8">
        <button
          onClick={() => void save()}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500 disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {saved ? 'Salvo com sucesso!' : 'Salvar configurações'}
        </button>
      </div>
    </div>
  )
}
