'use client'

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, Volume2 } from 'lucide-react'

const SCRIPT_LINES = [
  'Bem-vindo ao NEXUS.',
  'Eu sou sua inteligência operacional.',
  'Meu trabalho é operar sua empresa em tempo real.',
  'Vou organizar suas vendas, tarefas, clientes, projetos e automações.',
  'Você não está entrando em um CRM.',
  'Você está entrando em um Sistema Operacional Empresarial com Inteligência Artificial.',
  'Vamos crescer sua empresa juntos.',
]

const BAR_COUNT = 28

// Real reactive waveform driven by the Web Audio API's AnalyserNode — not a
// faked CSS loop. Falls back gracefully (orb still pulses, just without
// frequency-reactive bars) if AudioContext can't be created.
export default function VoiceOrb() {
  const audioRef    = useRef<HTMLAudioElement>(null)
  const ctxRef       = useRef<AudioContext | null>(null)
  const analyserRef  = useRef<AnalyserNode | null>(null)
  const sourceRef    = useRef<MediaElementAudioSourceNode | null>(null)
  const rafRef       = useRef<number | null>(null)

  const [playing,  setPlaying]  = useState(false)
  const [levels,   setLevels]   = useState<number[]>(() => Array(BAR_COUNT).fill(0.08))
  const [progress, setProgress] = useState(0)
  const [lineIdx,  setLineIdx]  = useState(-1)

  function ensureAudioGraph() {
    if (ctxRef.current || !audioRef.current) return
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new Ctx()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 64
      const source = ctx.createMediaElementSource(audioRef.current)
      source.connect(analyser)
      analyser.connect(ctx.destination)
      ctxRef.current = ctx
      analyserRef.current = analyser
      sourceRef.current = source
    } catch {
      // Web Audio unavailable — orb still works, just without reactive bars.
    }
  }

  function tick() {
    const analyser = analyserRef.current
    const audio    = audioRef.current
    if (analyser && audio) {
      const data = new Uint8Array(analyser.frequencyBinCount)
      analyser.getByteFrequencyData(data)
      const step = Math.floor(data.length / BAR_COUNT) || 1
      const next = Array.from({ length: BAR_COUNT }, (_, i) => {
        const v = data[i * step] ?? 0
        return Math.max(0.08, v / 255)
      })
      setLevels(next)

      if (audio.duration) {
        setProgress(audio.currentTime / audio.duration)
        const idx = Math.floor((audio.currentTime / audio.duration) * SCRIPT_LINES.length)
        setLineIdx(Math.min(idx, SCRIPT_LINES.length - 1))
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  function handlePlay() {
    ensureAudioGraph()
    ctxRef.current?.resume()
    const audio = audioRef.current
    if (!audio) return
    if (playing) {
      audio.pause()
    } else {
      audio.currentTime = audio.ended ? 0 : audio.currentTime
      void audio.play()
    }
  }

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onPlay = () => {
      setPlaying(true)
      rafRef.current = requestAnimationFrame(tick)
    }
    const onPauseOrEnd = () => {
      setPlaying(false)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      setLevels(Array(BAR_COUNT).fill(0.08))
      if (audio.ended) { setProgress(0); setLineIdx(-1) }
    }

    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPauseOrEnd)
    audio.addEventListener('ended', onPauseOrEnd)
    return () => {
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPauseOrEnd)
      audio.removeEventListener('ended', onPauseOrEnd)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  return (
    <div
      className="relative rounded-[28px] border border-white/8 p-8 overflow-hidden"
      style={{ background: 'rgba(10,14,22,0.85)', backdropFilter: 'blur(20px)' }}
    >
      <audio ref={audioRef} src="/audio/nexus-welcome.mp3" preload="auto" />

      {/* Status */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2 rounded-full border border-emerald-500/25 bg-emerald-500/8 px-3 py-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[11px] font-bold text-emerald-400 tracking-wider">ONLINE</span>
        </div>
        <div className="flex items-center gap-1.5 text-zinc-600">
          <Volume2 className="w-3.5 h-3.5" />
          <span className="text-[11px]">Apresentação · 30s</span>
        </div>
      </div>

      {/* Orb */}
      <div className="relative flex items-center justify-center mb-8 h-40">
        <motion.div
          animate={playing ? { scale: [1, 1.06, 1] } : { scale: 1 }}
          transition={{ duration: 1.6, repeat: playing ? Infinity : 0, ease: 'easeInOut' }}
          className="absolute w-36 h-36 rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(59,130,246,0.35) 0%, transparent 70%)',
            filter: 'blur(18px)',
          }}
        />
        <button
          onClick={handlePlay}
          className="relative z-10 w-24 h-24 rounded-full flex items-center justify-center border border-blue-400/30 transition-transform hover:scale-105"
          style={{ background: 'linear-gradient(135deg, #1E40AF, #1E3A8A)' }}
          aria-label={playing ? 'Pausar apresentação' : 'Ouvir apresentação do NEXUS'}
        >
          {playing ? <Pause className="w-7 h-7 text-white" /> : <Play className="w-7 h-7 text-white" fill="currentColor" />}
        </button>

        {/* Waveform ring */}
        <div className="absolute inset-0 flex items-center justify-center gap-[3px] pointer-events-none">
          {levels.map((lvl, i) => {
            const angle = (i / BAR_COUNT) * 360
            const radius = 78
            return (
              <span
                key={i}
                className="absolute rounded-full bg-blue-400"
                style={{
                  width: 3,
                  height: 4 + lvl * 26,
                  opacity: 0.35 + lvl * 0.65,
                  transform: `rotate(${angle}deg) translateY(-${radius}px)`,
                  transition: 'height 80ms ease, opacity 80ms ease',
                }}
              />
            )
          })}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 w-full rounded-full bg-white/8 mb-5 overflow-hidden">
        <div className="h-full bg-blue-500 transition-all duration-150" style={{ width: `${progress * 100}%` }} />
      </div>

      {/* Live caption */}
      <div className="h-12 flex items-center justify-center text-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={lineIdx}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="text-[13px] text-zinc-300 leading-relaxed px-2"
          >
            {lineIdx >= 0 ? SCRIPT_LINES[lineIdx] : 'Clique para ouvir o NEXUS se apresentar.'}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  )
}
