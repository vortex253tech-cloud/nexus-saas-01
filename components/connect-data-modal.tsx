'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useRef, useState } from 'react'
import {
  Upload, Link2, PenLine, X, ChevronRight, ChevronLeft,
  FileSpreadsheet, AlertCircle, CheckCircle2, Loader2,
  ArrowRight, Users,
} from 'lucide-react'
import { parseCSV, detectFieldType } from '@/lib/import/csv-parser'
import { cn } from '@/lib/cn'

// ─── Types ────────────────────────────────────────────────────

type Step     = 'source' | 'upload' | 'mapping' | 'preview'
type Source   = 'csv' | 'sheets' | 'manual'
type SysField = 'name' | 'email' | 'phone' | 'status' | 'value' | 'last_interaction' | 'origem' | 'notes' | '__skip'

interface ParsedData {
  headers: string[]
  rows: Record<string, string>[]
}

interface FieldMapping {
  [csvCol: string]: SysField
}

const SYSTEM_FIELDS: { key: SysField; label: string; required?: boolean }[] = [
  { key: 'name',             label: 'Nome',              required: true  },
  { key: 'email',            label: 'Email',                             },
  { key: 'phone',            label: 'Telefone / WhatsApp'                },
  { key: 'status',           label: 'Status'                             },
  { key: 'value',            label: 'Valor (R$)'                         },
  { key: 'last_interaction', label: 'Última interação'                   },
  { key: 'origem',           label: 'Origem'                             },
  { key: 'notes',            label: 'Notas'                              },
]

// ─── Auto-build initial mapping ───────────────────────────────

function buildAutoMapping(headers: string[]): FieldMapping {
  const mapping: FieldMapping = {}
  const used = new Set<SysField>()

  headers.forEach(h => {
    const detected = detectFieldType(h) as SysField | null
    if (detected && !used.has(detected)) {
      mapping[h] = detected
      used.add(detected)
    } else {
      mapping[h] = '__skip'
    }
  })
  return mapping
}

// ─── Step indicator ───────────────────────────────────────────

function Steps({ current }: { current: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: 'source',  label: 'Fonte'   },
    { id: 'upload',  label: 'Dados'   },
    { id: 'mapping', label: 'Campos'  },
    { id: 'preview', label: 'Revisar' },
  ]
  const idx = steps.findIndex(s => s.id === current)

  return (
    <div className="flex items-center gap-0 mb-6">
      {steps.map((s, i) => (
        <div key={s.id} className="flex items-center gap-0 flex-1">
          <div className={cn(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200',
            i < idx  ? 'text-emerald-400' :
            i === idx ? 'text-white' :
            'text-white/25',
          )}>
            <span className={cn(
              'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold border transition-all',
              i < idx   ? 'border-emerald-500 bg-emerald-500/15 text-emerald-400' :
              i === idx ? 'border-violet-400 bg-violet-500/20 text-violet-300' :
              'border-white/15 text-white/25',
            )}>
              {i < idx ? '✓' : i + 1}
            </span>
            {s.label}
          </div>
          {i < steps.length - 1 && (
            <div className={cn(
              'h-px flex-1 transition-all duration-300',
              i < idx ? 'bg-emerald-500/40' : 'bg-white/8',
            )} />
          )}
        </div>
      ))}
    </div>
  )
}

// ─── Step 1: Choose source ────────────────────────────────────

function SourceStep({ onChoose }: { onChoose: (s: Source) => void }) {
  const options: { id: Source; icon: React.ReactNode; title: string; desc: string }[] = [
    {
      id:    'csv',
      icon:  <FileSpreadsheet size={24} className="text-violet-400" />,
      title: 'Upload de CSV',
      desc:  'Importe um arquivo .csv ou .txt exportado de qualquer sistema',
    },
    {
      id:    'sheets',
      icon:  <Link2 size={24} className="text-emerald-400" />,
      title: 'Google Sheets',
      desc:  'Cole o link de uma planilha pública do Google Sheets',
    },
    {
      id:    'manual',
      icon:  <PenLine size={24} className="text-blue-400" />,
      title: 'Entrada manual',
      desc:  'Adicione clientes um por vez diretamente no formulário',
    },
  ]

  return (
    <div className="space-y-3">
      {options.map((opt, i) => (
        <motion.button
          key={opt.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
          onClick={() => onChoose(opt.id)}
          className="w-full flex items-center gap-4 p-4 rounded-xl border border-white/8 bg-white/3 hover:bg-white/6 hover:border-white/15 text-left transition-all group"
        >
          <div className="shrink-0 w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-white/8 transition-colors">
            {opt.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">{opt.title}</p>
            <p className="text-xs text-white/40 mt-0.5">{opt.desc}</p>
          </div>
          <ChevronRight size={16} className="text-white/25 group-hover:text-white/50 transition-colors shrink-0" />
        </motion.button>
      ))}
    </div>
  )
}

// ─── Step 2a: CSV Upload ───────────────────────────────────────

function CSVUploadStep({
  onParsed,
  onBack,
}: {
  onParsed: (data: ParsedData) => void
  onBack:   () => void
}) {
  const [dragging, setDragging]   = useState(false)
  const [error,    setError]      = useState<string | null>(null)
  const [loading,  setLoading]    = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback((file: File) => {
    setError(null)
    if (!file.name.match(/\.(csv|txt|tsv)$/i)) {
      setError('Use um arquivo .csv, .txt ou .tsv')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Arquivo muito grande. Máximo: 5 MB')
      return
    }
    setLoading(true)
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const text = e.target?.result as string
        const { headers, rows } = parseCSV(text)
        if (headers.length === 0) {
          setError('Arquivo vazio ou formato inválido')
          setLoading(false)
          return
        }
        if (rows.length === 0) {
          setError('Nenhum dado encontrado no arquivo')
          setLoading(false)
          return
        }
        onParsed({ headers, rows })
      } catch {
        setError('Erro ao processar arquivo. Verifique o formato.')
      } finally {
        setLoading(false)
      }
    }
    reader.onerror = () => {
      setError('Erro ao ler arquivo')
      setLoading(false)
    }
    reader.readAsText(file, 'UTF-8')
  }, [onParsed])

  return (
    <div className="space-y-4">
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault()
          setDragging(false)
          const file = e.dataTransfer.files[0]
          if (file) handleFile(file)
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 cursor-pointer transition-all duration-200',
          dragging ? 'border-violet-400 bg-violet-500/8' : 'border-white/12 hover:border-white/25 hover:bg-white/3',
        )}
      >
        {loading ? (
          <Loader2 size={28} className="text-violet-400 animate-spin" />
        ) : (
          <Upload size={28} className={cn('transition-colors', dragging ? 'text-violet-400' : 'text-white/30')} />
        )}
        <div className="text-center">
          <p className="text-sm font-medium text-white">{loading ? 'Processando...' : 'Arraste o arquivo aqui'}</p>
          <p className="text-xs text-white/40 mt-1">ou clique para selecionar · CSV, TXT, TSV · máx 5 MB</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.txt,.tsv"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-950 border border-red-500/30 px-4 py-3 text-sm text-red-300">
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      <div className="text-xs text-white/25 space-y-1">
        <p>Dicas para um CSV compatível:</p>
        <p>• Primeira linha deve ser o cabeçalho (Nome, Email, Telefone...)</p>
        <p>• Valores separados por vírgula ou ponto-e-vírgula</p>
        <p>• Exportado do Excel, LibreOffice ou Google Sheets</p>
      </div>

      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-white/35 hover:text-white/60 transition-colors">
        <ChevronLeft size={14} /> Voltar
      </button>
    </div>
  )
}

// ─── Step 2b: Google Sheets ────────────────────────────────────

function SheetsUploadStep({
  onParsed,
  onBack,
}: {
  onParsed: (data: ParsedData) => void
  onBack:   () => void
}) {
  const [url,     setUrl]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const handleFetch = async () => {
    setError(null)
    if (!url.trim()) { setError('Cole o link da planilha'); return }
    if (!url.includes('docs.google.com/spreadsheets')) {
      setError('Cole um link válido do Google Sheets')
      return
    }
    setLoading(true)
    try {
      const res  = await fetch(`/api/import/sheets?url=${encodeURIComponent(url.trim())}`)
      const data = await res.json() as { headers?: string[]; rows?: Record<string, string>[]; total?: number; error?: string }
      if (!res.ok) { setError(data.error ?? 'Erro ao buscar planilha'); return }
      onParsed({ headers: data.headers!, rows: data.rows! })
    } catch {
      setError('Falha de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs text-white/40 mb-2">Link da planilha Google Sheets</label>
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') void handleFetch() }}
          placeholder="https://docs.google.com/spreadsheets/d/..."
          className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none focus:border-violet-500 transition-colors"
        />
      </div>

      <div className="rounded-xl border border-amber-500/20 bg-amber-950/30 px-4 py-3 text-xs text-amber-300/80 space-y-1">
        <p className="font-medium">Requisito: planilha pública</p>
        <p>Planilha {'>'} Compartilhar {'>'} &quot;Qualquer pessoa com o link&quot; → Visualizador</p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-950 border border-red-500/30 px-4 py-3 text-sm text-red-300">
          <AlertCircle size={14} className="shrink-0" />
          {error}
        </div>
      )}

      <button
        onClick={() => void handleFetch()}
        disabled={loading || !url.trim()}
        className="w-full flex items-center justify-center gap-2 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-50 transition-colors"
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : <Link2 size={15} />}
        {loading ? 'Buscando planilha...' : 'Buscar dados'}
      </button>

      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-white/35 hover:text-white/60 transition-colors">
        <ChevronLeft size={14} /> Voltar
      </button>
    </div>
  )
}

// ─── Step 3: Field mapping ────────────────────────────────────

function MappingStep({
  data,
  mapping,
  onMappingChange,
  onNext,
  onBack,
}: {
  data:            ParsedData
  mapping:         FieldMapping
  onMappingChange: (m: FieldMapping) => void
  onNext:          () => void
  onBack:          () => void
}) {
  const hasName = Object.values(mapping).includes('name')

  const setField = (col: string, field: SysField) => {
    const next = { ...mapping }
    // Un-assign from other columns if same system field chosen (except __skip)
    if (field !== '__skip') {
      Object.keys(next).forEach(k => {
        if (k !== col && next[k] === field) next[k] = '__skip'
      })
    }
    next[col] = field
    onMappingChange(next)
  }

  const preview = data.rows[0] ?? {}

  return (
    <div className="space-y-4">
      <p className="text-xs text-white/40">
        Mapeie as colunas do seu arquivo para os campos do NEXUS.
        <span className="text-violet-300"> Nome</span> é obrigatório.
      </p>

      <div className="rounded-xl border border-white/8 overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[1fr_140px_140px] gap-0 border-b border-white/8 bg-white/3 px-4 py-2">
          <span className="text-[10px] uppercase tracking-wider text-white/30">Coluna do arquivo</span>
          <span className="text-[10px] uppercase tracking-wider text-white/30">Exemplo</span>
          <span className="text-[10px] uppercase tracking-wider text-white/30">Campo NEXUS</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-white/5 max-h-64 overflow-y-auto">
          {data.headers.map(col => (
            <div key={col} className="grid grid-cols-[1fr_140px_140px] items-center gap-2 px-4 py-2.5">
              <span className="text-sm text-white font-medium truncate">{col}</span>
              <span className="text-xs text-white/35 truncate">{preview[col] || '—'}</span>
              <select
                value={mapping[col] ?? '__skip'}
                onChange={e => setField(col, e.target.value as SysField)}
                className="rounded-lg bg-white/5 border border-white/10 px-2 py-1.5 text-xs text-white focus:outline-none focus:border-violet-500 transition-colors cursor-pointer"
              >
                <option value="__skip">Ignorar</option>
                {SYSTEM_FIELDS.map(f => (
                  <option key={f.key} value={f.key}>
                    {f.label}{f.required ? ' *' : ''}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {!hasName && (
        <div className="flex items-center gap-2 rounded-lg bg-amber-950 border border-amber-500/30 px-4 py-3 text-sm text-amber-300">
          <AlertCircle size={14} className="shrink-0" />
          Mapeie pelo menos uma coluna como <strong className="ml-1">Nome</strong>
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onBack} className="flex items-center gap-1.5 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/50 hover:text-white hover:border-white/20 transition-all">
          <ChevronLeft size={14} /> Voltar
        </button>
        <button
          onClick={onNext}
          disabled={!hasName}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-40 transition-colors"
        >
          Ver prévia <ChevronRight size={15} />
        </button>
      </div>
    </div>
  )
}

// ─── Step 4: Preview & confirm ────────────────────────────────

function PreviewStep({
  data,
  mapping,
  onImport,
  onBack,
  importing,
}: {
  data:      ParsedData
  mapping:   FieldMapping
  onImport:  () => void
  onBack:    () => void
  importing: boolean
}) {
  const activeFields = SYSTEM_FIELDS.filter(f =>
    Object.values(mapping).includes(f.key),
  )

  // Build preview rows (max 10)
  const previewRows = data.rows.slice(0, 10).map(row => {
    const mapped: Record<string, string> = {}
    Object.entries(mapping).forEach(([col, field]) => {
      if (field !== '__skip') mapped[field] = row[col] ?? ''
    })
    return mapped
  })

  return (
    <div className="space-y-4">
      {/* Stats banner */}
      <div className="flex items-center gap-3 rounded-xl bg-violet-500/8 border border-violet-500/20 px-4 py-3">
        <Users size={16} className="text-violet-400 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-white">{data.rows.length} clientes prontos para importar</p>
          <p className="text-xs text-white/40">{activeFields.length} campos mapeados · Mostrando os primeiros 10</p>
        </div>
      </div>

      {/* Preview table */}
      <div className="rounded-xl border border-white/8 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-white/3 border-b border-white/8">
                {activeFields.map(f => (
                  <th key={f.key} className="px-3 py-2 text-left text-[10px] uppercase tracking-wider text-white/30 font-medium whitespace-nowrap">
                    {f.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {previewRows.map((row, i) => (
                <tr key={i} className="hover:bg-white/2 transition-colors">
                  {activeFields.map(f => (
                    <td key={f.key} className="px-3 py-2 text-white/70 max-w-[140px] truncate" title={row[f.key]}>
                      {row[f.key] || <span className="text-white/20">—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.rows.length > 10 && (
          <div className="border-t border-white/8 px-4 py-2 text-center text-xs text-white/25">
            + {data.rows.length - 10} linhas adicionais serão importadas
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button onClick={onBack} disabled={importing} className="flex items-center gap-1.5 rounded-xl border border-white/10 px-4 py-2.5 text-sm text-white/50 hover:text-white hover:border-white/20 disabled:opacity-40 transition-all">
          <ChevronLeft size={14} /> Voltar
        </button>
        <button
          onClick={onImport}
          disabled={importing}
          className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-50 transition-all"
          style={{
            background:  importing ? '#4c1d95' : 'linear-gradient(135deg, #7c3aed, #6d28d9)',
            boxShadow:   importing ? 'none' : '0 0 20px rgba(124,58,237,0.35)',
          }}
        >
          {importing ? (
            <><Loader2 size={15} className="animate-spin" /> Importando...</>
          ) : (
            <><ArrowRight size={15} /> Importar {data.rows.length} clientes</>
          )}
        </button>
      </div>
    </div>
  )
}

// ─── Main modal ───────────────────────────────────────────────

export function ConnectDataModal({
  companyId,
  onImported,
  onClose,
}: {
  companyId:  string
  onImported: (count: number) => void
  onClose:    () => void
}) {
  const [step,      setStep]     = useState<Step>('source')
  const [source,    setSource]   = useState<Source | null>(null)
  const [parsed,    setParsed]   = useState<ParsedData | null>(null)
  const [mapping,   setMapping]  = useState<FieldMapping>({})
  const [importing, setImporting] = useState(false)
  const [result,    setResult]   = useState<{ inserted: number; skipped: number } | null>(null)
  const [error,     setError]    = useState<string | null>(null)

  const handleSourceChoose = (s: Source) => {
    setSource(s)
    if (s === 'manual') {
      onClose()  // close modal — let user use AddClientModal
    } else {
      setStep('upload')
    }
  }

  const handleParsed = (data: ParsedData) => {
    setParsed(data)
    setMapping(buildAutoMapping(data.headers))
    setStep('mapping')
  }

  const handleImport = async () => {
    if (!parsed) return
    setImporting(true)
    setError(null)

    // Build normalized row payloads using the mapping
    const rows = parsed.rows.map(row => {
      const mapped: Record<string, string | undefined> = {}
      Object.entries(mapping).forEach(([col, field]) => {
        if (field !== '__skip') mapped[field] = row[col]
      })
      return mapped
    })

    try {
      const res  = await fetch('/api/import/clients', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ rows }),
      })
      const data = await res.json() as { inserted?: number; skipped?: number; errors?: string[]; error?: string }

      if (!res.ok) {
        setError(data.error ?? 'Falha ao importar')
        return
      }

      setResult({ inserted: data.inserted ?? 0, skipped: data.skipped ?? 0 })
      onImported(data.inserted ?? 0)
    } catch {
      setError('Falha de conexão. Tente novamente.')
    } finally {
      setImporting(false)
    }
  }

  // Success screen
  if (result) {
    return (
      <ModalShell onClose={onClose} title="">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="py-6 text-center space-y-4"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
            className="mx-auto w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center"
          >
            <CheckCircle2 size={32} className="text-emerald-400" />
          </motion.div>

          <div>
            <h3 className="text-xl font-bold text-white">
              Seus dados foram conectados com sucesso 🚀
            </h3>
            <p className="text-white/50 text-sm mt-2">
              <span className="text-emerald-400 font-semibold">{result.inserted} clientes</span> importados
              {result.skipped > 0 && <span className="text-white/30"> · {result.skipped} ignorados</span>}
            </p>
          </div>

          <p className="text-xs text-white/30">
            Seus clientes já estão disponíveis no Growth Map, IA e automações.
          </p>

          <button
            onClick={onClose}
            className="w-full rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white hover:bg-violet-500 transition-colors"
          >
            Ver clientes importados
          </button>
        </motion.div>
      </ModalShell>
    )
  }

  const titleMap: Record<Step, string> = {
    source:  'Conectar dados',
    upload:  source === 'csv' ? 'Upload de CSV' : 'Google Sheets',
    mapping: 'Mapear campos',
    preview: 'Revisar importação',
  }

  return (
    <ModalShell onClose={onClose} title={titleMap[step]}>
      <Steps current={step} />

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.18 }}
        >
          {step === 'source' && (
            <SourceStep onChoose={handleSourceChoose} />
          )}

          {step === 'upload' && source === 'csv' && (
            <CSVUploadStep
              onParsed={handleParsed}
              onBack={() => setStep('source')}
            />
          )}

          {step === 'upload' && source === 'sheets' && (
            <SheetsUploadStep
              onParsed={handleParsed}
              onBack={() => setStep('source')}
            />
          )}

          {step === 'mapping' && parsed && (
            <MappingStep
              data={parsed}
              mapping={mapping}
              onMappingChange={setMapping}
              onNext={() => setStep('preview')}
              onBack={() => setStep('upload')}
            />
          )}

          {step === 'preview' && parsed && (
            <>
              {error && (
                <div className="mb-3 flex items-center gap-2 rounded-lg bg-red-950 border border-red-500/30 px-4 py-3 text-sm text-red-300">
                  <AlertCircle size={14} className="shrink-0" />
                  {error}
                </div>
              )}
              <PreviewStep
                data={parsed}
                mapping={mapping}
                onImport={() => void handleImport()}
                onBack={() => setStep('mapping')}
                importing={importing}
              />
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </ModalShell>
  )
}

// ─── Modal shell ──────────────────────────────────────────────

function ModalShell({
  children,
  title,
  onClose,
}: {
  children: React.ReactNode
  title:    string
  onClose:  () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      {/* Panel */}
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 4 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="relative w-full max-w-xl bg-[#0e1117] border border-white/8 rounded-2xl shadow-2xl overflow-hidden"
        style={{ maxHeight: 'calc(100dvh - 48px)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/6">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-violet-400" />
            <h2 className="text-sm font-semibold text-white">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/30 hover:text-white hover:bg-white/6 transition-all"
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-6 py-5" style={{ maxHeight: 'calc(100dvh - 160px)' }}>
          {children}
        </div>
      </motion.div>
    </div>
  )
}
