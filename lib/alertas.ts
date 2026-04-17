// ─── Alertas Automáticos de Monitoramento ─────────────────────
// Simula alertas em tempo real baseados no perfil e contexto.

import type { Perfil } from './types'
import type { ResultadoInput } from './diagnostico'

export type AlertaTipo = 'perigo' | 'atencao' | 'oportunidade' | 'info'

export interface Alerta {
  id: string
  tipo: AlertaTipo
  titulo: string
  descricao: string
  impacto: string        // ex: "R$ 2.400/mês"
  icone: string
  tempoAtras: string     // ex: "há 2h"
  lido: boolean
}

const ALERTAS_BASE: Record<Perfil, Alerta[]> = {
  ecommerce: [
    {
      id: 'ec-a1',
      tipo: 'perigo',
      titulo: 'Taxa de abandono de carrinho acima da média',
      descricao: 'Seu abandono está em 74% — benchmark do setor é 68%. Estimativa de perda: R$ 2.400 esta semana.',
      impacto: 'R$ 2.400/semana',
      icone: '🛒',
      tempoAtras: 'há 2h',
      lido: false,
    },
    {
      id: 'ec-a2',
      tipo: 'atencao',
      titulo: 'Margem de produto abaixo do esperado',
      descricao: 'Margem líquida média de 18% — abaixo dos 25% saudáveis para seu segmento.',
      impacto: '-7% na margem',
      icone: '📉',
      tempoAtras: 'há 6h',
      lido: false,
    },
    {
      id: 'ec-a3',
      tipo: 'oportunidade',
      titulo: 'Clientes inativos há 60 dias detectados',
      descricao: 'Identificamos uma base de clientes sem compra recente. Uma campanha de reativação pode gerar R$ 8k+.',
      impacto: 'R$ 8.000 potencial',
      icone: '💌',
      tempoAtras: 'há 1d',
      lido: true,
    },
    {
      id: 'ec-a4',
      tipo: 'info',
      titulo: 'Custo de frete subiu 12% vs mês anterior',
      descricao: 'Variação acima do esperado. Avalie renegociar contrato ou ajustar frete grátis mínimo.',
      impacto: '+R$ 1.100/mês',
      icone: '📦',
      tempoAtras: 'há 3d',
      lido: true,
    },
  ],
  servicos: [
    {
      id: 'sv-a1',
      tipo: 'perigo',
      titulo: 'Cliente representa >40% da receita',
      descricao: 'Concentração de receita em risco. Se esse cliente sair, sua receita cai drasticamente.',
      impacto: 'Risco crítico',
      icone: '⚠️',
      tempoAtras: 'há 1h',
      lido: false,
    },
    {
      id: 'sv-a2',
      tipo: 'atencao',
      titulo: 'Inadimplência subiu 8% este mês',
      descricao: '3 clientes com pagamento atrasado >30 dias. Impacto direto no fluxo de caixa.',
      impacto: 'R$ 4.200 em atraso',
      icone: '💸',
      tempoAtras: 'há 4h',
      lido: false,
    },
    {
      id: 'sv-a3',
      tipo: 'oportunidade',
      titulo: 'Serviço premium com baixa penetração',
      descricao: 'Apenas 12% dos clientes usam seu serviço premium. Upsell pode gerar R$ 6k+ sem novos clientes.',
      impacto: 'R$ 6.000 potencial',
      icone: '⬆️',
      tempoAtras: 'há 2d',
      lido: true,
    },
    {
      id: 'sv-a4',
      tipo: 'info',
      titulo: 'Horas não faturadas acima de 15%',
      descricao: 'Time gastando horas em atividades não cobradas. Revise processos internos.',
      impacto: '-15% eficiência',
      icone: '⏱️',
      tempoAtras: 'há 5d',
      lido: true,
    },
  ],
  tech: [
    {
      id: 'tc-a1',
      tipo: 'perigo',
      titulo: 'Churn rate acima de 5% ao mês',
      descricao: 'Você está perdendo MRR mais rápido do que adquire. CAC atual não sustenta esse ritmo.',
      impacto: 'MRR em queda',
      icone: '🔴',
      tempoAtras: 'há 30min',
      lido: false,
    },
    {
      id: 'tc-a2',
      tipo: 'atencao',
      titulo: 'LTV/CAC abaixo de 3x',
      descricao: 'Sua relação LTV/CAC está em 2.1x — cada cliente adquirido custa mais do que retorna.',
      impacto: 'Unidade econômica negativa',
      icone: '📊',
      tempoAtras: 'há 3h',
      lido: false,
    },
    {
      id: 'tc-a3',
      tipo: 'oportunidade',
      titulo: 'Plano anual com baixa adoção',
      descricao: 'Apenas 20% dos clientes estão no plano anual. Migrar 15% geraria R$ 12k de caixa imediato.',
      impacto: 'R$ 12.000 imediato',
      icone: '📅',
      tempoAtras: 'há 1d',
      lido: true,
    },
    {
      id: 'tc-a4',
      tipo: 'info',
      titulo: 'Burn rate +18% vs trimestre anterior',
      descricao: 'Crescimento de custos operacionais acelerando. Revise headcount e contratos de infra.',
      impacto: '+R$ 8.000/mês',
      icone: '🔥',
      tempoAtras: 'há 4d',
      lido: true,
    },
  ],
  consultoria: [
    {
      id: 'cn-a1',
      tipo: 'perigo',
      titulo: 'Pipeline de vendas com menos de 30 dias de cobertura',
      descricao: 'Você não tem projetos suficientes confirmados para o próximo mês. Ação imediata necessária.',
      impacto: 'Gap de receita iminente',
      icone: '🚨',
      tempoAtras: 'há 2h',
      lido: false,
    },
    {
      id: 'cn-a2',
      tipo: 'atencao',
      titulo: 'Taxa de conversão de propostas caiu 20%',
      descricao: 'Benchmark do setor é 35%. Sua taxa caiu para 24% este trimestre.',
      impacto: '-R$ 3.600/mês',
      icone: '📋',
      tempoAtras: 'há 5h',
      lido: false,
    },
    {
      id: 'cn-a3',
      tipo: 'oportunidade',
      titulo: 'Clientes antigos sem contato há 90 dias',
      descricao: '4 ex-clientes sem projeto ativo. Reativação com desconto pode recuperar R$ 15k.',
      impacto: 'R$ 15.000 potencial',
      icone: '📞',
      tempoAtras: 'há 2d',
      lido: true,
    },
    {
      id: 'cn-a4',
      tipo: 'info',
      titulo: 'Rentabilidade por hora abaixo de R$ 180',
      descricao: 'Seu custo-hora considerando overhead está em R$ 140. Margem operacional comprimida.',
      impacto: '-28% na margem/h',
      icone: '💡',
      tempoAtras: 'há 6d',
      lido: true,
    },
  ],
  varejo: [
    {
      id: 'vr-a1',
      tipo: 'perigo',
      titulo: 'Giro de estoque crítico em 3 SKUs principais',
      descricao: 'Capital parado em estoque lento. Risco de perda por vencimento ou obsolescência.',
      impacto: 'R$ 9.000 parado',
      icone: '🏪',
      tempoAtras: 'há 1h',
      lido: false,
    },
    {
      id: 'vr-a2',
      tipo: 'atencao',
      titulo: 'Margem bruta caiu 5% este mês',
      descricao: 'Custo de mercadorias subiu mais rápido do que seus preços. Revise tabela de preços.',
      impacto: '-R$ 2.100/mês',
      icone: '📉',
      tempoAtras: 'há 3h',
      lido: false,
    },
    {
      id: 'vr-a3',
      tipo: 'oportunidade',
      titulo: 'Ticket médio abaixo do potencial',
      descricao: 'Cross-sell e bundling podem elevar ticket médio em 22% sem novos clientes.',
      impacto: '+22% no ticket',
      icone: '🎯',
      tempoAtras: 'há 1d',
      lido: true,
    },
    {
      id: 'vr-a4',
      tipo: 'info',
      titulo: 'Sazonalidade: queda prevista em 45 dias',
      descricao: 'Histórico indica queda de 30% nas próximas 6 semanas. Prepare estratégia antecipada.',
      impacto: '-30% previsto',
      icone: '📆',
      tempoAtras: 'há 5d',
      lido: true,
    },
  ],
  outro: [
    {
      id: 'ot-a1',
      tipo: 'perigo',
      titulo: 'Fluxo de caixa negativo projetado em 15 dias',
      descricao: 'Com base nas entradas e saídas atuais, seu caixa ficará negativo em 2 semanas.',
      impacto: 'Risco de insolvência',
      icone: '💰',
      tempoAtras: 'há 1h',
      lido: false,
    },
    {
      id: 'ot-a2',
      tipo: 'atencao',
      titulo: 'Custos fixos representam >60% da receita',
      descricao: 'Alta alavancagem operacional. Qualquer queda de receita pode ser crítica.',
      impacto: 'Risco operacional',
      icone: '📊',
      tempoAtras: 'há 4h',
      lido: false,
    },
    {
      id: 'ot-a3',
      tipo: 'oportunidade',
      titulo: 'Precificação abaixo do mercado detectada',
      descricao: 'Análise de benchmark indica que você pode subir preços em 12% sem perda de volume.',
      impacto: '+12% na receita',
      icone: '💡',
      tempoAtras: 'há 2d',
      lido: true,
    },
    {
      id: 'ot-a4',
      tipo: 'info',
      titulo: 'Despesas administrativas +9% sem crescimento proporcional',
      descricao: 'Custos administrativos crescendo mais rápido que a receita. Oportunidade de corte.',
      impacto: '-R$ 1.800 possível',
      icone: '✂️',
      tempoAtras: 'há 6d',
      lido: true,
    },
  ],
}

export function gerarAlertas(input: ResultadoInput): Alerta[] {
  const perfil = (input.perfil ?? 'outro') as Perfil
  return ALERTAS_BASE[perfil] ?? ALERTAS_BASE['outro']
}
