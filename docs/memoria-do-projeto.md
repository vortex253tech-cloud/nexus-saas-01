# NEXUS — Memória do Projeto (linha do tempo)

> Reconstruído a partir de `git log` em 2026-06-18 (209 commits, início em 2026-04-16). Este documento existe para que o "porquê" e a ordem dos eventos não dependam de uma conversa de chat. Atualizar a cada marco relevante.

**Nota de correção:** `NEXUS_SYSTEM_MANIFEST.md` (raiz) está datado "2025-04-27" — pela história real do repositório (primeiro commit em 2026-04-16), isso é quase certamente um erro de digitação do autor original; a data pretendida é **2026-04-27**.

## Fase 0 — Bootstrap (2026-04-16)
Projeto criado com `create-next-app`. Commit seguinte (`1868ce9`, 2026-04-17) já entrega "sistema completo com execução real" — ou seja, o NEXUS nasceu com ambição de produto funcional desde o segundo commit, não como protótipo incremental.

## Fase 1 — Núcleo financeiro e cobrança via WhatsApp (2026-04-20 a 2026-04-25)
- Módulo financeiro (customers, invoices, payments)
- Cron diário de cobrança (detecção de inadimplência → IA gera mensagem → WhatsApp + email)
- Insights de IA, chat assistente, dashboard financeiro, botão de autopilot
- Webhook do WhatsApp com auto-reply via Anthropic Haiku
- Supabase Auth com sessões persistentes (login/signup)
- Risk score de clientes, automações de email completas

Esta é a fase descrita em detalhe pelo `NEXUS_SYSTEM_MANIFEST.md`.

## Fase 2 — Flow Engine / Growth Map, Projetos (abril–maio 2026)
Construção do motor de automação visual (DAG de nodes), módulo de Projetos com Kanban, e o "Core AI Engine" com tool use. Esta é a base do que o manifesto chama de Flow Engine — permanece como descrito ali.

## Fase 3 — NEXUS multi-agente e voz, primeira iteração (2026-05-19 a 2026-05-23)
- `f25e60a` — Fase 2 do NEXUS Voice: "full COO AI executive assistant"
- `e544b25` — Core AI Engine com tool use + Command Center UI
- `59051c1` — Ecossistema multi-agente: orchestrator, status API, dashboard de agentes
- `e61c128` — "Living OS": Executive Copilot, Live Feed, Agent Dock, Executive Mode
- `8d57b52` — Overhaul do assistente de voz: API GA, waveform real, 25 tools

**Padrão observado:** o assistente de voz passou por múltiplas reescritas consecutivas (não é estável historicamente). Ver Fase 4.

## Fase 4 — Guerra da API Realtime do OpenAI (2026-05-27 a 2026-05-28)
Sequência intensa de ~25 commits em 2 dias, todos relacionados a fazer a OpenAI Realtime API funcionar corretamente. Sintomas enfrentados, em ordem:
1. Header `OpenAI-Beta` incorreto/obsoleto
2. Erro 404 (problema de tier de acesso à Realtime API)
3. Migração para WebSocket + áudio PCM16 (abandonando abordagem WebRTC/SDP anterior)
4. Endpoint mudou de `/connect` para `POST /v1/realtime/client_secrets`
5. Formato de `session.update` mudou (formato de áudio aninhado → depois restrito a apenas `type/instructions/tools/tool_choice`)
6. Nomes de modelo legados precisaram ser trocados por `gpt-realtime`
7. Resposta de `client_secrets` precisou ser envolvida manualmente em `client_secret.value` para extração do token
8. Suporte a Bearer token além de cookie (para validação via `createClient` do supabase-js)

Esse histórico é a razão pela qual `lib/nexus/voice-engine.ts` hoje lida defensivamente com nomes de evento (`response.audio.*` E `response.output_audio.*`) — **não é redundância acidental, é cicatriz de uma migração real da API**. Qualquer mudança futura no voice engine deve ler este histórico antes de "simplificar" esse código.

**Lição:** a API Realtime do OpenAI mudou formato de sessão e endpoints várias vezes em poucas semanas (lado deles, não do NEXUS). Tratar a integração de voz como uma camada **volátil** — testar manualmente após qualquer atualização do SDK `openai`.

## Fase 5 — NEXUS OS v4 / v4.1, Enterprise, WhatsApp V5, Homepage Ultra (2026-05-28 a 2026-05-29)
Reescrita completa do NEXUS OS do zero (`35a6226`), seguida por:
- `0a8c0ce` — Sessão sempre-ativa que sobrevive à navegação (arquitetura singleton fora do React)
- `0a52f13` — WhatsApp V5: CRM conversacional completo (pipeline, busca, fotos)
- `05c7b72` — Camada Enterprise: planos, permissões, admin, bloqueios
- `7bf880f` — Redesign completo da homepage ("nível OpenAI/Vercel")
- `75c7523` — Fix final de compatibilidade de eventos de áudio GA

Este é o estado mais recente do projeto (ver [arquitetura.md](./arquitetura.md) e [modulos.md](./modulos.md) para detalhes técnicos de cada um).

## Padrões recorrentes observados na história

1. **Iteração muito rápida em rajadas** — várias features completas (CRM, Enterprise, Homepage, Session Manager) foram entregues no mesmo dia (2026-05-29). Indica um único operador (ou IA assistente) trabalhando em sprints intensos, não um time grande com revisão lenta.
2. **Voice/Realtime é a área historicamente mais instável** — qualquer trabalho futuro ali deve assumir que pode haver mudanças não documentadas na API da OpenAI.
3. **Fixes de build da Vercel aparecem repetidamente** (`next.config.ts → next.config.mjs`, `serverExternalPackages`) — sinal de que configuração de build é sensível a mudanças de versão do Next.js; checar `node_modules/next/dist/docs/` (conforme `AGENTS.md`) antes de tocar em `next.config`.
4. **Múltiplos arquivos SQL de migração na raiz, não só em `supabase/migrations/`** — sugere que o fluxo de schema não foi 100% disciplinado desde o início; consolidar é uma tarefa de dívida técnica real (ver [decisoes.md](./decisoes.md)).
