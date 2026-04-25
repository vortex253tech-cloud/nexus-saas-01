// POST /api/messages/templates/seed
// Idempotent: skips templates that already exist (matched by name + company).
// Creates 6 default templates on first call.

import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/auth'
import { getSupabaseServerClient } from '@/lib/supabase'

const DEFAULT_TEMPLATES = [
  {
    name:     'Cobrança Gentil',
    category: 'financial',
    type:     'email',
    subject:  'Lembrete: pagamento em aberto — {{empresa}}',
    content:  '<p>Olá <strong>{{nome}}</strong>,</p><p>Identificamos um pagamento em aberto de <strong>{{valor}}</strong> com vencimento em <strong>{{vencimento}}</strong>. Poderia verificar para nós?</p><p>Qualquer dúvida, estamos à disposição.</p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>',
  },
  {
    name:     'Cobrança Urgente',
    category: 'financial',
    type:     'email',
    subject:  '⚠️ Pagamento vencido — {{empresa}}',
    content:  '<p>Prezado(a) <strong>{{nome}}</strong>,</p><p>Seu pagamento de <strong>{{valor}}</strong> está vencido há alguns dias. Por favor, regularize sua situação o mais breve possível para evitar inconvenientes.</p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>',
  },
  {
    name:     'Lembrete de Vencimento',
    category: 'financial',
    type:     'email',
    subject:  'Seu pagamento vence amanhã — {{empresa}}',
    content:  '<p>Olá <strong>{{nome}}</strong>,</p><p>Só um lembrete: seu pagamento de <strong>{{valor}}</strong> vence amanhã, <strong>{{vencimento}}</strong>. Não se esqueça!</p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>',
  },
  {
    name:     'Recuperação de Carrinho',
    category: 'sales',
    type:     'email',
    subject:  'Você esqueceu algo — {{empresa}}',
    content:  '<p>Olá <strong>{{nome}}</strong>,</p><p>Você deixou itens no carrinho! Não perca essa oportunidade de finalizar sua compra.</p><p><a href="{{link_pagamento}}" style="color:#7c3aed">Finalizar compra →</a></p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>',
  },
  {
    name:     'Boas-Vindas',
    category: 'relationship',
    type:     'email',
    subject:  'Bem-vindo(a) à {{empresa}}! 🎉',
    content:  '<p>Olá <strong>{{nome}}</strong>,</p><p>Seja muito bem-vindo(a)! Estamos felizes em tê-lo(a) como nosso cliente e faremos tudo para superar suas expectativas.</p><p>Qualquer dúvida, estamos à disposição.</p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>',
  },
  {
    name:     'Nutrição de Lead',
    category: 'relationship',
    type:     'email',
    subject:  'Conteúdo especial para você — {{empresa}}',
    content:  '<p>Olá <strong>{{nome}}</strong>,</p><p>Preparamos um conteúdo exclusivo para ajudá-lo(a) a alcançar seus objetivos! Acreditamos que isso pode fazer toda a diferença para você.</p><p>Qualquer dúvida, responda este e-mail.</p><p>Atenciosamente,<br><strong>Equipe {{empresa}}</strong></p>',
  },
] as const

export async function POST() {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  const db         = getSupabaseServerClient()
  const companyId  = ctx.company.id

  // Check which templates already exist by name
  const { data: existing } = await db
    .from('message_templates')
    .select('name')
    .eq('company_id', companyId)

  const existingNames = new Set((existing ?? []).map(t => t.name))
  const toInsert = DEFAULT_TEMPLATES.filter(t => !existingNames.has(t.name))

  if (toInsert.length === 0) {
    return NextResponse.json({ created: 0, message: 'Templates já existem' })
  }

  const { error } = await db.from('message_templates').insert(
    toInsert.map(t => ({ ...t, company_id: companyId, is_default: true }))
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ created: toInsert.length }, { status: 201 })
}
