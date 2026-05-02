'use client'

import { AnimatePresence, motion, useMotionValue, useTransform } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'welcome' | 'loading' | 'simulating' | 'results'

interface SimStep {
  id:       number
  icon:     string
  title:    string
  subtitle: string
  tooltip:  string   // educational overlay text
  logs:     string[]
  startMs:  number
  endMs:    number
}

interface DemoData {
  demoId:      string
  customerId:  string
  invoiceId:   string
  paymentLink: string
  existing:    boolean
}

// ─── Simulation timeline ──────────────────────────────────────────────────────
// 6 steps, total ~14s of live animation

const STEPS: SimStep[] = [
  {
    id:       1,
    icon:     '📄',
    title:    'Fatura criada',
    subtitle: 'Aqui criamos uma cobrança automaticamente',
    tooltip:  'O NEXUS gera faturas com todos os dados preenchidos. Sem planilha, sem cópia e cola. Zero esforço manual.',
    logs: [
      'Iniciando módulo de faturamento automático...',
      'Cliente identificado: Cliente Teste',
      'Valor: R$ 2.500,00 | Vencimento: 30 dias',
      '✓ Fatura #INV-0041 criada e registrada',
    ],
    startMs: 0,
    endMs:   2000,
  },
  {
    id:       2,
    icon:     '🔗',
    title:    'Link de pagamento gerado',
    subtitle: 'Link único e rastreável criado em milissegundos',
    tooltip:  'Cada link é individual, rastreável e expira em 48h. Você sabe exatamente quando o cliente acessou — antes de ligar.',
    logs: [
      'Acionando gateway de pagamento...',
      'Gerando sessão de checkout segura...',
      'pay.nexus.app/inv-0041-ct',
      '✓ Link ativo | Rastreamento: habilitado | Expira: 48h',
    ],
    startMs: 2500,
    endMs:   4200,
  },
  {
    id:       3,
    icon:     '🤖',
    title:    'IA detectou oportunidade',
    subtitle: 'A IA detectou um cliente em risco',
    tooltip:  'Nosso motor analisa 47 variáveis para prever inadimplência com 87% de precisão — e age antes que você precise lembrar.',
    logs: [
      'Motor IA inicializando análise de risco...',
      'Processando histórico de 12 meses de pagamentos...',
      'Score de risco: 8.4/10 | Prob. pagamento: 71%',
      '→ Decisão: cobrança imediata via WhatsApp',
    ],
    startMs: 4800,
    endMs:   7000,
  },
  {
    id:       4,
    icon:     '💬',
    title:    'Mensagem enviada',
    subtitle: 'Agora estamos enviando uma mensagem personalizada',
    tooltip:  'Mensagens personalizadas têm 3× mais resposta. O NEXUS injeta nome, valor e link — parece que você escreveu.',
    logs: [
      'Selecionando template de cobrança empática...',
      'Injetando variáveis: nome, valor, link de pagamento...',
      'Enviando WhatsApp para +55 (11) 9 9123-4567...',
      '✓ Mensagem entregue às 14:32 | Status: lida',
    ],
    startMs: 7500,
    endMs:   9200,
  },
  {
    id:       5,
    icon:     '📱',
    title:    'Cliente visualizou',
    subtitle: 'O cliente abriu o link e está pronto para pagar',
    tooltip:  'Rastreamento em tempo real. Você recebe uma notificação quando o cliente abre o link — sem precisar perguntar.',
    logs: [
      'Evento de rastreamento recebido...',
      'Link acessado: 14:34:52 | iPhone 14 | São Paulo, SP',
      'Tempo na página de pagamento: 52 segundos',
      '→ Alta probabilidade de conversão detectada',
    ],
    startMs: 9800,
    endMs:   11400,
  },
  {
    id:       6,
    icon:     '💰',
    title:    'Pagamento confirmado!',
    subtitle: 'Receita recuperada. Sem você tocar em nada.',
    tooltip:  'O dinheiro cai, o cliente é marcado como regularizado e você recebe uma notificação. Do começo ao fim: automático.',
    logs: [
      'Webhook de pagamento recebido...',
      'Transação aprovada: R$ 2.500,00 | Visa ****4521',
      'Fatura #INV-0041 → Status: PAGO ✓',
      '🎉 Cliente Teste regularizado — R$ 2.500,00 recuperados!',
    ],
    startMs: 12000,
    endMs:   14200,
  },
]

const TOTAL_DURATION_MS = STEPS[STEPS.length - 1].endMs

// ─── Revenue counter ──────────────────────────────────────────────────────────

function RevenueCounter({ target, active }: { target: number; active: boolean }) {
  const [value, setValue] = useState(0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    if (!active) return
    const duration = 2000
    const startTime = performance.now()

    const tick = (now: number) => {
      const t = Math.min((now - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3) // ease-out cubic
      setValue(Math.round(eased * target))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [active, target])

  return (
    <span className="tabular-nums font-black">
      R${value.toLocaleString('pt-BR')}
    </span>
  )
}

// ─── Terminal log panel ───────────────────────────────────────────────────────

function Terminal({ lines }: { lines: string[] }) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [lines])

  return (
    <div className="rounded-xl overflow-hidden border border-white/8 bg-[#0c1014] shadow-xl">
      {/* title bar */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 bg-[#14191f] border-b border-white/5">
        <div className="w-3 h-3 rounded-full bg-[#ff5f57]" />
        <div className="w-3 h-3 rounded-full bg-[#febc2e]" />
        <div className="w-3 h-3 rounded-full bg-[#28c840]" />
        <span className="ml-3 text-[10px] text-white/25 font-mono tracking-wide">
          nexus-engine — live
        </span>
      </div>
      {/* log body */}
      <div className="p-4 h-[168px] overflow-y-auto space-y-1.5 scrollbar-thin">
        <AnimatePresence initial={false}>
          {lines.map((line, i) => (
            <motion.div
              key={`${i}-${line}`}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.18 }}
              className="flex gap-2 font-mono text-[11px] leading-relaxed"
            >
              <span className="shrink-0 text-white/20 select-none">
                {new Date().toLocaleTimeString('pt-BR', {
                  hour: '2-digit', minute: '2-digit', second: '2-digit',
                })}
              </span>
              <span className={line.startsWith('✓') || line.startsWith('🎉') ? 'text-emerald-400' : line.startsWith('→') ? 'text-indigo-400' : 'text-green-400/80'}>
                {line}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={endRef} />
      </div>
    </div>
  )
}

// ─── Step list ────────────────────────────────────────────────────────────────

function StepRow({
  step,
  status,
}: {
  step:   SimStep
  status: 'pending' | 'active' | 'done'
}) {
  return (
    <motion.div
      layout
      className={[
        'flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-300',
        status === 'done'    ? 'border-emerald-500/25 bg-emerald-500/5'    : '',
        status === 'active'  ? 'border-indigo-400/40 bg-indigo-500/8 shadow-[0_0_16px_rgba(99,102,241,0.08)]' : '',
        status === 'pending' ? 'border-transparent opacity-35'             : '',
      ].join(' ')}
    >
      {/* icon / check */}
      <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-sm"
        style={{
          background: status === 'done'   ? 'rgba(16,185,129,0.12)'  :
                      status === 'active' ? 'rgba(99,102,241,0.15)' :
                      'rgba(255,255,255,0.03)',
        }}
      >
        {status === 'done' ? (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-emerald-400 text-base">✓</motion.span>
        ) : (
          <span>{step.icon}</span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${
          status === 'done'    ? 'text-emerald-400' :
          status === 'active'  ? 'text-white'       :
          'text-white/35'
        }`}>
          {step.title}
        </p>
        {status !== 'pending' && (
          <p className="text-[11px] text-white/35 truncate mt-0.5">{step.subtitle}</p>
        )}
      </div>

      {status === 'active' && (
        <motion.div
          className="shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-400"
          animate={{ opacity: [1, 0.25, 1] }}
          transition={{ repeat: Infinity, duration: 0.9 }}
        />
      )}
    </motion.div>
  )
}

// ─── Per-step visual cards ────────────────────────────────────────────────────

function InvoiceCard() {
  const rows = [
    ['Cliente',    'Cliente Teste'],
    ['Valor',      'R$ 2.500,00'],
    ['Vencimento', '30 dias'],
    ['Status',     'Pendente'],
  ]
  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">Fatura gerada</p>
          <p className="text-xl font-bold text-white">#INV-0041</p>
        </div>
        <motion.span
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.6, type: 'spring' }}
          className="px-3 py-1 rounded-full text-xs font-medium border border-indigo-500/30 bg-indigo-500/10 text-indigo-300"
        >
          Gerada ✓
        </motion.span>
      </div>
      <div className="space-y-2.5">
        {rows.map(([label, val], i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + i * 0.1 }}
            className="flex items-center justify-between"
          >
            <span className="text-sm text-white/35">{label}</span>
            <span className={`text-sm font-medium ${label === 'Valor' ? 'text-white' : 'text-white/65'}`}>{val}</span>
          </motion.div>
        ))}
      </div>
      <motion.div
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.7, duration: 0.6 }}
        style={{ originX: 0 }}
        className="h-px bg-gradient-to-r from-indigo-500/60 to-transparent"
      />
      <p className="text-[11px] text-white/25">Criado automaticamente pelo NEXUS em 0.3s</p>
    </div>
  )
}

function PaymentLinkCard({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)
  const displayUrl = url.length > 38 ? url.slice(0, 38) + '…' : url

  const copy = () => {
    navigator.clipboard.writeText(url).catch(() => undefined)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-6 space-y-5">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">Link de pagamento</p>
        <p className="text-lg font-bold text-white">Gerado em tempo real</p>
      </div>
      <div className="rounded-xl border border-white/8 bg-[#0c1014] p-4 space-y-3">
        <div className="flex items-center gap-2">
          <span className="shrink-0 w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <p className="text-[11px] font-mono text-indigo-300 break-all">{displayUrl}</p>
        </div>
        <div className="flex gap-2 text-[10px] text-white/30">
          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/8">Único</span>
          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/8">Expira 48h</span>
          <span className="px-2 py-0.5 rounded bg-white/5 border border-white/8">Rastreável</span>
        </div>
      </div>
      <button
        onClick={copy}
        className="w-full py-2.5 rounded-xl border border-white/10 bg-white/4 hover:bg-white/8 text-sm text-white/70 transition-colors"
      >
        {copied ? '✓ Copiado!' : '📋 Copiar link'}
      </button>
    </div>
  )
}

function AICard() {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-violet-500/15 border border-violet-500/20 flex items-center justify-center text-lg">
          🤖
        </div>
        <div>
          <p className="text-sm font-semibold text-white">Motor de IA NEXUS</p>
          <p className="text-[11px] text-white/35">Analisando padrões de pagamento</p>
        </div>
      </div>

      {[
        { label: 'Score de risco',       value: 84, color: 'bg-amber-400',   text: '8.4/10' },
        { label: 'Prob. pagamento hoje', value: 71, color: 'bg-indigo-400',  text: '71%'    },
        { label: 'Confiança da análise', value: 93, color: 'bg-emerald-400', text: '93%'    },
      ].map(({ label, value, color, text }, i) => (
        <div key={label} className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-white/45">{label}</span>
            <span className="text-white/80 font-medium">{text}</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${color}`}
              initial={{ width: 0 }}
              animate={{ width: `${value}%` }}
              transition={{ delay: 0.2 + i * 0.2, duration: 0.8, ease: 'easeOut' }}
            />
          </div>
        </div>
      ))}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="rounded-xl border border-amber-500/20 bg-amber-500/6 px-4 py-3"
      >
        <p className="text-xs text-amber-300/90">
          → Ação recomendada: <strong>cobrança imediata via WhatsApp</strong>
        </p>
      </motion.div>
    </div>
  )
}

function MessageCard() {
  const lines = [
    { text: 'Olá, Cliente Teste! 👋', delay: 0.1 },
    { text: 'Sua fatura de *R$ 2.500,00* está disponível.', delay: 0.5 },
    { text: 'Pague agora e evite juros:', delay: 0.9 },
    { text: '🔗 pay.nexus.app/inv-0041-ct', delay: 1.2, link: true },
  ]

  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-6 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/20 flex items-center justify-center text-sm">N</div>
        <div>
          <p className="text-xs font-semibold text-white">NEXUS Automation</p>
          <p className="text-[10px] text-emerald-400">● Online</p>
        </div>
      </div>

      <div className="rounded-xl bg-[#0c1014] border border-white/5 p-4 space-y-2">
        {lines.map(({ text, delay, link }, i) => (
          <motion.p
            key={i}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay }}
            className={`text-sm leading-relaxed ${link ? 'text-indigo-400 underline' : 'text-white/75'}`}
          >
            {text}
          </motion.p>
        ))}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6 }}
          className="text-[10px] text-white/25 pt-1"
        >
          ✓✓ Entregue às 14:32 · WhatsApp Business
        </motion.p>
      </div>
    </div>
  )
}

function ClientViewedCard() {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-white/30 mb-1">Rastreamento ao vivo</p>
          <p className="text-lg font-bold text-white">Link acessado</p>
        </div>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', delay: 0.3 }}
          className="w-10 h-10 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center"
        >
          <span className="text-lg">👁️</span>
        </motion.div>
      </div>

      {[
        ['Dispositivo', 'iPhone 14 Pro'],
        ['Localização', 'São Paulo, SP'],
        ['Acessado às', '14:34:52'],
        ['Tempo na página', '52 segundos'],
      ].map(([k, v], i) => (
        <motion.div
          key={k}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 + i * 0.1 }}
          className="flex justify-between text-sm"
        >
          <span className="text-white/35">{k}</span>
          <span className="text-white/75 font-medium">{v}</span>
        </motion.div>
      ))}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="rounded-xl border border-emerald-500/20 bg-emerald-500/6 px-4 py-3"
      >
        <p className="text-xs text-emerald-300/90">
          → Alta probabilidade de conversão detectada
        </p>
      </motion.div>
    </div>
  )
}

function PaymentSuccessCard({ active }: { active: boolean }) {
  return (
    <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-6 space-y-5">
      <div className="text-center py-2">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
          className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center text-3xl mx-auto mb-4"
        >
          ✅
        </motion.div>
        <p className="text-sm text-emerald-400/80 mb-1">Receita recuperada</p>
        <p className="text-4xl font-black text-emerald-400">
          <RevenueCounter target={2500} active={active} />
        </p>
      </div>

      {[
        ['Método',   'Visa ****4521'],
        ['Processado em', '1.3 segundos'],
        ['Cliente',  'Regularizado ✓'],
      ].map(([k, v], i) => (
        <motion.div
          key={k}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 + i * 0.15 }}
          className="flex justify-between text-sm"
        >
          <span className="text-white/35">{k}</span>
          <span className="text-emerald-300/80 font-medium">{v}</span>
        </motion.div>
      ))}
    </div>
  )
}

// ─── Step visual switcher ─────────────────────────────────────────────────────

function StepVisual({
  stepId,
  paymentLink,
  paymentActive,
}: {
  stepId:        number
  paymentLink:   string
  paymentActive: boolean
}) {
  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={stepId}
        initial={{ opacity: 0, y: 12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0,  scale: 1    }}
        exit={{ opacity: 0, y: -12,   scale: 0.98 }}
        transition={{ duration: 0.3 }}
      >
        {stepId === 1 && <InvoiceCard />}
        {stepId === 2 && <PaymentLinkCard url={paymentLink || 'pay.nexus.app/inv-0041-ct'} />}
        {stepId === 3 && <AICard />}
        {stepId === 4 && <MessageCard />}
        {stepId === 5 && <ClientViewedCard />}
        {stepId === 6 && <PaymentSuccessCard active={paymentActive} />}
      </motion.div>
    </AnimatePresence>
  )
}

// ─── Confetti ─────────────────────────────────────────────────────────────────

function Confetti({ active }: { active: boolean }) {
  if (!active) return null
  const palette = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#f97316']

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-50">
      {Array.from({ length: 32 }, (_, i) => {
        const color = palette[i % palette.length]
        const size  = 5 + Math.random() * 9
        return (
          <motion.div
            key={i}
            className="absolute rounded-sm"
            style={{
              left:       `${Math.random() * 100}%`,
              top:        '-12px',
              width:      size,
              height:     size,
              background: color,
            }}
            initial={{ y: 0, rotate: 0, opacity: 1 }}
            animate={{ y: '105vh', rotate: Math.random() > 0.5 ? 540 : -540, opacity: 0 }}
            transition={{ duration: 2.2 + Math.random() * 1.2, delay: Math.random() * 0.5, ease: 'easeIn' }}
          />
        )
      })}
    </div>
  )
}

// ─── Welcome screen ───────────────────────────────────────────────────────────

function WelcomeScreen({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center"
         style={{ background: 'var(--nexus-bg)' }}>
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55 }}
        className="max-w-xl w-full"
      >
        {/* badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-8 text-xs font-medium"
          style={{
            background: 'rgba(108,92,231,0.12)',
            border:     '1px solid rgba(108,92,231,0.25)',
            color:      'var(--nexus-primary)',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--nexus-primary)] animate-pulse inline-block" />
          Demonstração ao vivo — 30 segundos
        </motion.div>

        <h1 className="text-4xl sm:text-5xl font-black mb-5 leading-tight"
            style={{ color: 'var(--nexus-text)' }}>
          Veja o NEXUS recuperar
          <br />
          <span style={{ color: 'var(--nexus-secondary)' }}>R$2.500 em tempo real</span>
        </h1>

        <p className="text-base mb-10 leading-relaxed max-w-md mx-auto"
           style={{ color: 'var(--nexus-textMuted)' }}>
          Criamos um cenário de demonstração com um cliente inadimplente e
          vamos simular cada etapa da recuperação automática — do zero ao pagamento.
        </p>

        {/* preview cards */}
        <div className="grid grid-cols-3 gap-3 mb-10">
          {[
            { icon: '📄', label: 'Fatura criada' },
            { icon: '🤖', label: 'IA analisa risco' },
            { icon: '💰', label: 'Pagamento confirmado' },
          ].map(({ icon, label }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 + i * 0.1 }}
              className="rounded-xl p-4 text-center border"
              style={{ background: 'var(--nexus-card)', borderColor: 'var(--nexus-border)' }}
            >
              <div className="text-2xl mb-2">{icon}</div>
              <p className="text-[11px]" style={{ color: 'var(--nexus-textMuted)' }}>{label}</p>
            </motion.div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <motion.button
            onClick={onStart}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="px-8 py-4 rounded-xl font-semibold text-sm text-white shadow-lg transition-colors"
            style={{ background: 'var(--nexus-primary)', boxShadow: '0 0 24px rgba(108,92,231,0.25)' }}
          >
            ▶ Iniciar simulação gratuita
          </motion.button>
        </div>

        <button
          onClick={onSkip}
          className="mt-6 text-sm underline underline-offset-2 transition-colors hover:opacity-80"
          style={{ color: 'var(--nexus-textMuted)' }}
        >
          Pular demo — ir direto para o dashboard
        </button>
      </motion.div>
    </div>
  )
}

// ─── Loading screen ───────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center"
         style={{ background: 'var(--nexus-bg)' }}>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center space-y-4"
      >
        <div className="w-10 h-10 rounded-full border-2 border-transparent animate-spin mx-auto"
             style={{ borderTopColor: 'var(--nexus-primary)' }} />
        <p className="text-sm" style={{ color: 'var(--nexus-textMuted)' }}>
          Preparando ambiente de demonstração...
        </p>
      </motion.div>
    </div>
  )
}

// ─── Simulation screen ────────────────────────────────────────────────────────

function SimScreen({
  demoData,
  activeStep,
  completed,
  logs,
  paymentActive,
  phase,
}: {
  demoData:      DemoData | null
  activeStep:    number
  completed:     Set<number>
  logs:          string[]
  paymentActive: boolean
  phase:         Phase
}) {
  const progress  = (completed.size / STEPS.length) * 100
  const stepObj   = STEPS.find(s => s.id === activeStep)
  const tooltip   = stepObj?.tooltip ?? (phase === 'results' ? 'Automação concluída. Zero intervenção manual.' : '')
  const visStepId = activeStep > 0 ? activeStep : completed.size > 0 ? Math.max(...completed) : 0

  return (
    <div className="min-h-screen py-8 px-4" style={{ background: 'var(--nexus-bg)' }}>
      <div className="max-w-5xl mx-auto space-y-6">

        {/* ── Header ────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] mb-3"
               style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--nexus-textMuted)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
            NEXUS Automation Engine — rodando ao vivo
          </div>
          <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--nexus-text)' }}>
            Recuperação automática de inadimplente
          </h2>
          <p className="text-sm" style={{ color: 'var(--nexus-textMuted)' }}>
            Cliente Teste · Fatura R$2.500 · Vencida há 15 dias
          </p>
        </motion.div>

        {/* ── Progress bar ──────────────────────────────────────────────── */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs" style={{ color: 'var(--nexus-textMuted)' }}>
            <span>Progresso da automação</span>
            <span>{completed.size} / {STEPS.length} etapas</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, var(--nexus-primary), var(--nexus-secondary))' }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {/* ── Educational tooltip ───────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {tooltip && (
            <motion.div
              key={tooltip}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25 }}
              className="flex items-start gap-3 px-4 py-3 rounded-xl border text-sm"
              style={{
                background:   'rgba(108,92,231,0.06)',
                borderColor:  'rgba(108,92,231,0.2)',
                color:        '#a5b4fc',
              }}
            >
              <span className="shrink-0 mt-0.5">💡</span>
              <span>{tooltip}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Main 2-col grid ───────────────────────────────────────────── */}
        <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">

          {/* Visual card */}
          <div className="space-y-4">
            {visStepId > 0 ? (
              <StepVisual
                stepId={visStepId}
                paymentLink={demoData?.paymentLink ?? ''}
                paymentActive={paymentActive}
              />
            ) : (
              <div className="rounded-2xl border border-white/5 bg-white/2 h-52 flex items-center justify-center">
                <p className="text-sm" style={{ color: 'var(--nexus-textMuted)' }}>Aguardando início...</p>
              </div>
            )}

            {/* Terminal */}
            <Terminal lines={logs} />
          </div>

          {/* Step list */}
          <div className="space-y-1.5">
            <p className="text-[10px] uppercase tracking-widest mb-3" style={{ color: 'var(--nexus-textMuted)' }}>
              Etapas de automação
            </p>
            {STEPS.map(step => {
              const isDone   = completed.has(step.id)
              const isActive = !isDone && activeStep === step.id
              return (
                <StepRow
                  key={step.id}
                  step={step}
                  status={isDone ? 'done' : isActive ? 'active' : 'pending'}
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Results screen ───────────────────────────────────────────────────────────

function ResultsScreen({
  onDashboard,
  onPayments,
  onRestart,
  loading,
}: {
  onDashboard: () => void
  onPayments:  () => void
  onRestart:   () => void
  loading:     boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mt-8 pb-12 px-4"
    >
      <div className="max-w-xl mx-auto text-center space-y-6">
        <div className="rounded-2xl border px-6 py-5 text-sm"
             style={{ background: 'var(--nexus-card)', borderColor: 'var(--nexus-border)' }}>
          <p className="text-lg font-bold mb-2" style={{ color: 'var(--nexus-text)' }}>
            Você acabou de ver o NEXUS gerar receita automaticamente.
          </p>
          <p style={{ color: 'var(--nexus-textMuted)' }}>
            R$2.500 recuperados em menos de 15 segundos — sem uma única ação manual.
            É exatamente assim que funciona com seus clientes reais.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <motion.button
            onClick={onDashboard}
            disabled={loading}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="px-8 py-4 rounded-xl font-semibold text-white text-sm disabled:opacity-60 transition-colors shadow-lg"
            style={{ background: 'var(--nexus-primary)', boxShadow: '0 0 24px rgba(108,92,231,0.3)' }}
          >
            {loading ? 'Abrindo dashboard...' : '🚀 Usar com meus clientes reais'}
          </motion.button>

          <motion.button
            onClick={onPayments}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="px-8 py-4 rounded-xl font-medium text-sm border transition-colors"
            style={{
              background:  'rgba(255,255,255,0.04)',
              borderColor: 'rgba(255,255,255,0.1)',
              color:       'var(--nexus-text)',
            }}
          >
            💳 Conectar pagamentos
          </motion.button>
        </div>

        <button
          onClick={onRestart}
          className="text-sm underline underline-offset-2 transition-opacity hover:opacity-70"
          style={{ color: 'var(--nexus-textMuted)' }}
        >
          ↺ Repetir demo
        </button>
      </div>
    </motion.div>
  )
}

// ─── Main orchestrator ────────────────────────────────────────────────────────

export default function OnboardingDemoPage() {
  const router = useRouter()

  const [phase,         setPhase]    = useState<Phase>('welcome')
  const [demoData,      setDemoData] = useState<DemoData | null>(null)
  const [activeStep,    setActive]   = useState(-1)
  const [completed,     setDone]     = useState<Set<number>>(new Set())
  const [logs,          setLogs]     = useState<string[]>([])
  const [paymentActive, setRevenue]  = useState(false)
  const [confetti,      setConfetti] = useState(false)
  const [marking,       setMarking]  = useState(false)

  const timers = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearAll = useCallback(() => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }, [])

  // ── Simulation engine ────────────────────────────────────────────────────
  const runSimulation = useCallback(() => {
    setActive(-1)
    setDone(new Set())
    setLogs([])
    setRevenue(false)
    setConfetti(false)

    STEPS.forEach(step => {
      // Activate step
      const t1 = setTimeout(() => {
        setActive(step.id)
        setLogs(prev => [...prev, step.logs[0]])
      }, step.startMs)

      // Stream remaining log lines
      step.logs.slice(1).forEach((line, li) => {
        const t = setTimeout(() => {
          setLogs(prev => [...prev, line])
        }, step.startMs + 350 + li * 380)
        timers.current.push(t)
      })

      // Complete step
      const t2 = setTimeout(() => {
        setDone(prev => new Set([...prev, step.id]))
        setActive(prev => prev === step.id ? -1 : prev)
      }, step.endMs)

      timers.current.push(t1, t2)
    })

    // Celebration after last step
    const finalMs = STEPS[STEPS.length - 1].endMs + 400
    const tCelebration = setTimeout(() => {
      setRevenue(true)
      setConfetti(true)
      setTimeout(() => setConfetti(false), 3200)
      setTimeout(() => setPhase('results'), 1200)
    }, finalMs)

    timers.current.push(tCelebration)
  }, [])

  // ── Init: call API then start simulation ─────────────────────────────────
  const initDemo = useCallback(async () => {
    setPhase('loading')
    try {
      const res  = await fetch('/api/onboarding/demo', { method: 'POST' })
      const data = await res.json() as DemoData
      setDemoData(data)
    } catch {
      // proceed with null demoData — links degrade gracefully
    }
    setPhase('simulating')
    runSimulation()
  }, [runSimulation])

  const restart = useCallback(() => {
    clearAll()
    setPhase('simulating')
    runSimulation()
  }, [clearAll, runSimulation])

  const goToDashboard = useCallback(async () => {
    setMarking(true)
    try { await fetch('/api/onboarding/complete', { method: 'POST' }) } catch { /* non-blocking */ }
    router.push('/dashboard')
  }, [router])

  const goToPayments = useCallback(() => router.push('/dashboard/settings'), [router])

  const skipToReal = useCallback(async () => {
    try { await fetch('/api/onboarding/complete', { method: 'POST' }) } catch { /* non-blocking */ }
    router.push('/dashboard')
  }, [router])

  useEffect(() => () => clearAll(), [clearAll])

  // ── Render ───────────────────────────────────────────────────────────────

  if (phase === 'welcome') return <WelcomeScreen onStart={initDemo} onSkip={skipToReal} />
  if (phase === 'loading') return <LoadingScreen />

  return (
    <>
      <Confetti active={confetti} />

      <SimScreen
        demoData={demoData}
        activeStep={activeStep}
        completed={completed}
        logs={logs}
        paymentActive={paymentActive}
        phase={phase}
      />

      <AnimatePresence>
        {phase === 'results' && (
          <ResultsScreen
            onDashboard={goToDashboard}
            onPayments={goToPayments}
            onRestart={restart}
            loading={marking}
          />
        )}
      </AnimatePresence>
    </>
  )
}
