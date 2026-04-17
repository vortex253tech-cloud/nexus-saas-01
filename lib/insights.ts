// ─── Insights da IA ───────────────────────────────────────────
// Gera insights acionáveis personalizados por perfil + respostas.
// Cada insight mapeia diretamente a uma ação concreta com impacto estimado.

import type { Perfil } from './types'
import type { ResultadoInput } from './diagnostico'

export type InsightStatus = 'pendente' | 'executando' | 'concluido'
export type InsightPrioridade = 'critica' | 'alta' | 'media'
export type InsightCategoria = 'receita' | 'custo' | 'retencao' | 'operacional' | 'precificacao'

export interface InsightAcao {
  id: string
  titulo: string
  descricao: string
  detalhe: string             // o "como fazer" expandido
  impactoEstimado: number     // R$/mês
  prazo: string               // "3 dias" | "1 semana" | etc.
  prioridade: InsightPrioridade
  categoria: InsightCategoria
  icone: string               // emoji
  passos: string[]            // checklist de execução
  status: InsightStatus
  ganhoRealizado: number      // atualizado quando concluído
}

// ─── Banco de insights por perfil ─────────────────────────────

const INSIGHTS_BASE: Record<Perfil, Omit<InsightAcao, 'status' | 'ganhoRealizado'>[]> = {
  ecommerce: [
    {
      id: 'ec-abandono',
      titulo: 'Ativar recuperação de carrinho abandonado',
      descricao: 'Você está perdendo clientes que já demonstraram intenção de compra. A recuperação automatizada captura em média 15% desse volume.',
      detalhe: 'Sequência de 3 mensagens (e-mail + SMS) em 1h, 12h e 24h após abandono. Inclua desconto no 3º contato apenas se necessário — a maioria converte antes disso.',
      impactoEstimado: 3800,
      prazo: '2 dias',
      prioridade: 'critica',
      categoria: 'receita',
      icone: '🛒',
      passos: [
        'Ativar integração de e-mail/SMS no seu e-commerce',
        'Criar template do e-mail 1 (lembrete sem desconto)',
        'Criar template do e-mail 2 (urgência)',
        'Criar template do e-mail 3 (oferta de 5%)',
        'Configurar trigger no carrinho abandonado após 1h',
        'Testar fluxo com e-mail próprio',
      ],
    },
    {
      id: 'ec-cac',
      titulo: 'Redistribuir verba de mídia para canais de menor CAC',
      descricao: 'Seu CAC estimado está 40% acima do benchmark. Redirecionar 30% do budget para canais com ROAS comprovado reduz o custo por venda imediatamente.',
      detalhe: 'Analise ROAS por canal nos últimos 90 dias. Corte canais abaixo de 2x e redistribua para o top 2 de melhor performance. Reavalie quinzenalmente.',
      impactoEstimado: 4200,
      prazo: '3 dias',
      prioridade: 'critica',
      categoria: 'custo',
      icone: '📊',
      passos: [
        'Exportar relatório de ROAS por canal (Meta, Google, etc.)',
        'Calcular CAC real por canal nos últimos 90 dias',
        'Identificar o top 2 canais de melhor retorno',
        'Pausar ou reduzir canais com ROAS abaixo de 2x',
        'Redistribuir budget para os canais top',
        'Configurar alerta de CAC para revisão quinzenal',
      ],
    },
    {
      id: 'ec-frete',
      titulo: 'Negociar contrato de frete com tabela por volume',
      descricao: 'Sem contrato consolidado, você paga preço spot na maioria das remessas. Contratos de volume reduzem o custo de frete em 20–35%.',
      detalhe: 'Consolide volume dos últimos 3 meses e apresente para 3 transportadoras. Negocie desconto progressivo por faixa de CEP e peso médio.',
      impactoEstimado: 2900,
      prazo: '1 semana',
      prioridade: 'alta',
      categoria: 'custo',
      icone: '🚚',
      passos: [
        'Levantar volume de remessas dos últimos 90 dias',
        'Calcular custo médio por remessa atual',
        'Listar 3 transportadoras alternativas para cotação',
        'Enviar proposta com volume projetado para negociação',
        'Comparar tabelas e selecionar melhor contrato',
        'Configurar integração da nova transportadora',
      ],
    },
    {
      id: 'ec-recompra',
      titulo: 'Criar fluxo de recompra para clientes inativos (60+ dias)',
      descricao: 'Clientes que compraram há mais de 60 dias têm alta chance de reativação com o incentivo certo. Custo de reativação é 5x menor que aquisição.',
      detalhe: 'Segmente compradores com 60–180 dias sem compra. Envie oferta personalizada baseada no histórico de categoria. Inclua desconto de reativação.',
      impactoEstimado: 3100,
      prazo: '5 dias',
      prioridade: 'alta',
      categoria: 'retencao',
      icone: '🔄',
      passos: [
        'Exportar segmento de clientes inativos 60–180 dias',
        'Mapear categorias de maior recorrência por perfil',
        'Criar e-mail de reativação personalizado por categoria',
        'Definir desconto de reativação (recomendo 8–12%)',
        'Configurar envio e acompanhar taxa de reabertura',
      ],
    },
    {
      id: 'ec-margem',
      titulo: 'Identificar e descontinuar SKUs com margem negativa',
      descricao: 'Com frete e impostos incluídos, produtos de baixo ticket frequentemente têm margem negativa. Cada venda desses itens piora seu resultado.',
      detalhe: 'Calcule margem real (preço - CMV - frete médio - impostos) para cada SKU. Produtos abaixo de 15% de margem líquida precisam de reajuste ou descontinuação.',
      impactoEstimado: 2400,
      prazo: '4 dias',
      prioridade: 'media',
      categoria: 'precificacao',
      icone: '💡',
      passos: [
        'Exportar todos os SKUs com preço e custo',
        'Incluir frete médio e impostos no cálculo',
        'Filtrar produtos com margem líquida abaixo de 15%',
        'Decidir: reajustar preço ou pausar venda',
        'Atualizar preços no e-commerce',
        'Monitorar impacto em volume vs margem',
      ],
    },
  ],

  servicos: [
    {
      id: 'sv-retainer',
      titulo: 'Converter 2 clientes ativos para contrato retainer',
      descricao: 'Clients recorrentes gastam 67% mais e custam 5x menos para manter. Transformar projetos pontuais em contratos mensais cria previsibilidade.',
      detalhe: 'Selecione os 2 clientes com maior frequência de demandas pontuais. Apresente proposta de retainer com 10–15% de desconto vs soma dos projetos avulsos.',
      impactoEstimado: 6100,
      prazo: '1 semana',
      prioridade: 'critica',
      categoria: 'receita',
      icone: '🤝',
      passos: [
        'Identificar os 2 clientes com mais projetos recorrentes nos últimos 6 meses',
        'Calcular valor médio mensal de projetos avulsos por cliente',
        'Criar proposta de retainer com escopo claro e preço justo',
        'Apresentar o modelo de retainer como benefício mútuo',
        'Negociar e assinar contrato com termo de 6 meses mínimo',
      ],
    },
    {
      id: 'sv-precificacao',
      titulo: 'Migrar precificação de hora para entrega de valor',
      descricao: 'Cobrar por hora cria teto artificial de crescimento. Precificação por resultado ou pacote aumenta ticket médio em 30–60% sem aumentar esforço.',
      detalhe: 'Para cada tipo de serviço, calcule o valor gerado para o cliente (não o tempo gasto). Precifique em % do resultado ou como pacote com escopo definido.',
      impactoEstimado: 5800,
      prazo: '2 semanas',
      prioridade: 'critica',
      categoria: 'precificacao',
      icone: '💰',
      passos: [
        'Listar todos os serviços oferecidos atualmente',
        'Calcular valor médio gerado por tipo de serviço para o cliente',
        'Criar 3 pacotes (básico, intermediário, premium) com escopo claro',
        'Definir preços baseados em valor, não em horas',
        'Atualizar proposta comercial e site',
        'Apresentar nova estrutura para novos clientes imediatamente',
      ],
    },
    {
      id: 'sv-upsell',
      titulo: 'Mapear oportunidades de upsell na base atual',
      descricao: 'Clientes existentes têm necessidades adjacentes que você pode resolver. Um mapeamento ativo de upsell gera receita nova sem custo de aquisição.',
      detalhe: 'Faça uma revisão de 30 min com cada cliente ativo nos próximos 30 dias. Objetivo: entender o que mais eles precisam que você poderia entregar.',
      impactoEstimado: 4200,
      prazo: '2 semanas',
      prioridade: 'alta',
      categoria: 'receita',
      icone: '🎯',
      passos: [
        'Listar todos os clientes ativos com data da última conversa estratégica',
        'Priorizar os 5 com maior potencial de expansão',
        'Agendar check-in de 30 min com cada um',
        'Usar roteiro: "O que mais traria resultado para vocês agora?"',
        'Montar proposta específica para cada oportunidade identificada',
        'Enviar proposta em até 48h após a conversa',
      ],
    },
    {
      id: 'sv-churn',
      titulo: 'Criar NPS trimestral para antecipar cancelamentos',
      descricao: 'Clientes que cancelam raramente avisam antes — eles simplesmente somem. Um NPS simples identifica os insatisfeitos antes que sejam perdidos.',
      detalhe: 'Envie 1 pergunta por e-mail a cada 90 dias: "De 0 a 10, qual a chance de nos recomendar?" Detratores (0–6) recebem ligação em até 24h.',
      impactoEstimado: 3900,
      prazo: '3 dias',
      prioridade: 'alta',
      categoria: 'retencao',
      icone: '📋',
      passos: [
        'Criar pesquisa NPS simples (1 pergunta + campo aberto)',
        'Configurar envio automático a cada 90 dias',
        'Definir processo: quem contata detratores em até 24h',
        'Criar script de ligação para recuperação',
        'Configurar dashboard para acompanhar NPS ao longo do tempo',
      ],
    },
    {
      id: 'sv-processo',
      titulo: 'Documentar os 3 processos mais repetidos da operação',
      descricao: 'Sem processos documentados, cada entrega depende de pessoas específicas e gera retrabalho. Documentar os top 3 reduz horas não faturadas imediatamente.',
      detalhe: 'Identifique as 3 tarefas que mais se repetem e mais consomem tempo da equipe. Documente em SOPs de 1 página com checklist de execução.',
      impactoEstimado: 2700,
      prazo: '5 dias',
      prioridade: 'media',
      categoria: 'operacional',
      icone: '⚙️',
      passos: [
        'Listar as 10 tarefas que mais se repetem na operação',
        'Priorizar as top 3 por frequência e tempo consumido',
        'Para cada uma: gravar uma execução real (Loom/vídeo)',
        'Transcrever em checklist de etapas numeradas',
        'Compartilhar com a equipe e validar por 1 semana',
        'Usar como base de onboarding de novos colaboradores',
      ],
    },
  ],

  tech: [
    {
      id: 'tech-onboarding',
      titulo: 'Reduzir time-to-value do onboarding em 50%',
      descricao: 'Usuários que não atingem o "primeiro sucesso" nos primeiros 7 dias têm 70% de chance de churnar. Otimizar o onboarding é a alavanca de maior impacto no MRR.',
      detalhe: 'Mapeie o caminho do usuário até a primeira ação de valor. Remova fricção: pré-configure, guie com tooltips e envie e-mail de ativação com uma única ação clara.',
      impactoEstimado: 7400,
      prazo: '2 semanas',
      prioridade: 'critica',
      categoria: 'retencao',
      icone: '🚀',
      passos: [
        'Mapear o funil atual de ativação (signup → primeira ação de valor)',
        'Identificar onde ocorre maior drop-off nos primeiros 7 dias',
        'Simplificar: remover etapas desnecessárias antes do valor',
        'Criar e-mail de ativação D1 com uma única ação clara',
        'Implementar checklist in-app de primeiros passos',
        'Medir taxa de ativação antes vs depois',
      ],
    },
    {
      id: 'tech-expansion',
      titulo: 'Ativar notificação proativa de upgrade de plano',
      descricao: 'Usuários que atingem 80% do limite raramente fazem upgrade sem ser lembrados. Uma notificação in-app no momento certo converte 25–35% desse segmento.',
      detalhe: 'Configure trigger quando o usuário atinge 75% do limite de uso. Exiba modal com benefícios do próximo plano e botão de upgrade em 1 clique.',
      impactoEstimado: 5100,
      prazo: '3 dias',
      prioridade: 'critica',
      categoria: 'receita',
      icone: '⚡',
      passos: [
        'Identificar a métrica de consumo principal (armazenamento, API calls, usuários, etc.)',
        'Implementar trigger a 75% de consumo',
        'Criar modal de upgrade com proposta de valor clara',
        'Mostrar o que o usuário perde ao atingir 100%',
        'Implementar upgrade em 1 clique direto da notificação',
        'Medir taxa de conversão da notificação semanalmente',
      ],
    },
    {
      id: 'tech-anual',
      titulo: 'Criar incentivo para migração para plano anual',
      descricao: 'Planos anuais reduzem churn em 60% e melhoram LTV imediatamente. Oferecer 2 meses grátis é um investimento com retorno garantido.',
      detalhe: 'Ofereça upgrade para anual com 2 meses grátis. Apresente na renovação do plano mensal e após os primeiros 30 dias de uso ativo.',
      impactoEstimado: 4300,
      prazo: '1 semana',
      prioridade: 'alta',
      categoria: 'retencao',
      icone: '📅',
      passos: [
        'Definir o desconto do plano anual (sugestão: 2 meses grátis = ~17%)',
        'Criar página de upgrade com comparativo mensal vs anual',
        'Configurar e-mail de oferta no dia 30 de uso',
        'Adicionar banner de upgrade no painel para usuários mensais',
        'Implementar checkout simplificado para troca de plano',
        'Acompanhar taxa de conversão de mensal para anual',
      ],
    },
    {
      id: 'tech-nps',
      titulo: 'Implementar NPS no momento de maior satisfação',
      descricao: 'NPS coletado após o primeiro sucesso captura a avaliação mais alta. Usuários promotores viram fonte de indicações orgânicas.',
      detalhe: 'Dispare o NPS 24h após o usuário completar a primeira ação de valor. Promotores (9–10) recebem pedido de review/indicação. Detratores (0–6) recebem suporte proativo.',
      impactoEstimado: 3300,
      prazo: '4 dias',
      prioridade: 'alta',
      categoria: 'retencao',
      icone: '⭐',
      passos: [
        'Identificar o evento de "primeiro sucesso" para acionar o NPS',
        'Configurar NPS in-app 24h após esse evento',
        'Criar fluxo: promotores → pedido de G2/Capterra review',
        'Criar fluxo: detratores → ticket automático de suporte',
        'Dashboardar resultados semanalmente',
      ],
    },
    {
      id: 'tech-segmentacao',
      titulo: 'Segmentar comunicação por perfil de uso',
      descricao: 'Usuários de alto e baixo engajamento precisam de mensagens diferentes. Comunicação genérica tem 3x menos conversão que segmentada.',
      detalhe: 'Divida usuários em: alto uso (>5 sessões/semana), médio (2–4), baixo (<2). Crie campanhas de e-mail específicas para reativar baixo uso antes do churn.',
      impactoEstimado: 2900,
      prazo: '1 semana',
      prioridade: 'media',
      categoria: 'retencao',
      icone: '🎯',
      passos: [
        'Configurar segmentação por frequência de uso na plataforma de e-mail',
        'Criar campanha de reativação para usuários com <2 sessões/semana',
        'Criar campanha de expansão para usuários com >5 sessões/semana',
        'Automatizar entrada e saída dos segmentos semanalmente',
        'Medir impacto no churn após 30 dias',
      ],
    },
  ],

  consultoria: [
    {
      id: 'co-pipeline',
      titulo: 'Criar 1 conteúdo de diagnóstico gratuito como lead magnet',
      descricao: 'Um diagnóstico gratuito que demonstra sua metodologia gera leads 3x mais qualificados. Você entrega valor antes de vender.',
      detalhe: 'Crie um PDF ou ferramenta de autodiagnóstico de 1 página com 5 perguntas. Distribua via LinkedIn + e-mail. Quem preenche já demonstra interesse real.',
      impactoEstimado: 5800,
      prazo: '5 dias',
      prioridade: 'critica',
      categoria: 'receita',
      icone: '📄',
      passos: [
        'Escolher o problema mais comum dos seus melhores clientes',
        'Criar 5 perguntas de diagnóstico com pontuação simples',
        'Escrever PDF de 1 página com o diagnóstico e próximos passos',
        'Criar landing page simples para captura do e-mail',
        'Publicar no LinkedIn com storytelling de um caso real',
        'Configurar e-mail de follow-up automático após download',
      ],
    },
    {
      id: 'co-proposta',
      titulo: 'Reformular proposta com ROI estimado no topo',
      descricao: 'Propostas que mostram o retorno esperado antes do preço aumentam a taxa de fechamento em 30–50%. O cliente compra o resultado, não o serviço.',
      detalhe: 'Reestruture a proposta: abra com o diagnóstico do problema do cliente, mostre o custo atual de NÃO resolver, apresente o retorno esperado, e só então mostre o investimento.',
      impactoEstimado: 4600,
      prazo: '2 dias',
      prioridade: 'critica',
      categoria: 'receita',
      icone: '📊',
      passos: [
        'Escolher a última proposta enviada como base',
        'Reescrever a abertura: "Situação atual → custo do problema"',
        'Adicionar seção "Retorno esperado" com número conservador',
        'Mover o investimento para depois do ROI',
        'Adicionar casos de resultados anteriores com números reais',
        'Testar com a próxima proposta e medir taxa de resposta',
      ],
    },
    {
      id: 'co-followup',
      titulo: 'Implementar sequência de follow-up após envio de proposta',
      descricao: '80% das vendas acontecem no 5º ao 12º contato. Mas a maioria para no primeiro follow-up. Uma sequência estruturada triplica o aproveitamento de propostas enviadas.',
      detalhe: 'Crie sequência: D+2 (confirmação de recebimento), D+5 (resposta à dúvida comum), D+10 (case de resultado), D+15 (última tentativa com oferta por tempo limitado).',
      impactoEstimado: 3900,
      prazo: '3 dias',
      prioridade: 'alta',
      categoria: 'receita',
      icone: '📬',
      passos: [
        'Criar template de e-mail D+2: confirmação e abertura para dúvidas',
        'Criar template D+5: responder à objeção mais comum proativamente',
        'Criar template D+10: compartilhar case de resultado similar',
        'Criar template D+15: urgência real (vagas limitadas, prazo de proposta)',
        'Configurar sequência no seu CRM ou ferramenta de e-mail',
        'Acompanhar taxa de resposta por e-mail da sequência',
      ],
    },
    {
      id: 'co-advisory',
      titulo: 'Lançar serviço de advisory recorrente para ex-clientes',
      descricao: 'Ex-clientes satisfeitos têm 60% de chance de comprar novamente. Um advisory mensal de 2h é de baixo esforço e cria receita recorrente previsível.',
      detalhe: 'Ofereça 2h/mês de mentoria estratégica para ex-clientes de projetos encerrados. Preço: 20–30% do valor de um projeto pontuais. Escopo: alinhamento estratégico e revisão de métricas.',
      impactoEstimado: 3200,
      prazo: '1 semana',
      prioridade: 'alta',
      categoria: 'receita',
      icone: '🧠',
      passos: [
        'Listar ex-clientes satisfeitos dos últimos 2 anos',
        'Criar proposta de advisory: escopo, frequência, preço',
        'Enviar e-mail personalizado para os top 5',
        'Agendar call de apresentação do modelo',
        'Formalizar contrato mensal com renovação automática',
      ],
    },
    {
      id: 'co-referral',
      titulo: 'Criar programa de indicação com benefício claro',
      descricao: 'Indicações convertem 5x mais que leads frios. A maioria dos clientes satisfeitos indica quando explicitamente solicitados com um benefício claro.',
      detalhe: 'Para cada indicação que vira cliente: ofereça 1 mês de advisory gratuito ou desconto no próximo projeto. Comunique o programa ativamente — não espere indicações espontâneas.',
      impactoEstimado: 2800,
      prazo: '3 dias',
      prioridade: 'media',
      categoria: 'receita',
      icone: '🔗',
      passos: [
        'Definir o benefício para quem indica (desconto, hora extra, cashback)',
        'Criar landing page simples do programa',
        'Enviar e-mail anunciando o programa para toda a base',
        'Adicionar ao rodapé de cada entrega e relatório',
        'Criar lembrete mensal para perguntar ativamente por indicações',
      ],
    },
  ],

  varejo: [
    {
      id: 'va-abc',
      titulo: 'Implementar gestão ativa por curva ABC',
      descricao: 'Os 20% de produtos que geram 80% da receita precisam de tratamento diferente dos demais. Focar aqui aumenta giro e margem simultaneamente.',
      detalhe: 'Classifique todos os produtos: A (top 20% em faturamento), B (próximos 30%), C (demais 50%). Priorize estoque, vitrine e promoções nos produtos A.',
      impactoEstimado: 4100,
      prazo: '3 dias',
      prioridade: 'critica',
      categoria: 'receita',
      icone: '📦',
      passos: [
        'Exportar relatório de vendas dos últimos 90 dias por produto',
        'Classificar produtos em A, B e C por faturamento',
        'Garantir que produtos A nunca fiquem sem estoque',
        'Reposicionar produtos A na vitrine/gôndola de maior visibilidade',
        'Criar promoção para liquidar produtos C de baixo giro',
        'Revisar a curva mensalmente',
      ],
    },
    {
      id: 'va-combo',
      titulo: 'Criar combos complementares nos top 5 produtos',
      descricao: 'Oferecer produto complementar no ponto de decisão aumenta o ticket médio em 15–25% sem esforço adicional de vendas. É a ação de maior ROI imediato.',
      detalhe: 'Para cada produto A, identifique o complementar natural. Crie combo com desconto de 5–8% vs compra separada. Posicione junto no PDV/site.',
      impactoEstimado: 3200,
      prazo: '2 dias',
      prioridade: 'critica',
      categoria: 'receita',
      icone: '🛍️',
      passos: [
        'Identificar os 5 produtos com maior frequência de compra',
        'Para cada um, definir o produto complementar óbvio',
        'Criar oferta de combo com 5% de desconto',
        'Posicionar fisicamente ou digitalmente os complementares juntos',
        'Treinar equipe de atendimento para sugerir ativamente',
        'Medir aumento de ticket médio após 2 semanas',
      ],
    },
    {
      id: 'va-estoque',
      titulo: 'Liquidar produtos C com mais de 90 dias sem movimento',
      descricao: 'Estoque parado é dinheiro imobilizado. Cada R$ 10k em produto sem giro custa R$ 1.200/mês entre custo de capital e espaço físico.',
      detalhe: 'Identifique produtos sem venda há 90+ dias. Promova liquidação agressiva (30–50% off) para recuperar o caixa. Melhor vender com margem zero do que manter parado.',
      impactoEstimado: 3800,
      prazo: '1 semana',
      prioridade: 'alta',
      categoria: 'custo',
      icone: '🏷️',
      passos: [
        'Filtrar produtos sem venda nos últimos 90 dias',
        'Calcular custo de manutenção de cada item parado',
        'Definir preço de liquidação (cubra o custo de reposição)',
        'Criar ação de liquidação com prazo de 2 semanas',
        'Divulgar nas redes sociais e WhatsApp de clientes',
        'Aplicar desconto progressivo: 30% na 1ª semana, 50% na 2ª',
      ],
    },
    {
      id: 'va-fidelidade',
      titulo: 'Lançar cartão de fidelidade simples (carimbo ou app)',
      descricao: 'Clientes fidelizados visitam com 30% mais frequência e gastam 67% mais. Um programa simples tem ROI comprovado para varejo.',
      detalhe: 'Comece com algo simples: cartão físico de carimbos ou app gratuito como Stamp Me. A cada 10 compras, o cliente ganha 1 produto ou desconto de 20%.',
      impactoEstimado: 4800,
      prazo: '5 dias',
      prioridade: 'alta',
      categoria: 'retencao',
      icone: '🎁',
      passos: [
        'Escolher o modelo: cartão físico ou app de fidelidade',
        'Definir a recompensa (produto grátis ou % de desconto)',
        'Imprimir cartões ou configurar o app',
        'Treinar equipe para oferecer na finalização de toda compra',
        'Criar comunicação simples para clientes existentes',
        'Medir taxa de adoção e frequência de retorno após 30 dias',
      ],
    },
    {
      id: 'va-preco',
      titulo: 'Revisar margens e ajustar preços dos produtos A',
      descricao: 'Produtos líderes de venda frequentemente têm preço sub-ótimo por medo de reduzir volume. Um teste de preço em 10% nos top vendedores raramente reduz volume.',
      detalhe: 'Aumente o preço dos 3 produtos A em 8–12%. Monitore volume de vendas por 2 semanas. Se o volume não cair >10%, o ajuste se paga imediatamente.',
      impactoEstimado: 2200,
      prazo: '1 dia',
      prioridade: 'media',
      categoria: 'precificacao',
      icone: '💲',
      passos: [
        'Identificar os 3 produtos com maior volume de vendas',
        'Pesquisar preço do concorrente mais próximo',
        'Ajustar preço em 8–12% se houver espaço vs concorrência',
        'Monitorar volume diariamente por 2 semanas',
        'Se queda >10% em volume: reverter. Se <10%: manter.',
      ],
    },
  ],

  outro: [
    {
      id: 'ou-custos',
      titulo: 'Auditoria de custos recorrentes nos próximos 7 dias',
      descricao: 'Toda empresa acumula gastos fantasma ao longo do tempo. Uma auditoria simples frequentemente revela 10–15% de economia imediata.',
      detalhe: 'Revise todos os cartões de crédito empresariais e débitos automáticos. Cancele tudo que não foi usado nos últimos 30 dias ou que não tem ROI claro.',
      impactoEstimado: 2600,
      prazo: '3 dias',
      prioridade: 'critica',
      categoria: 'custo',
      icone: '🔍',
      passos: [
        'Exportar extrato de todos os cartões empresariais dos últimos 90 dias',
        'Listar todas as assinaturas e débitos automáticos',
        'Para cada item: está sendo usado? Tem alternativa gratuita?',
        'Cancelar ou downgrade de tudo sem uso ativo',
        'Negociar desconto nas assinaturas que ficar',
        'Criar revisão trimestral de custos recorrentes',
      ],
    },
    {
      id: 'ou-precificacao',
      titulo: 'Estruturar cálculo de preço com margem-alvo definida',
      descricao: 'Sem método de precificação, você cobra por intuição. Um modelo simples de custo + margem + posicionamento permite reajuste consciente e imediato.',
      detalhe: 'Calcule: custo direto + custo fixo rateado + margem alvo (mínimo 30%). Compare com mercado. Se estiver abaixo, o reajuste é urgente.',
      impactoEstimado: 4300,
      prazo: '1 semana',
      prioridade: 'critica',
      categoria: 'precificacao',
      icone: '📐',
      passos: [
        'Listar todos os produtos/serviços com custo direto real',
        'Calcular o rateio de custo fixo por produto/serviço',
        'Definir margem alvo mínima (recomendo 30–40%)',
        'Calcular o preço mínimo para cada item',
        'Comparar com preço atual — ajustar os que estão abaixo',
        'Criar planilha de precificação para novos projetos',
      ],
    },
    {
      id: 'ou-caixa',
      titulo: 'Criar projeção de fluxo de caixa para os próximos 90 dias',
      descricao: 'Com visibilidade antecipada, você evita surpresas, negocia melhor com fornecedores e não precisa de crédito emergencial.',
      detalhe: 'Monte uma planilha simples: entradas previstas (contratos, pedidos), saídas fixas (aluguel, folha, fornecedores), saldo resultante por semana.',
      impactoEstimado: 3100,
      prazo: '2 dias',
      prioridade: 'alta',
      categoria: 'operacional',
      icone: '📅',
      passos: [
        'Listar todas as entradas previstas para os próximos 90 dias',
        'Listar todas as saídas fixas e variáveis previstas',
        'Calcular saldo semana a semana',
        'Identificar semanas de risco (saldo negativo projetado)',
        'Antecipar recebíveis ou atrasar pagamentos onde possível',
        'Atualizar a projeção semanalmente',
      ],
    },
    {
      id: 'ou-clientes',
      titulo: 'Identificar os 20% de clientes que geram 80% da receita',
      descricao: 'Focar esforço nos melhores clientes e replicar o perfil deles é a estratégia de crescimento com maior ROI para qualquer empresa.',
      detalhe: 'Exporte todos os clientes por faturamento. Identifique os top 20%. Analise: como eles chegaram, qual o perfil, o que mais compram. Use isso para qualificar novos.',
      impactoEstimado: 3800,
      prazo: '2 dias',
      prioridade: 'alta',
      categoria: 'receita',
      icone: '🏆',
      passos: [
        'Exportar relatório de clientes por faturamento acumulado',
        'Identificar os top 20% (clientes A)',
        'Mapear: como cada um chegou até você (canal de origem)',
        'Descrever o perfil comum: segmento, porte, necessidade principal',
        'Usar esse perfil como filtro para qualificar novos leads',
        'Criar ação específica para aumentar a base de clientes A',
      ],
    },
    {
      id: 'ou-margem',
      titulo: 'Calcular margem real por linha de produto/serviço',
      descricao: 'Muitas empresas descobrem que seu produto/serviço mais vendido tem a pior margem. Saber isso muda completamente o foco comercial.',
      detalhe: 'Para cada linha: receita - (custo direto + parcela de custo fixo + impostos). O que sobra é margem real. Foque esforço de venda nos de maior margem.',
      impactoEstimado: 2900,
      prazo: '3 dias',
      prioridade: 'media',
      categoria: 'precificacao',
      icone: '📈',
      passos: [
        'Listar todas as linhas de produto/serviço',
        'Calcular custo direto real (matéria-prima, tempo, terceiros)',
        'Ratear custo fixo proporcional a cada linha',
        'Calcular margem líquida após impostos',
        'Ordenar por margem — do maior para o menor',
        'Redirecionar esforço comercial para os de maior margem',
      ],
    },
  ],
}

// ─── Ajuste por desafio principal ─────────────────────────────

function ajustarPorDesafio(
  insights: Omit<InsightAcao, 'status' | 'ganhoRealizado'>[],
  desafio?: string,
): Omit<InsightAcao, 'status' | 'ganhoRealizado'>[] {
  if (!desafio) return insights

  const mapaBonus: Record<string, InsightCategoria[]> = {
    fluxo: ['custo', 'operacional'],
    custos: ['custo', 'operacional'],
    crescimento: ['receita', 'precificacao'],
    visibilidade: ['operacional', 'custo'],
    churn: ['retencao'],
    mrr: ['receita', 'retencao'],
    cac: ['custo', 'receita'],
    burn: ['custo', 'operacional'],
    recorrencia: ['retencao', 'receita'],
    ticket: ['precificacao', 'receita'],
    capacidade: ['operacional'],
    inadimplencia: ['operacional', 'custo'],
    pipeline: ['receita'],
    proposta: ['receita'],
    hora: ['precificacao', 'operacional'],
    retencao: ['retencao'],
    margem: ['precificacao', 'custo'],
    estoque: ['operacional', 'custo'],
    sazonalidade: ['receita', 'operacional'],
    custo_aquisicao: ['custo', 'receita'],
    margem_produto: ['precificacao', 'custo'],
    frete: ['custo'],
  }

  const categoriasBonus = mapaBonus[desafio] ?? []
  if (!categoriasBonus.length) return insights

  return [...insights].sort((a, b) => {
    const aBonus = categoriasBonus.includes(a.categoria) ? 1 : 0
    const bBonus = categoriasBonus.includes(b.categoria) ? 1 : 0
    return bBonus - aBonus
  })
}

// ─── Export principal ─────────────────────────────────────────

export function gerarInsights(input: ResultadoInput): InsightAcao[] {
  const perfil: Perfil = (input.perfil as Perfil) ?? 'outro'
  const base = INSIGHTS_BASE[perfil] ?? INSIGHTS_BASE.outro

  const ajustados = ajustarPorDesafio([...base], input.principalDesafio)

  // Top 5 insights, inicializados como pendente
  return ajustados.slice(0, 5).map((insight) => ({
    ...insight,
    status: 'pendente' as InsightStatus,
    ganhoRealizado: 0,
  }))
}
