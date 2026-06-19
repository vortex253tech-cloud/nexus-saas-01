# NEXUS — Inventário de Módulos

> Mapeamento de páginas, rotas de API e módulos de dashboard, a partir da leitura de `app/` em 2026-06-18. Para os módulos "clássicos" (Financeiro, Clientes, Ações, Automações, Projetos, Flow Engine/Growth Map), ver também `NEXUS_SYSTEM_MANIFEST.md` que tem o detalhamento de schema/endpoints node a node.

## Páginas públicas (`app/`)

| Rota | Descrição |
|---|---|
| `/` | Homepage — "NEXUS Ultra Conversion Homepage" (redesenhada em `7bf880f`), landing premium com hero, demo animada, comparação COO-vs-chatbot, pricing, prova social |
| `/login`, `/signup` | Autenticação |
| `/onboarding`, `/onboarding/welcome`, `/onboarding/demo` | Funil de onboarding, incluindo variante de boas-vindas e fluxo de demonstração |
| `/resultado`, `/planos`, `/start` | Funil de vendas / apresentação de planos |
| `/setup` | Fluxo de configuração inicial da empresa |
| `/admin`, `/admin/waitlist` | Painel super-admin (gestão de usuários/planos) e gestão de waitlist |
| `/v1` | Rota legada/de teste |

## Módulos de dashboard (`app/dashboard/**`)

### Módulos "clássicos" (existentes desde o manifesto original)
Dashboard principal, Financeiro, Clientes, Mensagens, Ações, Alertas, Automações, Projetos, Growth Map (Flow Engine), Cobranças (via API).

### Módulos novos
| Módulo | Rota | Descrição |
|---|---|---|
| WhatsApp V5 CRM | `/dashboard/whatsapp` | CRM conversacional completo: threads, pipeline de vendas, busca full-text, fotos de contato, sugestões de IA — ver [integracoes.md](./integracoes.md) |
| NEXUS OS | `/dashboard/nexus-os` | Interface de voz/texto sempre-ativa |
| NEXUS (engine) | `/dashboard/nexus`, `/dashboard/nexus/engine` | Controle do motor NEXUS OS |
| Multi-Agentes | `/dashboard/agents` | Orquestração dos 9 agentes especializados (CEO, Marketing, Sales, Finance, Growth, Operations, Support, Projects, Content) |
| Creative AI | `/dashboard/creative-ai` | Geração de assets criativos (imagem, copy, PDF) |
| Executive | `/dashboard/executive` | Relatório executivo consolidado |
| Billing | `/dashboard/billing` | Gestão de assinatura/pagamento |
| Growth | `/dashboard/growth` | Métricas de crescimento (distinto de growth-map) |
| History | `/dashboard/history` | Histórico de execuções/ações |
| Leads | `/dashboard/leads` | Gestão de leads (CRM) |
| Marketplace | `/dashboard/marketplace` | Templates/integrações |
| Advisor | `/dashboard/advisor` | Recomendações de IA |
| Dados | `/dashboard/dados` | Analytics/dados |
| Revenue | `/dashboard/revenue` | Analytics de receita |
| Sales | `/dashboard/sales` | Pipeline de vendas |
| Settings | `/dashboard/settings` (+ `business-identity`, `payments`) | Configurações da empresa e identidade de marca |
| Suppliers | `/dashboard/suppliers` | Gestão de fornecedores e custos |
| System/Realtime | `/dashboard/system/realtime` | Diagnóstico de sessões de voz em tempo real |
| Upgrade | `/dashboard/upgrade` | Upgrade/downgrade de plano |

## Rotas de API (`app/api/**`) — grupos novos desde o manifesto

| Grupo | Propósito |
|---|---|
| `/api/nexus/**` (~80 endpoints) | Núcleo do NEXUS OS: `os`, `engine`, `voice/**` (sessão de voz, token efêmero), `whatsapp/**` (16 sub-rotas do CRM), `memory`, `metrics`, `insights`, `persona`, `pipeline`, `seller`, `tasks`, `diagnostic`, `overview` |
| `/api/admin/**` | `users`, `waitlist` — funções de administração enterprise |
| `/api/agents/**` | `orchestrate`, `status` — orquestração multi-agente |
| `/api/ai/**` (expandido) | `router` (dispatch entre modelos), `upload` (arquivos), além dos já existentes `chat`, `conversations`, `business-analysis`, `financial-insights`, `generate-flow`, `project-analysis` |
| `/api/analytics/**` | `track` — telemetria |
| `/api/billing/**` | `create-checkout` — Stripe |
| `/api/core/**` | `actions`, `analytics`, `events`, `memory`, `migrate`, `status` — internals do sistema |
| `/api/creative/**` | `generate`, `generate-multi`, `image`, `opportunities`, `pdf`, `stats` |
| `/api/engine/**` | `learning`, `settings`, `status` — engine de decisão |
| `/api/cron/**` (expandido) | `autopilot`, `charge`, `charge-email`, `flow-queue`, `retention`, `sales-followup`, `automations`, `ai-runner`, `ai-tasks` — ver agendamento em `vercel.json` |
| `/api/retention/**` | `detect`, `events` — detecção de churn |
| `/api/sales/**`, `/api/revenue/**` | Pipeline de vendas e receita |
| `/api/suppliers/**` | Fornecedores |
| `/api/waitlist/**` | Waitlist pública |
| `/api/webhook/**`, `/api/webhooks/**` | Webhooks de entrada |
| `/api/setup/**`, `/api/onboarding/**` (`complete`, `demo`) | Fluxo de configuração inicial |
| `/api/import/**` (`clients`, `sheets`) | Importação em massa |
| `/api/flow-templates/**`, `/api/flow-errors/**` | Marketplace de templates e erros de execução de flow |
| `/api/test-openai/**` | Endpoint de teste/diagnóstico |

> Lista completa tem 35+ grupos de rotas. Para o detalhamento exaustivo, repetir a exploração de `app/api/` — este documento cobre o que é novo/significativo, não cada endpoint individual.

## Status funcional por feature nova (ver também [bugs.md](./bugs.md))

| Feature | Status |
|---|---|
| Homepage Ultra | ✅ Funcional, end-to-end |
| Enterprise (planos/admin) | ✅ Funcional, gating aplicado em rotas reais (`whatsapp/send`, `automations`, `projects`) |
| WhatsApp V5 CRM | ✅ Funcional — busca, pipeline, fotos, paginação por cursor |
| NEXUS OS (sessão sempre-ativa) | ✅ Funcional — sobrevive à navegação |
| Voz (OpenAI Realtime GA) | ✅ Funcional — compatibilidade com nomes de evento legados e GA |
| Canvas visual do Flow Engine (drag-and-drop) | ✅ Implementado e verificado (2026-06-18) — manifesto antigo estava desatualizado. Falta só o configurador de parâmetros por nó (ver [proximos-passos.md](./proximos-passos.md) #6) |
| Stripe / Billing completo | ⚠️ `lib/payments/stripe.ts` e `/api/billing/create-checkout` existem; confirmar se webhooks de Stripe estão implementados antes de assumir fluxo completo |
