'use client'

// lib/nexus/voice-engine.ts
// NexusVoiceEngine — OpenAI Realtime GA WebSocket engine

import { NEXUS_OS_SYSTEM_PROMPT, NEXUS_OS_TOOLS } from './config'

const TOKEN_ENDPOINT = '/api/nexus/voice/token'
const SR             = 24000
const FFT            = 128
const BARS           = 24
const MAX_RETRIES    = 2

export type NexusOSState =
  | 'connecting'
  | 'ready'
  | 'listening'
  | 'processing'
  | 'speaking'
  | 'executing'
  | 'error'
  | 'disconnected'

export interface VoiceEngineCallbacks {
  onState:       (s: NexusOSState) => void
  onTranscript:  (role: 'user' | 'assistant', text: string, final: boolean) => void
  onToolCall:    (name: string, args: Record<string, unknown>, callId: string) => Promise<unknown>
  onAudioLevels: (levels: number[]) => void
  onError:       (msg: string) => void
}

// Inline AudioWorklet — avoids a separate static file
const WORKLET_CODE = `
class NexusPCMCapture extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0]?.[0]
    if (ch?.length) this.port.postMessage(ch)
    return true
  }
}
registerProcessor('nexus-pcm-capture', NexusPCMCapture)
`

function f32ToPCM16B64(f32: Float32Array): string {
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

function b64PCM16ToF32(b64: string): Float32Array {
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

export class NexusVoiceEngine {
  private cb:       VoiceEngineCallbacks
  private ws:       WebSocket | null      = null
  private ctx:      AudioContext | null   = null
  private mic:      MediaStream | null    = null
  private worklet:  AudioWorkletNode | null = null
  private analyser: AnalyserNode | null   = null
  private raf:      number | null         = null
  private playAt    = 0
  private retries   = 0
  private active    = false
  private _state:   NexusOSState          = 'disconnected'

  constructor(cb: VoiceEngineCallbacks) { this.cb = cb }

  get state(): NexusOSState { return this._state }

  async connect(): Promise<void> {
    if (this.active) return
    this.active  = true
    this.retries = 0
    await this.boot()
  }

  disconnect(): void {
    this.active = false
    this.teardown()
    this.set('disconnected')
  }

  sendText(text: string): void {
    this.send({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } })
    this.send({ type: 'response.create' })
    this.cb.onTranscript('user', text, true)
  }

  // ── Boot sequence ────────────────────────────────────────────────────────────

  private async boot(): Promise<void> {
    this.set('connecting')
    try {
      // 1. Ephemeral token
      const r = await fetch(TOKEN_ENDPOINT, { method: 'POST' })
      if (!r.ok) {
        const b = await r.json().catch(() => ({}) as Record<string, unknown>) as Record<string, unknown>
        throw new Error(String(b.error ?? `Token HTTP ${r.status}`))
      }
      const { token, model } = await r.json() as { token: string; model: string }
      console.log(`[nexus-os] token OK  model=${model}  token=${token.slice(0, 14)}...`)
      if (!token) throw new Error('Token vazio recebido')

      // 2. AudioContext
      const ctx = new AudioContext({ sampleRate: SR })
      this.ctx  = ctx
      if (ctx.state === 'suspended') await ctx.resume()

      // 3. Microphone
      const mic = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: SR, channelCount: 1, echoCancellation: true, noiseSuppression: true },
      })
      this.mic = mic

      // 4. Analyser (waveform visualization)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = FFT
      analyser.smoothingTimeConstant = 0.75
      this.analyser = analyser
      ctx.createMediaStreamSource(mic).connect(analyser)

      // 5. AudioWorklet (inline blob — no static file needed)
      const blob = new Blob([WORKLET_CODE], { type: 'application/javascript' })
      const url  = URL.createObjectURL(blob)
      await ctx.audioWorklet.addModule(url)
      URL.revokeObjectURL(url)
      const worklet = new AudioWorkletNode(ctx, 'nexus-pcm-capture')
      this.worklet  = worklet
      ctx.createMediaStreamSource(mic).connect(worklet)
      worklet.port.onmessage = (e: MessageEvent<Float32Array>) => this.onMicChunk(e.data)

      // 6. WebSocket — GA ephemeral-token auth (NO openai-beta protocol)
      const ws = new WebSocket(
        `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`,
        ['realtime', `openai-insecure-api-key.${token}`],
      )
      this.ws     = ws
      this.playAt = 0

      ws.onopen    = () => this.onOpen()
      ws.onclose   = (e) => {
        console.log(`[nexus-os] WS closed  code=${e.code}  reason="${e.reason || 'none'}"`)
        this.onClose(e.code)
      }
      ws.onerror   = (e) => {
        console.error('[nexus-os] WS error:', e)
        this.cb.onError('Erro de conexão WebSocket')
      }
      ws.onmessage = (e: MessageEvent<string>) => this.onMsg(JSON.parse(e.data) as Record<string, unknown>)

      // 7. Waveform loop
      this.waveLoop()

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro de conexão'
      console.error('[nexus-os] boot failed:', msg)
      this.cb.onError(msg)
      this.set('error')
      this.teardown()
    }
  }

  // ── WebSocket lifecycle ───────────────────────────────────────────────────────

  private onOpen(): void {
    this.retries = 0
    console.log('[nexus-os] WS open → session.update')

    // gpt-realtime (GA) only accepts: type, instructions, tools, tool_choice
    // voice, modalities, audio formats, turn_detection, temperature are not supported
    this.send({
      type: 'session.update',
      session: {
        type:         'realtime',
        instructions: NEXUS_OS_SYSTEM_PROMPT,
        tools:        NEXUS_OS_TOOLS as unknown as Record<string, unknown>[],
        tool_choice:  'auto',
      },
    })

    this.set('ready')
  }

  private onClose(code: number): void {
    if (!this.active) return
    if (this.retries < MAX_RETRIES && code !== 1000) {
      this.retries++
      this.dropWS()
      setTimeout(() => void this.boot(), 1500 * this.retries)
    } else {
      this.teardown()
      this.set('disconnected')
    }
  }

  private onMsg(msg: Record<string, unknown>): void {
    switch (msg.type as string) {

      case 'input_audio_buffer.speech_started':
        this.set('listening')
        break

      case 'input_audio_buffer.speech_stopped':
      case 'response.created':
        if (this._state === 'listening') this.set('processing')
        break

      case 'response.audio.delta': {
        const d = msg.delta as string | undefined
        if (d) {
          if (this._state !== 'speaking' && this._state !== 'executing') this.set('speaking')
          this.playChunk(d)
        }
        break
      }

      case 'response.audio_transcript.delta':
        if (msg.delta) this.cb.onTranscript('assistant', msg.delta as string, false)
        break

      case 'response.audio_transcript.done':
        if (msg.transcript) this.cb.onTranscript('assistant', msg.transcript as string, true)
        break

      case 'conversation.item.input_audio_transcription.completed':
        if (msg.transcript) this.cb.onTranscript('user', msg.transcript as string, true)
        break

      case 'response.output_item.done': {
        const item = msg.item as Record<string, unknown> | undefined
        if (item?.type === 'function_call') void this.runTool(item)
        break
      }

      case 'response.done':
        if (this._state !== 'executing') this.set('ready')
        break

      case 'error': {
        const err = msg.error as Record<string, unknown> | undefined
        console.error('[nexus-os] OpenAI error:', JSON.stringify(err ?? msg))
        this.cb.onError(String(err?.message ?? 'Erro OpenAI Realtime'))
        this.set('error')
        break
      }
    }
  }

  // ── Audio ─────────────────────────────────────────────────────────────────────

  private onMicChunk(f32: Float32Array): void {
    if (
      this.ws?.readyState === WebSocket.OPEN &&
      this._state !== 'speaking' &&
      this._state !== 'processing'
    ) {
      this.send({ type: 'input_audio_buffer.append', audio: f32ToPCM16B64(f32) })
    }
  }

  private playChunk(b64: string): void {
    const ctx = this.ctx
    if (!ctx) return
    const f32 = b64PCM16ToF32(b64)
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
    const name   = item.name    as string
    const callId = item.call_id as string
    let args: Record<string, unknown> = {}
    try { args = JSON.parse(item.arguments as string) } catch { /* no-op */ }

    this.set('executing')
    try {
      const result = await this.cb.onToolCall(name, args, callId)
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: callId, output: JSON.stringify(result) } })
        this.send({ type: 'response.create' })
      }
    } catch (err) {
      this.cb.onError(`Erro na ação "${name}": ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      if (this._state === 'executing') this.set('ready')
    }
  }

  // ── Waveform loop ─────────────────────────────────────────────────────────────

  private waveLoop(): void {
    const loop = () => {
      if (!this.active) return
      this.raf = requestAnimationFrame(loop)
      const an = (this._state === 'listening' || this._state === 'ready') ? this.analyser : null
      if (an) {
        const data = new Uint8Array(an.frequencyBinCount)
        an.getByteFrequencyData(data)
        this.cb.onAudioLevels(
          Array.from({ length: BARS }, (_, i) => (data[Math.floor(i * data.length / BARS)] ?? 0) / 255),
        )
      } else {
        this.cb.onAudioLevels(new Array<number>(BARS).fill(0))
      }
    }
    loop()
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private set(s: NexusOSState): void {
    if (this._state === s) return
    this._state = s
    this.cb.onState(s)
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

  private teardown(): void {
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
