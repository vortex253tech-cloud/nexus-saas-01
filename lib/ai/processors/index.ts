// ─── Unified document processor ──────────────────────────────────────────────
// Detects MIME type and routes to the correct parser.
// Returns plain text that gets injected into the AI context.

export interface ProcessedDocument {
  text:     string     // extracted text (may be truncated at 12 000 chars)
  pages?:   number
  sheets?:  string[]
  rows?:    number
  warning?: string
}

const MAX_CHARS = 12_000  // Claude context budget per document

// ─── PDF ─────────────────────────────────────────────────────────────────────

async function processPdf(buffer: Buffer): Promise<ProcessedDocument> {
  // Dynamic import so it only loads on Node.js (not edge)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod = (await import('pdf-parse')) as any
  const pdfParse = (mod.default ?? mod) as (buf: Buffer, opts?: { max?: number }) => Promise<{ text: string; numpages: number }>
  try {
    const data = await pdfParse(buffer, { max: 0 })
    const text = data.text.replace(/\s{3,}/g, '\n').trim()
    return {
      text:  text.slice(0, MAX_CHARS),
      pages: data.numpages,
      warning: text.length > MAX_CHARS ? `Documento truncado em ${MAX_CHARS} caracteres.` : undefined,
    }
  } catch (err) {
    throw new Error(`Falha ao processar PDF: ${err instanceof Error ? err.message : String(err)}`)
  }
}

// ─── DOCX ────────────────────────────────────────────────────────────────────

async function processDocx(buffer: Buffer): Promise<ProcessedDocument> {
  const mammoth = await import('mammoth')
  try {
    const result = await mammoth.extractRawText({ buffer })
    const text   = result.value.replace(/\s{3,}/g, '\n').trim()
    return {
      text:    text.slice(0, MAX_CHARS),
      warning: text.length > MAX_CHARS ? `Documento truncado em ${MAX_CHARS} caracteres.` : undefined,
    }
  } catch (err) {
    throw new Error(`Falha ao processar DOCX: ${err instanceof Error ? err.message : String(err)}`)
  }
}

// ─── XLSX / XLS / CSV ────────────────────────────────────────────────────────

async function processSpreadsheet(buffer: Buffer, mime: string): Promise<ProcessedDocument> {
  const XLSX = await import('xlsx')
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const sheets   = workbook.SheetNames
    const parts: string[] = []
    let totalRows = 0

    for (const name of sheets) {
      const sheet = workbook.Sheets[name]!
      const rows  = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' })
      totalRows += rows.length

      if (rows.length === 0) continue

      // Convert to readable markdown-style table (first 200 rows)
      const cols = Object.keys(rows[0]!)
      const header = `| ${cols.join(' | ')} |`
      const sep    = `| ${cols.map(() => '---').join(' | ')} |`
      const dataRows = rows.slice(0, 200).map(r =>
        `| ${cols.map(c => String(r[c] ?? '')).join(' | ')} |`
      )

      parts.push(
        `### Planilha: ${name} (${rows.length} linhas)\n\n` +
        [header, sep, ...dataRows].join('\n')
      )
    }

    const text = parts.join('\n\n')
    return {
      text:    text.slice(0, MAX_CHARS),
      sheets,
      rows:    totalRows,
      warning: text.length > MAX_CHARS ? `Planilha truncada em ${MAX_CHARS} caracteres.` : undefined,
    }
  } catch (err) {
    throw new Error(`Falha ao processar planilha: ${err instanceof Error ? err.message : String(err)}`)
  }
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

async function processCsv(buffer: Buffer): Promise<ProcessedDocument> {
  const XLSX = await import('xlsx')
  try {
    const csv      = buffer.toString('utf-8')
    const workbook = XLSX.read(csv, { type: 'string' })
    return processSpreadsheet(buffer, 'text/csv').then(r => ({ ...r, warning: r.warning }))
  } catch {
    // Fallback: treat as plain text
    const text = buffer.toString('utf-8')
    return { text: text.slice(0, MAX_CHARS) }
  }
}

// ─── TXT ─────────────────────────────────────────────────────────────────────

function processTxt(buffer: Buffer): ProcessedDocument {
  const text = buffer.toString('utf-8').trim()
  return {
    text:    text.slice(0, MAX_CHARS),
    warning: text.length > MAX_CHARS ? `Arquivo truncado em ${MAX_CHARS} caracteres.` : undefined,
  }
}

// ─── Dispatcher ──────────────────────────────────────────────────────────────

export async function extractDocumentText(
  buffer:   Buffer,
  mime:     string,
  filename: string,
): Promise<ProcessedDocument> {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''

  if (mime === 'application/pdf' || ext === 'pdf') return processPdf(buffer)
  if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || ext === 'docx') return processDocx(buffer)
  if (mime === 'text/csv' || ext === 'csv') return processCsv(buffer)
  if (
    mime === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
    mime === 'application/vnd.ms-excel' ||
    ext === 'xlsx' || ext === 'xls'
  ) return processSpreadsheet(buffer, mime)
  if (mime === 'text/plain' || ext === 'txt') return processTxt(buffer)

  return { text: '', warning: 'Tipo de arquivo não possui extrator de texto.' }
}
