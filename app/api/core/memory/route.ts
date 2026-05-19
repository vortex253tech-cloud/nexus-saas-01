// GET    /api/core/memory?type=X&key=Y   — read a memory entry
// POST   /api/core/memory               — write a memory entry
// DELETE /api/core/memory?type=X&key=Y  — delete a memory entry

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext }            from '@/lib/auth'
import { getMemory, setMemory, deleteMemory, listMemory } from '@/lib/core/memory'
import type { MemoryType }           from '@/lib/core/types'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') as MemoryType | null
  const key  = searchParams.get('key')

  if (!type) return NextResponse.json({ error: 'type is required' }, { status: 400 })

  if (key) {
    const entry = await getMemory(ctx.company.id, type, key)
    return NextResponse.json({ entry })
  }

  // List all entries for this type
  const entries = await listMemory(ctx.company.id, type)
  return NextResponse.json({ entries })
}

export async function POST(req: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { type?: string; key?: string; value?: Record<string, unknown>; ttl_seconds?: number }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!body.type || !body.key || !body.value) {
    return NextResponse.json({ error: 'type, key, value required' }, { status: 400 })
  }

  await setMemory(ctx.company.id, body.type as MemoryType, body.key, body.value, body.ttl_seconds)
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') as MemoryType | null
  const key  = searchParams.get('key')

  if (!type || !key) return NextResponse.json({ error: 'type and key required' }, { status: 400 })

  await deleteMemory(ctx.company.id, type, key)
  return NextResponse.json({ ok: true })
}
