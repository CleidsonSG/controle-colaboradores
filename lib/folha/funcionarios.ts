/**
 * Cálculos da tela Funcionários (planilha de cadastro): subtotais por origem e por empresa,
 * custo mensal por pessoa e conferência da remuneração dos terceirizados com a tabela salarial.
 * Valores monetários em centavos nos totais.
 */
import { normalizeHeader } from "../import/text.ts";
import type { CargoSalario, ColaboradorPlanilha } from "../import/types.ts";

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

export type ConferenciaFuncao = {
  funcao: string;
  pessoas: number;
  /** Valor da aba Terceirizado em centavos; null = função sem valor (ou fora da tabela). */
  valorTabela: number | null;
  /** Pessoas da função com remuneração diferente do valor da tabela (0 quando a tabela não tem valor). */
  divergentes: number;
};

export type Conferencia = {
  terceirizados: number;
  /** Pessoas cuja remuneração difere do valor da aba Terceirizado. */
  divergentes: number;
  /** Funções de terceirizados sem valor na aba Terceirizado (ausentes ou em branco). */
  funcoesSemValor: number;
  /** Detalhe por função, sem dados de pessoas. */
  funcoes: ConferenciaFuncao[];
};

/** Compara a remuneração dos terceirizados com a aba Terceirizado da tabela salarial (não afeta o teto dos comissionados). */
export function conferirTerceirizados(rows: ColaboradorPlanilha[], tabela: CargoSalario[]): Conferencia {
  const valores = new Map<string, number | null>();
  for (const linha of tabela) {
    if (linha.origem !== "Terceirizado") continue;
    const chave = normalizeHeader(linha.cargo);
    if (!valores.has(chave)) valores.set(chave, linha.salario === null ? null : centavos(linha.salario));
  }
  const grupos = new Map<string, ConferenciaFuncao>();
  let terceirizados = 0;
  for (const row of rows) {
    if (row.origem !== "Terceirizado") continue;
    terceirizados += 1;
    const chave = normalizeHeader(row.funcao);
    const valorTabela = valores.get(chave) ?? null;
    const grupo = grupos.get(chave) ?? { funcao: row.funcao.trim() || "Sem função informada", pessoas: 0, valorTabela, divergentes: 0 };
    grupo.pessoas += 1;
    if (valorTabela !== null && centavos(row.remuneracao) !== valorTabela) grupo.divergentes += 1;
    grupos.set(chave, grupo);
  }
  const funcoes = [...grupos.values()].sort((a, b) => b.pessoas - a.pessoas || a.funcao.localeCompare(b.funcao, "pt-BR", { sensitivity: "base" }));
  return {
    terceirizados,
    divergentes: funcoes.reduce((soma, f) => soma + f.divergentes, 0),
    funcoesSemValor: funcoes.filter((f) => f.valorTabela === null).length,
    funcoes,
  };
}
