// Rascunho genérico de Política de Privacidade (alinhado à LGPD) — revisar
// com um advogado antes de publicar. Preencher [RAZÃO SOCIAL], [CNPJ] e os
// contatos reais antes do lançamento.

import Link from 'next/link'
import { Zap, ArrowLeft } from 'lucide-react'

export const metadata = {
  title: 'Política de Privacidade — NEXUS',
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-xl font-bold text-white mt-10 mb-3">{children}</h2>
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] text-zinc-400 leading-relaxed mb-3">{children}</p>
}

export default function PrivacidadePage() {
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
        <h1 className="text-3xl sm:text-4xl font-black text-white mb-2">Política de Privacidade</h1>
        <p className="text-zinc-600 text-sm mb-10">Última atualização: [DATA] · Versão 1.0 (rascunho) · Alinhada à LGPD (Lei 13.709/2018)</p>

        <P>
          Esta Política descreve como <strong className="text-zinc-300">[RAZÃO SOCIAL DA EMPRESA]</strong>,
          CNPJ <strong className="text-zinc-300">[CNPJ]</strong> ("NEXUS", "nós"), na qualidade de
          controladora de dados, coleta, usa, compartilha e protege as informações de quem utiliza a
          plataforma nexusaas.com.br.
        </P>

        <H2>1. Quais dados coletamos</H2>
        <ul className="list-disc list-outside ml-5 text-[15px] text-zinc-400 leading-relaxed mb-3 space-y-1.5">
          <li><strong className="text-zinc-300">Dados de cadastro:</strong> nome, e-mail, empresa, telefone.</li>
          <li><strong className="text-zinc-300">Dados de pagamento:</strong> processados diretamente pelo Stripe — o NEXUS não armazena números completos de cartão.</li>
          <li><strong className="text-zinc-300">Dados operacionais inseridos por você:</strong> clientes, leads, conversas de WhatsApp, dados financeiros, documentos gerados — usados para entregar o serviço contratado.</li>
          <li><strong className="text-zinc-300">Dados de uso:</strong> logs de acesso, ações na plataforma, métricas de uso dos recursos de IA, para fins de segurança e melhoria do produto.</li>
        </ul>

        <H2>2. Para que usamos os dados</H2>
        <P>
          Usamos os dados para: (i) viabilizar o funcionamento da plataforma e dos recursos contratados;
          (ii) processar pagamentos; (iii) prestar suporte; (iv) enviar comunicações sobre a conta e o
          serviço; (v) cumprir obrigações legais; e (vi) melhorar a plataforma. Não vendemos dados
          pessoais a terceiros.
        </P>

        <H2>3. Compartilhamento com terceiros (operadores)</H2>
        <P>
          Para operar o NEXUS, compartilhamos dados, na medida necessária, com os seguintes operadores:
        </P>
        <ul className="list-disc list-outside ml-5 text-[15px] text-zinc-400 leading-relaxed mb-3 space-y-1.5">
          <li><strong className="text-zinc-300">Supabase</strong> — banco de dados e autenticação;</li>
          <li><strong className="text-zinc-300">Stripe</strong> — processamento de pagamentos;</li>
          <li><strong className="text-zinc-300">Z-API</strong> — envio/recebimento de mensagens do WhatsApp;</li>
          <li><strong className="text-zinc-300">Anthropic (Claude) e OpenAI</strong> — geração de conteúdo e análises por inteligência artificial;</li>
          <li><strong className="text-zinc-300">Resend</strong> — envio de e-mails transacionais;</li>
          <li><strong className="text-zinc-300">Vercel</strong> — hospedagem da aplicação.</li>
        </ul>
        <P>
          Alguns desses provedores estão localizados fora do Brasil, o que pode implicar transferência
          internacional de dados. Essa transferência ocorre com base na execução do contrato e nas
          salvaguardas contratuais oferecidas por esses provedores.
        </P>

        <H2>4. Base legal (LGPD)</H2>
        <P>
          Tratamos seus dados com base na execução de contrato (para prestar o serviço contratado), no
          cumprimento de obrigação legal (ex: emissão fiscal), no legítimo interesse (segurança e
          prevenção a fraude) e, quando aplicável, no consentimento (ex: comunicações de marketing
          opcionais).
        </P>

        <H2>5. Retenção e exclusão</H2>
        <P>
          Mantemos seus dados enquanto sua conta estiver ativa e pelo período necessário para cumprir
          obrigações legais/contratuais após o encerramento. Você pode solicitar a exclusão dos seus
          dados a qualquer momento, observadas as retenções exigidas por lei (ex: dados fiscais).
        </P>

        <H2>6. Seus direitos como titular de dados</H2>
        <P>Nos termos da LGPD, você pode solicitar, em relação aos seus dados:</P>
        <ul className="list-disc list-outside ml-5 text-[15px] text-zinc-400 leading-relaxed mb-3 space-y-1.5">
          <li>Confirmação da existência de tratamento e acesso aos dados;</li>
          <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
          <li>Anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade com a lei;</li>
          <li>Portabilidade dos dados a outro fornecedor de serviço;</li>
          <li>Revogação do consentimento, quando aplicável;</li>
          <li>Informação sobre com quem seus dados foram compartilhados.</li>
        </ul>
        <P>
          Para exercer esses direitos, entre em contato pelo canal indicado na seção 9.
        </P>

        <H2>7. Segurança da informação</H2>
        <P>
          Adotamos medidas técnicas e organizacionais para proteger os dados, incluindo criptografia de
          credenciais sensíveis, controle de acesso por empresa (multi-tenant) e autenticação. Nenhum
          sistema é 100% imune a incidentes — em caso de incidente de segurança relevante, comunicaremos
          os titulares e a Autoridade Nacional de Proteção de Dados (ANPD) conforme exigido por lei.
        </P>

        <H2>8. Cookies</H2>
        <P>
          Utilizamos cookies essenciais para autenticação e funcionamento da plataforma, e podemos usar
          cookies de análise para entender o uso do produto. Você pode gerenciar cookies nas
          configurações do seu navegador.
        </P>

        <H2>9. Contato e encarregado (DPO)</H2>
        <P>
          Para exercer seus direitos ou esclarecer dúvidas sobre esta Política, contate nosso encarregado
          de proteção de dados pelo e-mail [E-MAIL DO DPO/PRIVACIDADE].
        </P>

        <H2>10. Alterações desta política</H2>
        <P>
          Esta Política pode ser atualizada periodicamente. A versão vigente estará sempre disponível
          nesta página, com a data da última atualização indicada no topo.
        </P>
      </main>
    </div>
  )
}
