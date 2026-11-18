/**
 * Terceirizados por empresa (R12): ranking de custo, seleção de empresas e KPIs da seleção.
 * Funções puras; valores monetários em centavos.
 */
import type { ColaboradorPlanilha } from "../import/types.ts";
import { subtotais, type Soma } from "./funcionarios.ts";

export type EmpresaSoma = { empresa: string } & Soma;

export type KpisSelecao = Soma & {
  /** Custo mensal médio por pessoa, em centavos (arredondado); 0 sem pessoas. */
  custoMedio: number;
  /** Quantidade de empresas consideradas. */
  empresas: number;
};

/** Terceirizados somados por empresa, do maior para o menor custo mensal (empate: ordem alfabética). */
export function rankingEmpresas(rows: ColaboradorPlanilha[]): EmpresaSoma[] {
  return [...subtotais(rows).porEmpresa].sort(
    (a, b) => b.custo - a.custo || a.empresa.localeCompare(b.empresa, "pt-BR", { sensitivity: "base" }),
  );
}

/** Seleção vazia significa "todas as empresas"; nomes que não existem mais são ignorados. */
export function empresasSelecionadas(todas: EmpresaSoma[], selecionadas: readonly string[]): EmpresaSoma[] {
  const nomes = new Set(selecionadas);
  const escolhidas = todas.filter((item) => nomes.has(item.empresa));
  return escolhidas.length === 0 ? todas : escolhidas;
}

export function kpisDaSelecao(escolhidas: EmpresaSoma[]): KpisSelecao {
  const soma = { quantidade: 0, remuneracao: 0, alimentacao: 0, custo: 0 };
  for (const item of escolhidas) {
    soma.quantidade += item.quantidade;
    soma.remuneracao += item.remuneracao;
    soma.alimentacao += item.alimentacao;
    soma.custo += item.custo;
  }
  const custoMedio = soma.quantidade === 0 ? 0 : Math.round(soma.custo / soma.quantidade);
  return { ...soma, custoMedio, empresas: escolhidas.length };
}

/** Participação (0 a 1) do custo da empresa no maior custo do ranking, para o comprimento das barras. */
export function proporcaoDoMaior(valor: number, ranking: EmpresaSoma[]): number {
  const maior = ranking.reduce((max, item) => Math.max(max, item.custo), 0);
  return maior <= 0 ? 0 : Math.min(1, Math.max(0, valor / maior));
}
