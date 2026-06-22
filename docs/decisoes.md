# NEXUS — Decisões Arquiteturais

> Registro de decisões observadas no código (algumas implícitas, inferidas pela implementação) e decisões ainda pendentes de confirmação explícita. Atualizar sempre que uma decisão pendente for resolvida, ou uma nova decisão arquitetural relevante for tomada.

## Decisões já tomadas (observadas no código)

| Decisão | Evidência | Racional inferido |
|---|---|---|
| Sem `middleware.ts` global — proteção rota-a-rota via `getAuthContext()` | Ausência confirmada de `middleware.ts` no root | Provavelmente simplicidade/flexibilidade por rota, em vez de uma camada centralizada. Trade-off: mais fácil esquecer de proteger uma rota nova. |
| WhatsApp real é via **Z-API**, não Meta Cloud API | `lib/zapi.ts` em produção, `lib/whatsapp.ts` (Meta) parece legado | Z-API provavelmente foi escolhido por ser mais simples de integrar para PMEs brasileiras sem precisar de aprovação do Business Manager da Meta |
| Voz usa OpenAI Realtime (`gpt-realtime`), não Claude | `lib/nexus/voice-engine.ts` | Anthropic não oferece (no momento da implementação) uma API de voz em tempo real equivalente; Claude continua sendo usado para texto/análise (`lib/ai.ts`) |
| Sessão de voz é um singleton fora do React, não um hook comum | `lib/nexus/nexus-session-manager.ts` | Necessário para sobreviver à navegação entre páginas do dashboard sem reconectar a cada troca de rota — UX de "sempre ativo" |
| Multi-tenant via `company_id` em vez de schemas separados por empresa | Padrão `.eq('company_id', ...)` em todas as queries | Mais simples de operar em Supabase compartilhado; aceita o risco de bugs de isolamento se uma query esquecer o filtro |
| Credenciais de WhatsApp/SMTP por tenant são criptografadas e armazenadas em `business_identity` | `lib/payments/encryption.ts`, `lib/business-identity.ts` | Permite white-label real (cada empresa com seu próprio número/remetente) sem expor segredos em texto puro no banco |
| BullMQ/Redis é opcional com fallback síncrono | `lib/flow-engine/queue-connection.ts` retorna `null` se `REDIS_URL` ausente | Permite rodar em ambientes sem Redis configurado (ex: dev local, ou Vercel sem add-on) sem quebrar o Flow Engine |

## ✅ 2026-06-22 — Revisão de consistência do `next.config` (item 11): estável, sem ação necessária

**Contexto:** histórico tinha 2+ correções de build na Vercel ("modifyConfig crash") ligadas a `next.config` — verificar se o arquivo atual estava estável antes de qualquer upgrade futuro do Next.js.

**Achado: estável.** Só existe `next.config.js` (CJS), criado pelas correções anteriores (`next.config.ts` → `.mjs` → `.js`, commits `9075b79`/`8cf5ed5`) — sem duplicata de formato. Conteúdo mínimo: só `serverExternalPackages` para os pacotes nativos pesados (`bullmq`, `ioredis`, `pdf-parse`, `mammoth`, `nodemailer`). `vercel.json` (`buildCommand: "next build"`, crons) e `package.json` (scripts `dev`/`build`/`start` padrão) sem nada fora do comum.

**Achado fora de escopo do repositório, não corrigido por decisão do usuário:** o aviso do Next dev local ("Next.js inferred your workspace root... detected multiple lockfiles") vem de um `package-lock.json` vazio/órfão em `C:\Users\Ezequ\.claude\ide\package-lock.json` — **fora** da pasta `nexus-saas-01` (pasta pai onde o IDE clona repositórios, não faz parte do git deste projeto). É cosmético, só aparece em dev local — o build da Vercel roda num checkout limpo só do repo, sem esse arquivo. Não re-adicionei `turbopack.root` ao `next.config.js` para silenciar isso: essa opção foi removida de propósito no commit `09de0e0` durante a investigação do crash de build anterior — mesmo achando que o crash real era sobre formato de arquivo (já resolvido), preferi não reintroduzir uma variável historicamente ligada a um problema de build na Vercel só para resolver um aviso sem impacto em produção. Usuário confirmou: deixar o lockfile órfão como está.

## ✅ 2026-06-22 — Auditoria do Creative AI: módulo real e funcional, 3 ajustes de consistência

**Contexto:** item 10 de `proximos-passos.md` — módulo nunca tinha sido auditado em profundidade (rotas existiam, funcionalidade real não confirmada).

**Resultado da auditoria: módulo está pronto para produção, sem stubs.** 6 rotas (`generate`, `generate-multi`, `image`, `opportunities`, `pdf`, `stats`), todas chamando IA real (Claude Sonnet/Haiku via Anthropic SDK, DALL-E 3 via OpenAI) com persistência real em `ai_generated_assets`/`campaign_history` e gating de plano (`denyIfCannot('nexus_ai')` + `denyIfAtLimit('max_ai_messages', ...)`) já aplicado em todas. Frontend (`app/dashboard/creative-ai/page.tsx`, 1390 linhas) tem 7 abas todas funcionais, sem wiring quebrado. `ANTHROPIC_API_KEY` e `OPENAI_API_KEY` confirmados configurados no ambiente (não reproduzo os valores aqui por segurança).

**3 ajustes de consistência feitos:**
1. `generate-multi` e `opportunities` tinham um `resolveCompanyId()` com fallback para "primeira empresa do banco" se a sessão falhasse — mesmo padrão de risco já catalogado em `bugs.md` para `ai/chat`/`ai/business-analysis` (🟢 Baixo: `denyIfCannot('nexus_ai')` já é chamado antes e já exige sessão válida via `getAuthContext()`, então esse fallback só seria alcançável numa falha transitória entre duas chamadas separadas de `getAuthContext()` — não é um endpoint aberto). Mesmo de baixo risco prático, removido o fallback para manter consistência com `creative/generate`/`creative/image`, que já derivam `company_id` estritamente da sessão sem fallback nenhum.
2. `creative/generate` não checava `ANTHROPIC_API_KEY` antes de instanciar o client Anthropic (as outras 3 rotas que usam Claude já checavam e retornavam 503) — adicionado o mesmo check, evitando um 500 não tratado se a chave for removida/expirar.
3. Typo "Regerar" → "Regenerar" no botão de regenerar conteúdo (`app/dashboard/creative-ai/page.tsx`).

**Não corrigido, observado mas de baixa prioridade:** parsing de JSON da resposta do Claude em `creative/generate` usa regex (`/\{[\s\S]*\}/`) em vez de um parser estruturado — funciona na prática (Claude raramente devolve múltiplos blocos JSON), mas é frágil. Registrar se algum dia o parsing falhar silenciosamente em produção.

`npx tsc --noEmit` limpo.

## ✅ 2026-06-22 — Configurador de nó do Flow Engine / Growth Map canvas

**Contexto:** item 6 de `proximos-passos.md` — o canvas (`app/dashboard/growth-map/[id]/canvas.tsx`, `@xyflow/react`) já permitia criar/conectar/salvar/executar nós, mas `addNode()` sempre criava `config: {}` vazio e não havia nenhuma UI para editar os parâmetros depois — só era possível via edição direta do JSON no banco/API.

**Descoberta importante antes de codificar:** os tipos de nó do canvas (`data_analysis`, `opportunity`, `decision`, `message_gen`, `auto_action`, `result`, de `lib/growth-map-types.ts`) **não são** os mesmos do Flow Engine genérico (`TRIGGER/ANALYSIS/DECISION/ACTION/RESULT`, de `lib/flow-engine/types.ts`) — são dois vocabulários diferentes para o mesmo sistema. A ponte é `FlowEngineService.normaliseType()` em `lib/flow-engine/flow-engine.service.ts`, que mapeia `data_analysis`/`opportunity` → `ANALYSIS`, `auto_action` → `ACTION`, etc. Isso significa que o formulário de configuração precisa espelhar exatamente o que os **handlers** (`lib/flow-engine/handlers/*.ts`) e **actions** (`lib/flow-engine/actions/*.ts`) leem de `node.config` — não o que `GrowthNodeConfig` documentava antes (que tinha campos puramente decorativos como `focus`/`question`, nunca lidos pelo motor de execução).

**Implementado:** novo `app/dashboard/growth-map/[id]/node-config-panel.tsx` — painel lateral com formulário específico por tipo de nó:
- `data_analysis`/`opportunity`: `dataSource` (dropdown), `limit`, `inactiveDays` (só aparece se `dataSource === 'at_risk_clients'`).
- `decision`: toggle "Decidir com IA" → `aiPrompt` + `threshold`, ou (se desligado) `condition` (expressão livre, ex: `lastOutput.count > 500`).
- `message_gen`: `messageType`, `channel`, `tone`.
- `auto_action`: dropdown "Ação" (Automático pelo canal, ou um override explícito de `actionType`: `SEND_EMAIL`, `SEND_WHATSAPP`, `UPDATE_CLIENT`, `UPDATE_FINANCIAL`, `CREATE_LEAD`, `UPDATE_LEAD_STATUS`, `CREATE_PAYMENT_LINK`) — os campos secundários mudam dinamicamente conforme a ação escolhida (ex: `subject`/`template` para email, `field`/`value`/`table` para updates).
- `result`: sem campos (mostra aviso "não tem parâmetros").

**Integração no canvas:** novo botão de engrenagem no header de cada nó (`data-node-action="configure"`) + clique no corpo do nó agora abre o configurador quando o nó ainda não tem resultado de execução (antes abria um painel de detalhe vazio e inútil; depois de executado, clicar no corpo continua mostrando o resultado, a engrenagem sempre abre o configurador). Removido `onClickDetail` do `data` dos nós — era redundante com a lógica que já existia em `onNodeClick` no `<ReactFlow>`, e só funcionava para os nós iniciais (nós criados via `addNode()` nunca tinham esse callback).

**Bônus, achado ao mapear o schema real:** `lib/flow-engine/validators/node-config.validator.ts` rejeitava `dataSource: 'inactive'` (`VALID_DATA_SOURCES` não incluía), mas `analysis.handler.ts` suporta esse valor e o próprio template embutido "Reativar Clientes" (`GROWTH_TEMPLATES.reactivate_clients`) o usa — ou seja, o primeiro nó desse template específico provavelmente sempre falhava a validação silenciosamente (nó pulado, não fatal) e nunca executava de fato. Corrigido adicionando `'inactive'` ao set.

`lib/growth-map-types.ts`: `GrowthNodeConfig` ampliada para cobrir todos os campos reais usados pelos handlers (antes só tinha um subconjunto usado pelos 4 templates embutidos).

`npx tsc --noEmit` limpo. **Testado apenas parcialmente:** sem ferramenta de automação de browser disponível nesta sessão, validei que o servidor de dev sobe sem erro e que a rota `/dashboard/growth-map/[id]` responde normalmente (redirect de auth, não crash) — não cliquei de fato no botão de engrenagem nem testei o fluxo completo de editar→salvar→executar num browser real. Recomendo testar manualmente antes de confiar 100%, especialmente: (1) os campos condicionais do `auto_action` ao trocar a `actionType`, (2) se `handleConfigChange` realmente persiste a mudança no nó certo ao clicar em "Salvar".

## ✅ 2026-06-22 — Gating de plano completo (reset mensal, Flow Engine, WhatsApp CRM) + 2 achados de segurança corrigidos no caminho

**Contexto para quem abrir esta sessão sem o histórico do chat**: pedido original era "fechar o gating de plano" (item pendente desde 2026-06-18: reset mensal de `company_usage`, Flow Engine sem limite de execução, WhatsApp CRM com gate só no `send`). Durante a investigação, dois achados não previstos mudaram o escopo — registrados abaixo, ambos corrigidos com confirmação do usuário antes de codificar.

**1) Reset mensal de `company_usage` — migration `20260622_usage_period_reset.sql`.** A tabela já tinha a coluna `period_start`, mas a `UNIQUE` era só em `company_id` — uma linha por empresa, acumulando para sempre. Migration muda a chave para `(company_id, period_start)`, reescreve `increment_usage()` e `ensure_company_usage()` para criar uma linha nova por mês (chave descoberta dinamicamente via `pg_constraint`, não hardcoded — não assume o nome padrão do Postgres). `lib/usage.ts` reescrito para sempre filtrar pelo período corrente. **Efeito sobre dados existentes:** a migration também normaliza `period_start` das linhas atuais para o mês corrente — o total acumulado até hoje passa a contar como "uso deste mês" (não há como reconstruir retroativamente o consumo por mês passado). A partir do próximo mês, zera automaticamente.

**2) Limite de execuções do Flow Engine — `max_flow_executions` (novo).** Não existia nenhum limite de execução (só de criação, via `max_automations`, e nem isso estava sendo checado). Novo limite em `lib/nexus-plan.ts` (Free/Starter: 0 — já bloqueados pela feature `automations`; Pro: 500/mês; Business/Enterprise: ilimitado — valores de partida, ajustar se não fizerem sentido comercialmente). Nova coluna `flow_executions_count` na mesma migration acima. Gates aplicados (feature `automations` + limite + incremento pós-sucesso) em `flows/[id]/run`, `growth-maps/[id]/execute`, e `growth-maps` POST (create, contra `max_automations`). Bônus: `POST /api/automations` não tinha **nenhum** gate (só o GET tinha) — corrigido.

**3) Achado não previsto — `qr`/`setup`/`disconnect` (WhatsApp) sem autenticação nenhuma, e operando na instância Z-API global da plataforma em vez da instância por-empresa.** Essas 3 rotas são chamadas por `app/dashboard/whatsapp/page.tsx` (UI real de clientes, não ferramenta interna) mas liam `process.env.ZAPI_INSTANCE_ID` direto — ou seja, todo cliente que clicava "Conectar WhatsApp" estava, na prática, conectando/desconectando o número compartilhado da plataforma, não o próprio. **Decisão do usuário, explícita:** corrigir a causa raiz, não só adicionar autenticação. Implementado: `getCompanyZApiConfig(companyId)` (novo, em `lib/business-identity.ts`) resolve a instância da própria empresa via `business_identity.zapi_instance_id/token`, com fallback para a instância global só se a empresa ainda não configurou a própria (mesmo padrão já usado por `new-conversation`/`send-image`). Novos helpers em `lib/zapi.ts` (`zapiGetQrCode`, `zapiDisconnect`, `zapiSetupWebhooks`) substituem os `fetch` brutos duplicados nas rotas. `qr`/`setup`/`disconnect`/`status` reescritas: `getAuthContext()` + `denyIfCannot('whatsapp')` + resolução per-company. `status/route.ts` mudou de query param `?company_id=` (não autenticado, e o frontend passava literalmente o placeholder `"check"`/`"self"`, nunca um ID real) para sessão — os 2 call sites em `app/dashboard/whatsapp/page.tsx` atualizados para não enviar mais o param.

**4) Gate `denyIfCannot('whatsapp')` aplicado nas rotas que faltavam:** `send-image`, `transfer`, `suggest`, `search`, `new-conversation`, `lead` (todas usam `getAuthContext()`, gate direto). **`analyze`** é caso especial — chamado fire-and-forget pelo webhook (sem sessão, usa `x-webhook-secret`) e o branch "manual" no comentário original nunca teve implementação real nem chamador no código (confirmado: zero call sites fora do próprio webhook). O branch `!isInternal` era um no-op (comentário "skip auth for now") — exatamente o vetor de custo/DoS já registrado em `bugs.md` ("qualquer um podendo disparar análises de IA pagas"). Corrigido: `!isInternal` agora exige `getAuthContext()` + `denyIfCannot('whatsapp')` de verdade; o caminho interno do webhook continua sem gate (não tem sessão, sempre foi assim, não é regressão).

**Não corrigido, fora de escopo desta rodada:** o caminho manual de `analyze` (que agora exige sessão) ainda deriva `company_id` só da própria conversa, sem validar se o `conversation_id` pertence à empresa do chamador — pré-existente, não introduzido agora, mas como hoje não há nenhum chamador real desse branch, o risco prático é zero. Registrar se um caminho manual real for implementado no futuro.

**✅ Migration confirmada em 2026-06-22.** Usuário rodou `supabase/migrations/20260622_usage_period_reset.sql` no SQL Editor do Supabase. Reverificado por leitura direta via PostgREST (`GET /rest/v1/company_usage?select=company_id,period_start,flow_executions_count`): coluna `flow_executions_count` existe e `period_start` das linhas existentes já está normalizado para `2026-06-01` (mês corrente) — efeito esperado do passo 2 da migration. Não verificado diretamente (PostgREST não expõe `pg_constraint`): se a `UNIQUE` foi de fato trocada para `(company_id, period_start)` — inferido como certo já que os dois efeitos visíveis só ocorrem se o script completo rodou sem erro (Supabase SQL Editor aborta no primeiro erro de uma execução em lote).

`npx tsc --noEmit` limpo após todas as edições (16 arquivos + 1 migration nova).

**Pendente:** nenhum dos fluxos foi testado em runtime (sem acesso a browser nesta sessão) — em particular, testar manualmente o fluxo de conectar WhatsApp com uma empresa que tenha (e uma que não tenha) `business_identity.zapi_instance_id` configurado, e confirmar que `growth-maps`/`flows` bloqueiam corretamente nos planos Free/Starter.

## ✅ 2026-06-21 — Dashboard: Autopilot reconectado ao motor real + voice/v8 rebrand da landing page

**Contexto para quem abrir esta sessão sem o histórico do chat**: o usuário pediu, em sequência, (1) corrigir o botão "Autopilot" do dashboard, (2) um rebrand visual da home pública preservando a identidade azul/escura atual (não voltar ao roxo/neon antigo), com voz e simulação do NEXUS operando, e depois (3) intensificar o azul porque a primeira versão ficou "flat/banco".

**1) Bug real corrigido — Autopilot do dashboard era 100% decorativo.** O botão em `app/dashboard/page.tsx` lia/escrevia `localStorage` e chamava `POST /api/user/preferences` com `{ autopilotEnabled }`, campo que essa rota **ignora silenciosamente** (só trata `themeKey`). Ou seja, clicar nunca setava `companies.autopilot_enabled`, a flag real que o cron `/api/cron/ai-runner` (motor de decisão rule-based, já existente) verifica antes de rodar. Religado para usar `/api/autopilot/enable` (GET/POST), que já existia e já fazia a coisa certa. Bloqueado por outro bug até o usuário rodar manualmente: `ALTER TABLE companies ADD COLUMN IF NOT EXISTS updated_at ...` — faltava a coluna que um trigger genérico já esperava. **Confirmado pelo usuário em 2026-06-21 que a migration foi rodada.** Falta só testar o toggle na UI pra fechar o ciclo.

**2) Novo cron `/api/cron/insights-generate`** — o motor de insights via Claude (`lib/ai.ts`, usado pela página Advisor) só rodava on-demand. Agora roda diário (`vercel.json`, 08:30) para empresas com assinatura ativa/trial e `financial_data`, com debounce de 20h e WhatsApp do top insight.

**3) Rebrand da home (`app/page.tsx`) — v8**: Hero virou duas colunas (texto+CTA à esquerda, orb de voz à direita). Orb novo (`components/VoiceOrb.tsx`) com waveform **real** (Web Audio API `AnalyserNode`, não CSS fake), tocando um áudio gerado por TTS (`public/audio/nexus-welcome.mp3`, OpenAI `tts-1-hd`, voz `onyx`) com o script de apresentação do NEXUS. Seção de módulos renomeada para "O NEXUS pensa" (6 cards: Vendas/Financeiro/CRM/Projetos/WhatsApp/Automações). Nova seção "Como o NEXUS trabalha" (timeline de 6 passos). Nebulosa azul + partículas discretas de volta no fundo (uma só, baixa opacidade — não é o mesh roxo/neon antigo).
**Decisão explícita de não fazer**: o briefing original pedia números de prova social fabricados (+50.000 automações, +1.000.000 mensagens, 99,9% disponibilidade) e um vídeo de avatar humano falando. Ambos ficaram de fora — o primeiro por ser propaganda enganosa (mesmo problema já corrigido antes no funil do Lovable, ver [[project_nexus_marketing_stack]] na memória), o segundo por exigir um serviço terceiro (HeyGen/D-ID) fora do escopo desta sessão.

**4) Ajuste de cor (2026-06-21, mesma sessão)**: a primeira versão usava `#1E40AF` (azul-marinho) sólido nos CTAs, e o usuário achou "flat, parece banco". Troquei para um gradiente mais vívido `#2563EB → #1D4ED8` em todos os CTAs sólidos (home, planos, login, resultado, setup) e intensifiquei todo glow que ainda estava em `rgba(30,64,175,...)` para `rgba(37,99,235,...)`, mantendo a mesma família de azul (não voltou pra roxo).

**Commits**: `4ff6997` (autopilot fix + cron) e `6106b79` (ajuste de azul vívido), ambos já em `origin/main`.

**Pendente**: usuário ainda vai testar a home no navegador e o toggle do Autopilot na UI — nenhum dos dois foi visualmente verificado por mim (sem acesso a browser nesta sessão).

## 🟠 Confirmado contra o painel real da Z-API em 2026-06-18 — código de setup está dessincronizado da config em produção (risco de regressão)

O usuário verificou diretamente o painel da Z-API (app.z-api.io → instância "nexus" → Webhooks e configurações gerais). Isso resolve a hipótese anterior e revela um problema mais preciso:

**O que está configurado em produção (confirmado por screenshot):**
- **Ao receber** (mensagens entrantes — o que importa) → `https://nexusaas.com.br/api/nexus/whatsapp/webhook` ✅ a rota **nova**, com CRM/análise
- **Receber status da mensagem** → `https://nexusaas.com.br/api/nexus/whatsapp/webhook` ✅ idem
- **Ao enviar** → `https://nexusaas.com.br/api/whatsapp/webhook` (rota antiga — usada só para eco/confirmação de envio, não para recebimento)

**Conclusão:** a produção está correta. O pipeline de CRM da V5 (`pipeline_stage`, tags, análise) está sim recebendo mensagens reais via `/api/nexus/whatsapp/webhook`. A hipótese de bug ativo está **descartada**.

**O problema real, residual:** `POST /api/nexus/whatsapp/setup` ([app/api/nexus/whatsapp/setup/route.ts:19](../app/api/nexus/whatsapp/setup/route.ts)) continua com `webhookUrl = ${siteUrl}/api/whatsapp/webhook` (a URL **antiga**) hardcoded, e usa essa URL para configurar **tanto** `update-webhook` (recebimento) quanto `update-webhook-delivery` (status) via API da Z-API. Ou seja, o código deste endpoint está **desatualizado em relação à configuração real e correta que está no painel hoje** — alguém deve ter corrigido manualmente no painel da Z-API depois que esse endpoint foi escrito, mas o código nunca foi atualizado para refletir isso.

**Risco:** o comentário do arquivo diz "Called once after successful QR scan so NEXUS AI receives all incoming messages" — ou seja, esse endpoint roda automaticamente sempre que alguém reconectar a instância via QR code (reset de sessão, troca de número, etc.). Se isso acontecer de novo, ele **sobrescreve silenciosamente a configuração correta do painel e aponta "Ao receber" de volta para a rota antiga** — quebrando o pipeline de CRM da V5 sem nenhum erro visível, até alguém notar que `pipeline_stage`/tags pararam de atualizar.

**✅ Corrigido em 2026-06-18** (confirmado pelo usuário): `webhookUrl` em [app/api/nexus/whatsapp/setup/route.ts](../app/api/nexus/whatsapp/setup/route.ts) trocado de `/api/whatsapp/webhook` para `/api/nexus/whatsapp/webhook`. Também corrigido o mesmo valor hardcoded (só informativo, exibido na UI de status) em [app/api/whatsapp/status/route.ts](../app/api/whatsapp/status/route.ts). Nenhuma das duas mudanças tem efeito imediato em produção — só passam a valer na próxima vez que `/api/nexus/whatsapp/setup` for chamado (reconexão por QR code).

## ✅ Resolvido em 2026-06-18 — 4 tabelas que faltavam foram criadas

O usuário rodou as 3 migrations no SQL Editor do Supabase. Reverifiquei via a mesma introspecção PostgREST: `flow_templates`, `flow_template_ratings`, `flow_insights` e `retention_events` agora existem (banco foi de 82 → 86 tabelas, exatamente as 4 que faltavam). Os 4 templates seed (`Recuperar Inadimplentes`, `Aumentar Receita Média`, `Reativar Clientes Inativos`, `Campanha Completa de Crescimento`) confirmados inseridos em `flow_templates`. Marketplace de flows e detecção de retenção devem estar funcionais agora — vale um teste manual na UI (`/dashboard/marketplace`) para confirmar ponta a ponta.

## Histórico do problema (contexto, já resolvido)

Verificação direta contra o banco de produção (introspecção PostgREST), não suposição:

| Tabela ausente | Quem usa | Migration pronta (não aplicada) |
|---|---|---|
| `flow_templates` | `app/api/flow-templates/route.ts`, `/seed`, `/[id]`, `/[id]/import`, `/[id]/rate` | `supabase-migration-flow-templates.sql` |
| `flow_template_ratings` | `app/api/flow-templates/[id]/rate/route.ts` | mesmo arquivo acima |
| `flow_insights` | `lib/flow-engine/analyze-execution.ts` | `supabase-migration-flow-insights.sql` |
| `retention_events` | `app/api/retention/detect/route.ts`, `app/api/retention/events/route.ts` | `supabase/migrations/20240002_retention.sql` |

**Efeito real:** o Marketplace de templates de flow (`/dashboard/marketplace`) e a detecção de retenção/churn (`/api/retention/**`) devem estar retornando erro de "relation does not exist" sempre que alguém os usa — não é hipótese, é o que esse schema ausente causa em qualquer query Postgres real.

**As 3 migrations já existem no repo, são idempotentes (`IF NOT EXISTS`, sem `DROP`/`TRUNCATE` — verificado) e nunca foram aplicadas.** Não há credencial disponível localmente para aplicar DDL programaticamente (a `service_role` key só acessa a API REST de dados via PostgREST, não executa DDL; não há `SUPABASE_ACCESS_TOKEN`/PAT configurado para a Management API). **Ação pendente do usuário:** colar o conteúdo de `supabase-migration-flow-templates.sql`, `supabase-migration-flow-insights.sql` e `supabase/migrations/20240002_retention.sql` no SQL Editor do Supabase (nessa ordem, não depende uma da outra) para destravar essas 3 features.

## Decisões resolvidas em 2026-06-18 (investigação read-only, sem mudança de código)

| Pendência original | Resolução |
|---|---|
| Qual script SQL é a fonte de verdade do schema? | **Verificado contra o banco real em 2026-06-18** via introspecção OpenAPI do PostgREST (`GET {SUPABASE_URL}/rest/v1/` com a `service_role` key local) — não é mais suposição. O banco real tem **82 tabelas/views**. Nenhum arquivo `.sql` isolado reproduz esse estado: `supabase-MASTER-migration.sql` cobre o core mas não inclui tabelas como `profiles`, `my_company`, `quiz_responses`, `user_payment_config`, `company_integrations`, `autopilot_logs`, que só existem via migrations incrementais. **Achado mais importante:** 4 tabelas usadas por código ativo (`flow_templates`, `flow_template_ratings`, `flow_insights`, `retention_events`) **não existem no banco real** — ver seção própria abaixo. Lista completa de tabelas em [integracoes.md](./integracoes.md). |
| Webhooks do Stripe estão implementados? | **Sim, e são dois, de propósitos diferentes — não é duplicação acidental:** `app/api/webhooks/stripe/route.ts` (plural) trata o ciclo de vida da assinatura da própria plataforma NEXUS (`customer.subscription.*`, atualiza `subscriptions`/`users.plan`). `app/api/webhook/stripe/route.ts` (singular) trata pagamento de faturas de clientes do tenant via Stripe (`checkout.session.completed` com `invoice_id`/`company_id`, atualiza `invoices`/`payments`/`revenue_events`/`collection_logs`). Ambos verificam assinatura com `STRIPE_WEBHOOK_SECRET` — não são stubs. Não confirmado: qual URL está de fato cadastrada no painel do Stripe para cada caso (não auditável sem acesso ao dashboard Stripe). |

## Decisões pendentes (precisam de confirmação do usuário antes de agir)

| Pendência | Por que importa | Onde está documentado o problema |
|---|---|---|
| Confirmar no painel do Stripe que as duas URLs de webhook (singular/plural) estão cadastradas corretamente para seus respectivos eventos | Se uma delas não estiver cadastrada, faturas de tenant ou assinaturas da plataforma silenciosamente não atualizam de status | [bugs.md](./bugs.md) |
| Gating por plano: apenas **3 de 189** rotas de API (`automations`, `nexus/whatsapp/send`, `projects`) chamam explicitamente `denyIfCannot`/`denyIfAtLimit`/`requirePlan`/`requireActiveSubscription` (confirmado por grep, 2026-06-18) | Recursos pagos como Creative AI, geração de insights de IA, token de voz, execução de flows não têm limite de plano aplicado no código — uso ilimitado mesmo em plano Free, se essa for realmente a intenção de produto | [bugs.md](./bugs.md), mapa detalhado abaixo |

### Mapa de gating por plano — quem tem, quem não tem (2026-06-18)

Sem gate hoje, agrupado por área (todas listadas abaixo **não chamam** `denyIfCannot`/`denyIfAtLimit`/`requirePlan`/`requireActiveSubscription`):

| Área | Rotas sem gate | Risco de negócio se ficar assim |
|---|---|---|
| **Creative AI** | `creative/generate`, `creative/generate-multi`, `creative/image`, `creative/pdf`, `creative/opportunities`, `creative/stats` | Geração de imagem/PDF/conteúdo via IA tem custo direto de API (tokens + possivelmente geração de imagem) — sem limite, um usuário Free pode gerar volume ilimitado |
| **AI (Claude/OpenAI)** | `ai/chat`, `ai/conversations`, `ai/business-analysis`, `ai/financial-insights`, `ai/generate-flow`, `ai/project-analysis`, `ai/router`, `ai/upload` | Mesma lógica — cada chamada consome tokens de IA pagos pela NEXUS; o manifesto antigo já previa limite de "insights" por plano (`lib/plan-gates.ts` define limites), mas o limite não está sendo **aplicado** nestas rotas |
| **NEXUS OS (voz + agentes)** | `nexus/voice/token`, `nexus/voice/execute`, `nexus/engine`, `nexus/os`, `nexus/insights`, `nexus/memory`, `nexus/tasks`, `nexus/pipeline`, `nexus/seller`, `nexus/persona`, `nexus/overview`, `nexus/diagnostic`, `nexus/metrics` | Voz via OpenAI Realtime tem custo por minuto de sessão — é provavelmente o recurso mais caro do produto sem nenhum controle de plano hoje |
| **WhatsApp CRM (nexus/whatsapp/**)** | Apenas `send` tem gate; `send-image`, `qr`, `setup`, `disconnect`, `transfer`, `suggest`, `analyze`, `new-conversation`, `lead`, `search` não têm | Funcionalidade central do plano Pro+ (segundo o manifesto Enterprise) acessível sem checar plano em quase toda a superfície, exceto o envio de texto simples |
| **Flow Engine** | `flows/[id]/run`, `flows/executions`, `flows/test`, `growth-maps/**` (CRUD + execução) | O manifesto Enterprise lista "unlimitedFlows" como feature por plano — não há enforcement real de quantidade/execuções no backend |

### ✅ Implementado em 2026-06-18

Decisões confirmadas com o usuário antes de codificar:
- **Free tem IA com limite**, não bloqueio total — `lib/nexus-plan.ts` atualizado: `free.features` agora inclui `'nexus_ai'`. O enforcement real é por contagem (`max_ai_messages`), não por feature flag (já que todo plano tem `nexus_ai` agora, esse `denyIfCannot` nunca bloqueia sozinho — quem bloqueia é o limite).
- **Voz (NEXUS OS) = feature `nexus_coo`** (Business+) — já existia no catálogo, só faltava aplicar.
- **Creative AI = feature `nexus_ai`** (Starter+, e Free dentro do limite).

O que foi construído:
- `lib/usage.ts` (novo) — `getAiUsage(companyId)` / `incrementAiUsage(companyId, amount?)`, reaproveitando a RPC `increment_usage()` que já existia no banco (`20240003_hardening.sql`) e nunca tinha sido chamada por nenhum código.
- Migration `supabase/migrations/20260618_ai_usage.sql` — adiciona a coluna `company_usage.ai_messages_count` (aplicada pelo usuário no SQL Editor).
- Gate aplicado (feature + limite + incremento pós-sucesso) em **6 rotas de `/api/ai/**`**: `chat`, `business-analysis`, `financial-insights`, `generate-flow`, `project-analysis`, `upload` (só nos ramos de imagem/áudio, que custam — parsing de documento é local).
- Gate aplicado em **5 rotas de `/api/creative/**`**: `generate`, `generate-multi` (incrementa 3 por chamada — gera 3 variações), `image`, `pdf`, `opportunities`.
- Gate `nexus_coo` aplicado em **2 rotas de voz**: `nexus/voice/token` (só no ramo de cookie/browser — o ramo Bearer é para clientes de API/testes e não é gateado, já que `getAuthContext()` não lê Bearer) e `nexus/voice/execute`.
- **Deliberadamente não gateado:** `/api/ai/router` — só chama Claude como fallback quase-gratuito (120 tokens) de um helper de navegação interna; bloquear navegação por causa de uma cota de chat não relacionada seria uma troca ruim para um custo irrisório.
- `npx tsc --noEmit` limpo após todas as edições (14 arquivos).

**Limitação conhecida, não resolvida nesta rodada:** `company_usage.company_id` é `UNIQUE` (uma linha por empresa, não por período) — apesar de existir uma coluna `period_start`, não há lógica de reset mensal implementada em nenhum lugar (nem nas colunas pré-existentes como `automations_count`). Ou seja, `ai_messages_count` acumula para sempre, não reseta todo mês. Isso é uma limitação pré-existente do sistema de usage (não introduzida agora) — resolver exigiria um cron mensal de reset ou mudar a chave para `(company_id, period_start)`. Ficou de fora do escopo desta rodada por ser uma mudança maior de schema/cron, não um simples gate.

### ✅ Resolvido em 2026-06-18 — isolamento multi-tenant (IDOR)

4 rotas corrigidas para derivar `company_id` exclusivamente da sessão autenticada (`getAuthContext()`), nunca do corpo da requisição:

| Rota | Causa raiz específica |
|---|---|
| `/api/ai/financial-insights` | Não chamava `getAuthContext()` — exigia `company_id` direto no body, sem checagem alguma |
| `/api/creative/generate` | Importava `resolveCompanyId` de `lib/get-company-id.ts` — um helper marcado `'use client'` que faz `if (typeof window === 'undefined') return null`. Chamado a partir de uma API route (sempre server-side), **sempre retornava `null`**. Na prática, essa rota dependia 100% do `company_id` do body — e como o frontend real (`app/dashboard/creative-ai/page.tsx`) nunca envia esse campo, a rota provavelmente **já estava completamente quebrada em produção antes de qualquer mudança de hoje** (sempre caía no `400 company_id required`). A correção (usar `getAuthContext()`) não é só uma correção de segurança — destrava a feature. |
| `/api/creative/image` | Mesmo import quebrado. Diferença: o código original **não exigia** `company_id` (tinha fallback `'Minha Empresa'`), então a imagem era gerada mesmo sem isso — só não era persistida em `ai_generated_assets` nem associada a nenhuma empresa. Ao adicionar o gate de plano nesta mesma sessão, eu introduzi um `if (!companyId) return 400` que teria quebrado essa rota (regressão). Corrigido junto. |
| `/api/creative/generate-multi` | Tinha um `resolveCompanyId()` local correto (chama `getAuthContext()`), mas a ordem de prioridade no body estava invertida: `body.company_id ?? resolveCompanyId()` — ou seja, um `company_id` vindo do cliente vencia a sessão. Na prática inofensivo hoje (o frontend real nunca envia esse campo), mas era uma porta aberta. Corrigido para usar exclusivamente a sessão. |

**Não precisaram de correção** (verificados, já resolvem a sessão *antes* de qualquer fallback de body): `/api/ai/chat`, `/api/ai/business-analysis`, `/api/creative/opportunities` (GET, sem body), `/api/ai/generate-flow`, `/api/ai/project-analysis`.

**Achado secundário, não corrigido:** `chat` e `business-analysis` ainda caem, em último caso (se `getAuthContext()` falhar E não houver `company_id` no body), em `db.from('companies').select('id').limit(1).single()` — ou seja, pegam literalmente a primeira empresa da tabela. É um "fail-open" em vez de "fail-closed" num cenário raro (falha transitória de auth com sessão de edge já validada). Risco baixo, mas registrado — ver [bugs.md](./bugs.md).

`npx tsc --noEmit` limpo após todas as correções.

| Pendência | Por que importa | Onde está documentado o problema |
|---|---|---|
| Aplicar o fix de uma linha em `setup/route.ts` (URL antiga → nova) para eliminar o risco de regressão no próximo reconnect via QR code | Sem isso, qualquer reconexão futura da instância Z-API quebra o pipeline de CRM silenciosamente | Seção acima |
| `lib/whatsapp.ts` (Meta Cloud API) ainda está em uso em algum fluxo, ou é código morto? | Usado apenas pelo handler legado `/api/webhook/whatsapp`, que não aparece referenciado por nenhum fluxo de setup — candidato a código morto | [bugs.md](./bugs.md) |
| A instância n8n com os 5 workflows está ativa e mantida? | Define se sequências de nutrição de leads por email realmente disparam | [integracoes.md](./integracoes.md) |
| O canvas visual do Flow Engine (drag-and-drop) foi implementado desde o manifesto antigo? | Define se é prioridade de roadmap ou item já resolvido | [roadmap.md](./roadmap.md) |

### ✅ Resolvido em 2026-06-18 — WhatsApp V5 CRM não era multi-tenant (achado grave durante o item 7)

Ao investigar o item 7 (unificar WhatsApp com Leads), descobri que o problema era mais profundo: **13 arquivos** do CRM (webhook, analyze, conversations, search, transfer, new-conversation, send-image, suggest, debug, messages, voice/execute, `lib/whatsapp-engine.ts`) resolviam `company_id` via `process.env.NEXUS_PLATFORM_COMPANY_ID` em vez da empresa do usuário logado. Em 8 desses arquivos o padrão era "env var primeiro, sessão só se a env var estiver vazia" — como a env var está sempre configurada em produção, o fallback de sessão nunca rodava na prática: **todo usuário logado, de qualquer empresa, via e contribuía para os dados da mesma empresa fixa.**

**Decisão do usuário (2026-06-18), explícita:** "Hoje é uso interno da NEXUS. Mas a arquitetura final deve ser multi-tenant... Implemente desde agora isolamento completo por company_id... Preparar o sistema para clientes pagantes e múltiplas empresas." Não era um bug em produção hoje (só a própria NEXUS usa o módulo), mas bloquearia completamente a venda do CRM a qualquer cliente.

**O que foi corrigido:**

| Arquivo | Mudança |
|---|---|
| `lib/business-identity.ts` | Nova função `getCompanyIdByZapiInstance()` — lookup reverso (Z-API `instanceId` → `company_id`) via `business_identity.zapi_instance_id`. É o único sinal multi-tenant que um webhook de entrada tem, já que não carrega sessão. |
| `app/api/nexus/whatsapp/webhook/route.ts` | `company_id` resolvido via `payload.instanceId` → `getCompanyIdByZapiInstance()`, com fallback para `NEXUS_PLATFORM_COMPANY_ID` apenas se a instância não tiver `business_identity` cadastrada. `autoReply()` agora envia pela instância Z-API **da própria empresa** (via `getBusinessIdentity()` + `resolveZApiConfig()`), não mais pela instância global da plataforma. |
| `app/api/nexus/whatsapp/analyze/route.ts` | Removida a dependência da env var inteiramente — `company_id` vem direto da conversa (`whatsapp_conversations.company_id`), que já foi resolvida corretamente no momento do recebimento da mensagem. |
| `app/api/whatsapp/conversations`, `nexus/whatsapp/{search,transfer,new-conversation,send-image,suggest,debug}`, `whatsapp/messages` (8 rotas) | Resolução de `company_id` trocada de "env var primeiro" para `getAuthContext()` exclusivamente — nunca mais consulta a env var para rotas com sessão. `new-conversation` e `send-image` também passaram a enviar pela instância Z-API da própria empresa, não a global. |
| `app/api/nexus/voice/execute/route.ts` | Já estava correto (resolvia via `company_members` primeiro) — não precisou de mudança. |

**Dependência para funcionar de ponta a ponta:** uma empresa só é roteada corretamente pelo webhook depois de cadastrar sua própria instância Z-API em `/dashboard/settings/business-identity` (campo já existe na UI). Até lá, a mensagem cai no fallback da plataforma — comportamento atual preservado, não é regressão.

**Não corrigido, fora de escopo:** `app/api/whatsapp/webhook/route.ts` (rota antiga, separada — bot de vendas da própria NEXUS, não o CRM v5) continua hardcoded. Não é a rota ativa de produção (confirmado: o painel da Z-API aponta para `/api/nexus/whatsapp/webhook`), e parece ser uma ferramenta de vendas interna da NEXUS, não uma feature de cliente — não foi tocada para não arriscar o funil de vendas da própria empresa sem confirmação explícita.

`npx tsc --noEmit` limpo após todas as correções (14 arquivos no total, incluindo o novo helper).

### ✅ Resolvido em 2026-06-19 — sincronização WhatsApp → tabela `leads` (pedido original do item 7)

Com o `company_id` já correto em toda a pipeline (achado acima), implementei o pedido original: `lib/leads-sync.ts` (novo, `syncWhatsAppLeadToLeads()`), chamado por `app/api/nexus/whatsapp/analyze/route.ts` depois de cada upsert em `lead_context`. Upsert por `(company_id, phone)` — nunca regride o estágio nem abaixa o score de um lead existente.

**Achado durante a implementação:** a tabela `leads` tem dois campos de status paralelos e pré-existentes — `status` (inglês: new/contacted/converted/lost/qualified/proposal/won/nurture, usado por `/api/leads/manage` e o que `/dashboard/leads` filtra) e `stage` (português: novo/contatado/qualificado/proposta/negociando/fechado/perdido, adicionado depois em `20260516_nexus_core.sql`). O `syncToLeads()` de referência (em `app/api/whatsapp/webhook/route.ts`) só setava `stage`, nunca `status` — ou seja, mesmo se tivesse sido conectado, leads criados por ele não apareceriam corretamente nos filtros de status do `/dashboard/leads`. O novo helper mantém os dois em sincronia via um mapa stage→status.

Também corrigi um bug pequeno do código de referência: ele tinha `name: merged.nome ?? existing.id` (caía para o UUID do lead como nome de exibição se a IA não extraísse um nome) — agora cai para o nome já salvo, ou um placeholder `WhatsApp xxxx` baseado no telefone.

**Limitação conhecida, não resolvida:** o prompt de extração do `analyze/route.ts` não pede um campo `score` à IA (só `nome/empresa/nicho/objetivo/dores/estagio/faturamento`) — então hoje todo lead sincronizado por esse caminho entra com `score: 0`. Calcular um score real a partir do conteúdo da conversa é trabalho novo, não uma correção deste fix.

`npx tsc --noEmit` limpo.

### ✅ Resolvido em 2026-06-19 — health-check automatizado da voz (NEXUS OS)

`/dashboard/system/realtime` já existia (a pergunta do roadmap "já existe?" — sim), mas dois problemas: (1) era só manual, alguém precisava abrir a página; (2) **estava quebrado** — chamava `POST /api/nexus/voice/session` e `GET /api/nexus/voice/debug`, nenhuma das duas rotas existe no código hoje (só `voice/token` e `voice/execute` existem). Provavelmente ficou esquecido depois de uma das ~25 correções de 2026-05-27/28.

**Decisões do usuário (2026-06-19), explícitas:**
- Canal de alerta: email simples (não há Slack webhook configurado).
- Profundidade do teste: testar a conexão WebSocket real com a OpenAI, não só a emissão do token efêmero — a maioria dos problemas históricos foi em formato de sessão/eventos do WebSocket, não na emissão do token.

**O que foi feito:**

| Arquivo | Mudança |
|---|---|
| `app/dashboard/system/realtime/page.tsx` | Corrigido para chamar `POST /api/nexus/voice/token` (rota real) e fazer o parse correto da resposta (`{ token, model, expires_at }` — a página antiga esperava `ephemeral_key`). Adicionado um segundo teste: abre e fecha uma conexão WebSocket real (`wss://api.openai.com/v1/realtime`) com o mesmo esquema de autenticação por subprotocolo que `lib/nexus/voice-engine.ts` usa em produção (`['realtime', 'openai-insecure-api-key.<token>']`), e considera sucesso no primeiro evento recebido do servidor (normalmente `session.created`). |
| `app/api/cron/voice-health/route.ts` (novo) | Mesmo teste de dois passos (mintar token + handshake WS real), rodando sozinho. Em caso de falha, envia email via `sendEmail()` (`lib/email.ts`) para `VOICE_HEALTH_ALERT_EMAIL` (default: o email do usuário). Protegido por `CRON_SECRET`, mesmo padrão dos outros crons. |
| `vercel.json` | Novo cron `/api/cron/voice-health`, diário às 13:00 UTC (10:00 BRT). |

**Limitação aceita:** todos os crons do projeto na Vercel são diários (não há nenhum de intervalo menor configurado) — não confirmei se é por limite do plano (Hobby só permite cron diário) ou só preferência. Um health-check diário pega "está completamente fora do ar", mas não pega uma degradação de poucas horas. Se quiser granularidade maior, precisa confirmar o plano da Vercel primeiro.

`npx tsc --noEmit` limpo.

### ✅ Resolvido em 2026-06-19 — n8n decomissionado; sequência de nutrição do waitlist migrada para cron nativo

Eu não tenho credenciais para o painel do n8n (infraestrutura externa, não há API/PAT do n8n no código) — não dava para confirmar sozinho se a instância estava ativa. Achei evidência indireta forte: os 5 arquivos em `n8n-workflows/` (último commit 2026-05-15, mesma data do "AI engine nativo" do WhatsApp) mostram os 4 workflows de email do waitlist com `"active": false` no JSON exportado, e o workflow de WhatsApp (`NEXUS-whatsapp-lead-responder.json`) recebia o webhook da Z-API diretamente e respondia via Claude+Z-API **sem passar pelo NEXUS** — uma pipeline paralela e independente da que corrigimos no item 7.

**Confirmado pelo usuário (2026-06-19):** n8n não está mais em uso, foi substituído pelo engine nativo.

**Achado consequente, não previsto na pergunta original:** sem o n8n, `/api/waitlist/send-sequence` (que dispara os emails de nutrição do waitlist — bastidores no dia 2, case study no dia 5, urgência no dia 9) **não tinha mais nenhum gatilho automático**. Os 3 workflows agendados do n8n eram o único disparador — sem eles, ninguém recebia esses emails, silenciosamente, desde o abandono do n8n (~2026-05-15 ou depois).

**O que foi feito:**

| Arquivo | Mudança |
|---|---|
| `lib/waitlist-sequence.ts` (novo) | Extrai a lógica de envio (antes só dentro do route handler) para `runWaitlistSequenceStep()`, reaproveitável tanto pela rota HTTP quanto pelo cron. |
| `app/api/waitlist/send-sequence/route.ts` | Simplificado para só validar e delegar ao helper. Mantido — ainda serve para disparo manual/ad-hoc (em particular o step 5, e-mail de acesso, que sempre foi manual mesmo no n8n). |
| `app/api/cron/waitlist-sequence/route.ts` (novo) | Roda diariamente os 3 steps agendados (`step 2 / days_ago 2`, `step 3 / days_ago 5`, `step 4 / days_ago 9`), substituindo nativamente os workflows agendados do n8n. O 4º workflow (acesso manual) não foi automatizado — continua exigindo disparo manual, como era no design original. |
| `vercel.json` | Novo cron `/api/cron/waitlist-sequence`, diário às 14:00 UTC. |

**Não corrigido, fora de escopo:** o workflow de WhatsApp do n8n (`NEXUS-whatsapp-lead-responder.json`) não foi tocado — está confirmado abandonado/substituído, mas como não está mais registrado como webhook ativo na Z-API (confirmado no item 5/7, a Z-API aponta para `/api/nexus/whatsapp/webhook`), não há ação necessária além de eventualmente arquivar a pasta `n8n-workflows/` como histórico morto (não fiz isso agora — é só renomeação/organização, baixo risco, mas não pedido explicitamente).

`npx tsc --noEmit` limpo.

### ✅ Resolvido em 2026-06-19 — leads do quiz (Lovable) não chegavam ao NEXUS; decisão de espelhar, não migrar

Contexto: ao tentar ativar o sistema de indicação do waitlist, descobri que o funil real de captura (`diagnostico.nexusaas.com.br`, construído no Lovable) não tem nenhuma relação com a tabela `waitlist` deste banco — os 2 únicos registros lá eram testes do próprio usuário. O Lovable Cloud provisionou, sem o usuário perceber, um projeto Supabase **separado e próprio** (`mrhsieznrxaclvohusjs`) para o app do quiz, gerenciado inteiramente pela infraestrutura do Lovable (não aparece na conta pessoal do usuário no Supabase).

Auditoria feita via Lovable (não consigo acessar esse projeto diretamente — sem credenciais, sem dashboard próprio): a única tabela do fluxo do quiz é `public.quiz_leads` (24 colunas — `name`, `company_name`, `email`, `whatsapp`, `operational_score`, `ai_diagnosis`, etc. — schema completo no migration abaixo), com um trigger que deriva `lead_temperature` de `operational_score`. RLS permite INSERT anônimo (o form escreve direto do browser).

**Tentativa descartada:** pedir ao Lovable para trocar a conexão do backend para o projeto do NEXUS. A resposta do Lovable revelou que isso quebraria login, área admin e todo o subsistema de email (precisaria recriar `user_roles`, enum `app_role`, função `has_role()`, tabelas de email transacional, filas `pgmq`) — risco desproporcional ao objetivo real, que era só ter os leads também no NEXUS.

**Decisão tomada:** manter os dois bancos como estão (Lovable Cloud continua sendo a fonte de verdade do quiz) e fazer o app do Lovable espelhar cada novo lead, via um segundo client Supabase (`@supabase/supabase-js`, só com a anon key do NEXUS) inserido depois do insert original, em try/catch isolado — se o espelhamento falhar, não pode afetar o fluxo principal do quiz. Implementação fica do lado do Lovable (fora deste repositório); a tabela espelho já foi criada aqui.

**O que foi feito neste repositório:** `supabase/migrations/20260619_quiz_leads.sql` recria a tabela `quiz_leads` (schema, trigger `quiz_leads_set_temperature`, RLS — `service_role` full access + INSERT anônimo) — aplicada manualmente pelo usuário via SQL Editor, confirmada (0 linhas, tabela existe). Esperando confirmação de que o espelhamento do lado do Lovable foi implementado e testado.

**Confirmado funcionando em 2026-06-19** — envio de teste real no quiz chegou nas duas tabelas. Na cópia do NEXUS: todos os 16 campos espelhados corretamente, `pipeline_stage` no default `'novo'`, e `lead_temperature` calculado certo pelo trigger (`operational_score: 44` → `'morno'`, dentro da faixa 40-69). Pipeline de captura → espelhamento → CRM do NEXUS está de ponta a ponta funcional.

**Pendente (resolvido abaixo):** decidir o que fazer com os dados já capturados no projeto antigo antes deste fix.

### ✅ Resolvido em 2026-06-21 — sistema de indicação implementado, 3 bugs reais corrigidos, backfill concluído

Sistema de indicação (referral) implementado em ambos os bancos: `supabase/migrations/20260619_quiz_leads_referral.sql` adiciona `referral_code`/`referred_by`/`referrals_count`/`position`, gera código via trigger `BEFORE INSERT`, e recalcula posições via trigger `AFTER INSERT` (cada indicação adianta 5 posições — menor que o `waitlist` original, de propósito: fila B2B de acesso antecipado, não waitlist viral). Espelhado no lado do Lovable (`NexusQuiz.tsx`), com captura de `?ref=` na URL.

**Três bugs reais encontrados e corrigidos durante o teste de ponta a ponta:**

1. **401 no insert principal (Lovable):** RLS do `quiz_leads` original só permite `INSERT` para `anon`, não `SELECT`. Qualquer `.insert().select()` (inclusive a validação de `referred_by` antes do insert) dispara um `SELECT` implícito do PostgREST (`Prefer: return=representation`), que falha sob RLS. Corrigido trocando os `SELECT`s diretos por duas funções `SECURITY DEFINER` expostas via RPC (`submit_quiz_lead`, `validate_quiz_referral_code`) — evita abrir `SELECT` geral para `anon` (que exporia PII de todos os leads).

2. **Trigger de posição não disparava para inserts via `anon` (NEXUS):** `handle_quiz_lead_referral()` e `recalculate_quiz_leads_positions()` não tinham `SECURITY DEFINER`. Os `UPDATE`/`SELECT` internos do trigger rodavam com os privilégios de quem fez o insert original — e a policy de RLS do `anon` só libera `INSERT`, não `UPDATE`/`SELECT`. O trigger "rodava" sem erro, mas afetava zero linhas silenciosamente. Só funcionava em teste manual porque `service_role` ignora RLS. Corrigido em `supabase/migrations/20260621_quiz_leads_referral_security_definer.sql` (`ALTER FUNCTION ... SECURITY DEFINER` + `SET search_path = public`). Verificado com insert real via chave `anon` pós-fix: posição calculada automaticamente.

3. **`referred_by` chegava `null` no mirror mesmo com link de indicação real:** o insert do mirror revalidava o `referral_code` contra o próprio banco do NEXUS antes de gravar `referred_by` — e como os dois bancos geram códigos independentemente via trigger próprio, o código do banco principal frequentemente não existia (ainda) no espelho, fazendo a indicação cair em `null`. Resolvido em duas partes: (a) o insert do mirror já passa `referral_code: finalRefCode` (o código do banco principal) em vez de deixar o NEXUS gerar um código próprio, então os dois bancos ficam sincronizados a partir de cada novo lead; (b) pedido ao Lovable para simplificar o insert do mirror, confiando direto no `refCode` já validado contra o banco principal, sem revalidar contra o espelho.

**Achado lateral, também corrigido:** a tela de resultado (`src/routes/waitlist.tsx`) tinha múltiplos números fictícios — fallback de posição hardcoded (`127`) quando o `sessionStorage` estava vazio, contador de "vagas restantes" decrescente automático, feed de "atividade ao vivo" simulado, e countdown de lançamento que nunca chegava a zero (recalculado a cada `mount`). Removidos a pedido do usuário — risco de propaganda enganosa (CDC art. 37) que cresce junto com o volume de tráfego pago. A seção de posição agora só aparece com dado real do `submit_quiz_lead`; sem dado, fica oculta.

**Backfill concluído:** auditoria revelou que o histórico real do banco principal tinha **19 linhas no total** (não ~114/115 como uma posição exibida incorretamente sugeria — esse número vinha do fallback hardcoded acima, não da contagem real da tabela). Das 19, 18 são testes do próprio usuário (mesmo nome/telefone, e-mails variados) e 1 é de outra pessoa (`oliver oliveira`). As 14 linhas que ainda não estavam espelhadas foram inseridas no NEXUS preservando `id`, `created_at` e `referral_code` originais (corrigindo também mojibake de UTF-8 que vinha no export). Estado final: 19/19 linhas em ambos os bancos, todos os `referral_code` sincronizados (incluindo o primeiro teste, que tinha código divergente entre os dois bancos antes do fix de sincronização existir).

**Pendente, não bloqueante para o lançamento:** finding de segurança crítico do próprio scanner do Lovable — `quiz_leads` publicada no Realtime sem RLS em `realtime.messages`, permitindo qualquer usuário autenticado se inscrever no canal e receber PII (nome, e-mail, whatsapp, diagnóstico). Usuário optou por remover a tabela do Realtime (não há nenhuma tela usando subscription nela) em vez de só justificar o finding — aplicado pelo Lovable antes de publicar o fix do RPC.

## Como registrar uma nova decisão

Adicionar uma linha na tabela "Decisões já tomadas" com: a decisão, a evidência no código (arquivo/padrão), e o racional (mesmo que inferido). Se a decisão foi tomada em conversa com o usuário e não está visível no código ainda, registrar aqui mesmo assim — esse é exatamente o tipo de informação que se perde quando não há memória persistente.
