// GET  /api/settings/payments — list tenant's payment configs (sanitized)
// POST /api/settings/payments — save/update a provider config

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'
import { getString, readJsonObject } from '@/lib/unknown'
import { encrypt, decrypt, mask } from '@/lib/payments/encryption'

export const dynamic = 'force-dynamic'

type Provider = 'stripe' | 'mercadopago' | 'pix' | 'manual'

// Fields that must be encrypted at rest and never sent to the client
const SECRET_FIELDS = ['stripe_secret_key', 'stripe_webhook_secret', 'mp_access_token'] as const

// ─── GET — return sanitized configs (no raw secrets) ──────────────────────────

export async function GET() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = getSupabaseServerClient()
  const { data, error } = await db
    .from('user_payment_config')
    .select('*')
    .eq('company_id', auth.companyId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Sanitize: replace secret fields with masked version
  const sanitized = (data ?? []).map(row => {
    const safe: Record<string, unknown> = { ...row }
    for (const field of SECRET_FIELDS) {
      if (safe[field] && typeof safe[field] === 'string') {
        try {
          const plain = decrypt(safe[field] as string)
          safe[field] = mask(plain)
        } catch {
          safe[field] = '****' // corrupted — mask anyway
        }
      }
    }
    return safe
  })

  return NextResponse.json({ configs: sanitized })
}

// ─── POST — upsert a provider config ─────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await readJsonObject(req)
  if (!body) return NextResponse.json({ error: 'Body required' }, { status: 400 })

  const provider = getString(body, 'provider') as Provider | undefined
  if (!provider || !['stripe', 'mercadopago', 'pix', 'manual'].includes(provider)) {
    return NextResponse.json({ error: 'Invalid provider' }, { status: 400 })
  }

  // Build the row — encrypt sensitive fields
  const row: Record<string, unknown> = {
    company_id: auth.companyId,
    provider,
    is_active:  body['is_active'] !== false,
    updated_at: new Date().toISOString(),
  }

  // ── Stripe ────────────────────────────────────────────────────────────────
  if (provider === 'stripe') {
    const pubKey    = getString(body, 'stripe_publishable_key')
    const secretKey = getString(body, 'stripe_secret_key')
    const webhookSecret = getString(body, 'stripe_webhook_secret')

    if (!pubKey || !secretKey) {
      return NextResponse.json({ error: 'stripe_publishable_key and stripe_secret_key are required' }, { status: 400 })
    }
    if (!pubKey.startsWith('pk_')) {
      return NextResponse.json({ error: 'stripe_publishable_key must start with pk_' }, { status: 400 })
    }
    if (!secretKey.startsWith('sk_')) {
      return NextResponse.json({ error: 'stripe_secret_key must start with sk_' }, { status: 400 })
    }

    row['stripe_publishable_key'] = pubKey
    row['stripe_secret_key']      = encrypt(secretKey)
    if (webhookSecret) row['stripe_webhook_secret'] = encrypt(webhookSecret)
  }

  // ── Mercado Pago ──────────────────────────────────────────────────────────
  if (provider === 'mercadopago') {
    const accessToken = getString(body, 'mp_access_token')
    const publicKey   = getString(body, 'mp_public_key')

    if (!accessToken) {
      return NextResponse.json({ error: 'mp_access_token is required' }, { status: 400 })
    }
    if (!accessToken.startsWith('APP_USR-') && !accessToken.startsWith('TEST-')) {
      return NextResponse.json({ error: 'mp_access_token format invalid (must start with APP_USR- or TEST-)' }, { status: 400 })
    }

    row['mp_access_token'] = encrypt(accessToken)
    if (publicKey) row['mp_public_key'] = publicKey
  }

  // ── Pix ───────────────────────────────────────────────────────────────────
  if (provider === 'pix') {
    const pixKey      = getString(body, 'pix_key')
    const holderName  = getString(body, 'pix_holder_name')
    const pixKeyType  = getString(body, 'pix_key_type')
    const pixCity     = getString(body, 'pix_city')

    if (!pixKey || !holderName) {
      return NextResponse.json({ error: 'pix_key and pix_holder_name are required' }, { status: 400 })
    }

    row['pix_key']         = pixKey
    row['pix_key_type']    = pixKeyType ?? 'aleatoria'
    row['pix_holder_name'] = holderName
    row['pix_city']        = pixCity ?? 'SAO PAULO'
  }

  const db = getSupabaseServerClient()

  const { data, error } = await db
    .from('user_payment_config')
    .upsert(row, { onConflict: 'company_id,provider' })
    .select('id, provider, is_active, created_at, updated_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true, config: data })
}

// ─── DELETE — remove a provider config ───────────────────────────────────────

export async function DELETE(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const provider = searchParams.get('provider') as Provider | null
  if (!provider) return NextResponse.json({ error: 'provider param required' }, { status: 400 })

  const db = getSupabaseServerClient()
  const { error } = await db
    .from('user_payment_config')
    .delete()
    .eq('company_id', auth.companyId)
    .eq('provider', provider)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
