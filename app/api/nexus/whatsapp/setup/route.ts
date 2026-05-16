// POST /api/nexus/whatsapp/setup — Auto-configure Z-API webhook + connected phone
// Called once after successful QR scan so NEXUS AI receives all incoming messages.

import { NextResponse } from 'next/server'

export const dynamic    = 'force-dynamic'
export const maxDuration = 15

export async function POST() {
  const instanceId  = process.env.ZAPI_INSTANCE_ID
  const token       = process.env.ZAPI_TOKEN
  const clientToken = process.env.ZAPI_CLIENT_TOKEN
  const siteUrl     = process.env.NEXT_PUBLIC_SITE_URL ?? ''

  if (!instanceId || !token) {
    return NextResponse.json({ error: 'Z-API not configured' }, { status: 503 })
  }

  const webhookUrl = `${siteUrl}/api/whatsapp/webhook`

  const base    = `https://api.z-api.io/instances/${instanceId}/token/${token}`
  const headers = { 'Content-Type': 'application/json', 'Client-Token': clientToken ?? '' }

  // Run all setup calls in parallel — failures are non-fatal (log, don't error)
  const results = await Promise.allSettled([
    // 1. Set receive webhook (incoming messages)
    fetch(`${base}/update-webhook`, {
      method:  'PUT',
      headers,
      body:    JSON.stringify({ value: webhookUrl }),
      signal:  AbortSignal.timeout(8000),
    }),
    // 2. Set delivery webhook (read receipts)
    fetch(`${base}/update-webhook-delivery`, {
      method:  'PUT',
      headers,
      body:    JSON.stringify({ value: webhookUrl }),
      signal:  AbortSignal.timeout(8000),
    }),
    // 3. Enable message history sync
    fetch(`${base}/update-history-sync`, {
      method:  'PUT',
      headers,
      body:    JSON.stringify({ value: true }),
      signal:  AbortSignal.timeout(8000),
    }),
  ])

  for (const [i, r] of results.entries()) {
    if (r.status === 'rejected') {
      console.error(`[wa/setup] call ${i} failed:`, String(r.reason))
    }
  }

  return NextResponse.json({ ok: true, webhook_url: webhookUrl })
}
