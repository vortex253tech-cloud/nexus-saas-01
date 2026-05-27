'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Activity, RefreshCw, CheckCircle, AlertCircle, Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SessionResult {
  ok:            boolean
  status?:       number
  ephemeral_key?: string
  model?:        string
  error?:        string
}

interface DebugResult {
  key_hint?:    string
  model?:       string
  approach?:    string
  note?:        string
  session_test?: unknown
  error?:       string
}

interface DiagResult {
  ts:         number
  session:    SessionResult | null
  debug:      DebugResult | null
  sessionMs:  number
  debugMs:    number
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function RealtimeDiagPage() {
  const [running, setRunning] = useState(false)
  const [result,  setResult ] = useState<DiagResult | null>(null)

  const runDiag = useCallback(async () => {
    setRunning(true)
    setResult(null)

    // 1. Session endpoint
    const t0 = Date.now()
    let session: SessionResult | null = null
    try {
      const r    = await fetch('/api/nexus/voice/session', { method: 'POST' })
      const body = await r.json().catch(() => ({})) as Record<string, unknown>
      session    = {
        ok:            r.ok,
        status:        r.status,
        ephemeral_key: typeof body.ephemeral_key === 'string' ? body.ephemeral_key : undefined,
        model:         typeof body.model         === 'string' ? body.model         : undefined,
        error:         typeof body.error         === 'string' ? body.error         : undefined,
      }
    } catch (e) {
      session = { ok: false, error: String(e) }
    }
    const sessionMs = Date.now() - t0

    // 2. Debug endpoint
    const t1 = Date.now()
    let debug: DebugResult | null = null
    try {
      const r    = await fetch('/api/nexus/voice/debug')
      const body = await r.json().catch(() => ({})) as Record<string, unknown>
      debug = {
        key_hint:    typeof body.key_hint  === 'string' ? body.key_hint  : undefined,
        model:       typeof body.model     === 'string' ? body.model     : undefined,
        approach:    typeof body.approach  === 'string' ? body.approach  : undefined,
        note:        typeof body.note      === 'string' ? body.note      : undefined,
        session_test: body.session_test,
        error:       typeof body.error     === 'string' ? body.error     : undefined,
      }
    } catch (e) {
      debug = { error: String(e) }
    }
    const debugMs = Date.now() - t1

    setResult({ ts: Date.now(), session, debug, sessionMs, debugMs })
    setRunning(false)
  }, [])

  useEffect(() => { void runDiag() }, [runDiag])

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
          onClick={() => void runDiag()}
          disabled={running}
          style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: '#1e1b2e', border: '1px solid #312e5a', borderRadius: '8px', color: '#a78bfa', cursor: running ? 'not-allowed' : 'pointer', fontSize: '13px' }}
        >
          {running
            ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
            : <RefreshCw size={14} />}
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

          {/* Status cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
            <StatusCard
              label="Ephemeral Token"
              ok={result.session?.ok === true}
              extra={result.session?.ok ? `${result.sessionMs}ms — OK` : (result.session?.error ?? 'Falhou')}
            />
            <StatusCard
              label="API Key detectada"
              ok={!!result.debug?.key_hint}
              extra={result.debug?.key_hint ?? 'Não detectado'}
            />
          </div>

          {/* Session result */}
          <Panel title="POST /api/nexus/voice/session" ms={result.sessionMs} ok={result.session?.ok === true}>
            {result.session?.ok ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <DataRow label="Modelo"  value={result.session.model ?? '—'} />
                <DataRow label="Token"   value={result.session.ephemeral_key ? `${result.session.ephemeral_key.slice(0, 14)}…` : '—'} />
                <DataRow label="Status"  value={String(result.session.status ?? '—')} />
              </div>
            ) : (
              <ErrBox msg={result.session?.error ?? 'Erro desconhecido'} />
            )}
          </Panel>

          {/* Debug result */}
          <Panel title="GET /api/nexus/voice/debug" ms={result.debugMs} ok={!!result.debug?.key_hint}>
            {result.debug ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <DataRow label="API Key"   value={result.debug.key_hint   ?? '—'} />
                <DataRow label="Modelo"    value={result.debug.model      ?? '—'} />
                <DataRow label="Abordagem" value={result.debug.approach   ?? '—'} />
                <DataRow label="Nota"      value={result.debug.note       ?? '—'} />
                <p style={{ fontSize: '11px', color: '#64748b', margin: '8px 0 4px' }}>session_test:</p>
                <pre style={{ fontSize: '11px', color: '#94a3b8', background: '#060608', padding: '10px', borderRadius: '6px', overflow: 'auto', maxHeight: '200px', margin: 0 }}>
                  {JSON.stringify(result.debug.session_test, null, 2)}
                </pre>
              </div>
            ) : (
              <ErrBox msg="Endpoint não respondeu" />
            )}
          </Panel>

          {/* Fix instructions */}
          {result.session?.ok === false && (
            <div style={{ padding: '20px', background: '#180f0a', border: '1px solid #451a03', borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <AlertCircle size={16} style={{ color: '#f97316' }} />
                <span style={{ fontSize: '14px', fontWeight: 600, color: '#fed7aa' }}>Como corrigir</span>
              </div>
              <ol style={{ fontSize: '13px', color: '#94a3b8', lineHeight: '2', margin: 0, paddingLeft: '20px' }}>
                <li>Acesse <strong style={{ color: '#e2e8f0' }}>vercel.com → nexus-saas → Settings → Environment Variables</strong></li>
                <li>Edite <code style={{ color: '#a78bfa', background: '#1e1b2e', padding: '1px 6px', borderRadius: '3px' }}>OPENAI_API_KEY</code> com a chave que tem acesso ao Realtime</li>
                <li>Salve e vá em <strong style={{ color: '#e2e8f0' }}>Deployments → ⋯ → Redeploy</strong></li>
                <li>Aguarde 60s e clique em <em>Testar novamente</em></li>
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

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusCard({ label, ok, extra }: { label: string; ok: boolean; extra: string }) {
  return (
    <div style={{ padding: '16px', background: '#0a0810', border: `1px solid ${ok ? '#14532d' : '#450a0a'}`, borderRadius: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        {ok
          ? <CheckCircle size={14} style={{ color: '#22c55e' }} />
          : <AlertCircle size={14} style={{ color: '#ef4444' }} />}
        <span style={{ fontSize: '12px', color: '#94a3b8' }}>{label}</span>
      </div>
      <p style={{ fontSize: '12px', color: ok ? '#22c55e' : '#ef4444', margin: 0, wordBreak: 'break-all' }}>{extra}</p>
    </div>
  )
}

function Panel({ title, ms, ok, children }: { title: string; ms: number; ok: boolean; children: React.ReactNode }) {
  return (
    <div style={{ background: '#0a0810', border: '1px solid #1e1b2e', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #1e1b2e', background: '#0f0d1f' }}>
        <code style={{ fontSize: '13px', color: '#c4b5fd' }}>{title}</code>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#475569' }}>{ms}ms</span>
          {ok
            ? <CheckCircle size={13} style={{ color: '#22c55e' }} />
            : <AlertCircle size={13} style={{ color: '#ef4444' }} />}
        </div>
      </div>
      <div style={{ padding: '16px' }}>{children}</div>
    </div>
  )
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: '12px' }}>
      <span style={{ fontSize: '12px', color: '#64748b', minWidth: '80px', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: '12px', color: '#e2e8f0', wordBreak: 'break-all' }}>{value}</span>
    </div>
  )
}

function ErrBox({ msg }: { msg: string }) {
  return (
    <div style={{ padding: '12px', background: '#180a0a', border: '1px solid #450a0a', borderRadius: '8px' }}>
      <p style={{ fontSize: '12px', color: '#fca5a5', margin: 0, wordBreak: 'break-all' }}>{msg}</p>
    </div>
  )
}
