# NEXUS — Roadmap

> Combina o roadmap técnico do `NEXUS_SYSTEM_MANIFEST.md` (ainda válido para o Flow Engine) com o que se tornou relevante depois das fases NEXUS OS / WhatsApp V5 / Enterprise. Este documento é uma proposta de sequenciamento, não uma decisão tomada — validar prioridades com o usuário antes de executar qualquer sprint.

## Sprints originais (do manifesto, status reavaliado em 2026-06-18)

| Sprint | Item | Status real observado |
|---|---|---|
| 1 — Flow Engine UI | Canvas visual (`@xyflow/react`) ✅, painel de execuções ✅, node configurator ❌ | **Verificado em 2026-06-18** (não mais suposição): canvas drag-and-drop completo com save/execute/status em tempo real/"salvar como template" → Marketplace. Falta só o configurador de nó (editar parâmetros de um nó já criado) — hoje todo nó nasce com `config: {}` e não há UI para preenchê-lo. Ver [proximos-passos.md](./proximos-passos.md) #6. |
| 2 — WhatsApp Real | Substituir stub por provedor real, webhook de entrada, status tracking | ✅ Superado — Z-API está integrado e em produção (WhatsApp V5), muito além do que este sprint previa |
| 3 — Triggers Avançados | scheduled, webhook, event (Supabase Realtime) | Parcial — `nexus_events` (Realtime) existe; confirmar se TRIGGER nodes do Flow Engine já consomem isso |
| 4 — IA Autônoma | Agente que cria/executa flows a partir de uma meta | Parcial — `lib/engine/learning`, `lib/decision-engine.ts`, `lib/autopilot.ts` existem; NEXUS OS com 9 agentes é uma versão mais ambiciosa disso, mas não necessariamente conectada ao Flow Engine |
| 5 — Multi-tenant Avançado | Roles por empresa, múltiplos usuários, audit log | Parcial — planos Pro/Scale/Enterprise já preveem múltiplos usuários (`lib/nexus-plan.ts`); roles/audit log não confirmados |
| 6 — Billing/Monetização | Stripe Checkout, usage-based billing, webhooks | Parcial — Stripe e checkout existem (`lib/payments/stripe.ts`); webhooks não confirmados (ver [bugs.md](./bugs.md)) |

## Frentes que surgiram depois do manifesto (não estavam no roadmap original)

1. **NEXUS OS / voz sempre-ativa** — already shipped, mas a integração com a Realtime API da OpenAI é historicamente instável (ver [memoria-do-projeto.md](./memoria-do-projeto.md), Fase 4). Próximo passo natural: testes automatizados ou monitoramento de saúde da sessão de voz, não só correção reativa.
2. **WhatsApp V5 CRM** — já tem pipeline, busca e fotos. Próximo passo natural: conectar o pipeline de vendas do WhatsApp ao módulo de Leads/CRM mais amplo (`/dashboard/leads`), se ainda não estiverem unificados.
3. **Enterprise/Admin** — gating já aplicado em alguns endpoints (`whatsapp/send`, `automations`, `projects`). Auditar se TODOS os endpoints sensíveis por plano têm o gate aplicado, ou se há lacunas.
4. **Creative AI / Marketplace** — módulos novos, status funcional não auditado nesta rodada de exploração — próxima sessão de documentação deveria cobrir isso em detalhe.
5. **Consolidação de schema SQL** — ver [decisoes.md](./decisoes.md): há duas fontes de "setup canônico" do banco. Isso é dívida técnica que pode causar divergência entre ambientes (dev vs. produção) se não resolvida.

## Como usar este roadmap

Antes de iniciar qualquer sprint, validar com o usuário (dono do produto) a prioridade real — este documento é um **inventário de opções organizadas**, não uma decisão de o que construir primeiro. Ver [proximos-passos.md](./proximos-passos.md) para a lista priorizada por criticidade.
