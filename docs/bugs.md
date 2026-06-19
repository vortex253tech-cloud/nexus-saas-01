# NEXUS — Itens Parcialmente Implementados, Stubs e Riscos Conhecidos

> Não é um bug tracker formal (não há issue tracker externo identificado — ver [decisoes.md](./decisoes.md) sobre isso). Este documento lista o que foi observado como incompleto, stub, ou potencialmente fonte de bug durante a reconstrução de memória em 2026-06-18. Nenhum destes itens foi verificado em runtime — são inferências de leitura de código.

## Herdados do manifesto antigo (verificar se ainda se aplicam)

| Item | Descrição original | Verificar |
|---|---|---|
| Canvas visual do Flow Engine | Página existe, editor drag-and-drop de nodes/edges não estava implementado | Confirmar se segue pendente — `@xyflow/react` está instalado, pode já ter sido feito sem atualização do manifesto |
| BullMQ Worker persistente | Código existe mas exige processo Node.js persistente, incompatível com serverless puro da Vercel | Confirmar onde o worker roda hoje (Vercel não sustenta processo long-running) |
| Webhooks de entrada para TRIGGER `webhook` | Recebia mas não roteava para o flow certo | Status não confirmado nesta exploração |
| Multi-tenant avançado (roles) | "Hoje: 1 user = 1 company" | Planos Pro+ já preveem múltiplos usuários — roles/permissões internas não confirmadas |
| Relatórios exportáveis (PDF/Excel) | Parcial | `xlsx` e `pdf-parse`/`mammoth` estão instalados — pode já estar mais avançado |

## Identificados nesta rodada (2026-06-18) — investigados, ver [decisoes.md](./decisoes.md) para detalhe completo

| Item | Risco | Status |
|---|---|---|
| Setup de banco com múltiplos scripts SQL | ✅ Resolvido (verificado contra o banco real) | Nenhum arquivo `.sql` isolado reproduz o schema real (82 tabelas) — é uma combinação do MASTER + migrations incrementais. Não é mais ambiguidade, é um fato documentado em [integracoes.md](./integracoes.md). |
| 4 tabelas usadas por código ativo não existiam no banco (`flow_templates`, `flow_template_ratings`, `flow_insights`, `retention_events`) | ✅ Resolvido (2026-06-18) | Migrations aplicadas pelo usuário no SQL Editor do Supabase; reverificado por introspecção (82→86 tabelas) e seed de templates confirmado. Falta só um teste manual na UI do Marketplace para fechar o ciclo. |
| Webhooks do Stripe | ✅ Resolvido | **Confirmado implementado e completo** — dois webhooks distintos (billing da plataforma vs. faturas de tenant), ambos com verificação de assinatura real. Não eram stubs. Falta só confirmar cadastro correto no painel do Stripe. |
| Webhook do WhatsApp V5 CRM | ✅ Resolvido (era falso alarme) | **Verificado contra o painel real da Z-API** (screenshot do usuário, 2026-06-18): "Ao receber" está corretamente apontado para `/api/nexus/whatsapp/webhook` (rota nova, com análise de CRM). Produção está OK. |
| `setup/route.ts` dessincronizado da config real da Z-API | ✅ Corrigido (2026-06-18) | Era um risco de regressão futura: o código tinha hardcoded a URL antiga. Corrigido em `setup/route.ts` e `whatsapp/status/route.ts` — ver [decisoes.md](./decisoes.md). |
| `/api/webhook/whatsapp` (Meta Cloud API + `lib/whatsapp.ts`) | 🟢 Baixo | Não referenciado por nenhum fluxo de setup — candidato a código morto, não confirmado se ainda recebe tráfego do lado da Meta. |
| Gating por plano cobre só 3 de 189 rotas de API | ✅ Resolvido (2026-06-18) | Gate aplicado em 13 rotas adicionais (6 AI + 5 Creative AI + 2 voz) com contagem real de uso via `company_usage.ai_messages_count` (nova coluna) e a RPC `increment_usage()` já existente. Detalhe completo em [decisoes.md](./decisoes.md). |
| `company_usage` não tem reset mensal (acumula para sempre) | 🟡 Médio, novo achado | `company_id` é `UNIQUE` na tabela — uma linha por empresa, não por período, apesar de existir `period_start`. Limitação pré-existente do sistema de usage, exposta ao implementar o contador de IA. Resolver exige cron de reset mensal ou mudar a chave para `(company_id, period_start)`. |
| `financial-insights`, `creative/generate`, `creative/image`, `creative/generate-multi` confiavam em `company_id` do corpo da requisição | ✅ Resolvido (2026-06-18) | Todas as 4 corrigidas para derivar `company_id` exclusivamente de `getAuthContext()`. Achado extra: `creative/generate` e `creative/image` importavam `lib/get-company-id.ts`, um helper `'use client'` que sempre retorna `null` quando chamado server-side — ou seja, `creative/generate` provavelmente já estava completamente quebrado em produção (sempre 400) antes desta correção. Detalhe em [decisoes.md](./decisoes.md). |
| `ai/chat` e `ai/business-analysis` caem para "primeira empresa da tabela" se auth E body falharem | 🟢 Baixo, novo achado | Fail-open em vez de fail-closed num cenário raro (falha transitória de `getAuthContext()` com sessão já validada no edge). Não corrigido — risco baixo, registrado para referência futura. |
| WhatsApp V5 CRM inteiro (13 arquivos) usava `NEXUS_PLATFORM_COMPANY_ID` fixo em vez da empresa do usuário logado | ✅ Resolvido (2026-06-18) | Não era bug em produção hoje (só a NEXUS usa o módulo), mas bloquearia totalmente vender o CRM a clientes. Corrigido por decisão explícita do usuário de preparar multi-tenant desde já. Detalhe completo em [decisoes.md](./decisoes.md). |
| `lead_context`/`whatsapp_conversations` não sincronizavam com a tabela `leads` | ✅ Resolvido (2026-06-19) | `lib/leads-sync.ts` (novo) conecta `analyze/route.ts` à tabela `leads`. Achado: `leads` tem dois campos de status paralelos (`status` em inglês, `stage` em português) — o helper mantém os dois em sincronia. Detalhe em [decisoes.md](./decisoes.md). |
| Leads sincronizados do WhatsApp sempre entram com `score: 0` | 🟢 Baixo, novo achado | O prompt de extração do `analyze/route.ts` não pede um campo de score à IA. Calcular um score real é trabalho novo, não corrigido nesta rodada. |
| `app/api/nexus/whatsapp/analyze` aceita qualquer `conversation_id` sem validar quem está chamando de verdade | 🟢 Baixo, novo achado | A checagem de `x-webhook-secret` existe mas não bloqueia nada se falhar (`if (!isInternal) { /* comentário, sem ação */ }`). Não é um leak de dados entre empresas (a rota deriva `company_id` da própria conversa, não aceita um valor externo), mas é um vetor de custo/DoS — qualquer um podendo disparar análises de IA pagas. Não corrigido nesta rodada. |
| Voice/Realtime — dependência de comportamento não documentado da API OpenAI | 🟠 Alto (operacional), mitigado em 2026-06-19 | Histórico de 2026-05-27/28 mostra ~25 commits corrigindo formato de sessão, endpoint e nomes de evento em 2 dias. A OpenAI pode mudar de novo sem aviso. Agora há um health-check diário automatizado (`/api/cron/voice-health`) que testa um handshake WebSocket real e avisa por email se quebrar — não elimina o risco, mas detecta sem depender de relato manual. Detalhe em [decisoes.md](./decisoes.md). |
| `/dashboard/system/realtime` chamava duas rotas que não existem (`/api/nexus/voice/session`, `/api/nexus/voice/debug`) | ✅ Resolvido (2026-06-19) | A página de diagnóstico estava quebrada — provavelmente esquecida depois de uma das correções de 2026-05-27/28. Corrigida para usar `/api/nexus/voice/token` (rota real) e agora também testa um handshake WebSocket de verdade. |
| Instância n8n (5 workflows) | ✅ Resolvido (2026-06-19) | Confirmado pelo usuário: n8n abandonado, substituído pelo engine nativo do WhatsApp. Achado consequente: a sequência de nutrição do waitlist ficou sem gatilho — corrigida com um cron nativo (`/api/cron/waitlist-sequence`). Detalhe em [decisoes.md](./decisoes.md). |
| Pasta `n8n-workflows/` (5 arquivos JSON) ainda no repositório | 🟢 Baixo | Histórico morto agora confirmado — candidato a mover para uma pasta de arquivo morto junto com os ~20 SQL legados (item 15), não feito nesta rodada. |
| ~20 arquivos `supabase-migration-*.sql` legados na raiz | 🟢 Baixo (mas confuso) | Não são código executado automaticamente, mas podem confundir quem tenta entender "qual é o setup real" — candidato a arquivamento |
| Rota pública `/v1` | 🟢 Baixo | Identificada como "legada/teste" — não auditada, verificar se está exposta sem necessidade |

## Como tratar este documento

Cada item aqui é uma hipótese a confirmar, não um fato estabelecido — vieram de leitura estática de código, não de execução/teste. Ao confirmar (ou descartar) um item, mover para [decisoes.md](./decisoes.md) com a resolução, ou remover desta lista se for falso positivo.
