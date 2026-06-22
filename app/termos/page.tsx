// Rascunho genérico de Termos de Uso — revisar com um advogado antes de
// publicar. Preencher [RAZÃO SOCIAL], [CNPJ] e os contatos reais antes do
// lançamento.

import Link from 'next/link'
import { Zap, ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Termos de Uso — NEXUS',
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-bold text-white mt-10 mb-3">{children}</h2>
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] text-zinc-400 leading-relaxed mb-3">{children}</p>
}

export default function TermosPage() {
  return (
    <div className="min-h-screen bg-[#0A0E16] text-white">
      <header className="border-b border-white/6 px-6 py-5">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center">
              <Zap className="w-3.5 h-3.5 text-white" fill="currentColor" />
            </div>
            <span className="text-[14px] font-black text-white tracking-tight">NEXUS</span>
          </Link>
          <Link href="/" className="flex items-center gap-1.5 text-[13px] text-zinc-500 hover:text-white transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Voltar
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-14">
        <p className="text-[12px] font-bold text-violet-400 uppercase tracking-widest mb-3">Documento legal</p>
        <h1 className="text-3xl sm:text-4xl font-black text-white mb-2">Termos de Uso</h1>
        <p className="text-zinc-600 text-sm mb-10">Última atualização: [DATA] · Versão 1.0 (rascunho)</p>

        <P>
          Estes Termos de Uso regulam a utilização da plataforma NEXUS ("NEXUS", "Plataforma", "nós"),
          operada por <strong className="text-zinc-300">[RAZÃO SOCIAL DA EMPRESA]</strong>, inscrita no
          CNPJ <strong className="text-zinc-300">[CNPJ]</strong>, disponibilizada em nexusaas.com.br. Ao
          criar uma conta ou utilizar o serviço, você concorda com estes termos.
        </P>

        <H2>1. Descrição do serviço</H2>
        <P>
          O NEXUS é um sistema de gestão empresarial com inteligência artificial, que inclui CRM,
          automações ("Flow Engine"), atendimento via WhatsApp assistido por IA, geração de conteúdo
          ("Creative AI"), assistente de voz e relatórios financeiros. Os recursos disponíveis variam
          conforme o plano contratado.
        </P>

        <H2>2. Cadastro e conta</H2>
        <P>
          Para usar o NEXUS, você deve criar uma conta com informações verdadeiras e mantê-las
          atualizadas. Você é responsável pela confidencialidade das suas credenciais de acesso e por
          toda atividade realizada na sua conta.
        </P>

        <H2>3. Planos, cobrança e cancelamento</H2>
        <P>
          O NEXUS oferece um período de teste gratuito de 7 dias, sem necessidade de cartão de crédito.
          Após esse período, a continuidade do uso está sujeita à assinatura de um dos planos pagos
          divulgados em nexusaas.com.br/planos. Os pagamentos são processados por um terceiro (Stripe) e
          cobrados de forma recorrente (mensal ou anual) até o cancelamento. Você pode cancelar a
          qualquer momento pelo painel — o acesso permanece ativo até o fim do período já pago, sem multa
          de fidelidade.
        </P>
        <P>
          Reembolsos, quando aplicáveis, seguem a política vigente descrita em [LINK/POLÍTICA DE
          REEMBOLSO] ou, na ausência de uma política específica, a legislação consumerista aplicável.
        </P>

        <H2>4. Uso aceitável</H2>
        <P>Ao usar o NEXUS, você se compromete a não:</P>
        <ul className="list-disc list-outside ml-5 text-[15px] text-zinc-400 leading-relaxed mb-3 space-y-1.5">
          <li>Utilizar a plataforma para enviar mensagens não solicitadas (spam) via WhatsApp ou e-mail, ou para qualquer finalidade ilícita;</li>
          <li>Tentar acessar dados de outras empresas/contas sem autorização;</li>
          <li>Realizar engenharia reversa, copiar ou revender a plataforma sem autorização por escrito;</li>
          <li>Sobrecarregar a infraestrutura de forma deliberada (ex: automações configuradas para abuso).</li>
        </ul>
        <P>O descumprimento pode resultar em suspensão ou encerramento da conta, sem reembolso.</P>

        <H2>5. Integrações de terceiros</H2>
        <P>
          O NEXUS se integra a serviços de terceiros para funcionar — incluindo, mas não se limitando a:
          processamento de pagamentos (Stripe), envio de mensagens (Z-API/WhatsApp), geração de
          conteúdo por inteligência artificial (Anthropic Claude, OpenAI) e envio de e-mails (Resend).
          O uso dessas integrações está sujeito também aos termos desses provedores. O NEXUS não se
          responsabiliza por instabilidades ou indisponibilidades causadas exclusivamente por esses
          terceiros.
        </P>

        <H2>6. Propriedade intelectual</H2>
        <P>
          Todo o conteúdo, marca, software e tecnologia do NEXUS são de propriedade de [RAZÃO SOCIAL DA
          EMPRESA] ou licenciados a ela. Você mantém a titularidade sobre os dados que insere na
          plataforma (clientes, conversas, documentos gerados).
        </P>

        <H2>7. Disponibilidade do serviço</H2>
        <P>
          Fazemos esforços razoáveis para manter o NEXUS disponível 24 horas por dia, mas não garantimos
          disponibilidade ininterrupta. Manutenções programadas e indisponibilidades de provedores
          terceiros (hospedagem, banco de dados, IA) podem afetar o serviço.
        </P>

        <H2>8. Limitação de responsabilidade</H2>
        <P>
          O NEXUS é fornecido "como está". Na máxima extensão permitida por lei, não nos
          responsabilizamos por danos indiretos, lucros cessantes ou perda de dados decorrentes do uso ou
          da impossibilidade de uso da plataforma, exceto nos casos de dolo ou culpa grave.
        </P>

        <H2>9. Encerramento</H2>
        <P>
          Você pode encerrar sua conta a qualquer momento. Podemos suspender ou encerrar contas que
          violem estes termos, mediante aviso quando razoavelmente possível.
        </P>

        <H2>10. Alterações destes termos</H2>
        <P>
          Podemos atualizar estes Termos periodicamente. Alterações relevantes serão comunicadas pelos
          canais de contato cadastrados ou por aviso na plataforma, com antecedência razoável.
        </P>

        <H2>11. Lei aplicável e foro</H2>
        <P>
          Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da
          comarca de [CIDADE/UF] para dirimir quaisquer controvérsias, com renúncia a qualquer outro,
          por mais privilegiado que seja.
        </P>

        <H2>12. Contato</H2>
        <P>
          Dúvidas sobre estes Termos podem ser enviadas para [E-MAIL DE CONTATO].
        </P>
      </main>
    </div>
  )
}
