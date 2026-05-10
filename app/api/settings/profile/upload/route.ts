import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseRouteClient } from '@/lib/supabase-server'

const BUCKET = 'brand-assets'
const MAX_BYTES = 5 * 1024 * 1024
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'])

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  )
}

export async function POST(req: NextRequest) {
  // Authenticate with cookie-based client so we can read the session
  const db = await getSupabaseRouteClient()
  const { data: { user } } = await db.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: u } = await db.from('users').select('id').eq('auth_id', user.id).single()
  if (!u) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data: c } = await db.from('companies').select('id').eq('user_id', u.id).single()
  if (!c) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const kind = (formData.get('kind') as string) ?? 'logo'  // logo | banner | icon

  if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: 'Tipo não suportado. Use PNG, JPG, WebP ou SVG.' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Arquivo maior que 5 MB.' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'png'
  const path = `${c.id}/${kind}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const supabase = adminClient()
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: file.type, upsert: true })

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path)
  const url = `${pub.publicUrl}?t=${Date.now()}`   // cache-bust

  return NextResponse.json({ url })
}
