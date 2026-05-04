// GET /api/cron/sales-followup — 24h follow-up automation
// Runs daily at 10:00 UTC via Vercel cron

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'
import { generateFollowupMessage, type Lead } from '@/lib/sales-engine'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const db = getSupabaseServerClient()
  const now = new Date().toISOString()

  // Fetch pending follow-up actions that are due
  const { data: pendingActions, error: actErr } = await db
    .from('sales_actions')
    .select('id, lead_id, company_id, payload, created_at')
    .eq('type', 'followup')
    .eq('status', 'pending')
    .lte('scheduled_for', now)
    .limit(100)

  if (actErr) {
    console.error('[sales-followup] Error fetching actions:', actErr.message)
    return NextResponse.json({ error: actErr.message }, { status: 500 })
  }

  if (!pendingActions?.length) {
    return NextResponse.json({ processed: 0, message: 'No pending follow-ups' })
  }

  let processed = 0
  let failed = 0

  for (const action of pendingActions) {
    try {
      // Load lead
      const { data: lead } = await db
        .from('leads')
        .select('*')
        .eq('id', action.lead_id)
        .eq('company_id', action.company_id)
        .maybeSingle()

      if (!lead || lead.status === 'won' || lead.status === 'lost') {
        // Mark action as completed (lead no longer relevant)
        await db
          .from('sales_actions')
          .update({ status: 'completed', executed_at: now })
          .eq('id', action.id)
        continue
      }

      // Determine follow-up stage
      const stage = lead.status === 'proposal' ? 'proposal' : 'no_response'
      const message = generateFollowupMessage(lead as Lead, stage)

      // Find or create a conversation
      const { data: conv } = await db
        .from('sales_conversations')
        .select('id')
        .eq('lead_id', action.lead_id)
        .eq('company_id', action.company_id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      let conversationId = conv?.id

      if (!conversationId) {
        const { data: newConv } = await db
          .from('sales_conversations')
          .insert({ lead_id: action.lead_id, company_id: action.company_id })
          .select('id')
          .single()
        conversationId = newConv?.id
      }

      if (conversationId) {
        // Persist follow-up message as AI message
        await db.from('sales_messages').insert({
          conversation_id: conversationId,
          role:            'ai',
          content:         message,
        })
      }

      // Mark action as completed + log new action for tracking
      await Promise.all([
        db
          .from('sales_actions')
          .update({ status: 'completed', executed_at: now })
          .eq('id', action.id),

        db.from('sales_actions').insert({
          lead_id:    action.lead_id,
          company_id: action.company_id,
          type:       'message',
          status:     'sent',
          payload:    { message, stage, source: 'followup_cron' },
          executed_at: now,
        }),
      ])

      processed++
    } catch (err) {
      console.error(`[sales-followup] Error processing action ${action.id}:`, err)
      failed++
    }
  }

  console.log(`[sales-followup] Done: ${processed} processed, ${failed} failed`)
  return NextResponse.json({ processed, failed, total: pendingActions.length })
}
