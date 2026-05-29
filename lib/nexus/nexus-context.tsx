'use client'

// lib/nexus/nexus-context.tsx
// React Context wrapping the NexusSessionManager singleton.
// The Provider lives at layout level — it never unmounts, so the session persists.

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import { nexusSessionManager, NexusSessionState } from './nexus-session-manager'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TranscriptLine {
  id:    number
  role:  'user' | 'assistant'
  text:  string
  final: boolean
}

export interface ActionLogEntry {
  id:      number
  name:    string
  message: string
  success: boolean
  ts:      Date
}

export interface NexusContextValue {
  state:       NexusSessionState
  levels:      number[]
  transcript:  TranscriptLine[]
  actionLog:   ActionLogEntry[]
  errorMsg:    string | null

  /** Start the session (no-op if already active). */
  activate:    () => Promise<void>
  /** Explicitly stop — only call from the "Desativar NEXUS" button. */
  deactivate:  () => void
  /** Send a text command. */
  sendText:    (text: string) => void
  /** Log an action result from the page (called by onToolCall). */
  pushAction:  (entry: Omit<ActionLogEntry, 'id'>) => void
}

// ── Context ───────────────────────────────────────────────────────────────────

const NexusContext = createContext<NexusContextValue | null>(null)

export function useNexusSession(): NexusContextValue {
  const ctx = useContext(NexusContext)
  if (!ctx) throw new Error('useNexusSession must be used inside NexusProvider')
  return ctx
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function NexusProvider({ children }: { children: React.ReactNode }) {
  const [state,      setState]      = useState<NexusSessionState>(nexusSessionManager.state)
  const [levels,     setLevels]     = useState<number[]>(new Array(24).fill(0))
  const [transcript, setTranscript] = useState<TranscriptLine[]>([])
  const [actionLog,  setActionLog]  = useState<ActionLogEntry[]>([])
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null)
  const idRef = useRef(0)

  // Subscribe to singleton events — these subscriptions live forever (layout never unmounts)
  useEffect(() => {
    const unsubState = nexusSessionManager.subscribeState(s => {
      setState(s)
      if (s !== 'error') setErrorMsg(null)
    })
    const unsubTranscript = nexusSessionManager.subscribeTranscript((role, text, final) => {
      setTranscript(prev => {
        if (!final) {
          const last = prev[prev.length - 1]
          if (last && last.role === role && !last.final) {
            return [...prev.slice(0, -1), { ...last, text }]
          }
        }
        idRef.current += 1
        const line: TranscriptLine = { id: idRef.current, role, text, final }
        const capped = prev.length >= 50 ? prev.slice(-49) : prev
        return [...capped, line]
      })
    })
    const unsubLevels = nexusSessionManager.subscribeLevels(l => setLevels(l))
    const unsubError  = nexusSessionManager.subscribeError(msg => {
      setErrorMsg(msg)
      setState('error')
    })

    return () => {
      unsubState()
      unsubTranscript()
      unsubLevels()
      unsubError()
    }
  }, [])

  const activate = useCallback(() => nexusSessionManager.connect(), [])

  const deactivate = useCallback(() => {
    nexusSessionManager.forceDisconnect()
    setLevels(new Array(24).fill(0))
  }, [])

  const sendText = useCallback((text: string) => {
    nexusSessionManager.sendText(text)
  }, [])

  const pushAction = useCallback((entry: Omit<ActionLogEntry, 'id'>) => {
    idRef.current += 1
    const full: ActionLogEntry = { ...entry, id: idRef.current }
    setActionLog(prev => {
      const capped = prev.length >= 20 ? prev.slice(-19) : prev
      return [...capped, full]
    })
  }, [])

  return (
    <NexusContext.Provider value={{
      state, levels, transcript, actionLog, errorMsg,
      activate, deactivate, sendText, pushAction,
    }}>
      {children}
    </NexusContext.Provider>
  )
}
