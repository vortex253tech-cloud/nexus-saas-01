'use client'

import { useCallback, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
  type NodeTypes,
  Handle,
  Position,
  Panel,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Loader2, Play, Save, Zap } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { GrowthNode, GrowthEdge, NodeResult, NodeType } from '@/lib/growth-map-types'

// ─── Node appearance config ───────────────────────────────────────────────────

const NODE_META: Record<NodeType, { label: string; icon: string; color: string; desc: string }> = {
  data_analysis: { label: 'Análise de Dados', icon: '📊', color: '#3b82f6', desc: 'Consulta dados financeiros e de clientes' },
  opportunity:   { label: 'Oportunidade IA',  icon: '💡', color: '#a855f7', desc: 'IA detecta oportunidades no negócio' },
  decision:      { label: 'Decisão IA',        icon: '🧠', color: '#f59e0b', desc: 'IA toma decisão estratégica' },
  message_gen:   { label: 'Gerar Mensagem',    icon: '✉️', color: '#22c55e', desc: 'IA cria mensagem personalizada' },
  auto_action:   { label: 'Ação Automática',   icon: '⚡', color: '#f97316', desc: 'Envia email ou WhatsApp' },
  result:        { label: 'Resultado',         icon: '🎯', color: '#10b981', desc: 'Métricas e resumo do fluxo' },
}

// ─── Status config ────────────────────────────────────────────────────────────

type NodeStatus = 'pending' | 'running' | 'success' | 'error' | 'skipped'

const STATUS_META: Record<NodeStatus, { dot: string; label: string; ring: string }> = {
  pending: { dot: '🟡', label: 'Aguardando', ring: 'ring-yellow-500/40' },
  running: { dot: '🔵', label: 'Executando', ring: 'ring-blue-500/60'  },
  success: { dot: '🟢', label: 'Concluído',  ring: 'ring-emerald-500/60' },
  error:   { dot: '🔴', label: 'Erro',        ring: 'ring-red-500/60'   },
  skipped: { dot: '⏭️', label: 'Pulado',      ring: 'ring-zinc-500/40'  },
}

// ─── Custom node component ────────────────────────────────────────────────────

function GrowthNodeComponent({
  data,
}: {
  data: {
    label:   string
    type:    NodeType
    config:  unknown
    result?: NodeResult
    status?: NodeStatus
  }
}) {
  const meta   = NODE_META[data.type] ?? NODE_META.result
  const res    = data.result
  const status = data.status
  const sm     = status ? STATUS_META[status] : undefined

  return (
    <div
      style={{ borderColor: status === 'error' ? '#ef4444' : status === 'success' ? '#10b981' : meta.color }}
      className={cn(
        'rounded-2xl border-2 bg-zinc-900 min-w-[220px] max-w-[260px] overflow-hidden shadow-xl transition-all duration-300',
        sm?.ring && `ring-2 ${sm.ring}`,
      )}
    >
      {/* Header */}
      <div
        style={{ backgroundColor: `${meta.color}20` }}
        className="flex items-center gap-2 px-3 py-2.5 border-b border-zinc-800"
      >
        <span className="text-lg">{meta.icon}</span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold text-zinc-300 uppercase tracking-wide">{meta.label}</p>
          <p className="text-xs text-white font-medium truncate">{data.label}</p>
        </div>

        {/* Status / result badge */}
        {sm ? (
          <span className={cn(
            'ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-bold whitespace-nowrap flex items-center gap-0.5',
            status === 'success' ? 'bg-emerald-500/20 text-emerald-400' :
            status === 'error'   ? 'bg-red-500/20 text-red-400'         :
            status === 'running' ? 'bg-blue-500/20 text-blue-400'       :
            status === 'skipped' ? 'bg-zinc-700 text-zinc-400'          :
                                   'bg-yellow-500/20 text-yellow-400',
          )}>
            <span>{sm.dot}</span>
            <span>{sm.label}</span>
          </span>
        ) : res ? (
          <span className={cn(
            'ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-bold',
            res.success ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400',
          )}>
            {res.success ? '✓' : '✗'}
          </span>
        ) : null}
      </div>

      {/* Result / description body */}
      {res ? (
        <div className="px-3 py-2 bg-zinc-800/50">
          <p className="text-[11px] text-zinc-300 leading-relaxed">{res.label}</p>
          {res.error && <p className="text-[10px] text-red-400 mt-1">{res.error}</p>}
        </div>
      ) : (
        <div className="px-3 py-2">
          <p className="text-[10px] text-zinc-600">{meta.desc}</p>
        </div>
      )}

      <Handle type="target" position={Position.Left}
        style={{ background: meta.color, width: 10, height: 10, border: '2px solid #18181b' }} />
      <Handle type="source" position={Position.Right}
        style={{ background: meta.color, width: 10, height: 10, border: '2px solid #18181b' }} />
    </div>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface CanvasProps {
  mapId:        string
  initialNodes: GrowthNode[]
  initialEdges: GrowthEdge[]
  onSave:       (nodes: GrowthNode[], edges: GrowthEdge[]) => Promise<void>
  onExecute:    () => Promise<void>
  executing:    boolean
  saving:       boolean
  results:      Record<string, NodeResult> | null
  nodeStatuses?: Record<string, NodeStatus>
}

// ─── Canvas ───────────────────────────────────────────────────────────────────

export default function GrowthCanvas({
  initialNodes, initialEdges, onSave, onExecute, executing, saving, results, nodeStatuses,
}: CanvasProps) {

  const nodesWithResults = useMemo<Node[]>(() =>
    initialNodes.map(n => ({
      ...n,
      data: {
        ...n.data,
        type:   n.type,
        result: results?.[n.id] ?? n.data.result,
        status: nodeStatuses?.[n.id],
      },
    })),
    [initialNodes, results, nodeStatuses],
  )

  const [nodes, setNodes, onNodesChange] = useNodesState(nodesWithResults)
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges as Edge[])

  const onConnect = useCallback(
    (connection: Connection) => setEdges(eds => addEdge({ ...connection, animated: true, style: { stroke: '#7c3aed', strokeWidth: 2 } }, eds)),
    [setEdges],
  )

  const nodeTypes = useMemo<NodeTypes>(() => ({
    data_analysis: GrowthNodeComponent,
    opportunity:   GrowthNodeComponent,
    decision:      GrowthNodeComponent,
    message_gen:   GrowthNodeComponent,
    auto_action:   GrowthNodeComponent,
    result:        GrowthNodeComponent,
  }), [])

  const NODE_TYPES = Object.entries(NODE_META) as [NodeType, (typeof NODE_META)[NodeType]][]

  function addNode(type: NodeType) {
    const meta = NODE_META[type]
    const newNode: Node = {
      id:       `n${Date.now()}`,
      type,
      position: { x: 200 + Math.random() * 300, y: 200 + Math.random() * 200 },
      data: { label: meta.label, type, config: {} },
    }
    setNodes(ns => [...ns, newNode])
  }

  async function handleSave() {
    await onSave(nodes as unknown as GrowthNode[], edges as unknown as GrowthEdge[])
  }

  // ── Legend (shown while executing or after execution) ─────────────────────
  const showLegend = executing || (nodeStatuses && Object.keys(nodeStatuses).length > 0)

  return (
    <div className="h-full w-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        defaultEdgeOptions={{ animated: true, style: { stroke: '#7c3aed', strokeWidth: 2 } }}
        style={{ background: '#09090b' }}
      >
        <Background color="#27272a" gap={24} size={1} />
        <Controls style={{ background: '#18181b', border: '1px solid #27272a' }} />
        <MiniMap
          style={{ background: '#18181b', border: '1px solid #27272a' }}
          nodeColor={n => NODE_META[n.type as NodeType]?.color ?? '#7c3aed'}
        />

        {/* Top panel — actions */}
        <Panel position="top-right">
          <div className="flex items-center gap-2">
            {/* Execution status legend */}
            {showLegend && (
              <div className="flex items-center gap-1.5 bg-zinc-900/90 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-[10px] text-zinc-400">
                {Object.entries(STATUS_META).map(([s, m]) => (
                  <span key={s} className="flex items-center gap-0.5">{m.dot} {m.label}</span>
                ))}
              </div>
            )}

            <button onClick={() => void handleSave()} disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-300 disabled:opacity-50 transition-colors">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Salvar
            </button>
            <button onClick={() => void onExecute()} disabled={executing}
              className="flex items-center gap-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 transition-colors">
              {executing ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} className="fill-white" />}
              {executing ? 'Executando…' : 'Executar fluxo'}
            </button>
          </div>
        </Panel>

        {/* Left panel — node palette */}
        <Panel position="top-left">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-3 w-52">
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-wide mb-2.5 flex items-center gap-1.5">
              <Zap size={10} /> Adicionar bloco
            </p>
            <div className="space-y-1">
              {NODE_TYPES.map(([type, meta]) => (
                <button key={type} onClick={() => addNode(type)}
                  style={{ borderColor: `${meta.color}40` }}
                  className="w-full text-left flex items-center gap-2 rounded-lg border px-2.5 py-1.5 hover:bg-zinc-800 transition-colors">
                  <span className="text-sm">{meta.icon}</span>
                  <span className="text-xs text-zinc-300">{meta.label}</span>
                </button>
              ))}
            </div>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  )
}
