// POST /api/webhooks/stripe — Stripe subscription lifecycle handler
//
// Events handled:
//   customer.subscription.created  → activate plan
//   customer.subscription.updated  → plan change / renewal
//   customer.subscription.deleted  → downgrade to free
//   invoice.payment_succeeded       → mark active
//   invoice.payment_failed          → mark past_due
//   checkout.session.completed      → initial activation
//
// STRIPE_WEBHOOK_SECRET must be set in env for signature verification.

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient }   from '@/lib/supabase'
import { trackEvent }                from '@/lib/analytics'
import type { Plan }                  from '@/lib/db'

export const dynamic = 'force-dynamic'

// Map Stripe price IDs to NEXUS plan names
function priceIdToPlan(priceId: string): Plan | null {
  const map: Record<string, Plan> = {
    [process.env.STRIPE_STARTER_MONTHLY ?? '']: 'starter',
    [process.env.STRIPE_STARTER_ANNUAL  ?? '']: 'starter',
    [process.env.STRIPE_PRO_MONTHLY     ?? '']: 'pro',
    [process.env.STRIPE_PRO_ANNUAL      ?? '']: 'pro',
    [process.env.STRIPE_SCALE_MONTHLY   ?? '']: 'scale',
    [process.env.STRIPE_SCALE_ANNUAL    ?? '']: 'scale',
  }
  return map[priceId] ?? null
}

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    console.warn('[stripe-webhook] STRIPE_WEBHOOK_SECRET not set — skipping verification')
  }

  const rawBody = await req.text()
  const sig     = req.headers.get('stripe-signature') ?? ''

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: any

  if (secret) {
    try {
      const Stripe = (await import('stripe')).default
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-04-22.dahlia' })
      event = stripe.webhooks.constructEvent(rawBody, sig, secret)
    } catch (err) {
      console.error('[stripe-webhook] Signature verification failed:', err)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
    }
  } else {
    try { event = JSON.parse(rawBody) } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
    }
  }

  const db = getSupabaseServerClient()

  try {
    switch (event.type) {

      // ── Checkout completed → initial subscription activation ────────────────
      case 'checkout.session.completed': {
        const session   = event.data.object
        const userId    = session.metadata?.nexus_user_id
        const companyId = session.metadata?.nexus_company_id
        const plan      = session.metadata?.plan as Plan | undefined

        if (!userId || !plan) break

        await activateSubscription(db, {
          userId,
          companyId,
          plan,
          stripeCustomerId:     session.customer,
          stripeSubscriptionId: session.subscription,
          status:               'trialing',
          trialEndsAt:          null,
        })

        void trackEvent({
          name:       'subscription_activated',
          company_id: companyId ?? '',
          plan,
          properties: { stripe_customer: session.customer },
        })

        void trackEvent({
          name:       'trial_started',
          company_id: companyId ?? '',
          plan,
        })
        break
      }

      // ── Subscription created/updated ──────────────────────────────────────
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub     = event.data.object
        const priceId = sub.items?.data?.[0]?.price?.id as string | undefined
        const plan    = priceId ? priceIdToPlan(priceId) : null
        const userId  = sub.metadata?.nexus_user_id
        const companyId = sub.metadata?.nexus_company_id

        if (!userId) break

        const status = sub.status === 'trialing' ? 'trialing'
          : sub.status === 'active' ? 'active'
          : sub.status === 'past_due' ? 'past_due'
          : 'canceled'

        await db.from('subscriptions').upsert({
          user_id:                userId,
          plan:                   plan ?? 'free',
          status,
          stripe_customer_id:     sub.customer,
          stripe_subscription_id: sub.id,
          trial_ends_at:          sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
          current_period_end:     sub.current_period_end ? new Date(sub.current_period_end * 1000).toISOString() : null,
          updated_at:             new Date().toISOString(),
        }, { onConflict: 'user_id' })

        // Update user plan
        if (plan) {
          await db.from('users').update({ plan }).eq('id', userId)
        }

        if (event.type === 'customer.subscription.updated' && plan && companyId) {
          void trackEvent({
            name:       'subscription_activated',
            company_id: companyId,
            plan,
          })
        }
        break
      }

      // ── Subscription canceled ─────────────────────────────────────────────
      case 'customer.subscription.deleted': {
        const sub    = event.data.object
        const userId = sub.metadata?.nexus_user_id
        const companyId = sub.metadata?.nexus_company_id

        if (!userId) break

        await db.from('subscriptions').update({
          status:     'canceled',
          plan:       'free',
          updated_at: new Date().toISOString(),
        }).eq('stripe_subscription_id', sub.id)

        await db.from('users').update({ plan: 'free' }).eq('id', userId)

        if (companyId) {
          void trackEvent({
            name:       'subscription_canceled',
            company_id: companyId,
            plan:       'free',
          })
        }
        break
      }

      // ── Payment succeeded → ensure active ───────────────────────────────
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object
        const subId   = invoice.subscription

        if (subId) {
          await db.from('subscriptions')
            .update({ status: 'active', updated_at: new Date().toISOString() })
            .eq('stripe_subscription_id', subId)

          // Fetch userId to update plan on users table
          const { data: sub } = await db
            .from('subscriptions')
            .select('user_id, plan')
            .eq('stripe_subscription_id', subId)
            .maybeSingle()

          if (sub?.user_id && sub.plan) {
            await db.from('users').update({ plan: sub.plan }).eq('id', sub.user_id)
          }
        }
        break
      }

      // ── Payment failed → mark past_due + revoke plan access ──────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object
        const subId   = invoice.subscription

        if (subId) {
          await db.from('subscriptions')
            .update({ status: 'past_due', updated_at: new Date().toISOString() })
            .eq('stripe_subscription_id', subId)

          // Revoke access: downgrade user to free until payment is resolved
          const { data: sub } = await db
            .from('subscriptions')
            .select('user_id')
            .eq('stripe_subscription_id', subId)
            .maybeSingle()

          if (sub?.user_id) {
            await db.from('users').update({ plan: 'free' }).eq('id', sub.user_id)
          }
        }
        break
      }

      default:
        // Unhandled events — fine to ignore
    }
  } catch (err) {
    console.error(`[stripe-webhook] Handler error for ${event.type}:`, err)
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function activateSubscription(
  db: ReturnType<typeof getSupabaseServerClient>,
  params: {
    userId:               string
    companyId?:           string
    plan:                 Plan
    stripeCustomerId:     string
    stripeSubscriptionId: string
    status:               'trialing' | 'active'
    trialEndsAt:          string | null
  }
) {
  const now = new Date().toISOString()

  await db.from('subscriptions').upsert({
    user_id:                params.userId,
    plan:                   params.plan,
    status:                 params.status,
    stripe_customer_id:     params.stripeCustomerId,
    stripe_subscription_id: params.stripeSubscriptionId,
    trial_ends_at:          params.trialEndsAt,
    updated_at:             now,
  }, { onConflict: 'user_id' })

  await db.from('users').update({ plan: params.plan }).eq('id', params.userId)
}
