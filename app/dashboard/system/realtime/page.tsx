'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Activity, RefreshCw, CheckCircle, AlertCircle, Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface TokenResult {
  ok:          boolean
  status?:     number
  token?:      string
  model?:      string
  expires_at?: number | null
  error?:      string
}

interface WsResult {
  ok:    boolean
  ms?:   number
  error?: string
}

interface DiagResult {
  ts:       number
  token:    TokenResult
  ws:       WsResult | null
  tokenMs:  number
  wsMs:     number
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function RealtimeDiagPage() {
  const [running, setRunning] = useState(false)
  const [result,  setResult ] = useState<DiagResult | null>(null)

  const runDiag = useCallback(async () => {
    setRunning(true)
    setResult(null)

    // 1. Mint an ephemeral token — same endpoint the real voice engine uses
    const t0 = Date.now()
    let token: TokenResult
    try {
      const r    = await fetch('/api/nexus/voice/token', { method: 'POST' })
      const body = await r.json().catch(() => ({})) as Record<string, unknown>
      token = {
        ok:         r.ok,
        status:     r.status,
        token:      typeof body.token === 'string' ? body.token : undefined,
        model:      typeof body.model === 'string' ? body.model : undefined,
        expires_at: typeof body.expires_at === 'number' ? body.expires_at : null,
        error:      typeof body.error === 'string' ? body.error : undefined,
      }
    } catch (e) {
      token = { ok: false, error: String(e) }
    }
    const tokenMs = Date.now() - t0

    // 2. If a token was minted, open a real WebSocket round-trip to OpenAI —
    // this is what actually breaks when the Realtime API changes formats.
    let ws: WsResult | null = null
    const t1 = Date.now()
    if (token.ok && token.token && token.model) {
      ws = await testWsRoundTrip(token.token, token.model)
    }
    const wsMs = Date.now() - t1

    setResult({ ts: Date.now(), token, ws, tokenMs, wsMs })
    setRunning(false)
  }, [])

  useEffect(() => { void runDiag() }, [runDiag])

  return (
    <div style={{ minHeight: '100vh', background: 'radial-gradient(ellipse at 20% 0%, #0f0a1e 0%, #060608 50%, #040406 100%)', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif', padding: '32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
        <Link href="/dashboard/nexus-os" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', textDecoration: 'none', fontSize: '14px' }}>
          <ArrowLeft size={14} /> Voltar
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Activity size={24} style={{ color: '#8b5cf6' }} />
          <div>
            <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#f1f5f9' }}>Diagnóstico Realtime</h1>
            <p style={{ fontSize: '12px', color: '#64748b', margin: 0 }}>WebSocket + OpenAI Realtime API — também roda automaticamente todo dia (ver /api/cron/voice-health)</p>
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
              label="Token efêmero"
              ok={result.token.ok}
              extra={result.token.ok ? `${result.tokenMs}ms — OK` : (result.token.error ?? 'Falhou')}
            />
            <StatusCard
              label="Conexão WebSocket real"
              ok={result.ws?.ok === true}
              extra={result.ws ? (result.ws.ok ? `${result.ws.ms}ms — handshake OK` : (result.ws.error ?? 'Falhou')) : 'Não testado (token falhou)'}
            />
          </div>

          {/* Token result */}
          <Panel title="POST /api/nexus/voice/token" ms={result.tokenMs} ok={result.token.ok}>
            {result.token.ok ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <DataRow label="Modelo"  value={result.token.model ?? '—'} />
                <DataRow label="Token"   value={result.token.token ? `${result.token.token.slice(0, 14)}…` : '—'} />
                <DataRow label="Status"  value={String(result.token.status ?? '—')} />
              </div>
            ) : (
              <ErrBox msg={result.token.error ?? 'Erro desconhecido'} />
            )}
          </Panel>

          {/* WebSocket result */}
          <Panel title="wss://api.openai.com/v1/realtime (handshake real)" ms={result.wsMs} ok={result.ws?.ok === true}>
            {result.ws ? (
              result.ws.ok
                ? <DataRow label="Handshake" value={`OK em ${result.ws.ms}ms`} />
                : <ErrBox msg={result.ws.error ?? 'Erro desconhecido'} />
            ) : (
              <ErrBox msg="Não testado — minte o token primeiro" />
            )}
          </Panel>

          {/* Fix instructions */}
          {(!result.token.ok || result.ws?.ok === false) && (
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

// ── WebSocket round-trip test (same auth scheme as lib/nexus/voice-engine.ts) ──

function testWsRoundTrip(token: string, model: string): Promise<WsResult> {
  const TIMEOUT_MS = 10000
  return new Promise(resolve => {
    let settled = false
    const finish = (r: WsResult) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      try { ws.close() } catch { /* already closed */ }
      resolve(r)
    }

    const t0 = Date.now()
    const timer = setTimeout(() => finish({ ok: false, error: `Timeout aguardando handshake (${TIMEOUT_MS}ms)` }), TIMEOUT_MS)

    const ws = new WebSocket(
      `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(model)}`,
      ['realtime', `openai-insecure-api-key.${token}`],
    )

    ws.addEventListener('message', () => finish({ ok: true, ms: Date.now() - t0 }))
    ws.addEventListener('error',   () => finish({ ok: false, error: 'WebSocket error ao conectar' }))
    ws.addEventListener('close', (ev) => {
      if (!settled) finish({ ok: false, error: `Conexão fechada antes do handshake (code ${ev.code})` })
    })
  })
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
