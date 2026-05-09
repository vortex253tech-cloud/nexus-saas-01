// ─── Z-API WhatsApp Integration ────────────────────────────────
// Server-side only. Never import in client components.
//
// Z-API docs: https://developer.z-api.io
//
// Each company can have their own Z-API instance (stored encrypted in
// business_identity) or fall back to the platform-level instance from env.
//
// Required env vars (platform-level fallback):
//   ZAPI_INSTANCE_ID   — Instance ID from Z-API dashboard
//   ZAPI_TOKEN         — Instance Token from Z-API dashboard
//   ZAPI_CLIENT_TOKEN  — Account-level Client-Token (optional on some plans)

const ZAPI_BASE = 'https://api.z-api.io'

export interface ZApiConfig {
  instanceId:  string
  token:       string
  clientToken?: string
}

export interface ZApiResult {
  success:    boolean
  id?:        string
  error?:     string
  simulated?: true
}

// ─── Resolve config ────────────────────────────────────────────
// Returns per-company config if provided, otherwise falls back to env vars.
// Returns null if neither is configured (will simulate).

export function resolveZApiConfig(override?: Partial<ZApiConfig> | null): ZApiConfig | null {
  const instanceId  = override?.instanceId  || process.env.ZAPI_INSTANCE_ID
  const token       = override?.token       || process.env.ZAPI_TOKEN
  const clientToken = override?.clientToken || process.env.ZAPI_CLIENT_TOKEN

  if (!instanceId || !token) return null
  return { instanceId, token, clientToken }
}

// ─── Send text message ─────────────────────────────────────────

export async function zapiSendText(params: {
  to:     string          // E.164 or local BR format — Z-API accepts both
  body:   string
  config: ZApiConfig
}): Promise<ZApiResult> {
  const { to, body, config } = params
  const { instanceId, token, clientToken } = config

  // Z-API expects number without '+' sign
  const phone = to.replace(/^\+/, '')

  const url = `${ZAPI_BASE}/instances/${instanceId}/token/${token}/send-text`

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (clientToken) headers['Client-Token'] = clientToken

    const res = await fetch(url, {
      method:  'POST',
      headers,
      body: JSON.stringify({ phone, message: body }),
    })

    const json = await res.json() as { zaapId?: string; messageId?: string; error?: string; message?: string }

    if (!res.ok) {
      const errMsg = json.error ?? json.message ?? `HTTP ${res.status}`
      return { success: false, error: errMsg }
    }

    return { success: true, id: json.zaapId ?? json.messageId }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Z-API request failed'
    return { success: false, error: msg }
  }
}

// ─── Send image ────────────────────────────────────────────────

export async function zapiSendImage(params: {
  to:      string
  imageUrl: string
  caption?: string
  config:  ZApiConfig
}): Promise<ZApiResult> {
  const { to, imageUrl, caption, config } = params
  const { instanceId, token, clientToken } = config

  const phone = to.replace(/^\+/, '')
  const url = `${ZAPI_BASE}/instances/${instanceId}/token/${token}/send-image`

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (clientToken) headers['Client-Token'] = clientToken

    const res = await fetch(url, {
      method:  'POST',
      headers,
      body: JSON.stringify({ phone, image: imageUrl, caption: caption ?? '' }),
    })

    const json = await res.json() as { zaapId?: string; messageId?: string; error?: string; message?: string }

    if (!res.ok) {
      return { success: false, error: json.error ?? json.message ?? `HTTP ${res.status}` }
    }

    return { success: true, id: json.zaapId ?? json.messageId }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Z-API error' }
  }
}

// ─── Check instance status ─────────────────────────────────────

export async function zapiGetStatus(config: ZApiConfig): Promise<{
  connected: boolean
  phone?:    string
  error?:    string
}> {
  const { instanceId, token, clientToken } = config
  const url = `${ZAPI_BASE}/instances/${instanceId}/token/${token}/status`

  try {
    const headers: Record<string, string> = {}
    if (clientToken) headers['Client-Token'] = clientToken

    const res = await fetch(url, { headers })
    const json = await res.json() as { connected?: boolean; smartphoneConnected?: boolean; phone?: string; error?: string }

    return {
      connected: json.connected ?? json.smartphoneConnected ?? false,
      phone:     json.phone,
    }
  } catch (err) {
    return { connected: false, error: err instanceof Error ? err.message : 'Z-API error' }
  }
}
