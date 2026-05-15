'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/lib/auth-provider'
import { getSupabaseClient } from '@/lib/supabase'
import {
  Building2, Users, Target, ChevronRight,
  CheckCircle, Zap, Brain, BarChart3, Shield,
  ArrowRight, Sparkles,
} from 'lucide-react'

// ─── Types ─────────────────────────────────────────────────────

type Screen = 'welcome' | 'setup' | 'activating' | 'ready'

const SETORES = [
  'E-commerce', 'Serviços', 'Tech / SaaS', 'Consultoria',
  'Varejo', 'Saúde', 'Educação', 'Alimentação', 'Outro',
]

const SIZES = ['1-5', '6-20', '21-50', '51-200', '200+']

const ACTIVATION_STEPS = [
  { label: 'Criando seu perfil empresarial', duration: 900 },
  { label: 'Configurando IA operacional', duration: 1100 },
  { label: 'Conectando módulos financeiros', duration: 800 },
  { label: 'Ativando monitoramento em tempo real', duration: 1000 },
  { label: 'Calibrando análises para seu setor', duration: 900 },
  { label: 'Sistema operacional pronto', duration: 700 },
]

// ─── Particle dot ───────────────────────────────────────────────

function Dot({ x, y, delay }: { x: number; y: number; delay: number }) {
  return (
    <motion.div
      className="absolute w-0.5 h-0.5 rounded-full bg-violet-400/30"
      style={{ left: `${x}%`, top: `${y}%` }}
      animate={{ opacity: [0, 0.6, 0], scale: [0, 1.5, 0] }}
      transition={{ duration: 3, delay, repeat: Infinity, repeatDelay: Math.random() * 4 }}
    />
  )
}

const DOTS = Array.from({ length: 40 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  delay: Math.random() * 4,
}))

// ─── Screen 1: Welcome ─────────────────────────────────────────

function WelcomeScreen({ name, onNext }: { name: string; onNext: () => void }) {
  return (
    <motion.div
      key="welcome"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.6 }}
      className="flex flex-col items-center justify-center text-center max-w-lg"
    >
      {/* Logo glow */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="relative mb-10"
      >
        <div
          className="w-20 h-20 rounded-2xl bg-violet-600 flex items-center justify-center text-white font-black text-3xl"
          style={{ boxShadow: '0 0 60px rgba(124,58,237,0.6), 0 0 120px rgba(124,58,237,0.2)' }}
        >
          N
        </div>
        <motion.div
          className="absolute inset-0 rounded-2xl bg-violet-400/20"
          animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
          transition={{ duration: 2.5, repeat: Infinity }}
        />
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.7 }}
      >
        <p className="text-sm font-medium text-violet-400 uppercase tracking-widest mb-4">
          Acesso liberado
        </p>
        <h1 className="text-4xl font-bold text-white leading-tight mb-4">
          Bem-vindo ao NEXUS{name ? `,` : '.'}<br />
          {name && <span className="text-violet-400">{name}.</span>}
        </h1>
        <p className="text-white/50 text-lg leading-relaxed mb-10">
          Seu sistema operacional empresarial com IA está pronto.<br />
          Vamos configurar tudo em 60 segundos.
        </p>
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.6 }}
        className="w-full space-y-3"
      >
        {/* Feature pills */}
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {[
            { icon: Brain, label: 'IA Operacional' },
            { icon: BarChart3, label: 'Analytics' },
            { icon: Shield, label: 'Monitoramento' },
            { icon: Zap, label: 'Automações' },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/60"
            >
              <Icon className="w-3 h-3 text-violet-400" />
              {label}
            </div>
          ))}
        </div>

        <button
          onClick={onNext}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-base transition-all duration-200"
          style={{ boxShadow: '0 0 30px rgba(124,58,237,0.4)' }}
        >
          Configurar meu sistema
          <ArrowRight className="w-5 h-5" />
        </button>
        <p className="text-xs text-white/20">Leva menos de 60 segundos</p>
      </motion.div>
    </motion.div>
  )
}

// ─── Screen 2: Setup ───────────────────────────────────────────

function SetupScreen({
  onNext,
}: {
  onNext: (data: { empresa: string; setor: string; tamanho: string }) => void
}) {
  const [empresa, setEmpresa]   = useState('')
  const [setor, setSetor]       = useState('')
  const [tamanho, setTamanho]   = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  const canContinue = empresa.trim() && setor && tamanho

  return (
    <motion.div
      key="setup"
      initial={{ opacity: 0, x: 40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-md"
    >
      <div className="mb-8 text-center">
        <p className="text-xs font-medium text-violet-400 uppercase tracking-widest mb-3">
          Configuração rápida
        </p>
        <h2 className="text-2xl font-bold text-white mb-2">Sobre sua empresa</h2>
        <p className="text-white/40 text-sm">3 perguntas. Sem complicação.</p>
      </div>

      <div className="space-y-5">
        {/* Nome */}
        <div>
          <label className="flex items-center gap-2 text-xs font-medium text-white/60 mb-2">
            <Building2 className="w-3.5 h-3.5 text-violet-400" />
            Nome da empresa
          </label>
          <input
            ref={inputRef}
            type="text"
            value={empresa}
            onChange={e => setEmpresa(e.target.value)}
            placeholder="Ex: Vortex Tech"
            className="w-full px-4 py-3.5 rounded-xl bg-white/[0.05] border border-white/10 text-white placeholder-white/20 focus:outline-none focus:border-violet-500/60 focus:bg-white/[0.08] transition-all text-sm"
            onKeyDown={e => e.key === 'Enter' && canContinue && onNext({ empresa, setor, tamanho })}
          />
        </div>

        {/* Setor */}
        <div>
          <label className="flex items-center gap-2 text-xs font-medium text-white/60 mb-2">
            <Target className="w-3.5 h-3.5 text-violet-400" />
            Setor de atuação
          </label>
          <div className="flex flex-wrap gap-2">
            {SETORES.map(s => (
              <button
                key={s}
                onClick={() => setSetor(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  setor === s
                    ? 'bg-violet-600/30 border border-violet-500/50 text-violet-300'
                    : 'bg-white/[0.04] border border-white/[0.08] text-white/50 hover:border-white/20 hover:text-white/70'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Tamanho */}
        <div>
          <label className="flex items-center gap-2 text-xs font-medium text-white/60 mb-2">
            <Users className="w-3.5 h-3.5 text-violet-400" />
            Tamanho do time
          </label>
          <div className="flex gap-2">
            {SIZES.map(s => (
              <button
                key={s}
                onClick={() => setTamanho(s)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-medium transition-all ${
                  tamanho === s
                    ? 'bg-violet-600/30 border border-violet-500/50 text-violet-300'
                    : 'bg-white/[0.04] border border-white/[0.08] text-white/50 hover:border-white/20'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button
        onClick={() => canContinue && onNext({ empresa, setor, tamanho })}
        disabled={!canContinue}
        className="mt-8 w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-violet-600 hover:bg-violet-500 text-white font-semibold transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
        style={canContinue ? { boxShadow: '0 0 30px rgba(124,58,237,0.4)' } : {}}
      >
        Ativar meu NEXUS
        <Sparkles className="w-4 h-4" />
      </button>
    </motion.div>
  )
}

// ─── Screen 3: Activating ──────────────────────────────────────

function ActivatingScreen({ empresa, onDone }: { empresa: string; onDone: () => void }) {
  const [completedSteps, setCompletedSteps] = useState<number[]>([])
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    let total = 0
    ACTIVATION_STEPS.forEach((step, i) => {
      total += step.duration
      const timeout = setTimeout(() => {
        setCompletedSteps(prev => [...prev, i])
        setCurrentStep(i + 1)
        if (i === ACTIVATION_STEPS.length - 1) {
          setTimeout(onDone, 600)
        }
      }, total)
      return () => clearTimeout(timeout)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const progress = (completedSteps.length / ACTIVATION_STEPS.length) * 100

  return (
    <motion.div
      key="activating"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-sm"
    >
      <div className="text-center mb-10">
        <motion.div
          className="w-16 h-16 rounded-2xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center mx-auto mb-6"
          animate={{ boxShadow: ['0 0 20px rgba(124,58,237,0.2)', '0 0 40px rgba(124,58,237,0.5)', '0 0 20px rgba(124,58,237,0.2)'] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Brain className="w-7 h-7 text-violet-400" />
        </motion.div>
        <h2 className="text-xl font-bold text-white mb-2">
          Ativando {empresa || 'seu sistema'}
        </h2>
        <p className="text-white/40 text-sm">IA operacional inicializando...</p>
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between text-xs text-white/30 mb-2">
          <span>Progresso</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-violet-600 to-cyan-500 rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {ACTIVATION_STEPS.map((step, i) => {
          const done = completedSteps.includes(i)
          const active = currentStep === i && !done

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: i <= currentStep ? 1 : 0.3, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center gap-3"
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                done
                  ? 'bg-emerald-500/20 border border-emerald-500/40'
                  : active
                  ? 'bg-violet-500/20 border border-violet-500/40'
                  : 'bg-white/5 border border-white/10'
              }`}>
                {done ? (
                  <CheckCircle className="w-3 h-3 text-emerald-400" />
                ) : active ? (
                  <motion.div
                    className="w-2 h-2 rounded-full bg-violet-400"
                    animate={{ scale: [1, 1.4, 1] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  />
                ) : (
                  <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                )}
              </div>
              <span className={`text-sm transition-colors duration-300 ${
                done ? 'text-emerald-400/80' : active ? 'text-white' : 'text-white/30'
              }`}>
                {step.label}
              </span>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}

// ─── Screen 4: Ready ───────────────────────────────────────────

function ReadyScreen({ empresa, onEnter }: { empresa: string; onEnter: () => void }) {
  return (
    <motion.div
      key="ready"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center text-center max-w-md"
    >
      {/* Success icon */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative mb-10"
      >
        <div
          className="w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-600 to-cyan-500 flex items-center justify-center"
          style={{ boxShadow: '0 0 80px rgba(124,58,237,0.5), 0 0 40px rgba(6,182,212,0.3)' }}
        >
          <CheckCircle className="w-12 h-12 text-white" strokeWidth={1.5} />
        </div>
        <motion.div
          className="absolute -inset-3 rounded-3xl border border-violet-500/20"
          animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <motion.div
          className="absolute -inset-6 rounded-3xl border border-violet-500/10"
          animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, delay: 0.3 }}
        />
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.6 }}
      >
        <p className="text-sm font-medium text-emerald-400 uppercase tracking-widest mb-4">
          Sistema ativo
        </p>
        <h1 className="text-3xl font-bold text-white mb-4">
          {empresa ? `${empresa} está no NEXUS.` : 'Seu NEXUS está pronto.'}
        </h1>
        <p className="text-white/50 leading-relaxed mb-10">
          IA operacional ativa. Monitoramento em tempo real ligado.<br />
          Seu sistema operacional está pronto para trabalhar por você.
        </p>
      </motion.div>

      {/* Feature cards */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.6 }}
        className="grid grid-cols-3 gap-3 w-full mb-8"
      >
        {[
          { icon: Brain, label: 'IA ativa', color: 'text-violet-400' },
          { icon: BarChart3, label: 'Analytics', color: 'text-cyan-400' },
          { icon: Shield, label: 'Alertas', color: 'text-emerald-400' },
        ].map(({ icon: Icon, label, color }) => (
          <div key={label} className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3 text-center">
            <Icon className={`w-5 h-5 ${color} mx-auto mb-1`} />
            <p className="text-xs text-white/50">{label}</p>
          </div>
        ))}
      </motion.div>

      <motion.button
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.6 }}
        onClick={onEnter}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 text-white font-semibold text-base transition-all duration-200"
        style={{ boxShadow: '0 0 40px rgba(124,58,237,0.5)' }}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        Entrar no meu sistema
        <ChevronRight className="w-5 h-5" />
      </motion.button>
    </motion.div>
  )
}

// ─── Main ──────────────────────────────────────────────────────

export default function WelcomeOnboardingPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [screen, setScreen] = useState<Screen>('welcome')
  const [empresa, setEmpresa] = useState('')
  const [firstName, setFirstName] = useState('')

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login')
    }
    if (user) {
      const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || ''
      setFirstName(name.split(' ')[0] || '')
    }
  }, [user, loading, router])

  const handleSetupDone = async (data: { empresa: string; setor: string; tamanho: string }) => {
    setEmpresa(data.empresa)
    setScreen('activating')

    try {
      const supabase = getSupabaseClient()
      await supabase.auth.updateUser({
        data: { onboarding_completed: true, onboarding_empresa: data.empresa, onboarding_setor: data.setor }
      })

      // Save company profile
      if (user) {
        await fetch('/api/company/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: data.empresa,
            sector: data.setor,
            team_size: data.tamanho,
          }),
        }).catch(() => {})
      }
    } catch { /* continue anyway */ }
  }

  const handleActivationDone = () => setScreen('ready')

  const handleEnterDashboard = () => router.push('/dashboard')

  if (loading) {
    return (
      <div className="min-h-screen bg-[#04040a] flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-6 h-6 rounded-full border-2 border-violet-500 border-t-transparent"
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#04040a] flex items-center justify-center overflow-hidden relative px-4">
      {/* Background particles */}
      <div className="absolute inset-0 pointer-events-none">
        {DOTS.map(d => <Dot key={d.id} x={d.x} y={d.y} delay={d.delay} />)}
      </div>

      {/* Background gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(124,58,237,0.08) 0%, transparent 70%)' }}
      />

      {/* Step indicator */}
      {screen !== 'activating' && screen !== 'ready' && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
          {(['welcome', 'setup'] as Screen[]).map((s, i) => (
            <div
              key={s}
              className={`rounded-full transition-all duration-500 ${
                screen === s ? 'w-6 h-1.5 bg-violet-500' : i < (['welcome', 'setup'] as Screen[]).indexOf(screen) ? 'w-3 h-1.5 bg-violet-800' : 'w-3 h-1.5 bg-white/10'
              }`}
            />
          ))}
        </div>
      )}

      {/* Content */}
      <AnimatePresence mode="wait">
        {screen === 'welcome' && (
          <WelcomeScreen
            key="welcome"
            name={firstName}
            onNext={() => setScreen('setup')}
          />
        )}
        {screen === 'setup' && (
          <SetupScreen
            key="setup"
            onNext={handleSetupDone}
          />
        )}
        {screen === 'activating' && (
          <ActivatingScreen
            key="activating"
            empresa={empresa}
            onDone={handleActivationDone}
          />
        )}
        {screen === 'ready' && (
          <ReadyScreen
            key="ready"
            empresa={empresa}
            onEnter={handleEnterDashboard}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
