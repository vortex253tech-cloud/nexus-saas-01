'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Dashboard Error Boundary]', error)
  }, [error])

  return (
    <div className="flex h-full min-h-screen items-center justify-center bg-zinc-950 p-6">
      <div className="flex max-w-md flex-col items-center gap-5 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10">
          <AlertTriangle size={28} className="text-red-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Algo deu errado</h2>
          <p className="mt-1 text-sm text-zinc-400">
            O painel encontrou um problema inesperado. Tente recarregar.
          </p>
          {error.digest && (
            <p className="mt-2 font-mono text-[10px] text-zinc-600">
              Ref: {error.digest}
            </p>
          )}
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-violet-500 active:scale-95"
        >
          <RefreshCw size={14} />
          Tentar novamente
        </button>
      </div>
    </div>
  )
}
