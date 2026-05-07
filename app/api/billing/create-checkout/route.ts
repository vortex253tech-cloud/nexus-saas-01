// POST /api/billing/create-checkout — Create Stripe checkout session
//
// Body: { plan: 'starter' | 'pro' | 'scale', period: 'monthly' | 'annual' }
// Returns: { url } — redirect to Stripe hosted checkout
//
// Falls back to WhatsApp contact URL if STRIPE_SECRET_KEY is not configured.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext }            from '@/lib/auth'
import { getSupabaseServerClient }   from '@/lib/supabase'
import { getFeatures }               from '@/lib/plan-gates'
import { trackEvent }                from '@/lib/analytics'
import { getString, readJsonObject }  from '@/lib/unknown'
import type { Plan }                  from '@/lib/db'

const VALID_PLANS:   Plan[]                     = ['starter', 'pro', 'scale']
const VALID_PERIODS: Array<'monthly' | 'annual'> = ['monthly', 'annual']

export async function POST(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body   = await readJsonObject(req)
  const plan   = getString(body ?? {}, 'plan')   as Plan | undefined
  const period = getString(body ?? {}, 'period') as 'monthly' | 'annual' | undefined

  if (!plan || !VALID_PLANS.includes(plan)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }
  if (period && !VALID_PERIODS.includes(period)) {
    return NextResponse.json({ error: 'Invalid period' }, { status: 400 })
  }

  const billingPeriod = period ?? 'monthly'
  const features      = getFeatures(plan)
  const priceId       = billingPeriod === 'annual'
    ? features.stripePriceIdAnnual
    : features.stripePriceIdMonthly

  const origin = req.nextUrl.origin

  // Track intent
  void trackEvent({
    name:       'checkout_started',
    company_id: auth.companyId,
    user_id:    auth.user.id,
    plan:       auth.effectivePlan,
    properties: { target_plan: plan, period: billingPeriod },
  })

  // ── Stripe path ───────────────────────────────────────────────────────────
  if (process.env.STRIPE_SECRET_KEY && priceId) {
    try {
      const Stripe = (await import('stripe')).default
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        apiVersion: '2026-04-22.dahlia',
      })

      // Get or create Stripe customer
      const db = getSupabaseServerClient()
      const { data: user } = await db
        .from('users')
        .select('email, name')
        .eq('id', auth.user.id)
        .single()

      const { data: sub } = await db
        .from('subscriptions')
        .select('stripe_customer_id')
        .eq('user_id', auth.user.id)
        .maybeSingle()

      let customerId = sub?.stripe_customer_id as string | undefined

      if (!customerId && user?.email) {
        const customer = await stripe.customers.create({
          email: user.email as string,
          name:  (user.name ?? undefined) as string | undefined,
          metadata: { nexus_user_id: auth.user.id, nexus_company_id: auth.companyId },
        })
        customerId = customer.id
      }

      const session = await stripe.checkout.sessions.create({
        mode:               'subscription',
        payment_method_types: ['card'],
        customer:           customerId,
        line_items:         [{ price: priceId, quantity: 1 }],
        success_url:        `${origin}/dashboard?checkout=success&plan=${plan}`,
        cancel_url:         `${origin}/dashboard/upgrade?canceled=1`,
        allow_promotion_codes: true,
        subscription_data: {
          trial_period_days: 7,
          metadata: { nexus_user_id: auth.user.id, nexus_company_id: auth.companyId, plan },
        },
        metadata: { nexus_user_id: auth.user.id, nexus_company_id: auth.companyId, plan },
      })

      return NextResponse.json({ url: session.url })
    } catch (err) {
      console.error('[billing] Stripe error:', err)
      // Fall through to manual fallback
    }
  }

  // ── Manual fallback: WhatsApp contact ─────────────────────────────────────
  const planNames: Record<string, string> = { starter: 'Starter', pro: 'Pro', scale: 'Scale' }
  const msg = encodeURIComponent(
    `Olá! Quero assinar o plano ${planNames[plan] ?? plan} do NEXUS (${billingPeriod === 'annual' ? 'anual' : 'mensal'}). Meu email: ${auth.companyId}`
  )
  const whatsappUrl = `https://wa.me/${process.env.SUPPORT_WHATSAPP ?? '5511999999999'}?text=${msg}`

  return NextResponse.json({ url: whatsappUrl, fallback: true })
}
