'use client'

import type { EventName } from '@/lib/analytics'

export function track(
  name: EventName,
  properties?: Record<string, unknown>,
  value?: number,
) {
  fetch('/api/analytics/track', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ name, properties, value }),
  }).catch(() => null)
}
