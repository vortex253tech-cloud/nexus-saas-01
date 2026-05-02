// GET /api/import/sheets?url=<encoded_sheets_url>
// Fetches a public Google Sheets as CSV and returns parsed headers + rows.
// Server-side to avoid CORS issues.

import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext }            from '@/lib/auth'
import { parseCSV }                  from '@/lib/import/csv-parser'

export const dynamic = 'force-dynamic'

function extractSheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  return match?.[1] ?? null
}

function extractGid(url: string): string {
  const match = url.match(/[?&]gid=(\d+)/)
  return match?.[1] ?? '0'
}

export async function GET(req: NextRequest) {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const raw = req.nextUrl.searchParams.get('url')
  if (!raw) return NextResponse.json({ error: 'url required' }, { status: 400 })

  let url: string
  try { url = decodeURIComponent(raw) } catch {
    url = raw
  }

  const sheetId = extractSheetId(url)
  if (!sheetId) {
    return NextResponse.json(
      { error: 'URL inválida. Cole um link do Google Sheets (ex: https://docs.google.com/spreadsheets/d/...)' },
      { status: 400 },
    )
  }

  const gid        = extractGid(url)
  const exportUrl  = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`

  let csvText: string
  try {
    const res = await fetch(exportUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NEXUS-Importer/1.0)' },
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json(
          { error: 'Planilha privada. Certifique-se de que ela está compartilhada como "Qualquer pessoa com o link pode visualizar".' },
          { status: 403 },
        )
      }
      return NextResponse.json(
        { error: `Google retornou erro ${res.status}. Verifique se o link está correto.` },
        { status: 502 },
      )
    }

    // Verify it's actually CSV / text
    const contentType = res.headers.get('content-type') ?? ''
    if (contentType.includes('text/html')) {
      return NextResponse.json(
        { error: 'Planilha privada. Compartilhe como "Qualquer pessoa com o link pode visualizar" e tente novamente.' },
        { status: 403 },
      )
    }

    csvText = await res.text()
  } catch (e) {
    if (e instanceof Error && e.name === 'TimeoutError') {
      return NextResponse.json({ error: 'Tempo limite atingido ao buscar planilha.' }, { status: 504 })
    }
    return NextResponse.json({ error: 'Falha ao conectar ao Google Sheets.' }, { status: 502 })
  }

  if (!csvText.trim()) {
    return NextResponse.json({ error: 'Planilha vazia ou sem dados.' }, { status: 422 })
  }

  const { headers, rows } = parseCSV(csvText)

  if (headers.length === 0) {
    return NextResponse.json({ error: 'Não foi possível detectar colunas na planilha.' }, { status: 422 })
  }

  return NextResponse.json({
    headers,
    rows: rows.slice(0, 2000),   // cap at 2000
    total: rows.length,
  })
}
