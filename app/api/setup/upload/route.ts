import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: Request) {
  try {
    const ctx = await getAuthContext()
    if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

    const formData = await req.formData()
    const files = formData.getAll('files') as File[]

    if (!files.length) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    const results: { name: string; id: string; status: string }[] = []

    for (const file of files.slice(0, 10)) { // cap at 10 files
      const ext = file.name.split('.').pop() ?? 'bin'
      const path = `${ctx.companyId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

      const arrayBuffer = await file.arrayBuffer()
      const buffer = Buffer.from(arrayBuffer)

      // Upload to Supabase Storage bucket "ai-training"
      const { error: storageErr } = await supabase.storage
        .from('ai-training')
        .upload(path, buffer, { contentType: file.type || 'application/octet-stream' })

      const storagePath = storageErr ? null : path

      // Record in DB
      const { data: record } = await supabase
        .from('ai_training_files')
        .insert({
          company_id: ctx.companyId,
          name: file.name,
          size: file.size,
          mime_type: file.type,
          storage_path: storagePath,
          status: storageErr ? 'error' : 'uploaded',
        })
        .select('id')
        .single()

      results.push({
        name: file.name,
        id: record?.id ?? '',
        status: storageErr ? 'error' : 'uploaded',
      })
    }

    // Track step
    await supabase
      .from('users')
      .update({ onboarding_step: 6 })
      .eq('id', ctx.user.id)

    return NextResponse.json({ files: results })
  } catch (err) {
    console.error('[setup/upload]', err)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
