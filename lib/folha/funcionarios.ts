/**
 * Cálculos da tela Funcionários (planilha de cadastro): subtotais por origem e por empresa,
 * e custo mensal por pessoa. O custo usa sempre a remuneração informada na planilha da empresa; a conferência com a tabela salarial fica em conciliacao.ts.
 * Valores monetários em centavos nos totais.
 */
import type { ColaboradorPlanilha } from "../import/types.ts";

export type Soma = {
  quantidade: number;
  remuneracao: number;
  alimentacao: number;
  /** remuneração + alimentação. */
  custo: number;
};

export type Subtotais = {
  comissionados: Soma;
  terceirizados: Soma;
  total: Soma;
  /** Só terceirizados, por Empresa/Secretaria, em ordem alfabética. */
  porEmpresa: ({ empresa: string } & Soma)[];
};

export const SEM_EMPRESA = "Sem empresa informada";

const centavos = (valor: number | null) => Math.round((valor ?? 0) * 100);

/** Custo mensal da pessoa (reais) = remuneração + alimentação; null quando nenhum dos dois foi informado. */
export function custoMensal(row: Pick<ColaboradorPlanilha, "remuneracao" | "alimentacao">): number | null {
  if (row.remuneracao === null && row.alimentacao === null) return null;
  return (centavos(row.remuneracao) + centavos(row.alimentacao)) / 100;
}

function vazia(): Soma {
  return { quantidade: 0, remuneracao: 0, alimentacao: 0, custo: 0 };
}

function somar(soma: Soma, row: ColaboradorPlanilha): void {
  const remuneracao = centavos(row.remuneracao);
  const alimentacao = centavos(row.alimentacao);
  // Linhas com R$ 0,00 (ou sem valor) contam na quantidade.
  soma.quantidade += 1;
  soma.remuneracao += remuneracao;
  soma.alimentacao += alimentacao;
  soma.custo += remuneracao + alimentacao;
}

export function subtotais(rows: ColaboradorPlanilha[]): Subtotais {
  const resultado: Subtotais = { comissionados: vazia(), terceirizados: vazia(), total: vazia(), porEmpresa: [] };
  const empresas = new Map<string, Soma>();
  for (const row of rows) {
    somar(resultado.total, row);
    if (row.origem === "Comissionado") {
      somar(resultado.comissionados, row);
      continue;
    }
    somar(resultado.terceirizados, row);
    const nome = row.empresaSecretaria.trim() || SEM_EMPRESA;
    const soma = empresas.get(nome) ?? vazia();
    somar(soma, row);
    empresas.set(nome, soma);
  }
  resultado.porEmpresa = [...empresas]
    .map(([empresa, soma]) => ({ empresa, ...soma }))
    .sort((a, b) => a.empresa.localeCompare(b.empresa, "pt-BR", { sensitivity: "base" }));
  return resultado;
}
