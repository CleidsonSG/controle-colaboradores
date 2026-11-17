import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { ATUALIZADO_EM, ATUALIZADO_EM_TEXTO, CONTATO_ENCARREGADO, CONTROLADOR } from "@/lib/privacidade";

export const metadata: Metadata = { title: "Aviso de privacidade" };

function Secao({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-t pt-6">
      <h2 className="text-lg font-semibold tracking-tight">{titulo}</h2>
      <div className="flex flex-col gap-3 text-muted-foreground">{children}</div>
    </section>
  );
}

function Lista({ children }: { children: ReactNode }) {
  return <ul className="flex list-disc flex-col gap-1 pl-5">{children}</ul>;
}

function Forte({ children }: { children: ReactNode }) {
  return <strong className="font-medium text-foreground">{children}</strong>;
}

export default function PrivacidadePage() {
  return (
    <div className="min-h-dvh bg-background">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-10 sm:px-6" id="main-content">
        <Link className="inline-flex min-h-6 items-center gap-1.5 self-start text-sm text-primary underline-offset-4 hover:underline" href="/">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Voltar ao sistema
        </Link>
        <header className="flex flex-col gap-2">
          <span className="grid size-10 place-items-center rounded-md bg-secondary text-primary" aria-hidden="true">
            <ShieldCheck className="size-5" />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">Aviso de privacidade</h1>
          <p className="text-muted-foreground">
            Explicamos, em linguagem simples, como o sistema Controle Colaboradores trata dados pessoais, conforme a Lei Geral de Proteção de Dados
            (LGPD, Lei 13.709/2018). Atualizado em <time dateTime={ATUALIZADO_EM}>{ATUALIZADO_EM_TEXTO}</time>.
          </p>
        </header>

        <Secao titulo="Quem é o responsável">
          <p>
            O controlador dos dados é a <Forte>{CONTROLADOR}</Forte>. Contato do encarregado pelo tratamento de dados: <Forte>{CONTATO_ENCARREGADO}</Forte>.
          </p>
        </Secao>

        <Secao titulo="Quais dados são tratados">
          <p>
            <Forte>De quem usa o sistema:</Forte> nome e e-mail informados no pedido de acesso.
          </p>
          <p>
            <Forte>Dos servidores, importados dos arquivos da Prefeitura:</Forte>
          </p>
          <Lista>
            <li>matrícula e nome;</li>
            <li>lotação e função (cargo);</li>
            <li>remuneração e alimentação;</li>
            <li>indicação.</li>
          </Lista>
        </Secao>

        <Secao titulo="Para que usamos">
          <p>Para o controle de cargos e do orçamento da folha de pagamento. Os dados não são usados para nenhuma outra finalidade.</p>
        </Secao>

        <Secao titulo="Base legal">
          <p>
            O tratamento se apoia no art. 7º, III, e no art. 23 da LGPD: execução de políticas públicas e atendimento de obrigações do poder
            público, no exercício de suas competências.
          </p>
        </Secao>

        <Secao titulo="Onde os dados ficam e quem trata">
          <p>
            Com o acesso por login ativo, os dados ficam guardados na nuvem do <Forte>Supabase</Forte>, que atua como operador. Sem esse serviço
            configurado, os dados ficam só no banco local (IndexedDB) do navegador de quem importou e não são enviados a servidor algum.
          </p>
        </Secao>

        <Secao titulo="Quem pode acessar">
          <Lista>
            <li>Só usuários aprovados por um administrador veem os dados.</li>
            <li>Importar, limpar dados e alterar o teto da folha é permitido apenas a administradores.</li>
          </Lista>
        </Secao>

        <Secao titulo="Como protegemos">
          <p>
            Login com senha, acesso liberado só por um administrador (aprovação do pedido ou convite enviado por ele) e regras de segurança no banco de dados (RLS) que impedem a leitura e a
            alteração por quem não tem permissão.
          </p>
        </Secao>

        <Secao titulo="Por quanto tempo guardamos">
          <Lista>
            <li>
              Os dados importados ficam guardados só até a próxima importação do mesmo tipo (que os substitui) ou até um administrador usar
              “Limpar dados importados”.
            </li>
            <li>Contas recusadas ou bloqueadas podem ser excluídas a pedido.</li>
            <li>Os registros de acesso (logs) seguem a política do Supabase.</li>
            <li>
              No navegador ficam guardados apenas a sessão de login (para manter você conectado, apagada ao sair), a preferência de tema
              (claro ou escuro) e, sem o Supabase, os dados importados em IndexedDB local.
            </li>
          </Lista>
        </Secao>

        <Secao titulo="Seus direitos">
          <p>Conforme o art. 18 da LGPD, você pode pedir:</p>
          <Lista>
            <li>confirmação de que tratamos seus dados e acesso a eles;</li>
            <li>correção de dados incompletos, inexatos ou desatualizados;</li>
            <li>eliminação ou anonimização de dados desnecessários;</li>
            <li>informação sobre com quem os dados são compartilhados;</li>
            <li>revisão ou oposição ao tratamento, nos casos previstos em lei.</li>
          </Lista>
          <p>
            Para exercer qualquer direito, procure o encarregado em <Forte>{CONTATO_ENCARREGADO}</Forte>.
          </p>
        </Secao>
      </main>
    </div>
  );
}
