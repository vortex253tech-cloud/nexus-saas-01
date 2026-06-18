# NEXUS — Integrações e Banco de Dados

> Gerado em 2026-06-18 por leitura de `lib/`, `package.json`, arquivos SQL e `vercel.json`.

## Supabase (Postgres + Auth + Realtime)

### Schema real — verificado contra o banco ao vivo em 2026-06-18

Em vez de inferir a partir dos ~25 arquivos `.sql` espalhados pelo repo, o schema abaixo foi obtido **direto do banco de produção** via `GET {SUPABASE_URL}/rest/v1/` (introspecção OpenAPI do PostgREST, usando a `SUPABASE_SERVICE_ROLE_KEY` já presente em `.env.local`) — leitura real, não suposição. **82 tabelas/views expostas.**

Achado importante: **4 tabelas usadas por código ativo não existem no banco real** — ver [decisoes.md](./decisoes.md) e [bugs.md](./bugs.md) para o detalhe e a correção recomendada (`flow_templates`, `flow_template_ratings`, `flow_insights`, `retention_events`).

`supabase-MASTER-migration.sql` continua sendo o melhor candidato a "script de setup completo" (idempotente, mais recente) — mas note que mesmo ele não cobre tudo: tabelas como `profiles`, `my_company`, `quiz_responses`, `user_payment_config`, `company_integrations`, `autopilot_logs` existem em produção e vieram de migrations incrementais avulsas, não do MASTER. Não existe hoje um único arquivo que reproduza o banco real do zero — qualquer setup novo precisaria do MASTER **mais** as migrations incrementais relevantes.

### Tabelas confirmadas em produção (82, agrupadas por domínio)

| Domínio | Tabelas |
|---|---|
| Identidade/Auth | `users`, `companies`, `company_profile`, `company_identity`, `business_identity`, `profiles`, `my_company`, `company_integrations` |
| Billing | `subscriptions`, `payments`, `customers`, `invoices`, `user_payment_config` |
| CRM/Vendas | `leads`, `products`, `ai_personas`, `sales_conversations`, `sales_messages`, `sales_actions`, `pipeline_stages`, `quiz_responses` |
| WhatsApp | `whatsapp_conversations`, `whatsapp_messages`, `whatsapp_ai_context`, `whatsapp_analytics`, `lead_context`, `wa_contacts` (view) |
| Automação/Flow Engine | `automations`, `automation_steps`, `automation_enrollments`, `automation_flows`, `flow_executions`, `flow_errors`, `growth_maps`, `growth_map_executions`, `engine_runs`, `engine_action_logs`, `autopilot_logs` |
| IA/Conteúdo | `ai_training_files`, `ai_generated_assets`, `creative_templates`, `ai_memory`, `ai_tasks`, `ai_attachments`, `ai_creative_logs`, `company_usage`, `nexus_ai_conversations`, `nexus_ai_messages`, `nexus_memory` |
| Inteligência de negócio | `diagnostics`, `diagnostic_scores`, `financial_data`, `actions`, `execution_history`, `execution_logs` |
| Retenção/Crescimento | `revenue_events`, `seller_events`, `alerts` |
| Analytics | `analytics_events`, `campaign_analytics`, `campaign_history` |
| Projetos | `projects`, `project_tasks`, `project_products`, `project_revenues`, `project_expenses`, `project_analyses`, `project_comments` |
| Waitlist/Referral | `waitlist`, `onboarding_leads` |
| Fornecedores | `suppliers`, `supplier_costs`, `supplier_insights` |
| Outros | `message_templates`, `message_logs`, `messages`, `checklist_progress`, `client_transactions`, `clients`, `collection_logs`, `charge_logs`, `nexus_events` (Realtime cross-process) |

### ✅ 4 tabelas que faltavam foram criadas em 2026-06-18

`flow_templates`, `flow_template_ratings`, `flow_insights` e `retention_events` foram aplicadas pelo usuário via SQL Editor do Supabase e reverificadas por introspecção direta (banco foi de 82 → 86 tabelas). Os 4 templates seed do Marketplace (`Recuperar Inadimplentes`, `Aumentar Receita Média`, `Reativar Clientes Inativos`, `Campanha Completa de Crescimento`) confirmados inseridos em `flow_templates`. Detalhe completo do problema original e da resolução em [decisoes.md](./decisoes.md).

### Padrões
- RLS ativo em todas as tabelas, policy `service_role_bypass` para o backend.
- Multi-tenant via `company_id` em praticamente todas as tabelas de domínio.
- `nexus_events` é usado para broadcast Realtime entre processos (`lib/core/realtime.ts`) — não confundir com o WebSocket de voz do NEXUS OS, que é uma conexão direta ao OpenAI.

## IA — Claude (Anthropic) + OpenAI

| Uso | Onde | Modelo |
|---|---|---|
| Diagnósticos, insights financeiros, geração de respostas WhatsApp | `lib/ai.ts` | `claude-sonnet-4-6`, `claude-haiku-4-5` |
| Processamento de IA das conversas de WhatsApp entrantes | `lib/whatsapp-engine.ts` | `gpt-4.1-mini` (OpenAI) |
| Voz sempre-ativa do NEXUS OS | `lib/nexus/voice-engine.ts` | `gpt-realtime` (OpenAI Realtime API, WebSocket) |
| Transcrição de áudio | `lib/ai/audio/transcribe.ts` | — |
| Análise de imagem | `lib/ai/vision/analyze-image.ts` | — |
| Roteamento entre modelos | `app/api/ai/router` | — |

**Atenção:** o projeto usa tanto Anthropic quanto OpenAI dependendo do contexto — não assumir que "a IA do NEXUS" é só Claude. Voz é exclusivamente OpenAI Realtime (Claude não tem API de voz equivalente atualmente).

## Stripe (Billing)

- `lib/payments/stripe.ts` — integração da plataforma (API `2026-04-22.dahlia`), `generatePaymentLink()` para faturas, checkout sessions com metadata (`invoice_id`, `company_id`).
- `lib/payments/provider.ts` — geração de link de pagamento **por tenant**, lendo credenciais próprias de `user_payment_config` (cada empresa pode ter sua própria conta Stripe/gateway).
- `lib/payments/encryption.ts` — criptografia AES para credenciais armazenadas.
- `/api/billing/create-checkout` — endpoint de checkout.
- **Não confirmado:** se webhooks do Stripe (atualização de `subscriptions` a partir de eventos) estão implementados. Verificar antes de declarar o billing como "completo" — o manifesto antigo listava isso como pendente (Sprint 6).

## WhatsApp — Z-API (não Meta Cloud API)

Divergência importante em relação ao manifesto antigo, que descrevia um stub para Meta Cloud API: a integração real e em produção usa **Z-API** (`https://developer.z-api.io`).

- `lib/zapi.ts` — credenciais por empresa armazenadas criptografadas em `business_identity`, com fallback para variáveis de ambiente da plataforma. `zapiSendText()`.
- `lib/whatsapp.ts` — ainda existe código relacionado à Meta Cloud API (normalização E.164, builders de mensagem) — confirmar se está em uso ou é vestígio do design original antes de removê-lo ou estendê-lo.
- `lib/whatsapp-engine.ts` — pipeline completo de IA para mensagens entrantes (receive → validar → IA → responder), usando `gpt-4.1-mini`.
- CRM completo (V5, commit `0a52f13`): pipeline de vendas (`novo → qualificado → interessado → negociando → proposta → fechado/perdido/cliente`), busca full-text em português, fotos de contato, paginação por cursor.
- `app/api/nexus/whatsapp/**` — 16 sub-rotas (setup por QR code, send, receive, analyze, transfer, activity tracking, search).

## Email

- `lib/email.ts` — Resend (principal) + Nodemailer/SMTP (fallback ou per-tenant via `business_identity`).
- Builders de HTML para notificações de ação e cobranças.

## n8n (automação externa)

`n8n-workflows/*.json` — 5 workflows exportados, fora do código Next.js, executados em uma instância n8n separada:
- `NEXUS-email-d2-bastidores`, `NEXUS-email-d5-casestudy`, `NEXUS-email-d9-urgencia` — sequência de nutrição por email (dias 2/5/9)
- `NEXUS-email-acesso-manual` — disparo manual
- `NEXUS-whatsapp-lead-responder` — resposta automática a leads via WhatsApp

Esses workflows não são deployados pelo Vercel — precisam ser importados manualmente numa instância n8n. Confirmar se essa instância está ativa/mantida antes de assumir que essas sequências estão rodando em produção.

## Vercel / CI

- Deploy via integração nativa Vercel↔GitHub; `.github/workflows/vercel-deploy.yml` é o único workflow de CI.
- `vercel.json` define 7 cron jobs diários (ver [arquitetura.md](./arquitetura.md)).
- `.env.local`, `.env.local.example`, `.env.vercel.tmp` presentes localmente — variáveis sensíveis nunca devem ser lidas/expostas em respostas de IA.

## Dependências críticas (package.json)

```
next 16.2.4 · react/react-dom 19.2.4 · @supabase/supabase-js 2.103.3 · @supabase/ssr 0.10.2
@anthropic-ai/sdk 0.90.0 · openai 6.37.0 · stripe 22.1.0
bullmq 5.76.2 · ioredis 5.10.1 · @xyflow/react 12.10.2
resend 6.12.0 · nodemailer 8.0.7 · mammoth 1.12.0 · pdf-parse 2.4.5 · xlsx 0.18.5
zustand 5.0.12 · framer-motion 12.38.0 · @hello-pangea/dnd 18.0.1 · recharts 3.8.1
```
