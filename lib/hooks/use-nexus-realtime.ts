'use client'

// NEXUS Core Engine — Realtime React Hook
// Subscribes to `nexus_events` table via Supabase Realtime.
// Drop in anywhere: const { events, metrics } = useNexusRealtime(companyId)

import { useEffect, useRef, useState, useCallback } from 'react'
import { getSupabaseClient }  from '@/lib/supabase'
import type { NexusEvent, NexusEventType, DashboardMetrics } from '@/lib/core/types'

interface UseNexusRealtimeOptions {
  company_id:   string
  filter_types?: NexusEventType[]
  on_event?:    (event: NexusEvent) => void
  auto_metrics?: boolean   // auto-refresh /api/core/analytics on changes
}

interface UseNexusRealtimeResult {
  events:         NexusEvent[]
  metrics:        DashboardMetrics | null
  connected:      boolean
  last_event_at:  string | null
  refresh_metrics: () => Promise<void>
}

export function useNexusRealtime({
  company_id,
  filter_types,
  on_event,
  auto_metrics = false,
}: UseNexusRealtimeOptions): UseNexusRealtimeResult {
  const [events, setEvents]           = useState<NexusEvent[]>([])
  const [metrics, setMetrics]         = useState<DashboardMetrics | null>(null)
  const [connected, setConnected]     = useState(false)
  const [lastEventAt, setLastEventAt] = useState<string | null>(null)
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabaseClient>['channel']> | null>(null)

  const refreshMetrics = useCallback(async () => {
    try {
      const res = await fetch('/api/core/analytics')
      if (res.ok) {
        const data = await res.json()
        setMetrics(data)
      }
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (!company_id) return

    const supabase = getSupabaseClient()

    const channel = supabase
      .channel(`nexus-events-${company_id}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'nexus_events',
          filter: `company_id=eq.${company_id}`,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (payload: any) => {
          const event = payload.new as NexusEvent

          // Apply type filter
          if (filter_types && !filter_types.includes(event.type)) return

          setEvents((prev) => [event, ...prev].slice(0, 100))
          setLastEventAt(event.created_at)
          on_event?.(event)

          if (auto_metrics) {
            refreshMetrics()
          }
        },
      )
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .subscribe((status: any) => {
        setConnected(status === 'SUBSCRIBED')
      })

    channelRef.current = channel

    // Initial metrics load
    if (auto_metrics) refreshMetrics()

    return () => {
      supabase.removeChannel(channel)
      setConnected(false)
    }
  }, [company_id, auto_metrics, filter_types, on_event, refreshMetrics])

  return {
    events,
    metrics,
    connected,
    last_event_at: lastEventAt,
    refresh_metrics: refreshMetrics,
  }
}
