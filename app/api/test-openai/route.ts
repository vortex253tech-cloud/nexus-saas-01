import { NextResponse } from 'next/server'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'

export async function GET() {
  const key = process.env.OPENAI_API_KEY
  if (!key) return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 })

  try {
    const openai = new OpenAI({ apiKey: key, timeout: 10000 })
    const res = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      max_tokens: 20,
      messages: [{ role: 'user', content: 'diga apenas: OpenAI funcionando' }],
    })
    const text = res.choices[0]?.message?.content ?? ''
    return NextResponse.json({ ok: true, response: text, model: res.model })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
