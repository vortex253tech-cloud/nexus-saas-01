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
| Gating por plano cobre só 3 de 189 rotas de API | 🔴 Alto (confirmado, não mais hipótese) | **Confirmado por grep.** `automations`, `nexus/whatsapp/send`, `projects` são as únicas rotas com `denyIfCannot`/`denyIfAtLimit`/`requirePlan`. Recursos como Creative AI, insights de IA, voz e execução de flows não têm limite de plano aplicado no backend. |
| Voice/Realtime — dependência de comportamento não documentado da API OpenAI | 🟠 Alto (operacional) | Histórico de 2026-05-27/28 mostra ~25 commits corrigindo formato de sessão, endpoint e nomes de evento em 2 dias. A OpenAI pode mudar de novo sem aviso — não é um bug do NEXUS, mas é um risco operacional real que já se materializou antes |
| Instância n8n (5 workflows) — status de execução não verificável pelo código | 🟡 Médio | Se a instância n8n não estiver rodando/paga, sequências de nutrição por email simplesmente não disparam, sem erro visível no Next.js |
| ~20 arquivos `supabase-migration-*.sql` legados na raiz | 🟢 Baixo (mas confuso) | Não são código executado automaticamente, mas podem confundir quem tenta entender "qual é o setup real" — candidato a arquivamento |
| Rota pública `/v1` | 🟢 Baixo | Identificada como "legada/teste" — não auditada, verificar se está exposta sem necessidade |

## Como tratar este documento

Cada item aqui é uma hipótese a confirmar, não um fato estabelecido — vieram de leitura estática de código, não de execução/teste. Ao confirmar (ou descartar) um item, mover para [decisoes.md](./decisoes.md) com a resolução, ou remover desta lista se for falso positivo.
