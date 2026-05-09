'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  Building2, Palette, Bot, Mail, Target, Eye,
  Upload, Check, AlertCircle, Loader2, X,
  ChevronDown, ChevronUp, Phone, Globe,
  Sparkles, User,
} from 'lucide-react'
import { cn } from '@/lib/cn'

// ─── Types ────────────────────────────────────────────────────────

interface ProfileData {
  // Company
  name?: string
  fantasy_name?: string
  email?: string
  phone?: string
  sector?: string
  slogan?: string
  description?: string
  website?: string
  instagram?: string
  whatsapp_commercial?: string
  // Branding
  logo_url?: string
  banner_url?: string
  icon_url?: string
  brand_name?: string
  brand_color?: string
  secondary_color?: string
  // AI Identity
  ai_name?: string
  ai_role?: string
  ai_style?: string
  // Communication
  sender_name?: string
  sender_email?: string
  support_email?: string
  reply_to_email?: string
  // Personalisation
  niche?: string
  client_type?: string
  company_objective?: string
  communication_tone?: string
}

type SectionId = 'empresa' | 'branding' | 'ia' | 'comunicacao' | 'personalizacao' | 'preview'

// ─── Toast ────────────────────────────────────────────────────────

function Toast({ msg, type, onClose }: { msg: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t) }, [onClose])
  return (
    <div className={cn(
      'fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl border px-4 py-3 shadow-2xl',
      'animate-in slide-in-from-bottom-4 fade-in',
      type === 'success'
        ? 'border-emerald-500/30 bg-emerald-950/90 text-emerald-300'
        : 'border-red-500/30 bg-red-950/90 text-red-300',
    )}>
      {type === 'success' ? <Check size={15} /> : <AlertCircle size={15} />}
      <span className="text-sm font-medium">{msg}</span>
      <button onClick={onClose} className="ml-2 opacity-60 hover:opacity-100"><X size={13} /></button>
    </div>
  )
}

// ─── Section wrapper ──────────────────────────────────────────────

function Section({
  id, active, icon: Icon, title, subtitle, color, children, onToggle,
}: {
  id: SectionId
  active: boolean
  icon: React.ComponentType<{ size?: number; className?: string }>
  title: string
  subtitle: string
  color: string
  children: React.ReactNode
  onToggle: (id: SectionId) => void
}) {
  return (
    <div className={cn(
      'rounded-2xl border transition-all duration-200',
      active ? 'border-zinc-700 bg-zinc-900/60' : 'border-zinc-800/60 bg-zinc-900/30',
    )}>
      <button
        onClick={() => onToggle(id)}
        className="flex w-full items-center gap-4 px-6 py-4 text-left"
      >
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: `${color}18`, border: `1px solid ${color}30` }}
        >
          <span style={{ color }}><Icon size={16} /></span>
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="text-xs text-zinc-500">{subtitle}</p>
        </div>
        {active
          ? <ChevronUp size={15} className="shrink-0 text-zinc-500" />
          : <ChevronDown size={15} className="shrink-0 text-zinc-500" />}
      </button>
      {active && (
        <div className="border-t border-zinc-800/60 px-6 py-5">
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Field components ─────────────────────────────────────────────

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-zinc-400">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-zinc-600">{hint}</p>}
    </div>
  )
}

const inputCls = cn(
  'w-full rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-3 py-2',
  'text-sm text-white placeholder-zinc-600',
  'focus:border-violet-500/50 focus:outline-none focus:ring-1 focus:ring-violet-500/20',
  'transition-colors',
)

const textareaCls = cn(inputCls, 'resize-none')

// ─── Image uploader ───────────────────────────────────────────────

function ImageUploader({
  label, kind, currentUrl, onUploaded,
}: {
  label: string
  kind: 'logo' | 'banner' | 'icon'
  currentUrl?: string
  onUploaded: (url: string) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function upload(file: File) {
    if (uploading) return
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('kind', kind)
    try {
      const res = await fetch('/api/settings/profile/upload', { method: 'POST', body: fd })
      const json = await res.json()
      if (json.url) onUploaded(json.url)
    } catch {
      // silent
    } finally {
      setUploading(false)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file) upload(file)
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-medium text-zinc-400">{label}</label>
      <div
        className={cn(
          'relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 transition-colors cursor-pointer',
          dragOver ? 'border-violet-500/60 bg-violet-500/5' : 'border-zinc-700/50 bg-zinc-800/30 hover:border-zinc-600',
        )}
        style={{ minHeight: kind === 'banner' ? 80 : 72 }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        {currentUrl ? (
          <div className="flex items-center gap-3">
            <img
              src={currentUrl}
              alt={label}
              className={cn(
                'object-contain rounded-lg border border-zinc-700',
                kind === 'banner' ? 'h-12 w-40' : kind === 'icon' ? 'h-10 w-10' : 'h-12 w-12',
              )}
            />
            <div className="text-left">
              <p className="text-xs font-medium text-zinc-300">Imagem carregada</p>
              <p className="text-[11px] text-zinc-500">Clique para trocar</p>
            </div>
          </div>
        ) : (
          <>
            {uploading
              ? <Loader2 size={18} className="animate-spin text-violet-400" />
              : <Upload size={18} className="text-zinc-500" />}
            <p className="text-xs text-zinc-500">
              {uploading ? 'Enviando…' : 'Arraste ou clique para enviar'}
            </p>
            <p className="text-[11px] text-zinc-600">PNG, JPG, WebP, SVG — máx 5 MB</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f) }}
        />
      </div>
    </div>
  )
}

// ─── Color picker ─────────────────────────────────────────────────

function ColorField({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-zinc-400">{label}</label>
      <div className="flex items-center gap-2">
        <label
          className="relative h-9 w-9 cursor-pointer overflow-hidden rounded-lg border border-zinc-700"
          style={{ background: value || '#6366f1' }}
        >
          <input
            type="color"
            value={value || '#6366f1'}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#6366f1"
          className={cn(inputCls, 'flex-1 font-mono text-xs')}
          maxLength={7}
        />
      </div>
    </div>
  )
}

// ─── AI Style selector ────────────────────────────────────────────

const AI_STYLES = [
  { value: 'profissional',  label: 'Profissional',  desc: 'Formal, preciso, direto ao ponto' },
  { value: 'premium',       label: 'Premium',        desc: 'Elegante, sofisticado, exclusivo' },
  { value: 'executivo',     label: 'Executivo',      desc: 'Autoridade, estratégico, conciso' },
  { value: 'tecnico',       label: 'Técnico',        desc: 'Especialista, detalhado, analítico' },
  { value: 'humanizado',    label: 'Humanizado',     desc: 'Próximo, empático, acolhedor' },
]

// ─── Live Preview ─────────────────────────────────────────────────

function LivePreview({ profile }: { profile: ProfileData }) {
  const brandColor = profile.brand_color || '#6366f1'
  const companyName = profile.brand_name || profile.name || 'Minha Empresa'
  const aiName = profile.ai_name || 'NEXUS IA'

  return (
    <div className="space-y-6">
      {/* Email preview */}
      <div>
        <p className="mb-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">Preview de Email</p>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden">
          {/* Email header */}
          <div className="px-5 py-4 text-center" style={{ background: `${brandColor}15`, borderBottom: `2px solid ${brandColor}30` }}>
            {profile.logo_url
              ? <img src={profile.logo_url} alt="logo" className="mx-auto h-8 object-contain" />
              : <p className="text-sm font-bold text-white" style={{ color: brandColor }}>{companyName}</p>}
            {profile.slogan && <p className="mt-1 text-[11px] text-zinc-500">{profile.slogan}</p>}
          </div>
          <div className="px-5 py-4">
            <p className="text-xs text-zinc-400">Olá, <span className="text-white font-medium">Cliente</span> 👋</p>
            <p className="mt-2 text-xs text-zinc-500 leading-relaxed">
              Sua mensagem de exemplo aparecerá aqui, com o estilo e identidade visual configurados acima.
            </p>
            <div className="mt-4 flex justify-center">
              <div className="rounded-lg px-5 py-2 text-xs font-semibold text-white" style={{ background: brandColor }}>
                Ação Principal
              </div>
            </div>
          </div>
          <div className="border-t border-zinc-800 px-5 py-3 text-center">
            <p className="text-[10px] text-zinc-600">
              {profile.sender_name || companyName} · {profile.support_email || profile.email || 'suporte@empresa.com'}
            </p>
          </div>
        </div>
      </div>

      {/* WhatsApp preview */}
      <div>
        <p className="mb-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">Preview WhatsApp</p>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="flex items-center gap-3 border-b border-zinc-800 pb-3 mb-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ background: brandColor }}>
              {companyName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="text-xs font-semibold text-white">{companyName}</p>
              <p className="text-[10px] text-emerald-400">● Online</p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="ml-auto max-w-[75%] rounded-xl rounded-tr-sm bg-emerald-600/20 border border-emerald-600/20 px-3 py-2">
              <p className="text-xs text-zinc-300">Olá! Tenho uma dúvida sobre meu pedido.</p>
            </div>
            <div className="max-w-[75%] rounded-xl rounded-tl-sm bg-zinc-800 px-3 py-2">
              <p className="text-[10px] font-semibold mb-0.5" style={{ color: brandColor }}>{aiName}</p>
              <p className="text-xs text-zinc-300">Olá! Fico feliz em ajudar. Qual é a sua dúvida?</p>
            </div>
          </div>
        </div>
      </div>

      {/* AI Chat preview */}
      <div>
        <p className="mb-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">Preview Chat IA</p>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="flex items-center gap-2 mb-3 pb-3 border-b border-zinc-800">
            <span style={{ color: brandColor }}><Sparkles size={13} /></span>
            <p className="text-xs font-semibold" style={{ color: brandColor }}>{aiName}</p>
            <span className="ml-auto text-[10px] text-zinc-600">
              {profile.ai_style ? AI_STYLES.find(s => s.value === profile.ai_style)?.label : 'Profissional'}
            </span>
          </div>
          <div className="rounded-lg bg-zinc-800/60 px-3 py-2">
            <p className="text-xs text-zinc-300 leading-relaxed">
              Olá! Sou {aiName}, assistente da <span className="font-medium text-white">{companyName}</span>
              {profile.niche ? `, especializada em ${profile.niche}` : ''}. Como posso ajudar hoje?
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────

export function BusinessProfileTab() {
  const [profile, setProfile] = useState<ProfileData>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [openSection, setOpenSection] = useState<SectionId>('empresa')
  const dirty = useRef(false)

  // Load
  useEffect(() => {
    fetch('/api/settings/profile')
      .then(r => r.json())
      .then(({ data }) => {
        if (data) {
          const identity = data.identity ?? {}
          setProfile({
            name:               data.name,
            fantasy_name:       data.fantasy_name,
            email:              data.email,
            phone:              data.phone,
            sector:             data.sector,
            slogan:             data.slogan,
            description:        data.description,
            website:            data.website,
            instagram:          data.instagram,
            whatsapp_commercial:data.whatsapp_commercial,
            logo_url:           data.logo_url,
            banner_url:         data.banner_url,
            icon_url:           data.icon_url,
            brand_name:         data.brand_name,
            brand_color:        data.brand_color,
            ai_name:            data.ai_name,
            ai_role:            data.ai_role,
            ai_style:           data.ai_style,
            niche:              data.niche,
            client_type:        data.client_type,
            company_objective:  data.company_objective,
            communication_tone: data.communication_tone,
            sender_name:        identity.sender_name,
            sender_email:       identity.sender_email,
            support_email:      identity.support_email,
            reply_to_email:     identity.reply_to_email,
          })
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const set = useCallback((key: keyof ProfileData, value: string) => {
    setProfile(p => ({ ...p, [key]: value }))
    dirty.current = true
  }, [])

  const save = useCallback(async () => {
    if (saving) return
    setSaving(true)
    dirty.current = false
    try {
      const res = await fetch('/api/settings/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      })
      const json = await res.json()
      if (json.error) {
        setToast({ msg: json.error, type: 'error' })
      } else {
        setToast({ msg: 'Perfil salvo com sucesso!', type: 'success' })
      }
    } catch {
      setToast({ msg: 'Falha ao salvar. Tente novamente.', type: 'error' })
    } finally {
      setSaving(false)
    }
  }, [profile, saving])

  function toggleSection(id: SectionId) {
    setOpenSection(s => s === id ? 'empresa' : id)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-violet-400" />
      </div>
    )
  }

  const sections: Array<{
    id: SectionId
    icon: React.ComponentType<{ size?: number; className?: string }>
    title: string
    subtitle: string
    color: string
  }> = [
    { id: 'empresa',       icon: Building2,    title: 'Perfil da Empresa',   subtitle: 'Nome, setor, redes sociais e contatos',   color: '#6366f1' },
    { id: 'branding',      icon: Palette,       title: 'Branding',            subtitle: 'Logo, banner, ícone e cores da marca',    color: '#8b5cf6' },
    { id: 'ia',            icon: Bot,           title: 'Identidade da IA',    subtitle: 'Nome, cargo e estilo de comunicação da IA', color: '#06b6d4' },
    { id: 'comunicacao',   icon: Mail,          title: 'Comunicação',         subtitle: 'Remetente de email e assinatura',         color: '#10b981' },
    { id: 'personalizacao',icon: Target,        title: 'Personalização',      subtitle: 'Nicho, tipo de cliente e objetivo',       color: '#f59e0b' },
    { id: 'preview',       icon: Eye,           title: 'Preview ao Vivo',     subtitle: 'Veja como sua marca aparece em cada módulo', color: '#ec4899' },
  ]

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-white">Perfil e Identidade da Empresa</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Configure como sua empresa aparece em todos os módulos do NEXUS.
          </p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className={cn(
            'flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold text-white transition-all',
            saving ? 'bg-zinc-700 cursor-not-allowed' : 'bg-violet-600 hover:bg-violet-500',
          )}
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          {saving ? 'Salvando…' : 'Salvar Perfil'}
        </button>
      </div>

      {/* Sections */}
      {sections.map(s => (
        <Section
          key={s.id}
          {...s}
          active={openSection === s.id}
          onToggle={toggleSection}
        >
          {s.id === 'empresa' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nome da empresa *">
                <input className={inputCls} value={profile.name ?? ''} onChange={e => set('name', e.target.value)} placeholder="Minha Empresa Ltda" />
              </Field>
              <Field label="Nome fantasia / marca">
                <input className={inputCls} value={profile.fantasy_name ?? ''} onChange={e => set('fantasy_name', e.target.value)} placeholder="Minha Empresa" />
              </Field>
              <Field label="Setor / segmento">
                <input className={inputCls} value={profile.sector ?? ''} onChange={e => set('sector', e.target.value)} placeholder="Tecnologia, Saúde, Educação…" />
              </Field>
              <Field label="Slogan">
                <input className={inputCls} value={profile.slogan ?? ''} onChange={e => set('slogan', e.target.value)} placeholder="Frase que define sua empresa" />
              </Field>
              <Field label="Descrição" hint="Usada pela IA para contextualizar respostas">
                <textarea rows={3} className={textareaCls} value={profile.description ?? ''} onChange={e => set('description', e.target.value)} placeholder="Descreva o que sua empresa faz…" />
              </Field>
              <div className="flex flex-col gap-4">
                <Field label="Website">
                  <div className="flex items-center gap-2">
                    <Globe size={14} className="shrink-0 text-zinc-500" />
                    <input className={cn(inputCls, 'flex-1')} value={profile.website ?? ''} onChange={e => set('website', e.target.value)} placeholder="https://suaempresa.com.br" />
                  </div>
                </Field>
                <Field label="Instagram">
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-xs font-bold text-zinc-500">@</span>
                    <input className={cn(inputCls, 'flex-1')} value={profile.instagram ?? ''} onChange={e => set('instagram', e.target.value)} placeholder="suaempresa" />
                  </div>
                </Field>
                <Field label="WhatsApp comercial">
                  <div className="flex items-center gap-2">
                    <Phone size={14} className="shrink-0 text-zinc-500" />
                    <input className={cn(inputCls, 'flex-1')} value={profile.whatsapp_commercial ?? ''} onChange={e => set('whatsapp_commercial', e.target.value)} placeholder="5511999999999" />
                  </div>
                </Field>
              </div>
            </div>
          )}

          {s.id === 'branding' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <ImageUploader
                  label="Logo principal"
                  kind="logo"
                  currentUrl={profile.logo_url}
                  onUploaded={url => { set('logo_url', url); void save() }}
                />
                <ImageUploader
                  label="Banner / capa"
                  kind="banner"
                  currentUrl={profile.banner_url}
                  onUploaded={url => { set('banner_url', url); void save() }}
                />
                <ImageUploader
                  label="Ícone / favicon"
                  kind="icon"
                  currentUrl={profile.icon_url}
                  onUploaded={url => { set('icon_url', url); void save() }}
                />
              </div>
              <div className="border-t border-zinc-800/60" />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <Field label="Nome da marca (exibido)">
                  <input className={inputCls} value={profile.brand_name ?? ''} onChange={e => set('brand_name', e.target.value)} placeholder="Minha Empresa" />
                </Field>
                <ColorField label="Cor primária" value={profile.brand_color ?? '#6366f1'} onChange={v => set('brand_color', v)} />
                <ColorField label="Cor secundária" value={profile.secondary_color ?? '#8b5cf6'} onChange={v => set('secondary_color', v)} />
              </div>

              {/* Live color preview */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 space-y-2">
                <p className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider">Prévia das cores</p>
                <div className="flex items-center gap-3">
                  <div className="h-8 flex-1 rounded-lg" style={{ background: profile.brand_color || '#6366f1' }} />
                  <div className="h-8 flex-1 rounded-lg" style={{ background: profile.secondary_color || '#8b5cf6' }} />
                  <div className="h-8 flex-1 rounded-lg bg-zinc-800" />
                </div>
                <div className="flex gap-2">
                  <button className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ background: profile.brand_color || '#6366f1' }}>
                    Botão primário
                  </button>
                  <button className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white" style={{ background: profile.secondary_color || '#8b5cf6' }}>
                    Botão secundário
                  </button>
                </div>
              </div>
            </div>
          )}

          {s.id === 'ia' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Nome da IA" hint="Aparece em chats e notificações">
                  <div className="flex items-center gap-2">
                    <Bot size={14} className="shrink-0 text-cyan-400" />
                    <input className={cn(inputCls, 'flex-1')} value={profile.ai_name ?? ''} onChange={e => set('ai_name', e.target.value)} placeholder="NEXUS IA" />
                  </div>
                </Field>
                <Field label="Cargo / função da IA" hint="Ex: Assistente de Vendas, Consultora Financeira">
                  <div className="flex items-center gap-2">
                    <User size={14} className="shrink-0 text-cyan-400" />
                    <input className={cn(inputCls, 'flex-1')} value={profile.ai_role ?? ''} onChange={e => set('ai_role', e.target.value)} placeholder="Assistente Inteligente" />
                  </div>
                </Field>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400 block mb-2">Estilo de comunicação</label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
                  {AI_STYLES.map(style => {
                    const active = (profile.ai_style ?? 'profissional') === style.value
                    return (
                      <button
                        key={style.value}
                        onClick={() => set('ai_style', style.value)}
                        className={cn(
                          'rounded-xl border p-3 text-left transition-all',
                          active
                            ? 'border-cyan-500/50 bg-cyan-500/10 text-cyan-300'
                            : 'border-zinc-700/50 bg-zinc-800/40 text-zinc-400 hover:border-zinc-600',
                        )}
                      >
                        <p className="text-xs font-semibold">{style.label}</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5 leading-snug">{style.desc}</p>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {s.id === 'comunicacao' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Nome do remetente">
                <input className={inputCls} value={profile.sender_name ?? ''} onChange={e => set('sender_name', e.target.value)} placeholder="Minha Empresa" />
              </Field>
              <Field label="Email do remetente" hint="Requer domínio verificado no Resend ou SMTP">
                <input type="email" className={inputCls} value={profile.sender_email ?? ''} onChange={e => set('sender_email', e.target.value)} placeholder="noreply@suaempresa.com.br" />
              </Field>
              <Field label="Email de suporte">
                <input type="email" className={inputCls} value={profile.support_email ?? ''} onChange={e => set('support_email', e.target.value)} placeholder="suporte@suaempresa.com.br" />
              </Field>
              <Field label="Reply-To">
                <input type="email" className={inputCls} value={profile.reply_to_email ?? ''} onChange={e => set('reply_to_email', e.target.value)} placeholder="contato@suaempresa.com.br" />
              </Field>
              <div className="col-span-full">
                <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
                  <Mail size={14} className="text-emerald-400 shrink-0" />
                  <p className="text-xs text-zinc-400">
                    Para configurar SMTP personalizado ou domínio Resend, acesse{' '}
                    <a href="/dashboard/settings/business-identity" className="text-violet-400 underline underline-offset-2">
                      Identidade da empresa
                    </a>.
                  </p>
                </div>
              </div>
            </div>
          )}

          {s.id === 'personalizacao' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Nicho de mercado" hint="Ex: Marketing Digital, Clínicas, Infoprodutos">
                  <input className={inputCls} value={profile.niche ?? ''} onChange={e => set('niche', e.target.value)} placeholder="Infoprodutos, SaaS, Consultoria…" />
                </Field>
                <Field label="Tipo de cliente ideal">
                  <input className={inputCls} value={profile.client_type ?? ''} onChange={e => set('client_type', e.target.value)} placeholder="PMEs, Empreendedores, CLTs…" />
                </Field>
              </div>
              <Field label="Objetivo principal da empresa" hint="A IA usará isso para contextualizar suas respostas">
                <textarea rows={2} className={textareaCls} value={profile.company_objective ?? ''} onChange={e => set('company_objective', e.target.value)} placeholder="Ajudar empresas a automatizar seus processos de vendas e retenção…" />
              </Field>
              <Field label="Tom de comunicação preferido" hint="Orienta a IA sobre como se comunicar com seus clientes">
                <textarea rows={2} className={textareaCls} value={profile.communication_tone ?? ''} onChange={e => set('communication_tone', e.target.value)} placeholder="Direto, descontraído mas profissional, evitando termos muito técnicos…" />
              </Field>

              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles size={13} className="text-amber-400" />
                  <p className="text-xs font-semibold text-amber-300">Como isso é usado</p>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  Nicho, tipo de cliente, objetivo e tom são injetados no prompt do assistente IA, tornando as respostas mais precisas e alinhadas com o seu negócio.
                </p>
              </div>
            </div>
          )}

          {s.id === 'preview' && (
            <LivePreview profile={profile} />
          )}
        </Section>
      ))}

      {/* Bottom save */}
      <div className="flex justify-end pt-2">
        <button
          onClick={save}
          disabled={saving}
          className={cn(
            'flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition-all',
            saving ? 'bg-zinc-700 cursor-not-allowed' : 'bg-violet-600 hover:bg-violet-500',
          )}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {saving ? 'Salvando…' : 'Salvar todas as alterações'}
        </button>
      </div>

      {toast && (
        <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  )
}
