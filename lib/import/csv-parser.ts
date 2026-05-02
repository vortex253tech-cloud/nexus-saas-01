// CSV parser — handles quoted fields, BOM, CRLF, semicolon delimiters

export interface ParseResult {
  headers: string[]
  rows: Record<string, string>[]
}

export function parseCSV(raw: string): ParseResult {
  // Remove UTF-8 BOM, normalize line endings
  const text = raw.replace(/^﻿/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  const lines = text.split('\n').filter(l => l.trim() !== '')
  if (lines.length < 1) return { headers: [], rows: [] }

  // Auto-detect delimiter (comma vs semicolon)
  const firstLine = lines[0]
  const delimiter = firstLine.includes(';') && !firstLine.includes(',') ? ';' : ','

  const headers = parseLine(firstLine, delimiter).map(h => h.trim())
  if (headers.length === 0) return { headers: [], rows: [] }

  const rows = lines.slice(1).map(line => {
    const vals = parseLine(line, delimiter)
    const obj: Record<string, string> = {}
    headers.forEach((h, i) => {
      obj[h] = (vals[i] ?? '').trim()
    })
    return obj
  }).filter(row => {
    // Skip rows where all values are empty
    return Object.values(row).some(v => v !== '')
  })

  return { headers, rows }
}

function parseLine(line: string, delimiter: string): string[] {
  const fields: string[] = []
  let i = 0
  let current = ''

  while (i < line.length) {
    const ch = line[i]

    if (ch === '"') {
      // Quoted field
      i++
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          // Escaped double-quote
          current += '"'
          i += 2
        } else if (line[i] === '"') {
          i++
          break
        } else {
          current += line[i++]
        }
      }
      // Consume trailing delimiter or end
      if (i < line.length && line[i] === delimiter) {
        fields.push(current)
        current = ''
        i++
      }
    } else if (ch === delimiter) {
      fields.push(current)
      current = ''
      i++
    } else {
      current += line[i++]
    }
  }

  fields.push(current)
  return fields
}

/** Detect likely column type from header name (heuristic, for auto-mapping) */
export function detectFieldType(header: string): string | null {
  const h = header.toLowerCase().trim()

  if (/nome|name|client|cliente|razão|empresa|company/.test(h))           return 'name'
  if (/e.?mail|email|e_mail/.test(h))                                      return 'email'
  if (/tel|phone|fone|celular|whatsapp|cel|contato/.test(h))              return 'phone'
  if (/status|situação|situacao|estado/.test(h))                          return 'status'
  if (/valor|value|receita|revenue|total|amount|débito|divida|dívida/.test(h)) return 'value'
  if (/interação|interacao|ultimo|última|last|data_contato|contato/.test(h))   return 'last_interaction'
  if (/origem|source|canal|channel|procedencia/.test(h))                  return 'origem'
  if (/nota|note|obs|observa|comment/.test(h))                            return 'notes'

  return null
}
