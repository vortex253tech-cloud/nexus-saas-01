'use client'

// NexusRealtimeClient — WebSocket client for the OpenAI Realtime API.
// Architecture: ephemeral token (server) → WebSocket (browser ↔ OpenAI)
// Audio: AudioWorklet PCM16 capture → base64 → OpenAI; base64 → PCM16 → AudioContext playback

import { NEXUS_SYSTEM_PROMPT, NEXUS_TOOLS } from '@/lib/voice/realtime-config'

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

const SAMPLE_RATE   = 24000
const FFT_SIZE      = 128
const BAR_COUNT     = 32
const MAX_RECONNECTS = 3
const WORKLET_CODE  = `
class NexusPCMProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0]?.[0]
    if (ch?.length) this.port.postMessage(ch)
    return true
  }
}
registerProcessor('nexus-pcm-processor', NexusPCMProcessor)
`

// ── PCM16 helpers ──────────────────────────────────────────────────────────────

function float32ToPCM16Base64(float32: Float32Array): string {
  const buf = new ArrayBuffer(float32.length * 2)
  const view = new DataView(buf)
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]))
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  let bin = ''
  const bytes = new Uint8Array(buf)
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

function base64PCM16ToFloat32(b64: string): Float32Array {
  const bin  = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const view = new DataView(bytes.buffer)
  const out  = new Float32Array(bytes.length / 2)
  for (let i = 0; i < out.length; i++) {
    const s = view.getInt16(i * 2, true)
    out[i] = s / (s < 0 ? 0x8000 : 0x7fff)
  }
  return out
}

// ── Client ────────────────────────────────────────────────────────────────────

export class NexusRealtimeClient {
  private ws:          WebSocket | null      = null
  private audioCtx:    AudioContext | null   = null
  private micStream:   MediaStream | null    = null
  private workletNode: AudioWorkletNode | null = null
  private analyser:    AnalyserNode | null   = null
  private animFrame:   number | null         = null
  private nextPlayAt   = 0
  private reconnects   = 0
  private stopped      = true
  private state: NexusState = 'disconnected'
  private opts:  NexusClientOptions

  constructor(opts: NexusClientOptions) { this.opts = opts }

  get currentState(): NexusState { return this.state }

  // ── Public API ───────────────────────────────────────────────────────────────

  async connect() {
    if (!this.stopped) return
    this.stopped    = false
    this.reconnects = 0
    await this.doConnect()
  }

  disconnect() {
    this.stopped = true
    this.cleanup()
    this.setState('disconnected')
  }

  sendText(text: string) {
    this.send({ type: 'conversation.item.create', item: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } })
    this.send({ type: 'response.create' })
    this.opts.onTranscript('user', text, true)
  }

  sendRaw(event: Record<string, unknown>) { this.send(event) }

  // ── Connection ───────────────────────────────────────────────────────────────

  private async doConnect() {
    this.setState('connecting')
    try {
      // 1. Ephemeral token from server
      const tokenRes = await fetch('/api/nexus/voice/session', { method: 'POST' })
      if (!tokenRes.ok) {
        const body = await tokenRes.json().catch(() => ({})) as Record<string, unknown>
        throw new Error((body.error as string) ?? `Token HTTP ${tokenRes.status}`)
      }
      const { ephemeral_key: token, model } = await tokenRes.json() as { ephemeral_key: string; model: string }
      if (!token) throw new Error('No ephemeral token received')

      // 2. AudioContext + mic
      const ctx = new AudioContext({ sampleRate: SAMPLE_RATE })
      this.audioCtx = ctx
      if (ctx.state === 'suspended') await ctx.resume()

      const stream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: SAMPLE_RATE, channelCount: 1, echoCancellation: true, noiseSuppression: true } })
      this.micStream = stream

      // 3. Analyser for waveform (input)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = FFT_SIZE
      analyser.smoothingTimeConstant = 0.7
      this.analyser = analyser
      ctx.createMediaStreamSource(stream).connect(analyser)

      // 4. AudioWorklet PCM16 capture
      const blob    = new Blob([WORKLET_CODE], { type: 'application/javascript' })
      const blobURL = URL.createObjectURL(blob)
      await ctx.audioWorklet.addModule(blobURL)
      URL.revokeObjectURL(blobURL)

      const worklet = new AudioWorkletNode(ctx, 'nexus-pcm-processor')
      this.workletNode = worklet
      ctx.createMediaStreamSource(stream).connect(worklet)

      worklet.port.onmessage = (e: MessageEvent<Float32Array>) => {
        if (this.ws?.readyState === WebSocket.OPEN && this.state !== 'speaking' && this.state !== 'processing') {
          const b64 = float32ToPCM16Base64(e.data)
          this.send({ type: 'input_audio_buffer.append', audio: b64 })
        }
      }

      // 5. WebSocket
      const ws = new WebSocket(
        `wss://api.openai.com/v1/realtime?model=${model}`,
        ['realtime', `openai-insecure-api-key.${token}`, 'openai-beta.realtime-v1'],
      )
      this.ws = ws
      this.nextPlayAt = 0

      ws.onopen    = () => this.onOpen()
      ws.onclose   = () => this.onClose()
      ws.onerror   = () => this.opts.onError('WebSocket error')
      ws.onmessage = (e) => this.onMessage(JSON.parse(e.data as string) as Record<string, unknown>)

      // 6. Waveform loop
      this.startWaveform()

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Connection failed'
      this.opts.onError(msg)
      this.setState('error')
      this.cleanup()
    }
  }

  // ── WebSocket handlers ───────────────────────────────────────────────────────

  private onOpen() {
    this.reconnects = 0
    this.send({
      type: 'session.update',
      session: {
        modalities:                ['text', 'audio'],
        instructions:              NEXUS_SYSTEM_PROMPT,
        voice:                     'alloy',
        input_audio_format:        'pcm16',
        output_audio_format:       'pcm16',
        input_audio_transcription: { model: 'whisper-1' },
        turn_detection: {
          type:                'server_vad',
          threshold:           0.5,
          prefix_padding_ms:   300,
          silence_duration_ms: 700,
        },
        tools:       NEXUS_TOOLS,
        tool_choice: 'auto',
      },
    })
    this.setState('idle')
  }

  private onClose() {
    if (this.stopped) return
    if (this.reconnects < MAX_RECONNECTS) {
      this.reconnects++
      this.cleanupConnection()
      setTimeout(() => this.doConnect(), 1200 * this.reconnects)
    } else {
      this.setState('disconnected')
      this.cleanup()
    }
  }

  private onMessage(msg: Record<string, unknown>) {
    const type = msg.type as string

    switch (type) {
      case 'input_audio_buffer.speech_started':
        this.setState('listening')
        break

      case 'input_audio_buffer.speech_stopped':
      case 'response.created':
        if (this.state === 'listening') this.setState('processing')
        break

      case 'response.audio.delta': {
        const delta = msg.delta as string | undefined
        if (delta) {
          if (this.state !== 'speaking' && this.state !== 'executing') this.setState('speaking')
          this.playPCM16Chunk(delta)
        }
        break
      }

      case 'response.audio.done':
        break

      case 'response.audio_transcript.delta': {
        const delta = msg.delta as string | undefined
        if (delta) this.opts.onTranscript('assistant', delta, false)
        break
      }

      case 'response.audio_transcript.done': {
        const text = msg.transcript as string | undefined
        if (text) this.opts.onTranscript('assistant', text, true)
        break
      }

      case 'conversation.item.input_audio_transcription.completed': {
        const text = msg.transcript as string | undefined
        if (text) this.opts.onTranscript('user', text, true)
        break
      }

      case 'response.output_item.done': {
        const item = msg.item as Record<string, unknown> | undefined
        if (item?.type === 'function_call') this.handleToolCall(item)
        break
      }

      case 'response.done':
        if (this.state !== 'executing') this.setState('idle')
        break

      case 'error': {
        const err    = msg.error as Record<string, unknown> | undefined
        const errMsg = (err?.message as string) ?? 'Unknown error from OpenAI'
        this.opts.onError(errMsg)
        this.setState('error')
        break
      }
    }
  }

  // ── PCM16 audio playback ─────────────────────────────────────────────────────

  private playPCM16Chunk(b64: string) {
    const ctx = this.audioCtx
    if (!ctx) return
    const float32 = base64PCM16ToFloat32(b64)
    const buf = ctx.createBuffer(1, float32.length, SAMPLE_RATE)
    buf.getChannelData(0).set(float32)
    const src = ctx.createBufferSource()
    src.buffer = buf
    src.connect(ctx.destination)
    const now = ctx.currentTime
    if (this.nextPlayAt < now) this.nextPlayAt = now
    src.start(this.nextPlayAt)
    this.nextPlayAt += buf.duration
  }

  // ── Tool calls ───────────────────────────────────────────────────────────────

  private async handleToolCall(item: Record<string, unknown>) {
    const tool   = item.name as string
    const callId = item.call_id as string
    let params: Record<string, unknown> = {}
    try { params = JSON.parse(item.arguments as string) } catch {}

    this.setState('executing')
    try {
      const result = await this.opts.onToolCall(tool, params, callId)
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'conversation.item.create', item: { type: 'function_call_output', call_id: callId, output: JSON.stringify(result) } })
        this.send({ type: 'response.create' })
      }
    } catch (err) {
      this.opts.onError(`Tool ${tool} failed: ${err instanceof Error ? err.message : 'unknown'}`)
    } finally {
      if (this.state === 'executing') this.setState('idle')
    }
  }

  // ── Waveform ─────────────────────────────────────────────────────────────────

  private startWaveform() {
    const loop = () => {
      if (this.stopped) return
      this.animFrame = requestAnimationFrame(loop)
      const analyser = (this.state === 'listening' || this.state === 'idle') ? this.analyser : null
      if (analyser) {
        const data = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(data)
        const levels = Array.from({ length: BAR_COUNT }, (_, i) => data[Math.floor(i * data.length / BAR_COUNT)] / 255)
        this.opts.onAudioLevels(levels)
      } else {
        this.opts.onAudioLevels(Array(BAR_COUNT).fill(0))
      }
    }
    loop()
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  private setState(s: NexusState) {
    if (this.state === s) return
    this.state = s
    this.opts.onState(s)
  }

  private send(event: Record<string, unknown>) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(event))
  }

  private cleanupConnection() {
    this.ws?.close()
    this.ws = null
    this.workletNode?.disconnect()
    this.workletNode = null
  }

  private cleanup() {
    if (this.animFrame) { cancelAnimationFrame(this.animFrame); this.animFrame = null }
    this.cleanupConnection()
    this.micStream?.getTracks().forEach(t => t.stop())
    this.micStream = null
    this.audioCtx?.close().catch(() => {})
    this.audioCtx  = null
    this.analyser  = null
    this.nextPlayAt = 0
  }
}
