// DEPRECATED — WhatsApp auto-send removed per architecture decision.
// All automated billing now runs via /api/cron/charge-email (email-only).
// This endpoint is kept to avoid 404s from old cron configs; does nothing.

import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

function handler() {
  return NextResponse.json({
    ok:         true,
    deprecated: true,
    message:    'Use /api/cron/charge-email for automated billing.',
  })
}

export const GET  = handler
export const POST = handler
