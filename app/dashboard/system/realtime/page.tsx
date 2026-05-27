'use client'

import { useEffect, useState, useCallback } from 'react'
import { Activity, Wifi, WifiOff, RefreshCw, CheckCircle, AlertCircle, Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface SessionResult {
  ok: boolean
  status?: number
  ephemeral_key?: string
  model?: string
  error?: string
  raw?: string
}

interface DebugResult {
  ok: boolean
  model?: string
  key_hint?: string
  approach?: string
  connect_route?: string
  session_test?: unknown
  error?: string
  note?: string
}

interface DiagResult {
  ts:           number
  session:      SessionResult | null
  debug:        DebugResult | null
  sessionMs:    number
  debugMs:      number
  wsReachable:  boolean | null
}

export default function RealtimeDiagPage() {
  const [running, setRunning] = useState(false)
  const [result,  setResult ] = useState<DiagResult | null>(null)

  const runDiag = useCallback(async () => {
    setRunning(true)
    setResult(null)

    // 1. Test session endpoint
    const t0 = Date.now()
    let sessionResult: SessionResult | null = null
    try {
      const r = await fetch('/api/nexus/voice/session', { method: 'POST' })
      const body = await r.json().catch(() => ({})) as SessionResult
      sessionResult = { ok: r.ok, status: r.status, ...body }
    } catch (e) {
      sessionResult = { ok: false, error: String(e) }
    }
    const sessionMs = Date.now() - t0

    // 2. Test debug endpoint
    const t1 = Date.now()
    let debugResult: DebugResult | null = null
    try {
      const r = await fetch('/api/nexus/voice/debug')
      debugResult = await r.json().catch(() => ({ ok: false })) as DebugResult
    } catch (e) {
      debugResult = { ok: false, error: String(e) }
    }
    const debugMs = Date.now() - t1

    // 3. Check if WSS endpoint is reachable (simple HEAD doesn't work for WSS, use fetch with error check)
    let wsReachable: boolean | null = null
    try {
      const wsTestRes = await fetch('https://api.openai.com/v1/realtime', { method: 'OPTIONS', signal: AbortSignal.timeout(5000) }).catch(() => null)
      wsReachable = wsTestRes !== null
    } catch {
      wsReachable = null
    }

    setResult({ ts: Date.now(), session: sessionResult, debug: debugResult, sessionMs, debugMs, wsReachable })
    setRunning(false)
  }, [])

  useEffect(() => { runDiag() }, [runDiag])

  const ok  = (v: boolean | null | undefined) => v === true
  const unk = (v: boolean | null | undefined) => v === null || v === undefined

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse at 20% 0%, #0f0a1e 0%, #060608 50%, #040406 100%)', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif', padding: '32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
        <Link href="/dashboard/assistant" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', textDecoration: 'none', fontSize: '14px' }}>
          <ArrowLeft size={14} /> Voltar
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Activity size={24} style={{ color: '#8b5cf6' }} />
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#f1f5f9' }}>Diagnóstico Realtime</h1>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>WebSocket + OpenAI Realtime API</p>
          </div>
        </div>
        <button
          onClick={runDiag}
          disabled={running}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#1e1b2e', border: '1px solid #312e5a', borderRadius: '8px', color: '#a78bfa', cursor: running ? 'not-allowed' : 'pointer', fontSize: '13px' }}
        >
          {running ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
          {running ? 'Testando...' : 'Testar novamente'}
        </button>
      </div>

      {running && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '20px', background: '#0f0d1f', border: '1px solid #1e1b2e', borderRadius: '12px', marginBottom: '24px' }}>
          <Loader2 size={18} style={{ color: '#8b5cf6', animation: 'spin 1s linear infinite' }} />
          <span style={{ color: '#94a3b8', fontSize: '14px' }}>Executando diagnóstico…</span>
        </div>
      )}

      {result && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Quick status */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <StatusCard label="Ephemeral Token" ok={ok(result.session?.ok)} extra={result.session?.ok ? `${result.sessionMs}ms` : result.session?.error} />
            <StatusCard label="API Key válida" ok={ok((result.debug as DebugResult | null)?.key_hint)} extra={(result.debug as DebugResult | null)?.key_hint ?? 'não detectado'} />
            <StatusCard label="Endpoint alcançável" ok={unk(result.wsReachable) ? null : result.wsReachable} extra={unk(result.wsReachable) ? 'CORS (esperado)' : result.wsReachable ? 'OK' : 'Inacessível'} />
          </div>

          {/* Session detail */}
          <Section title="POST /api/nexus/voice/session" ms={result.sessionMs} ok={result.session?.ok}>
            {result.session?.ok ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Row label="Modelo"         value={result.session.model ?? '—'} />
                <Row label="Token recebido" value={result.session.ephemeral_key ? `${result.session.ephemeral_key.slice(0, 12)}…` : '—'} />
                <Row label="Status HTTP"    value={String(result.session.status ?? '—')} />
              </div>
            ) : (
              <ErrorBox msg={result.session?.error ?? 'Erro desconhecido'} />
            )}
          </Section>

          {/* Debug detail */}
          <Section title="GET /api/nexus/voice/debug" ms={result.debugMs} ok={!!(result.debug as DebugResult | null)?.key_hint}>
            {result.debug ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <Row label="API Key"   value={(result.debug as DebugResult).key_hint ?? '—'} />
                <Row label="Modelo"    value={(result.debug as DebugResult).model ?? '—'} />
                <Row label="Abordagem" value={(result.debug as DebugResult).approach ?? '—'} />
                <Row label="Nota"      value={(result.debug as DebugResult).note ?? '—'} />
                <div style={{ marginTop: '8px' }}>
                  <p style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>session_test:</p>
                  <pre style={{ fontSize: '11px', color: '#94a3b8', background: '#060608', padding: '10px', borderRadius: '6px', overflow: 'auto', maxHeight: '200px', margin: 0 }}>
                    {JSON.stringify((result.debug as DebugResult).session_test, null, 2)}
                  </pre>
                </div>
              </div>
            ) : (
              <ErrorBox msg="Endpoint não respondeu" />
            )}
          </Section>

          {/* Instructions */}
          {!result.session?.ok && (
            <div style={{ padding: '20px', background: '#180f0a', border: '1px solid #451a03', borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <AlertCircle size={16} style={{ color: '#f97316' }} />
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#fed7aa' }}>Como corrigir</span>
              </div>
              <ol style={{ fontSize: '13px', color: '#94a3b8', lineHeight: '1.8', margin: 0, paddingLeft: '20px' }}>
                <li>Acesse <strong style={{ color: '#e2e8f0' }}>vercel.com → Seu projeto → Settings → Environment Variables</strong></li>
                <li>Localize <code style={{ color: '#a78bfa', background: '#1e1b2e', padding: '1px 4px', borderRadius: '3px' }}>OPENAI_API_KEY</code> e clique em <strong style={{ color: '#e2e8f0' }}>Edit</strong></li>
                <li>Cole a chave nova (deve ter acesso ao plano Realtime)</li>
                <li>Salve e faça <strong style={{ color: '#e2e8f0' }}>Redeploy</strong> (Deployments → … → Redeploy)</li>
                <li>Aguarde ~60s e teste novamente</li>
              </ol>
            </div>
          )}

          <p style={{ fontSize: '11px', color: '#334155', textAlign: 'right' }}>
            {new Date(result.ts).toLocaleString('pt-BR')}
          </p>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}

function StatusCard({ label, ok, extra }: { label: string; ok: boolean | null; extra?: string }) {
  const color = ok === null ? '#64748b' : ok ? '#22c55e' : '#ef4444'
  const Icon  = ok === null ? Activity : ok ? CheckCircle : AlertCircle
  return (
    <div style={{ padding: '16px', background: '#0a0810', border: `1px solid ${ok === null ? '#1e293b' : ok ? '#14532d' : '#450a0a'}`, borderRadius: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <Icon size={14} style={{ color }} />
        <span style={{ fontSize: '12px', color: '#94a3b8' }}>{label}</span>
      </div>
      <p style={{ fontSize: '12px', color: ok === null ? '#64748b' : color, margin: 0, wordBreak: 'break-all' }}>{extra ?? '—'}</p>
    </div>
  )
}

function Section({ title, ms, ok, children }: { title: string; ms: number; ok?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ background: '#0a0810', border: '1px solid #1e1b2e', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #1e1b2e', background: '#0f0d1f' }}>
        <code style={{ fontSize: '13px', color: '#c4b5fd' }}>{title}</code>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#475569' }}>{ms}ms</span>
          {ok ? <CheckCircle size={13} style={{ color: '#22c55e' }} /> : <AlertCircle size={13} style={{ color: '#ef4444' }} />}
        </div>
      </div>
      <div style={{ padding: '16px' }}>{children}</div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
      <span style={{ fontSize: '12px', color: '#64748b', minWidth: '100px', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '12px', color: '#e2e8f0', wordBreak: 'break-all' }}>{value}</span>
    </div>
  )
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div style={{ padding: '12px', background: '#180a0a', border: '1px solid #450a0a', borderRadius: '8px' }}>
      <p style={{ fontSize: '12px', color: '#fca5a5', margin: 0, wordBreak: 'break-all' }}>{msg}</p>
    </div>
  )
}
