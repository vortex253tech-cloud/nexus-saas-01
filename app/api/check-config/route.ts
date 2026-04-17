// GET /api/check-config
// Returns which optional features are configured (no secrets exposed).

import { NextResponse } from 'next/server'

export async function GET() {
  const anthropicKey = process.env.ANTHROPIC_API_KEY ?? ''
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''

  return NextResponse.json({
    hasAnthropicKey: anthropicKey.length > 10 && !anthropicKey.includes('your_'),
    hasSupabase: supabaseUrl.length > 10 && !supabaseUrl.includes('placeholder'),
  })
}
