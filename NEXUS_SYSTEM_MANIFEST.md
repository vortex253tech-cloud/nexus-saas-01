# NEXUS — SYSTEM MANIFEST
> **Versão:** 1.0.0 · **Data:** 2025-04-27 · **Stack:** Next.js 15 · Supabase · TypeScript  
> Este documento é o handoff técnico completo do NEXUS.  
> Qualquer IA ou engenheiro deve conseguir assumir o projeto a partir daqui.

---

## 1. Visão Geral do Sistema

### O que é o NEXUS
NEXUS é um **SaaS de inteligência operacional** para pequenas e médias empresas brasileiras. Funciona como um "COO de IA" — monitora dados financeiros, identifica oportunidades, gera ações e as executa autonomamente via fluxos automatizados.

### Objetivo Principal
Transformar dados de negócio (financeiro, clientes, cobranças) em **ações executadas automaticamente**, sem que o dono da empresa precise intervir manualmente.

### Problema que Resolve
PMEs têm dados espalhados, não sabem o que fazer com eles e não têm time de analistas. O NEXUS lê os dados, decide o que fazer e executa (enviar email, atualizar registro, disparar WhatsApp, etc).

### Diferencial
- **IA que pensa:** usa Claude (Anthropic) para gerar diagnósticos, insights e ações
- **IA que decide:** Decision Engine com regras nomeadas + caminho AI (`useAI: true`)
- **IA que executa:** Flow Engine executa fluxos de automação com nodes reais
- **Multi-tenant:** toda query é escopada por `company_id`

---

## 2. Arquitetura Geral

```
┌─────────────────────────────────────────────────────────────────────┐
│  FRONTEND  (Next.js 15 App Router — React 19)                        │
│  app/dashboard/**  →  "use client" components + Tailwind CSS        │
│  app/login, /signup, /onboarding                                     │
└────────────────────────────┬────────────────────────────────────────┘
                             │  HTTPS (fetch / React Server Components)
┌────────────────────────────▼────────────────────────────────────────┐
│  BACKEND  (Next.js API Routes — Edge/Node runtime)                   │
│  app/api/**  →  Route Handlers (GET/POST/PUT/DELETE)                 │
│  lib/auth.ts → getAuthContext() — verifica sessão em toda rota      │
│  lib/flow-engine/** → Flow Engine (ver seção 4)                     │
│  lib/ai/** → Claude API (Anthropic)                                 │
└──────────────┬──────────────────────────────────┬───────────────────┘
               │                                  │
┌──────────────▼──────┐               ┌──────────▼─────────────────┐
│  Supabase           │               │  Redis (opcional)           │
│  PostgreSQL + Auth  │               │  BullMQ — fila de jobs      │
│  Row Level Security │               │  Fallback: execução síncrona│
│  service_role key   │               └────────────────────────────-┘
└─────────────────────┘
               │
┌──────────────▼──────┐
│  Serviços Externos  │
│  Resend (email)     │
│  WhatsApp Meta API  │
│  Stripe (futuro)    │
└─────────────────────┘
```

### Stack Técnica
| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Frontend | Next.js App Router | 15.x |
| UI | React + Tailwind CSS + shadcn/ui | 19.x |
| Backend | Next.js Route Handlers | 15.x |
| Banco | Supabase (PostgreSQL 15) | hosted |
| Auth | Supabase Auth + `@supabase/ssr` | latest |
| IA | Anthropic Claude (via SDK) | claude-3-5-sonnet |
| Email | Resend | latest |
| WhatsApp | Meta Cloud API (stub pronto) | v18+ |
| Fila | BullMQ + IORedis | optional |
| Linguagem | TypeScript strict | 5.x |

---

## 3. Módulos do Sistema

### 3.1 Dashboard
- **Função:** Visão geral da empresa — score de saúde, métricas financeiras, ações pendentes, alertas
- **Página:** `app/dashboard/page.tsx`
- **Endpoints principais:** `GET /api/auth/session`, `GET /api/actions`, `GET /api/alerts`, `GET /api/financial-data`
- **Tabelas:** `companies`, `financial_data`, `actions`, `alerts`, `diagnostics`

### 3.2 Financeiro
- **Função:** Lançamentos financeiros, DRE simplificada, insights de IA, análise de lucratividade
- **Página:** `app/dashboard/financeiro/page.tsx`
- **Endpoints:** `GET/POST /api/financial-data`, `GET /api/ai/financial-insights`
- **Tabelas:** `financial_data`, `diagnostics`
- **IA:** `GET /api/ai/financial-insights` → Claude analisa dados e retorna insights estruturados

### 3.3 Clientes
- **Função:** CRUD de clientes, segmentação, relatórios
- **Página:** `app/dashboard/clients/page.tsx`
- **Endpoints:** `GET/POST /api/clients`, `GET/PUT/DELETE /api/clients/[id]`, `GET /api/reports/clients`
- **Tabelas:** `clients` (via migrations v2+)

### 3.4 Mensagens
- **Função:** Templates de mensagens (email/WhatsApp), envio em massa, histórico
- **Página:** `app/dashboard/messages/page.tsx`
- **Endpoints:** `GET/POST /api/messages/templates`, `POST /api/messages/generate`, `GET /api/messages/history`
- **Tabelas:** `message_logs` (automations module), `messages` (flow engine — nova)

### 3.5 Ações
- **Função:** Ações de alto impacto geradas por IA, executáveis manualmente ou via autopilot
- **Página:** `app/dashboard/actions/page.tsx`
- **Endpoints:** `GET/POST /api/actions`, `POST /api/actions/generate`, `POST /api/actions/execute`, `GET/PUT/DELETE /api/actions/[id]`
- **Tabelas:** `actions`, `execution_history`, `execution_logs`

### 3.6 Alertas
- **Função:** Notificações automáticas — clientes inadimplentes, margens baixas, etc.
- **Página:** `app/dashboard/alerts/page.tsx` (inline no dashboard)
- **Endpoints:** `GET/POST /api/alerts`
- **Tabelas:** `alerts`

### 3.7 Assistente IA
- **Função:** Chat conversacional com Claude sobre dados da empresa
- **Página:** `app/dashboard/assistant/page.tsx`
- **Endpoints:** `POST /api/ai/chat`, `POST /api/ai/project-analysis`
- **IA:** Claude recebe contexto da empresa (financeiro, clientes, ações) e responde perguntas

### 3.8 Automações
- **Função:** Fluxos de automação por evento/condição (ex: "se cliente inativo há 30 dias, enviar email")
- **Página:** `app/dashboard/automations/page.tsx`
- **Endpoints:** `GET/POST /api/automations`, `GET/PUT/DELETE /api/automations/[id]`, `POST /api/automations/[id]/execute`, `POST /api/automations/[id]/toggle`, `POST /api/automations/[id]/enroll`
- **Tabelas:** `automations`, `automation_steps`, `automation_enrollments`

### 3.9 Projetos
- **Função:** Gestão de projetos com produtos, receitas e despesas — P&L por projeto
- **Página:** `app/dashboard/projects/page.tsx`
- **Endpoints:** `GET/POST /api/projects`, e sub-recursos `/products`, `/revenues`, `/expenses`
- **Tabelas:** `projects`, `project_products`, `project_revenues`, `project_expenses`, `project_analyses`

### 3.10 Flow Engine / Growth Map (NOVO — CRÍTICO)
- **Função:** Motor de execução visual de fluxos de automação. O usuário desenha um fluxo no canvas (nodes + edges), e o Flow Engine o executa: busca dados, decide, executa ações
- **Página:** `app/dashboard/growth-map/page.tsx` (lista), `app/dashboard/growth-map/[id]/page.tsx` (canvas)
- **Endpoints:** ver seção 4
- **Tabelas:** `growth_maps`, `flow_executions`, `messages`

### 3.11 Cobranças (Collections)
- **Função:** Disparo automático de cobranças para clientes inadimplentes (email + WhatsApp)
- **Endpoints:** `POST /api/collections/run`, `POST /api/collections/charge`, `GET /api/collections/metrics`
- **Tabelas:** `customers`, `invoices`

---

## 4. Flow Engine (CRÍTICO)

O Flow Engine é o coração do sistema de automação visual. É completamente independente do módulo de Automações legado.

### 4.1 Conceito
Um "flow" é um grafo dirigido acíclico (DAG):
- **Nodes:** unidades de trabalho (trigger, analysis, decision, action, result)
- **Edges:** conexões entre nodes; podem ter condições nomeadas para roteamento

```
[TRIGGER] → [ANALYSIS] → [DECISION] → (high_value) → [ACTION: send_email]
                                    → (low_value)  → [ACTION: update_client]
                                    → (default)    → [RESULT]
```

### 4.2 Tipos de Nodes

| Tipo | Enum | Função |
|------|------|--------|
| `TRIGGER` | `FlowNodeType.TRIGGER` | Ponto de entrada. Verifica condição inicial. Tipos: `manual`, `scheduled`, `webhook`, `condition` |
| `ANALYSIS` | `FlowNodeType.ANALYSIS` | Busca dados do banco. Sources: `clients`, `invoices`, `overdue`, `financial`. Expõe `{ count, records, summary }` |
| `DECISION` | `FlowNodeType.DECISION` | Avalia regras e define qual branch seguir. Retorna uma string nomeada (ex: `'high_value'`) ou `'default'` |
| `ACTION` | `FlowNodeType.ACTION` | Executa uma ação concreta via `ActionHandlerService`. Tipos: `SEND_EMAIL`, `SEND_WHATSAPP`, `UPDATE_CLIENT`, `UPDATE_FINANCIAL` |
| `RESULT` | `FlowNodeType.RESULT` | Node terminal. Consolida o output final do flow |

**Mapeamento legado** (nodes criados antes do enum): `data_analysis → ANALYSIS`, `message_gen → ACTION`, `ai_analysis → ANALYSIS`, `filter → DECISION`, `send_notification → ACTION`

### 4.3 Estrutura de um Flow (DB)

```typescript
// Tabela: growth_maps
{
  id: UUID,
  company_id: UUID,
  name: string,
  description: string,
  nodes: FlowNode[],   // JSONB — array de nodes
  edges: FlowEdge[],   // JSONB — array de edges
  status: 'draft' | 'active' | 'archived',
  last_executed_at: timestamp | null
}

// FlowNode
{
  id: string,          // node-1, node-2, etc.
  type: FlowNodeType,  // 'TRIGGER' | 'ANALYSIS' | 'DECISION' | 'ACTION' | 'RESULT'
  config: Record<string, unknown>,  // específico por tipo
  position?: { x, y }, // para o canvas visual
  label?: string
}

// FlowEdge
{
  id: string,
  source: string,     // id do node de origem
  target: string,     // id do node de destino
  condition?: string  // 'high_value' | 'low_value' | 'default' | 'true' | 'false'
}
```

### 4.4 Config por Tipo de Node

**TRIGGER**
```json
{ "triggerType": "manual" | "scheduled" | "webhook" | "condition",
  "condition": "variable=value" }
```

**ANALYSIS**
```json
{ "dataSource": "clients" | "invoices" | "overdue" | "financial",
  "limit": 100,
  "filters": {} }
```

**DECISION — novo formato (recomendado)**
```json
{
  "rules": [
    { "condition": "high_value", "expression": "lastOutput.count > 500" },
    { "condition": "low_value",  "expression": "lastOutput.count <= 500" }
  ]
}
```
Expressões suportadas: `lastOutput.campo > N`, `variables.x === 'valor'`, operadores `>`, `<`, `>=`, `<=`, `===`, `!==`

**DECISION — legacy**
```json
{ "condition": "lastOutput.count > 100" }
// Retorna 'true' ou 'false'. Edges devem ter condition: 'true' / 'false'
```

**DECISION — AI**
```json
{ "useAI": true, "aiPrompt": "Should we proceed?", "threshold": 0.7 }
```

**ACTION**
```json
{ "actionType": "SEND_EMAIL" | "SEND_WHATSAPP" | "UPDATE_CLIENT" | "UPDATE_FINANCIAL",
  "message": "Olá {{nome}}, ...",
  "field": "status",
  "value": "contacted" }
```

### 4.5 Execução de um Flow

```
POST /api/flows/[id]/run
         │
         ▼
  FlowService.runFlow(flowId, companyId)
         │
         ├── Cria execution record (status: 'pending') em flow_executions
         │
         ├── Redis disponível?
         │   ├── SIM → enqueue BullMQ → Worker processa async
         │   └── NÃO → FlowEngineService.executeFlow() direto (síncrono)
         │
         ▼
  FlowEngineService.executeFlow(executionId, flowId, companyId)
         │
         ├── 1. markRunning(executionId) → status: 'running'
         ├── 2. getFlow(flowId) → carrega nodes e edges do DB
         ├── 3. topologicalSort(nodes, edges) → ordem de execução (Kahn BFS)
         │
         └── Para cada node (em ordem):
               ├── shouldSkip? → verifica branchDecisions Map
               │   (se node tem edge condicional de decisão anterior que não foi tomada → skip)
               ├── dispatch(node, ctx) → chama handler específico
               ├── handler retorna NodeResult { success, output, nextBranch? }
               ├── se DECISION: guarda branchDecisions.set(nodeId, 'high_value')
               ├── appendLog(executionId, logs) → persiste incrementalmente
               ├── falha em node não-DECISION → abort flow com status: 'error'
               └── ctx.lastOutput = result.output (passa para próximo node)
         │
         └── updateExecution(status: 'completed', logs, output)
```

### 4.6 Decision Routing

O roteamento multi-branch funciona via `Map<nodeId, chosenBranch>`:

```
DECISION node retorna nextBranch: 'high_value'
→ branchDecisions.set('decision-1', 'high_value')

Para cada node downstream:
→ Verificar edges condicionais que chegam no node
→ Se edge.source === 'decision-1' && edge.condition === 'high_value' → PERMITIDO
→ Se edge.source === 'decision-1' && edge.condition === 'default'    → PERMITIDO (fallback)
→ Qualquer outra condition → BLOCKED (shouldSkip = true)
```

### 4.7 Endpoints do Flow Engine

| Método | Endpoint | Descrição |
|--------|----------|-----------|
| `GET` | `/api/growth-maps` | Lista flows da empresa |
| `POST` | `/api/growth-maps` | Cria novo flow |
| `GET` | `/api/growth-maps/[id]` | Busca flow específico |
| `PUT` | `/api/growth-maps/[id]` | Salva canvas (nodes+edges) |
| `DELETE` | `/api/growth-maps/[id]` | Remove flow |
| `POST` | `/api/flows/[id]/run` | Executa um flow |
| `GET` | `/api/flows/executions` | Lista todas execuções (filtros: flowId, status, limit) |
| `GET` | `/api/growth-maps/[id]/executions` | Execuções de um flow específico |
| `GET` | `/api/growth-maps/[id]/executions/[execId]` | Detalhes de execução |
| `POST` | `/api/flows/test` | Execução de teste direto (sem DB) — dev only |
| `GET` | `/api/cron/flow-queue` | Cron Vercel — processa execuções pendentes |

---

## 5. Estrutura de Arquivos

### 5.1 Flow Engine (`lib/flow-engine/`)

```
lib/flow-engine/
├── types.ts                      # Tipos: FlowNode, FlowEdge, ExecutionContext, NodeResult, StepLog, ExecutionRecord
├── flow-engine.service.ts        # Orchestrator: topological sort + loop de execução + dispatch
├── flow.service.ts               # Entry point público: runFlow() → BullMQ ou síncrono
├── flow-repository.ts            # Data access: CRUD em flow_executions e growth_maps
├── flow-processor.ts             # BullMQ Worker + processPendingJobs() (para cron serverless)
├── flow-queue.ts                 # FlowQueue class (abstrações BullMQ)
├── queue-connection.ts           # Singleton IORedis; retorna null se REDIS_URL ausente
│
├── handlers/
│   ├── trigger.handler.ts        # Valida condição inicial do flow
│   ├── analysis.handler.ts       # Busca dados (clients/invoices/overdue/financial)
│   ├── decision.handler.ts       # Avalia regras e retorna branch nomeada ou 'default'
│   ├── action.handler.ts         # Thin adapter → ActionHandlerService
│   └── result.handler.ts         # Node terminal — consolida output
│
├── action-handler.service.ts     # Registry de ActionFn + executeAction()
│
└── actions/
    ├── action.types.ts           # ActionContext, ActionResult, ActionFn, helpers
    ├── send-email.action.ts      # SEND_EMAIL: renderiza template, chama Resend, salva em messages
    ├── send-whatsapp.action.ts   # SEND_WHATSAPP: stub pronto para Z-API/Twilio, salva em messages
    ├── update-client.action.ts   # UPDATE_CLIENT: atualiza campo em clients
    └── update-financial.action.ts# UPDATE_FINANCIAL: atualiza campo em financeiro
```

### 5.2 Autenticação e Utilidades (`lib/`)

```
lib/
├── supabase.ts           # getSupabaseClient() (browser) + getSupabaseServerClient() (service role)
├── supabase-server.ts    # getSupabaseRouteClient() — server-side com cookie SSR
├── auth.ts               # getAuthContext() (resolve user+company) + getCurrentUser() (lightweight)
├── auth-provider.tsx     # AuthProvider React context (user, session, loading, signOut)
├── db.ts                 # Tipos TypeScript: DBUser, DBCompany, DBSubscription, etc.
├── email.ts              # sendEmail() via Resend + sendWhatsApp() stub + builders HTML
├── ai.ts                 # Wrapper Anthropic Claude SDK
├── ai/
│   ├── decision-engine.ts  # decideNextAction() — IA para DECISION nodes
│   └── index.ts
└── ...outros módulos de domínio (collections, autopilot, etc.)
```

### 5.3 Middleware

```
middleware.ts
```
- Roda em toda requisição (exceto `_next/static`, imagens)
- Rotas públicas: `/`, `/login`, `/signup`, `/onboarding`, `/resultado`, `/planos`, `/start`
- `/dashboard/**` não autenticado → redirect `/login?redirect=<path>`
- `/api/**` protegidas não autenticado → `401 { error: 'Não autenticado' }`
- Refresh de token automático via `@supabase/ssr`

---

## 6. Banco de Dados

### Tabelas do Setup Completo (`supabase-setup-completo.sql`)

| Tabela | Propósito | Campos Principais |
|--------|-----------|------------------|
| `users` | Usuários da aplicação (separado de auth.users) | `id`, `auth_id` (FK → auth.users), `email`, `name`, `plan` |
| `companies` | Empresa de cada usuário | `id`, `user_id`, `name`, `email`, `phone`, `sector`, `perfil` |
| `financial_data` | Lançamentos financeiros | `id`, `company_id`, `revenue`, `costs`, `profit`, `period_label`, `period_date` |
| `diagnostics` | Diagnósticos gerados por IA | `id`, `company_id`, `score`, `resumo`, `ganho_total_estimado`, `ai_summary` |
| `subscriptions` | Planos e trial | `id`, `user_id`, `plan`, `status`, `trial_ends_at`, `stripe_*` |
| `actions` | Ações de alto impacto | `id`, `company_id`, `titulo`, `descricao`, `impacto_estimado`, `status`, `auto_executable` |
| `alerts` | Alertas operacionais | `id`, `company_id`, `message`, `type`, `read` |
| `customers` | Clientes para cobranças | `id`, `company_id`, `name`, `email`, `phone` |
| `invoices` | Faturas/cobranças | `id`, `company_id`, `customer_id`, `amount`, `status`, `due_date` |
| `execution_history` | Histórico de execuções de ações | `id`, `company_id`, `action_id`, `status`, `ganho_realizado` |
| `onboarding_leads` | Leads do funil de cadastro | `id`, `email`, `perfil`, `respostas` |

### Tabelas do Flow Engine

| Tabela | Arquivo SQL | Propósito |
|--------|-------------|-----------|
| `growth_maps` | `supabase-migration-growth-map-v1.sql` | Definição de flows (nodes + edges JSONB) |
| `flow_executions` | `supabase-migration-flow-executions-v2.sql` | Registro de cada execução (status, logs JSONB, output) |
| `messages` | `supabase-migration-flow-messages.sql` | Emails/WhatsApp disparados pelo Flow Engine |

### Tabelas de Módulos Adicionais

| Tabela | Arquivo SQL | Propósito |
|--------|-------------|-----------|
| `automations` | `supabase-migration-automations.sql` | Automações por evento |
| `automation_steps` | idem | Steps de automação |
| `automation_enrollments` | idem | Clientes inscritos em automações |
| `projects` | `supabase-migration-projects-v1.sql` | Gestão de projetos |
| `project_products/revenues/expenses` | idem | Sub-itens de projeto |

### Schema Crítico: `flow_executions`

```sql
CREATE TABLE flow_executions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id     UUID NOT NULL REFERENCES growth_maps(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'error')),
  logs        JSONB NOT NULL DEFAULT '[]',  -- array de StepLog
  output      JSONB,                        -- output do último node
  started_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);
```

### RLS (Row Level Security)
- **Todas as tabelas** têm RLS ativo
- Policy `service_role_bypass` concede acesso total ao `service_role`
- O backend usa **exclusivamente** `SUPABASE_SERVICE_ROLE_KEY`
- O frontend usa **exclusivamente** `NEXT_PUBLIC_SUPABASE_ANON_KEY` (via `getSupabaseClient()`)
- Nunca expor `SUPABASE_SERVICE_ROLE_KEY` ao browser

### Trigger de Sincronização Auth → Users
```sql
-- Dispara em AFTER INSERT ON auth.users
-- Cria automaticamente a linha em public.users ao signup
handle_new_auth_user()
  → INSERT INTO users (auth_id, email, name, plan)
  → ON CONFLICT (email) DO UPDATE SET auth_id = NEW.id
```

---

## 7. Action System

### 7.1 Arquitetura

```
action.handler.ts (thin adapter)
         │
         ▼
ActionHandlerService.executeAction(actionType, config, context)
         │
         ▼
REGISTRY[actionType] → ActionFn
         │
         ▼
send-email.action.ts | send-whatsapp.action.ts |
update-client.action.ts | update-financial.action.ts
```

### 7.2 Registry Completo

```typescript
// lib/flow-engine/action-handler.service.ts
const REGISTRY = {
  // ── Novos nomes (SCREAMING_SNAKE) ──
  SEND_EMAIL:       sendEmailAction.execute,
  SEND_WHATSAPP:    sendWhatsAppAction.execute,
  UPDATE_CLIENT:    updateClientAction.execute,
  UPDATE_FINANCIAL: updateFinancialAction.execute,

  // ── Legacy (backward compat) ──
  send_email:       sendEmailAction.execute,
  send_whatsapp:    sendWhatsAppAction.execute,
  update_client:    updateClientAction.execute,
  update_financial: updateFinancialAction.execute,
  update_record:    updateRecordLegacy,   // atualiza campo em qualquer tabela
  webhook:          webhookLegacy,        // dispara HTTP POST para URL externa
  create_log:       createLogLegacy,      // no-op (apenas loga)
}
```

### 7.3 ActionContext e ActionResult

```typescript
// Contexto passado para cada ActionFn
interface ActionContext {
  companyId:   string
  executionId: string
  flowId:      string
  lastOutput:  unknown        // output do node anterior (geralmente AnalysisOutput)
  variables:   Record<string, unknown>
}

// Retorno padronizado de cada ActionFn
interface ActionResult {
  success:   boolean
  message:   string
  processed: number           // quantos registros tentou processar
  succeeded: number           // quantos processou com sucesso
  errors:    string[]         // array de erros (id: mensagem)
  payload:   Record<string, unknown>  // dados extras para o log
}
```

### 7.4 Detalhes por Action

**SEND_EMAIL**
- Extrai records de `lastOutput` via `extractRecords()`
- Renderiza template com `{{nome}}`, `{{email}}`, etc. (substituição simples)
- Chama `sendEmail()` de `lib/email.ts` (Resend real ou simulação)
- Persiste em tabela `messages` (status: `sent` | `simulated` | `failed`)
- Cap: 100 emails por execução

**SEND_WHATSAPP**
- Mesma estrutura do SEND_EMAIL
- Usa campo `phoneField` (default: `'phone'`) para E.164
- Chama `sendWhatsApp()` de `lib/email.ts` (stub — retorna `simulated: true`)
- Para integrar provedor real: editar apenas `lib/email.ts → sendWhatsApp()`
- Cap: 100 mensagens por execução

**UPDATE_CLIENT**
```typescript
config: { field: 'status', value: 'contacted', idField?: 'id', table?: 'clients' }
// Atualiza clients.field = value para cada record do lastOutput, scoped a company_id
```

**UPDATE_FINANCIAL**
```typescript
config: { field: 'status', value: 'reviewed', idField?: 'id', table?: 'financeiro' }
// Mesmo padrão — tabela padrão é 'financeiro'
```

### 7.5 Adicionando Nova Action
1. Criar `lib/flow-engine/actions/minha-action.action.ts` com `export async function execute(config, context): Promise<ActionResult>`
2. Importar em `action-handler.service.ts`
3. Adicionar ao `REGISTRY` com chave SCREAMING_SNAKE e alias lowercase
4. Sem necessidade de alterar o engine, handlers ou rotas

---

## 8. Logs e Execução

### 8.1 Estrutura de Log (StepLog)

```typescript
interface StepLog {
  nodeId:     string           // 'node-1', 'node-2'
  nodeType:   string           // 'TRIGGER', 'ANALYSIS', etc.
  status:     'success' | 'error' | 'skipped'
  input:      unknown          // ctx.lastOutput antes do node
  output:     unknown          // resultado do node
  durationMs: number           // tempo de execução em ms
  timestamp:  string           // ISO 8601
  message?:   string           // mensagem descritiva do handler
}
```

### 8.2 Persistência Incremental

Logs são salvos após **cada node** — não apenas ao final:

```typescript
await this.repo.appendLog(executionId, ctx.logs)
```

Isso permite que a UI mostre progresso em tempo real consultando `flow_executions.logs`.

### 8.3 Estados de Execução

```
pending  → criado por FlowService.runFlow()
running  → marcado ao início de FlowEngineService.executeFlow()
completed → ao final bem-sucedido
error    → ao primeiro node que falha (não DECISION)
```

### 8.4 Tratamento de Erros

- Node TRIGGER falha → flow inteiro aborta (condição não satisfeita)
- Node ANALYSIS falha → flow aborta, log registra erro
- Node DECISION **nunca falha** — sem regras → retorna `'default'`
- Node ACTION falha → flow aborta, erros ficam em `log.message` e `result.errors[]`
- Exceções não tratadas → capturadas em try/catch, status `error`, mensagem salva

### 8.5 Reprocessamento

Execuções com status `pending` acumuladas no banco são reprocessadas pelo cron:

```
GET /api/cron/flow-queue
  → FlowProcessor.processPendingJobs(10)
  → Busca até 10 registros com status: 'pending'
  → Executa cada um via FlowEngineService.executeFlow()
```

Configurar no `vercel.json`:
```json
{ "crons": [{ "path": "/api/cron/flow-queue", "schedule": "*/5 * * * *" }] }
```

---

## 9. Autenticação

### Fluxo Completo

```
Signup:
  supabase.auth.signUp() → trigger on_auth_user_created → INSERT INTO public.users
  POST /api/company → upsert users + INSERT companies + INSERT subscriptions (trial 7 dias)
  redirect → /dashboard

Login:
  supabase.auth.signInWithPassword() → cookie de sessão setado pelo @supabase/ssr
  AuthProvider.onAuthStateChange → user/session state atualizado
  middleware.ts → valida cookie em cada requisição protegida

API Route (server-side):
  getAuthContext() → getSupabaseRouteClient().auth.getUser()
                   → SELECT users + companies + subscriptions
                   → resolve AuthContext { user, company, companyId, effectivePlan, ... }
  getCurrentUser() → getSupabaseRouteClient().auth.getUser() (apenas id + email)

Logout:
  POST /api/auth/logout → supabase.auth.signOut() (limpa cookie)
  AuthProvider.signOut() → sessionStorage.clear() + router.push('/login')
```

### Arquivos Chave

| Arquivo | Responsabilidade |
|---------|-----------------|
| `lib/supabase.ts` | Clientes browser (anon) e servidor (service_role) |
| `lib/supabase-server.ts` | Cliente com cookie SSR para API routes |
| `lib/auth.ts` | `getAuthContext()`, `getCurrentUser()` — server only |
| `lib/auth-provider.tsx` | `AuthProvider`, `useAuth()` — client only |
| `middleware.ts` | Proteção de rotas + refresh de token |
| `app/login/page.tsx` | Formulário de login completo |
| `app/signup/page.tsx` | Cadastro + criação de empresa |

---

## 10. Variáveis de Ambiente

```bash
# Obrigatórias
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...          # exposta ao browser
SUPABASE_SERVICE_ROLE_KEY=eyJ...              # NUNCA ao browser

# IA
ANTHROPIC_API_KEY=sk-ant-...                  # Claude API

# Email
RESEND_API_KEY=re_...                         # Resend.com
RESEND_FROM=NEXUS <noreply@seudominio.com>    # domínio verificado no Resend

# WhatsApp (opcional — stub funciona sem)
WHATSAPP_TOKEN=EAAx...                        # Meta Cloud API token
WHATSAPP_PHONE_ID=104...                      # ID do número no painel Meta
WHATSAPP_VERIFY_TOKEN=nexus_verify_xxx        # Webhook verification

# Redis/BullMQ (opcional — fallback síncrono se ausente)
REDIS_URL=redis://localhost:6379
```

---

## 11. Estado Atual do Projeto

### ✅ Funcionando Completamente

| Módulo | Status |
|--------|--------|
| Auth completo (login, signup, sessão, refresh, logout) | ✅ |
| Dashboard principal | ✅ |
| Módulo Financeiro + insights IA | ✅ |
| Módulo Clientes | ✅ |
| Módulo Ações (geração + execução manual) | ✅ |
| Alertas | ✅ |
| Automações (módulo legado) | ✅ |
| Cobranças (collections email+WhatsApp) | ✅ |
| Projetos (P&L por projeto) | ✅ |
| Assistente IA (chat) | ✅ |
| **Flow Engine — core** (topological sort, execução, logging incremental) | ✅ |
| **Flow Engine — ANALYSIS node** (clients, invoices, overdue, financial) | ✅ |
| **Flow Engine — DECISION node** (regras nomeadas + legacy + AI path) | ✅ |
| **Flow Engine — ACTION node** (SEND_EMAIL, SEND_WHATSAPP, UPDATE_CLIENT, UPDATE_FINANCIAL) | ✅ |
| **Flow Engine — persistência** (`flow_executions` + `messages`) | ✅ |
| **Flow Engine — BullMQ** (queue + worker + fallback síncrono) | ✅ |
| **Flow Engine — endpoints REST** (CRUD growth_maps + run + list executions) | ✅ |

### ⚠️ Parcialmente Implementado

| Item | O que está feito | O que falta |
|------|-----------------|-------------|
| WhatsApp | Stub que simula envio, persiste em `messages` | Integrar provedor real (Z-API, Twilio, Meta Cloud API) |
| Growth Map Canvas (UI) | Página existe, rota criada | Implementar editor visual de nodes/edges (React Flow) |
| BullMQ Worker persistente | Código em `flow-processor.ts` | Deploy requer processo Node.js persistente (não Vercel serverless) |
| Stripe / Billing | Página `/billing` existe | Integração Stripe Checkout/Webhooks |
| Cron jobs | Código existe (`/api/cron/*`) | Configurar `vercel.json` com schedules |

### ❌ Não Implementado

| Item | Observação |
|------|-----------|
| Editor visual de canvas (drag-and-drop) | UI de criação de flows no browser |
| Multi-tenant avançado (roles por empresa) | Hoje: 1 user = 1 company |
| Webhooks de entrada para triggers | TRIGGER type `webhook` recebe mas não roteia por flow |
| Relatórios exportáveis (PDF/Excel) | Endpoints de relatório existem parcialmente |
| Notificações push / in-app | Apenas alertas no banco, sem push real-time |

---

## 12. Próximos Passos (Roadmap Técnico)

### Sprint 1 — Completar Flow Engine UI
1. **Canvas visual** com React Flow (`@xyflow/react`) para criar/editar flows
2. **Painel de execuções** — listar histórico, ver logs por step, reprocessar
3. **Node configurator** — formulário lateral por tipo de node

### Sprint 2 — WhatsApp Real
1. Substituir stub `sendWhatsApp()` por Z-API ou Twilio
2. Webhook de entrada: `POST /api/webhook/whatsapp` → processar replies
3. Status tracking: `delivered`, `read`, `failed`

### Sprint 3 — Triggers Avançados
1. **Trigger scheduled:** cron por flow (ex: "todo dia útil às 9h")
2. **Trigger webhook:** um flow específico responde a um endpoint único
3. **Trigger event:** disparado por mudança em tabela (via Supabase Realtime)

### Sprint 4 — IA Autônoma
1. **Agente NEXUS:** dado uma meta ("aumentar receita em 20%"), o agente cria e executa flows automaticamente
2. **Feedback loop:** execuções geram dados → IA refina decisões
3. **Alerts inteligentes:** Claude detecta anomalias e cria flows de resposta

### Sprint 5 — Multi-tenant Avançado
1. Roles por empresa (admin, viewer, operator)
2. Múltiplos usuários por empresa
3. Audit log de todas as ações

### Sprint 6 — Billing / Monetização
1. Stripe Checkout para planos `free` / `pro` / `enterprise`
2. Usage-based billing (por execuções ou mensagens enviadas)
3. Stripe Webhooks → atualizar `subscriptions`

---

## 13. Convenções e Padrões

### Padrão de API Route
```typescript
// Toda rota autenticada começa com:
const ctx = await getAuthContext()
if (!ctx) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

// Toda query é escopada:
.eq('company_id', ctx.companyId)

// Toda rota dinâmica:
export const dynamic = 'force-dynamic'
```

### Multi-tenant
- **Regra inviolável:** toda query ao banco inclui `.eq('company_id', ctx.companyId)`
- Nunca confiar no `company_id` vindo do body/query — sempre usar `ctx.companyId` do servidor

### TypeScript
- Sem `any` — usar `unknown` e type guards
- Tipos de DB em `lib/db.ts`
- `getSupabaseServerClient()` para queries de backend (service role)
- `getSupabaseClient()` para queries de frontend (anon)

### Error Handling
```typescript
// API routes: sempre retornar JSON estruturado
return NextResponse.json({ error: 'mensagem legível' }, { status: 400 })

// Logs: sempre prefixar com [módulo]
console.error('[flow-engine]', err)
```

---

## 14. Dependências Críticas

```json
{
  "next": "15.x",
  "@supabase/supabase-js": "latest",
  "@supabase/ssr": "latest",
  "@anthropic-ai/sdk": "latest",
  "resend": "latest",
  "bullmq": "latest",
  "ioredis": "latest",
  "tailwindcss": "4.x",
  "typescript": "5.x"
}
```

---

*Documento gerado em 2025-04-27. Atualizar sempre que módulos ou contratos de API mudarem.*
