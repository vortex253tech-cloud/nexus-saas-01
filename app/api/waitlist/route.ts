import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: Request) {
  try {
    const body = await req.json() as { name?: string; email?: string; company?: string; team_size?: string }
    const { name, email, company, team_size } = body

    if (!name?.trim() || !email?.trim() || !company?.trim()) {
      return NextResponse.json({ error: 'Preencha todos os campos obrigatórios.' }, { status: 400 })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'E-mail inválido.' }, { status: 400 })
    }

    const { error } = await supabase.from('waitlist').insert({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      company: company.trim(),
      team_size: team_size ?? null,
    })

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Este e-mail já está na lista. Em breve você será contatado.' }, { status: 409 })
      }
      console.error('[waitlist] insert error:', error)
      return NextResponse.json({ error: 'Erro ao cadastrar. Tente novamente.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[waitlist] unexpected error:', err)
    return NextResponse.json({ error: 'Erro interno.' }, { status: 500 })
  }
}
