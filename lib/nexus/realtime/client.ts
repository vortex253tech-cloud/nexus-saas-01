'use client'

// ─────────────────────────────────────────────────────────────────────────────
// NEXUS Realtime Engine  —  lib/nexus/realtime/client.ts
// WebSocket implementation for OpenAI Realtime API (GA)
//
// Flow:
//   POST /api/nexus/voice/session  →  ephemeral token
//   new WebSocket(wss://api.openai.com/v1/realtime?model=…, [subprotocols])
//   onopen  →  session.update (config + tools)
//   onmessage → PCM16 playback, transcription, tool execution
// ─────────────────────────────────────────────────────────────────────────────

import { NEXUS_SYSTEM_PROMPT, NEXUS_TOOLS } from '@/lib/voice/realtime-config'

// ── Public types ──────────────────────────────────────────────────────────────

export type NexusState =
  | 'disconnected'
  | 'connecting'
  | 'idle'
  | 'listening'
  | 'processing'
  | 'executing'
  | 'speaking'
  | 'error'

export interface NexusClientOptions {
  onState:       (s: NexusState) => void
  onTranscript:  (role: 'user' | 'assistant', text: string, final: boolean) => void
  onToolCall:    (tool: string, params: Record<string, unknown>, callId: string) => Promise<unknown>
  onAudioLevels: (levels: number[]) => void
  onError:       (msg: string) => void
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SR       = 24000   // sample rate (Hz)
const FFT      = 128
const BARS     = 32
const RETRIES  = 3
const SESSION  = '/api/nexus/voice/connect'
const DEFAULT_MODEL = 'gpt-realtime'

function wsUrl(model: string) {
  return `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`
}

// Inline AudioWorklet processor — avoids a separate static .js file
const WORKLET  = `
class NexusPCMCapture extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0]?.[0]
    if (ch?.length) this.port.postMessage(ch)
    return true
  }
}
registerProcessor('nexus-pcm-capture', NexusPCMCapture)
`

// ── PCM16 helpers ─────────────────────────────────────────────────────────────

function f32ToB64(f32: Float32Array): string {
  const buf  = new ArrayBuffer(f32.length * 2)
  const view = new DataView(buf)
  for (let i = 0; i < f32.length; i++) {
    const s = Math.max(-1, Math.min(1, f32[i]))
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  const bytes = new Uint8Array(buf)
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

function b64ToF32(b64: string): Float32Array {
  const bin   = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const view  = new DataView(bytes.buffer)
  const f32   = new Float32Array(bytes.length / 2)
  for (let i = 0; i < f32.length; i++) {
    const s = view.getInt16(i * 2, true)
    f32[i]  = s / (s < 0 ? 0x8000 : 0x7fff)
  }
  return f32
}

// ── Engine class ──────────────────────────────────────────────────────────────

export class NexusRealtimeClient {
  private ws:       WebSocket | null         = null
  private ctx:      AudioContext | null      = null
  private mic:      MediaStream | null       = null
  private worklet:  AudioWorkletNode | null  = null
  private analyser: AnalyserNode | null      = null
  private raf:      number | null            = null
  private playAt    = 0
  private retries   = 0
  private stopped   = true
  private state:    NexusState               = 'disconnected'
  private opts:     NexusClientOptions

  constructor(opts: NexusClientOptions) { this.opts = opts }

  get currentState(): NexusState { return this.state }

  // ── Public API ────────────────────────────────────────────────────────────────

  async connect(): Promise<void> {
    if (!this.stopped) return
    this.stopped  = false
    this.retries  = 0
    await this.boot()
  }

  disconnect(): void {
    this.stopped = true
    this.cleanup()
    this.set('disconnected')
  }

  sendText(text: string): void {
    this.send({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } })
    this.send({ type: 'response.create' })
    this.opts.onTranscript('user', text, true)
  }

  sendRaw(event: Record<string, unknown>): void { this.send(event) }

  // ── Connection lifecycle ──────────────────────────────────────────────────────

  private async boot(): Promise<void> {
    this.set('connecting')

    try {
      // ── 1. Ephemeral token (server proxies to OpenAI, returns raw GA response) ──
      const r = await fetch(SESSION, { method: 'POST' })
      if (!r.ok) {
        const b = await r.json().catch(() => ({}) as Record<string, unknown>) as Record<string, unknown>
        throw new Error(String(b.error ?? `Session HTTP ${r.status}`))
      }
      // GA response (wrapped by voice/connect):
      // { client_secret: { value: "ek_..." }, _model_used, model, session }
      const data = await r.json() as {
        client_secret?: { value?: string }
        _model_used?:   string
        model?:         string
        ephemeral_key?: string   // legacy
        value?:         string   // raw GA format fallback
        error?: string
      }
      const token = data.client_secret?.value ?? data.ephemeral_key ?? data.value ?? null
      console.log('[nexus] voice/connect raw keys:', Object.keys(data))
      console.log('[nexus] token:', token?.slice(0, 12) ?? 'NULL')
      if (!token) throw new Error(data.error ?? 'No ephemeral token received')
      const model = data._model_used ?? data.model ?? DEFAULT_MODEL

      // ── 2. AudioContext ──
      const ctx = new AudioContext({ sampleRate: SR })
      this.ctx  = ctx
      if (ctx.state === 'suspended') await ctx.resume()

      // ── 3. Microphone ──
      const mic = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: SR, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      })
      this.mic = mic

      // ── 4. Analyser for waveform ──
      const analyser = ctx.createAnalyser()
      analyser.fftSize = FFT
      analyser.smoothingTimeConstant = 0.75
      this.analyser = analyser
      ctx.createMediaStreamSource(mic).connect(analyser)

      // ── 5. AudioWorklet for PCM16 capture (inline blob) ──
      const blob = new Blob([WORKLET], { type: 'application/javascript' })
      const url  = URL.createObjectURL(blob)
      await ctx.audioWorklet.addModule(url)
      URL.revokeObjectURL(url)

      const worklet = new AudioWorkletNode(ctx, 'nexus-pcm-capture')
      this.worklet  = worklet
      ctx.createMediaStreamSource(mic).connect(worklet)
      worklet.port.onmessage = (e: MessageEvent<Float32Array>) => this.onMicChunk(e.data)

      // ── 6. WebSocket — GA subprotocol authentication ──
      //    Browser WebSocket cannot set Authorization headers, so the ephemeral
      //    token is passed as a subprotocol.  This is OpenAI's official GA method.
      const ws = new WebSocket(wsUrl(model), [
        'realtime',
        `openai-insecure-api-key.${token}`,
        'openai-beta.realtime-v1',
      ])
      this.ws    = ws
      this.playAt = 0

      ws.onopen    = () => this.onOpen()
      ws.onclose   = (e) => {
        console.log('[nexus] WebSocket closed — code:', e.code, 'reason:', e.reason || '(none)')
        this.onClose(e.code)
      }
      ws.onerror   = (e) => {
        console.error('[nexus] WebSocket error event:', e)
        this.opts.onError('WebSocket error — verifique a API key no Vercel')
      }
      ws.onmessage = (e) => this.onMsg(JSON.parse(e.data as string) as Record<string, unknown>)

      // ── 7. Waveform loop ──
      this.waveLoop()

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed'
      this.opts.onError(msg)
      this.set('error')
      this.cleanup()
    }
  }

  // ── WebSocket handlers ────────────────────────────────────────────────────────

  private onOpen(): void {
    this.retries = 0
    console.log('[nexus] WebSocket open — sending session.update')

    // Standard flat session.update format (works with all OpenAI Realtime models)
    this.send({
      type: 'session.update',
      session: {
        modalities:                 ['text', 'audio'],
        instructions:               NEXUS_SYSTEM_PROMPT,
        voice:                      'verse',
        input_audio_format:         'pcm16',
        output_audio_format:        'pcm16',
        input_audio_transcription:  { model: 'whisper-1' },
        turn_detection: {
          type:                'server_vad',
          threshold:           0.5,
          prefix_padding_ms:   300,
          silence_duration_ms: 700,
        },
        tools:       NEXUS_TOOLS as unknown as Record<string, unknown>[],
        tool_choice: 'auto',
        temperature: 0.7,
      },
    })

    this.set('idle')
  }

  private onClose(code: number): void {
    if (this.stopped) return
    if (this.retries < RETRIES && code !== 1000) {
      this.retries++
      this.dropWS()
      setTimeout(() => void this.boot(), 1500 * this.retries)
    } else {
      this.set('disconnected')
      this.cleanup()
    }
  }

  private onMsg(msg: Record<string, unknown>): void {
    const type = msg.type as string

    switch (type) {

      case 'input_audio_buffer.speech_started':
        this.set('listening')
        break

      case 'input_audio_buffer.speech_stopped':
      case 'response.created':
        if (this.state === 'listening') this.set('processing')
        break

      case 'response.audio.delta': {
        const d = msg.delta as string | undefined
        if (d) {
          if (this.state !== 'speaking' && this.state !== 'executing') this.set('speaking')
          this.playChunk(d)
        }
        break
      }

      case 'response.audio_transcript.delta': {
        const d = msg.delta as string | undefined
        if (d) this.opts.onTranscript('assistant', d, false)
        break
      }

      case 'response.audio_transcript.done': {
        const t = msg.transcript as string | undefined
        if (t) this.opts.onTranscript('assistant', t, true)
        break
      }

      case 'conversation.item.input_audio_transcription.completed': {
        const t = msg.transcript as string | undefined
        if (t) this.opts.onTranscript('user', t, true)
        break
      }

      case 'response.output_item.done': {
        const item = msg.item as Record<string, unknown> | undefined
        if (item?.type === 'function_call') void this.runTool(item)
        break
      }

      case 'response.done':
        if (this.state !== 'executing') this.set('idle')
        break

      case 'error': {
        const err = msg.error as Record<string, unknown> | undefined
        console.error('[nexus] OpenAI error event:', JSON.stringify(err ?? msg))
        this.opts.onError(String(err?.message ?? 'OpenAI Realtime error'))
        this.set('error')
        break
      }
    }
  }

  // ── Audio ─────────────────────────────────────────────────────────────────────

  private onMicChunk(f32: Float32Array): void {
    if (
      this.ws?.readyState === WebSocket.OPEN &&
      this.state !== 'speaking' &&
      this.state !== 'processing'
    ) {
      this.send({ type: 'input_audio_buffer.append', audio: f32ToB64(f32) })
    }
  }

  private playChunk(b64: string): void {
    const ctx = this.ctx
    if (!ctx) return
    const f32 = b64ToF32(b64)
    const buf = ctx.createBuffer(1, f32.length, SR)
    buf.getChannelData(0).set(f32)
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)
    const now = ctx.currentTime
    if (this.playAt < now) this.playAt = now
    src.start(this.playAt)
    this.playAt += buf.duration
  }

  // ── Tool execution ────────────────────────────────────────────────────────────

  private async runTool(item: Record<string, unknown>): Promise<void> {
    const tool   = item.name    as string
    const callId = item.call_id as string
    let params: Record<string, unknown> = {}
    try { params = JSON.parse(item.arguments as string) } catch { /* empty */ }

    this.set('executing')
    try {
      const result = await this.opts.onToolCall(tool, params, callId)
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: callId, output: JSON.stringify(result) } })
        this.send({ type: 'response.create' })
      }
    } catch (err) {
      this.opts.onError(`Tool "${tool}" failed: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      if (this.state === 'executing') this.set('idle')
    }
  }

  // ── Waveform ──────────────────────────────────────────────────────────────────

  private waveLoop(): void {
    const loop = () => {
      if (this.stopped) return
      this.raf = requestAnimationFrame(loop)
      const an = (this.state === 'listening' || this.state === 'idle') ? this.analyser : null
      if (an) {
        const data = new Uint8Array(an.frequencyBinCount)
        an.getByteFrequencyData(data)
        const levels = Array.from({ length: BARS }, (_, i) =>
          (data[Math.floor(i * data.length / BARS)] ?? 0) / 255,
        )
        this.opts.onAudioLevels(levels)
      } else {
        this.opts.onAudioLevels(new Array<number>(BARS).fill(0))
      }
    }
    loop()
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private set(s: NexusState): void {
    if (this.state === s) return
    this.state = s
    this.opts.onState(s)
  }

  private send(event: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(event))
  }

  private dropWS(): void {
    this.ws?.close()
    this.ws = null
    this.worklet?.disconnect()
    this.worklet = null
  }

  private cleanup(): void {
    if (this.raf !== null) { cancelAnimationFrame(this.raf); this.raf = null }
    this.dropWS()
    this.mic?.getTracks().forEach(t => t.stop())
    this.mic      = null
    this.ctx?.close().catch(() => undefined)
    this.ctx      = null
    this.analyser = null
    this.playAt   = 0
  }
}
