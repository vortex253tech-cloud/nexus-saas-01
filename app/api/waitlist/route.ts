import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { randomBytes } from 'crypto'
import { sendWelcomeEmail } from '@/lib/email-waitlist'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// Short memorable referral code: NX-XXXXXX (e.g. NX-A3F9K2)
function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous I/O/0/1
  const bytes = randomBytes(6)
  const code = Array.from(bytes).map(b => chars[b % chars.length]).join('')
  return `NX-${code}`
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      name?: string
      email?: string
      company?: string
      team_size?: string
      ref?: string      // referral code from URL ?ref=NX-XXXXXX
      source?: string   // utm_source
    }
    const { name, email, company, team_size, ref, source } = body

    if (!name?.trim() || !email?.trim() || !company?.trim()) {
      return NextResponse.json({ error: 'Preencha todos os campos obrigatórios.' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 })
    }

    // Validate referral code exists
    let validRef: string | null = null
    if (ref?.trim()) {
      const { data: referrer } = await supabase
        .from('waitlist')
        .select('referral_code')
        .eq('referral_code', ref.trim().toUpperCase())
        .maybeSingle()
      validRef = referrer?.referral_code ?? null
    }

    // Generate unique referral code (retry on collision)
    let referral_code = generateReferralCode()
    for (let i = 0; i < 5; i++) {
      const { data: existing } = await supabase
        .from('waitlist')
        .select('id')
        .eq('referral_code', referral_code)
        .maybeSingle()
      if (!existing) break
      referral_code = generateReferralCode()
    }

    // Base position = current count + 1
    const { count } = await supabase
      .from('waitlist')
      .select('*', { count: 'exact', head: true })

    const basePosition = (count ?? 0) + 1

    const { data: inserted, error } = await supabase
      .from('waitlist')
      .insert({
        name: name.trim(),
        email: email.toLowerCase().trim(),
        company: company.trim(),
        team_size: team_size ?? null,
        referral_code,
        referred_by: validRef,
        position: basePosition,
        source: source ?? null,
      })
      .select('name, position, referral_code, referrals_count')
      .single()

    if (error) {
      if (error.code === '23505') {
        // Already registered — return their data so we can show the referral UI
        const { data: existing } = await supabase
          .from('waitlist')
          .select('name, position, referral_code, referrals_count')
          .eq('email', email.toLowerCase().trim())
          .single()

        if (existing) {
          return NextResponse.json(
            { error: 'Você já está na lista.', already_registered: true, data: existing },
            { status: 409 },
          )
        }
        return NextResponse.json({ error: 'Este e-mail já está na lista.' }, { status: 409 })
      }
      console.error('[waitlist] insert error:', error)
      return NextResponse.json({ error: 'Erro ao cadastrar. Tente novamente.' }, { status: 500 })
    }

    // Fire-and-forget welcome email — don't block the response
    sendWelcomeEmail({
      name:          inserted.name,
      email:         email.toLowerCase().trim(),
      position:      inserted.position,
      referral_code: inserted.referral_code,
    }).catch(err => console.error('[waitlist] welcome email failed:', err))

    return NextResponse.json({
      success: true,
      data: {
        position: inserted.position,
        referral_code: inserted.referral_code,
        referrals_count: inserted.referrals_count,
        name: inserted.name,
      },
    })
  } catch (err) {
    console.error('[waitlist] unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}

// GET /api/waitlist?code=NX-XXXXXX  — check status by referral code
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code  = searchParams.get('code')?.toUpperCase()
  const email = searchParams.get('email')?.toLowerCase()

  if (!code && !email) {
    return NextResponse.json({ error: 'Forneça code ou email.' }, { status: 400 })
  }

  const query = supabase
    .from('waitlist')
    .select('name, position, referral_code, referrals_count, created_at')

  const { data, error } = code
    ? await query.eq('referral_code', code).single()
    : await query.eq('email', email!).single()

  if (error || !data) {
    return NextResponse.json({ error: 'Não encontrado.' }, { status: 404 })
  }

  return NextResponse.json({ data })
}
