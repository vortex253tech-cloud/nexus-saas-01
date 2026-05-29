'use client'

// lib/nexus/nexus-session-manager.ts
// Singleton that owns the NexusVoiceEngine outside the React lifecycle.
// The engine is NEVER destroyed on page navigation — only on explicit forceDisconnect().

import { NexusVoiceEngine, NexusOSState, VoiceEngineCallbacks } from './voice-engine'

export type NexusSessionState = NexusOSState

type StateListener = (s: NexusSessionState) => void
type TranscriptListener = (role: 'user' | 'assistant', text: string, final: boolean) => void
type LevelsListener = (levels: number[]) => void
type ErrorListener = (msg: string) => void
type ToolCallHandler = (name: string, args: Record<string, unknown>, callId: string) => Promise<unknown>

const BACKOFF = [1000, 2000, 5000]
const HEARTBEAT_INTERVAL = 30_000
const HEARTBEAT_TIMEOUT  = 8_000

class NexusSessionManager {
  private engine:     NexusVoiceEngine | null = null
  private _state:     NexusSessionState = 'disconnected'
  private _forced:    boolean = false       // true only when user explicitly disconnects
  private _retry:     number  = 0
  private _retryTimer: ReturnType<typeof setTimeout> | null = null
  private _hbTimer:   ReturnType<typeof setTimeout> | null = null
  private _hbTimeout: ReturnType<typeof setTimeout> | null = null
  private _lastPong:  number = 0

  // Registered listeners (multiple pages / components can subscribe)
  private stateListeners:      StateListener[]      = []
  private transcriptListeners: TranscriptListener[] = []
  private levelsListeners:     LevelsListener[]     = []
  private errorListeners:      ErrorListener[]      = []
  private toolCallHandler:     ToolCallHandler | null = null

  // ── Public API ─────────────────────────────────────────────────────────────

  get state(): NexusSessionState { return this._state }

  /** Connect once. Safe to call multiple times — no-op if already active. */
  async connect(): Promise<void> {
    if (this.engine && this._state !== 'disconnected' && this._state !== 'error') return
    this._forced = false
    this._retry  = 0
    await this._boot()
  }

  /** Only to be called when user explicitly clicks "Desativar NEXUS", logout, or session expiry. */
  forceDisconnect(): void {
    this._forced = true
    this._clearRetryTimer()
    this._clearHeartbeat()
    if (this.engine) {
      this.engine.disconnect()
      this.engine = null
    }
    this._setState('disconnected')
  }

  /** Send a text message (for quick commands). */
  sendText(text: string): void {
    this.engine?.sendText(text)
  }

  // ── Subscriptions ──────────────────────────────────────────────────────────

  subscribeState(fn: StateListener): () => void {
    this.stateListeners.push(fn)
    fn(this._state) // immediate snapshot
    return () => { this.stateListeners = this.stateListeners.filter(f => f !== fn) }
  }

  subscribeTranscript(fn: TranscriptListener): () => void {
    this.transcriptListeners.push(fn)
    return () => { this.transcriptListeners = this.transcriptListeners.filter(f => f !== fn) }
  }

  subscribeLevels(fn: LevelsListener): () => void {
    this.levelsListeners.push(fn)
    return () => { this.levelsListeners = this.levelsListeners.filter(f => f !== fn) }
  }

  subscribeError(fn: ErrorListener): () => void {
    this.errorListeners.push(fn)
    return () => { this.errorListeners = this.errorListeners.filter(f => f !== fn) }
  }

  /** The page that mounts Nexus OS registers the tool handler. */
  registerToolHandler(fn: ToolCallHandler): () => void {
    this.toolCallHandler = fn
    return () => { if (this.toolCallHandler === fn) this.toolCallHandler = null }
  }

  // ── Internal ───────────────────────────────────────────────────────────────

  private async _boot(): Promise<void> {
    this._setState('connecting')
    const cb: VoiceEngineCallbacks = {
      onState:       (s) => this._onEngineState(s),
      onTranscript:  (r, t, f) => this.transcriptListeners.forEach(fn => fn(r, t, f)),
      onAudioLevels: (l) => this.levelsListeners.forEach(fn => fn(l)),
      onError:       (m) => this.errorListeners.forEach(fn => fn(m)),
      onToolCall:    (n, a, id) => this._onToolCall(n, a, id),
    }
    const engine = new NexusVoiceEngine(cb)
    this.engine  = engine
    await engine.connect()
  }

  private _onEngineState(s: NexusOSState): void {
    this._setState(s)

    if (s === 'ready') {
      this._retry = 0
      this._startHeartbeat()
    }

    if ((s === 'disconnected' || s === 'error') && !this._forced) {
      this._scheduleRetry()
    }
  }

  private async _onToolCall(name: string, args: Record<string, unknown>, callId: string): Promise<unknown> {
    if (this.toolCallHandler) {
      return this.toolCallHandler(name, args, callId)
    }
    return { success: false, message: 'No tool handler registered' }
  }

  private _setState(s: NexusSessionState): void {
    if (this._state === s) return
    this._state = s
    this.stateListeners.forEach(fn => fn(s))
  }

  private _scheduleRetry(): void {
    if (this._forced) return
    this._clearRetryTimer()
    const delay = BACKOFF[Math.min(this._retry, BACKOFF.length - 1)]
    this._retry++
    console.log(`[nexus-sm] retry #${this._retry} in ${delay}ms`)
    this._retryTimer = setTimeout(() => {
      void this._boot()
    }, delay)
  }

  private _clearRetryTimer(): void {
    if (this._retryTimer !== null) { clearTimeout(this._retryTimer); this._retryTimer = null }
  }

  private _startHeartbeat(): void {
    this._clearHeartbeat()
    this._hbTimer = setInterval(() => this._ping(), HEARTBEAT_INTERVAL)
  }

  private _clearHeartbeat(): void {
    if (this._hbTimer   !== null) { clearInterval(this._hbTimer);   this._hbTimer   = null }
    if (this._hbTimeout !== null) { clearTimeout(this._hbTimeout);  this._hbTimeout = null }
  }

  private _ping(): void {
    // OpenAI Realtime has no explicit ping frame — we detect liveness by whether
    // the engine is still in a non-error state. If the engine has silently died
    // (state became disconnected without triggering onClose) we reconnect.
    if (this._state === 'disconnected' || this._state === 'error') {
      if (!this._forced) this._scheduleRetry()
      return
    }
    // Also schedule a timeout — if state doesn't change to something active soon, reconnect.
    this._hbTimeout = setTimeout(() => {
      if (this._state !== 'speaking' && this._state !== 'listening' && this._state !== 'executing') {
        if (!this._forced) {
          console.warn('[nexus-sm] heartbeat timeout — reconnecting')
          this.engine?.disconnect()
          this.engine = null
          this._scheduleRetry()
        }
      }
    }, HEARTBEAT_TIMEOUT)
  }
}

// Export the singleton
export const nexusSessionManager = new NexusSessionManager()
