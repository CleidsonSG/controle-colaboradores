"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { FolhaView } from "@/components/folha-view";
import { useDadosImportados } from "@/components/use-dados-importados";
import { apurar, folhaDaApuracao } from "@/lib/folha/apuracao";
import { FOLHA_SIMULADA } from "@/lib/folha/simulacao";

/** Usa os dados importados quando há e-Cidade, tabela salarial e teto; senão, valores fictícios explicando o que falta. */
export default function Orcamento() {
  const { dados } = useDadosImportados();
  if (dados.status === "loading") {
    return (
      <div className="flex flex-col gap-6" role="status" aria-label="Carregando o orçamento">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (dados.status === "ready" && dados.ecidade && dados.salarial && dados.settings.tetoFolha !== null) {
    const folha = folhaDaApuracao(apurar(dados.ecidade.records, dados.salarial.records, dados.settings.tetoFolha));
    if (folha) return <FolhaView inicial={folha} origem="real" />;
  }
  const faltando: string[] = [];
  if (dados.status === "ready") {
    if (!dados.ecidade) faltando.push("o relatório do e-Cidade");
    if (!dados.salarial) faltando.push("a tabela salarial");
    if (dados.settings.tetoFolha === null) faltando.push("o teto da folha (no painel de cargos)");
  }
  const motivo =
    dados.status === "error"
      ? "Não foi possível ler os dados importados."
      : faltando.length > 0
        ? `Para simular com os dados reais, falta ${faltando.join(", ").replace(/, ([^,]*)$/, " e $1")}.`
        : "Nenhum cargo da tabela salarial tem salário válido.";
  return <FolhaView inicial={FOLHA_SIMULADA} origem="simulada" motivo={motivo} />;
}
