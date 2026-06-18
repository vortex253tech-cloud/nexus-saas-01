# NEXUS — Arquitetura

> Ver [contexto-geral.md](./contexto-geral.md) para visão de produto. Este documento foca na arquitetura técnica atual (2026-06-18). O `NEXUS_SYSTEM_MANIFEST.md` na raiz do repo ainda é a referência mais detalhada para o **Flow Engine** especificamente — não duplicado aqui em profundidade.

## Camadas

```
┌──────────────────────────────────────────────────────────────────────┐
│ FRONTEND — Next.js 16 App Router, React 19, Tailwind 4               │
│ app/ (marketing/público) · app/dashboard/** (autenticado)            │
│ NexusProvider (lib/nexus/nexus-context.tsx) envolve todo o dashboard │
│ e mantém a sessão de voz viva entre navegações                       │
└───────────────────────────────┬────────────────────────────────────-┘
                                 │ fetch / Server Components / WebSocket
┌───────────────────────────────▼────────────────────────────────────-┐
│ BACKEND — app/api/** (Route Handlers)                                │
│ lib/auth.ts → getAuthContext() por rota (não há middleware.ts global)│
│ lib/flow-engine/**  → motor de automação (ver manifest)              │
│ lib/nexus/**        → NEXUS OS (voz, sessão, tools)                  │
│ lib/payments/**     → Stripe + provedores por tenant                 │
│ lib/whatsapp* / zapi.ts → CRM conversacional                         │
└──────────────┬─────────────────────────────┬─────────────┬──────────┘
               │                             │             │
   ┌───────────▼─────────┐      ┌────────────▼───────┐  ┌──▼────────────┐
   │ Supabase             │      │ Redis (opcional)   │  │ OpenAI        │
   │ Postgres + Auth + RLS│      │ BullMQ — fila de    │  │ Realtime API  │
   │ Realtime (nexus_events)│    │ jobs (flows)        │  │ (voz, gpt-    │
   │ service_role no backend│    │ fallback síncrono   │  │ realtime)     │
   └───────────────────────┘     └─────────────────────┘  └───────────────┘
               │
   ┌───────────▼──────────────────────────────────────────────────────┐
   │ Serviços externos: Anthropic Claude · Stripe · Z-API (WhatsApp) · │
   │ Resend/Nodemailer (email) · n8n (sequências de email/WhatsApp)    │
   └─────────────────────────────────────────────────────────────────┘
```

## Autenticação e proteção de rotas

- **Não existe `middleware.ts`** no root do projeto (divergência em relação ao manifesto antigo, que descrevia um middleware global). A proteção é feita por rota:
  - Frontend: `lib/auth-provider.tsx` mantém estado de sessão; redirecionamentos client-side
  - Backend: cada API route chama `getAuthContext()` (`lib/auth.ts`), que resolve `user + company + subscription + effectivePlan` a partir do cookie de sessão Supabase (`@supabase/ssr`)
  - Suporte adicional a **Bearer token** (commit `f8da3bc`), além do cookie — relevante para chamadas server-to-server ou de apps externos
- Multi-tenant: toda query deve incluir `.eq('company_id', ctx.companyId)`. Regra herdada do manifesto antigo e ainda válida.

## Planos e gating (Enterprise)

- `lib/nexus-plan.ts` é a fonte única de verdade dos 5 tiers: **Free, Starter, Pro, Scale (Business), Enterprise** — limites de usuários, leads, projetos, agentes, mensagens de IA.
- `lib/plan-middleware.ts` expõe guards server-side: `denyIfCannot()`, `denyIfAtLimit()`, `requirePlan()`, `requireActiveSubscription()`.
- `components/ui/plan-gate.tsx` faz o gating no frontend (blur/overlay, `UpgradeBadge`, `UpgradeCard`, `LimitBadge`).
- Admin: `/admin` (protegido por `SUPER_ADMIN_EMAILS`) permite listar usuários e alterar plano manualmente via `/api/admin/users`.

## NEXUS OS — sessão de voz sempre-ativa

Arquitetura desenhada para sobreviver à navegação entre páginas (não é um componente React comum):

- `lib/nexus/nexus-session-manager.ts` — singleton fora do ciclo de vida do React. Reconecta com backoff (1s/2s/5s), heartbeat de 30s, reconecta se silêncio > 8s. **Único caminho** que fecha o WebSocket é `forceDisconnect()` (botão "Desativar NEXUS", logout, ou expiração de sessão).
- `lib/nexus/voice-engine.ts` (`NexusVoiceEngine`) — cliente WebSocket para `wss://api.openai.com/v1/realtime?model=gpt-realtime`. Autentica com token efêmero obtido em `/api/nexus/voice/token`. Áudio PCM16 @ 24kHz via AudioWorklet inline. Máquina de estados: `connecting → ready → listening → processing → speaking → executing`.
- `lib/nexus/config.ts` — system prompt + definição das tools (WhatsApp, tasks, leads, meetings, automations, propostas, consultas financeiras, modo CEO).
- `lib/nexus/nexus-context.tsx` — Context React que expõe o singleton via `useNexusSession()`; montado em `app/dashboard/layout.tsx`, então nunca desmonta enquanto o usuário estiver no dashboard.
- Evento recente (`75c7523`): a API Realtime do OpenAI mudou nomes de eventos de áudio na GA (`response.audio.*` → `response.output_audio.*`). O engine hoje escuta **ambos** os formatos por compatibilidade.

## Banco de dados

Ver [integracoes.md](./integracoes.md) para a tabela completa (~70 tabelas). Pontos-chave:
- `supabase-MASTER-migration.sql` e `supabase-setup-completo.sql` são os dois candidatos a "setup canônico" para banco novo — ambos cobrem o core (users, companies, subscriptions, financial_data, diagnostics) mas com pequenas diferenças; **decisão pendente de qual é a fonte de verdade** (ver [decisoes.md](./decisoes.md)).
- `supabase/migrations/*.sql` (23 arquivos, de `20240001` a `20260529`) são incrementais e devem rodar depois do setup base, em ordem.
- RLS ativo em todas as tabelas; policy `service_role_bypass` dá acesso total ao backend. Frontend usa exclusivamente a anon key.
- `nexus_events` (Supabase Realtime) é usado para broadcast de eventos entre processos (`lib/core/realtime.ts`) — mecanismo de comunicação cross-process fora do WebSocket de voz.

## Filas e cron

- BullMQ + IORedis para execução assíncrona de flows, com fallback síncrono se `REDIS_URL` não estiver configurado.
- `vercel.json` define 7 crons: `ai-runner` (08h), `autopilot` (07h), `charge-email` (09h), `automations` (10h), `flow-queue` (06h), `sales-followup` (11h), `ai-tasks` (12h) — todos diários, horários BRT presumidos.

## CI/CD

- `.github/workflows/vercel-deploy.yml` — único workflow no repo, deploy para Vercel.
- Deploy real acontece via integração nativa Vercel ↔ GitHub (`.vercel/` presente localmente).
