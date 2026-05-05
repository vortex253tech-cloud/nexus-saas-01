// POST /api/settings/payments/test — verify a provider's credentials work
//
// Accepts: { provider: 'stripe' | 'mercadopago' | 'pix' }
// Loads tenant config, decrypts secrets server-side, makes a real API call.
// Returns: { ok: boolean, message: string }

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'
import { getString, readJsonObject } from '@/lib/unknown'
import { decrypt } from '@/lib/payments/encryption'
import Stripe from 'stripe'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await readJsonObject(req)
  const provider = getString(body ?? {}, 'provider')
  if (!provider) return NextResponse.json({ error: 'provider required' }, { status: 400 })

  const db = getSupabaseServerClient()
  const { data: config } = await db
    .from('user_payment_config')
    .select('*')
    .eq('company_id', auth.companyId)
    .eq('provider', provider)
    .eq('is_active', true)
    .maybeSingle()

  if (!config) {
    return NextResponse.json({ ok: false, message: `Nenhuma configuração encontrada para ${provider}` })
  }

  try {
    switch (provider) {
      case 'stripe': {
        const secretKey = config.stripe_secret_key ? decrypt(config.stripe_secret_key as string) : null
        if (!secretKey) return NextResponse.json({ ok: false, message: 'stripe_secret_key não configurado' })

        const stripe = new Stripe(secretKey, { apiVersion: '2026-04-22.dahlia' })
        // A real API call that doesn't cost money — just reads account info
        const account = await stripe.accounts.retrieve(undefined as unknown as string)
        return NextResponse.json({
          ok: true,
          message: `Stripe conectado — conta: ${account.email ?? account.id}`,
        })
      }

      case 'mercadopago': {
        const token = config.mp_access_token ? decrypt(config.mp_access_token as string) : null
        if (!token) return NextResponse.json({ ok: false, message: 'mp_access_token não configurado' })

        const res = await fetch('https://api.mercadopago.com/users/me', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          const err = await res.json() as { message?: string }
          return NextResponse.json({ ok: false, message: `Mercado Pago: ${err.message ?? res.status}` })
        }
        const user = await res.json() as { email?: string; id?: number }
        return NextResponse.json({
          ok: true,
          message: `Mercado Pago conectado — conta: ${user.email ?? user.id}`,
        })
      }

      case 'pix': {
        const { pix_key, pix_holder_name } = config as Record<string, string | null>
        if (!pix_key || !pix_holder_name) {
          return NextResponse.json({ ok: false, message: 'Chave Pix ou nome do titular não configurado' })
        }
        // Pix is static — no external API to test. Just validate fields are present.
        return NextResponse.json({
          ok: true,
          message: `Chave Pix configurada — titular: ${pix_holder_name}`,
        })
      }

      default:
        return NextResponse.json({ ok: false, message: `Provider desconhecido: ${provider}` })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, message: msg })
  }
}
