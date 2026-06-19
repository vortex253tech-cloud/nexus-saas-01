# NEXUS — Próximos Passos (priorizados)

> Gerado em 2026-06-18. Esta priorização é uma proposta baseada em risco técnico e impacto observável no código — não foi validada com o usuário ainda. Tratar como ponto de partida para discussão, não como backlog definitivo.

## 🔴 CRÍTICO (risco de quebra ou bloqueio de receita)

1. ~~Aplicar 3 migrations pendentes no SQL Editor do Supabase~~ — **Feito em 2026-06-18.** `flow_templates`, `flow_template_ratings`, `flow_insights` e `retention_events` confirmadas criadas (reverificado por introspecção, 82→86 tabelas) e os 4 templates seed confirmados inseridos. Falta só um teste manual na UI do Marketplace (`/dashboard/marketplace`) para fechar o ciclo ponta a ponta.
2. ~~Confirmar se webhooks do Stripe estão implementados~~ — **Resolvido**: estão, e são dois com propósitos distintos (billing da plataforma vs. cobrança de tenant), nenhum é stub. Falta só confirmar no painel do Stripe que as URLs corretas estão cadastradas para cada evento.
3. ~~Verificar no painel da Z-API qual URL de webhook está cadastrada~~ — **Verificado pelo usuário em 2026-06-18**: produção estava correta (`/api/nexus/whatsapp/webhook` recebe as mensagens). ~~Corrigir a URL hardcoded em `setup/route.ts`~~ — **Corrigido em 2026-06-18** (e também em `whatsapp/status/route.ts`), eliminando o risco de regressão numa futura reconexão por QR code. `/api/webhook/whatsapp` (Meta Cloud API + `lib/whatsapp.ts`) continua parecendo código morto isolado — não confirmado, baixa prioridade.
4. ~~Aplicar gating por plano nos endpoints pagos que hoje não têm~~ — **Feito em 2026-06-18.** 13 rotas gateadas (6 AI + 5 Creative AI + 2 voz), com contador real de uso (`company_usage.ai_messages_count` + RPC `increment_usage()` reaproveitada). `tsc --noEmit` limpo. Ficou pendente: (a) reset mensal do contador não existe — acumula para sempre; (b) Flow Engine (`/api/flows/**`, `/api/growth-maps/**`) ainda sem gate de `max_automations`/execuções — não coberto nesta rodada. Detalhe em [decisoes.md](./decisoes.md).
5. **Corrigir isolamento multi-tenant em `/api/ai/financial-insights` e `/api/creative/generate`** — achado novo durante o trabalho de gating (2026-06-18): essas rotas confiam no `company_id` vindo do corpo da requisição em vez de derivá-lo da sessão autenticada. Um usuário de uma empresa poderia, em teoria, passar o `company_id` de outra e ver/gerar conteúdo com dados dela (IDOR). Não corrigido ainda — fora do escopo desta rodada de gating, mas é uma exposição de dados real.

## 🟠 ALTO IMPACTO (bloqueia crescimento ou experiência do usuário)

6. **Validar se o canvas visual do Flow Engine (`@xyflow/react`) está implementado** — é a peça que faltava no manifesto original (Sprint 1) e pode ser o que impede usuários não-técnicos de criar fluxos sem intervenção manual no banco.
7. **Unificar (ou confirmar que já estão unificados) o pipeline de vendas do WhatsApp V5 com o módulo de Leads/CRM geral** (`/dashboard/leads`) — hoje parecem ser sistemas paralelos (`leads` vs `whatsapp_conversations`/`lead_context`).
8. **Monitorar a integração de voz (NEXUS OS) ativamente.** O histórico mostra ~25 commits de correção em 2 dias por mudanças não anunciadas da API Realtime da OpenAI. Recomenda-se um health-check automatizado (já existe `/dashboard/system/realtime`?) e não depender só de relato manual de falha.
9. **Confirmar status real da instância n8n** (5 workflows de email/WhatsApp) — se não estiver ativa, sequências de nutrição de leads podem estar simplesmente não rodando sem ninguém notar.

## 🟡 MÉDIO IMPACTO

10. **Auditar Creative AI** — módulo identificado mas não auditado em profundidade nesta rodada (rotas existem, funcionalidade real não confirmada). O Marketplace já tem causa raiz conhecida do seu bug atual — ver item crítico #1.
11. **Revisar consistência de `next.config`** — histórico mostra 2+ correções de build na Vercel por causa de configuração de Next.js (`.ts` → `.mjs`, `serverExternalPackages`). Validar que o config atual está estável antes de fazer upgrade de versão do Next.js novamente.
12. **Implementar reset mensal de `company_usage`** — achado durante o trabalho de gating: a tabela tem `company_id` `UNIQUE` (uma linha por empresa, não por período), então `ai_messages_count` e os demais contadores (`automations_count`, `messages_sent`, etc.) acumulam para sempre em vez de resetar todo mês. Exige cron de reset ou mudar a chave para `(company_id, period_start)`.

## 🟢 BAIXA PRIORIDADE

13. Atualizar/aposentar formalmente `NEXUS_SYSTEM_MANIFEST.md` com uma nota apontando para `docs/` como complemento (já referenciado em [contexto-geral.md](./contexto-geral.md)).
14. Revisar se a rota `/v1` (legada) ainda é necessária.
15. Consolidar os ~20 arquivos `supabase-migration-*.sql` legados na raiz num único lugar de arquivo morto (`supabase/legacy/` por exemplo), depois de confirmar o item crítico #1.

## Regra de execução

Nenhum destes itens deve ser executado sem validação do usuário primeiro — esta lista é diagnóstico, não autorização para agir. Em particular, qualquer mudança em schema (#1, #15) ou remoção de webhooks (#3) é uma operação de alto risco em banco/integrações compartilhadas e exige confirmação explícita antes de qualquer DROP/ALTER/delete de arquivo.
