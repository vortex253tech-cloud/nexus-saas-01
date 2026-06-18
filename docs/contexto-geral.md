# NEXUS — Contexto Geral

> Documento de memória permanente do projeto. Gerado em 2026-06-18 a partir de leitura completa do código-fonte (não do histórico de chat). Ver também [arquitetura.md](./arquitetura.md), [modulos.md](./modulos.md), [integracoes.md](./integracoes.md).

## O que é o NEXUS

NEXUS é um SaaS de inteligência operacional para pequenas e médias empresas brasileiras. Originalmente concebido como um "COO de IA" que lê dados financeiros e de clientes, gera diagnósticos e executa ações automaticamente (email, WhatsApp, atualização de registros).

O projeto evoluiu significativamente além disso. Hoje é melhor descrito como **um sistema operacional de negócios sempre-ativo**, com três pilares:

1. **Flow Engine** — motor de automação visual (DAG de nodes: trigger → análise → decisão → ação)
2. **WhatsApp V5 CRM** — CRM conversacional completo construído sobre WhatsApp (Z-API), com pipeline de vendas, IA de atendimento e busca full-text
3. **NEXUS OS** — sessão de voz sempre-ativa (OpenAI Realtime API / `gpt-realtime`), com 9 agentes especializados (CEO, Marketing, Sales, Finance, Growth, Operations, Support, Projects, Content) e ~25 tools acionáveis por voz/texto

## Estado do código-fonte

- **Stack:** Next.js 16.2.4 (App Router) · React 19.2.4 · TypeScript 5 · Tailwind 4 · Supabase (Postgres + Auth) · Anthropic Claude SDK + OpenAI SDK · Stripe · Z-API (WhatsApp) · Resend/Nodemailer · BullMQ/IORedis
- **Importante:** `AGENTS.md` na raiz avisa que esta versão do Next.js tem breaking changes vs. treino do modelo — sempre checar `node_modules/next/dist/docs/` antes de escrever código que dependa de APIs do framework.
- O repositório **não tem `middleware.ts`** na raiz (apesar de um manifesto antigo descrever um). A proteção de rota é feita ponto-a-ponto via `getAuthContext()` dentro de cada API route, não por middleware global. Isso é uma divergência relevante a validar antes de assumir qualquer comportamento de redirecionamento global.
- Existe um documento anterior, `NEXUS_SYSTEM_MANIFEST.md` (raiz do projeto, datado de 2025-04-27), que descreve bem o Flow Engine e os módulos "clássicos" (Financeiro, Clientes, Ações, Automações, Projetos). Esse manifesto está **desatualizado** — não cobre NEXUS OS, WhatsApp V5, Enterprise/admin, billing Stripe nem o sistema multi-agente. Os documentos em `docs/` aqui complementam (não substituem) esse manifesto: usar o manifesto para o Flow Engine, usar `docs/` para tudo construído depois.

## Como navegar a documentação

| Arquivo | Conteúdo |
|---|---|
| [arquitetura.md](./arquitetura.md) | Visão técnica: camadas, fluxo de dados, autenticação, banco de dados |
| [modulos.md](./modulos.md) | Inventário de páginas, rotas de API e módulos de dashboard |
| [integracoes.md](./integracoes.md) | Supabase, Stripe, OpenAI/Claude, WhatsApp (Z-API), email, n8n, Vercel, CI |
| [memoria-do-projeto.md](./memoria-do-projeto.md) | Linha do tempo de decisões e marcos — o "porquê" por trás do que existe |
| [roadmap.md](./roadmap.md) | Sprints planejados (herdados do manifesto antigo) + o que falta validar |
| [proximos-passos.md](./proximos-passos.md) | Lista priorizada de ações imediatas (crítico → baixa prioridade) |
| [bugs.md](./bugs.md) | Itens parcialmente implementados, stubs e riscos conhecidos |
| [decisoes.md](./decisoes.md) | Decisões arquiteturais relevantes e suas justificativas |

## Regra de uso

Nenhum destes documentos substitui a leitura do código quando uma alteração for feita. Eles existem para que qualquer IA ou engenheiro retome o contexto **sem depender do histórico de uma conversa de chat**. Atualizar estes arquivos sempre que um módulo, contrato de API ou decisão relevante mudar.
