'use client'

// ─── /start ───────────────────────────────────────────────────
// Entry point for the NEXUS onboarding funnel.
// Accepts query params from Lovable, Typeform, ads, or direct links:
//
//   /start?nome=João&email=joao@empresa.com&perfil=ecommerce
//         &fonte=lovable&meta=50000&empresa=MinhaLoja
//         &setor=E-commerce&stage=growing&revenueRange=10k-50k
//         &teamSize=small
//
// What it does:
//   1. Reads all params
//   2. Saves an initial lead record (POST /api/leads) so we capture
//      the user even if they abandon mid-wizard
//   3. Stores params in sessionStorage for the wizard to read
//   4. Redirects to /onboarding

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function StartInner() {
  const router = useRouter()
  const params = useSearchParams()

  useEffect(() => {
    const nome = params.get('nome') ?? undefined
    const email = params.get('email') ?? undefined
    const perfil = params.get('perfil') ?? undefined
    const fonte = params.get('fonte') ?? 'direct'
    const meta = params.get('meta') ?? undefined
    const empresa = params.get('empresa') ?? undefined
    const setor = params.get('setor') ?? undefined
    const stage = params.get('stage') ?? undefined
    const revenueRange = params.get('revenueRange') ?? undefined
    const teamSize = params.get('teamSize') ?? undefined

    // Build the initial respostas payload from any pre-filled data
    const respostas: Record<string, unknown> = {}
    if (empresa) respostas.nomeEmpresa = empresa
    if (setor) respostas.setor = setor
    if (meta) respostas.metaMensal = Number(meta)
    if (stage) respostas.stage = stage
    if (revenueRange) respostas.revenueRange = revenueRange
    if (teamSize) respostas.teamSize = teamSize

    // Store all params in sessionStorage — wizard reads from here
    const sessionData = {
      nome,
      email,
      perfil,
      fonte,
      meta,
      empresa,
      setor,
      stage,
      revenueRange,
      teamSize,
    }
    sessionStorage.setItem('nexus_start_params', JSON.stringify(sessionData))

    // Fire-and-forget: save the initial lead immediately
    // This way we capture the lead even if they abandon the wizard
    if (email || nome) {
      fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nome ?? null,
          email: email ?? null,
          perfil: perfil ?? null,
          respostas,
          fonte,
        }),
      }).catch(() => {
        // Silently ignore — wizard will retry on submit
      })
    }

    router.replace('/onboarding')
  }, [params, router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-violet-500" />
        <p className="text-sm text-zinc-500">Preparando sua experiência…</p>
      </div>
    </div>
  )
}

export default function StartPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-zinc-950">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-zinc-700 border-t-violet-500" />
        </div>
      }
    >
      <StartInner />
    </Suspense>
  )
}
