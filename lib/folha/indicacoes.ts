/**
 * Relatório de Indicações (restrito a administradores: o detalhe lista pessoas).
 * Agrupa os registros da planilha de cadastro por Indicação. Valores monetários em centavos.
 */
import { normalizeHeader, normalizeIndicacao, SEM_INDICACAO } from "../import/text.ts";
import type { ColaboradorPlanilha, Origem } from "../import/types.ts";
import type { Soma } from "./funcionarios.ts";

export type FiltroIndicacoes = {
  /** Vazio/ausente = todos. Textos comparados sem acento nem diferença de caixa. */
  indicacao?: string;
  origem?: Origem | "";
  empresa?: string;
  lotacao?: string;
  funcao?: string;
};

export type ResumoIndicacao = { indicacao: string } & Soma;

export type DetalheIndicacao = {
  indicacao: string;
  servidor: string;
  matricula: string;
  origem: Origem;
  empresa: string;
  lotacao: string;
  funcao: string;
  /** Centavos; 0 quando não informada. */
  remuneracao: number;
  alimentacao: number;
  custo: number;
};

export type OpcoesFiltroIndicacoes = {
  indicacoes: string[];
  origens: Origem[];
  empresas: string[];
  lotacoes: string[];
  funcoes: string[];
};

export type RelatorioIndicacoes = {
  /** Por indicação, do maior custo ao menor; "Sem indicação" sempre por último. */
  resumo: ResumoIndicacao[];
  total: Soma;
  /** Ordenado por indicação e servidor. */
  detalhe: DetalheIndicacao[];
  /** Valores disponíveis para os filtros, sobre todos os registros (sem aplicar o filtro). */
  opcoes: OpcoesFiltroIndicacoes;
};

const centavos = (valor: number | null) => Math.round((valor ?? 0) * 100);
const compara = (a: string, b: string) => a.localeCompare(b, "pt-BR", { sensitivity: "base" });
const igual = (valor: string, filtro: string | undefined) => !filtro || normalizeHeader(valor) === normalizeHeader(filtro);

function unicos(valores: string[]): string[] {
  return [...new Set(valores.filter((valor) => valor.trim() !== ""))].sort(compara);
}

export function filtrarIndicacoes(rows: ColaboradorPlanilha[], filtro: FiltroIndicacoes = {}): ColaboradorPlanilha[] {
  return rows.filter(
    (row) =>
      igual(normalizeIndicacao(row.indicacao), filtro.indicacao) &&
      (!filtro.origem || row.origem === filtro.origem) &&
      igual(row.empresaSecretaria, filtro.empresa) &&
      igual(row.lotacao, filtro.lotacao) &&
      igual(row.funcao, filtro.funcao),
  );
}

/** Linhas de texto com os filtros ativos, para os cabeçalhos das exportações (vazio = sem filtros). */
export function descreverFiltros(filtro: FiltroIndicacoes = {}): string[] {
  const itens: [string, string | undefined][] = [
    ["Indicação", filtro.indicacao],
    ["Origem", filtro.origem],
    ["Empresa/Secretaria", filtro.empresa],
    ["Lotação", filtro.lotacao],
    ["Função", filtro.funcao],
  ];
  return itens.filter(([, valor]) => Boolean(valor)).map(([rotulo, valor]) => `${rotulo}: ${valor}`);
}

function somaVazia(): Soma {
  return { quantidade: 0, remuneracao: 0, alimentacao: 0, custo: 0 };
}

function acumular(soma: Soma, linha: DetalheIndicacao): void {
  soma.quantidade += 1;
  soma.remuneracao += linha.remuneracao;
  soma.alimentacao += linha.alimentacao;
  soma.custo += linha.custo;
}

export function montarRelatorioIndicacoes(rows: ColaboradorPlanilha[], filtro: FiltroIndicacoes = {}): RelatorioIndicacoes {
  const detalhe: DetalheIndicacao[] = filtrarIndicacoes(rows, filtro).map((row) => {
    const remuneracao = centavos(row.remuneracao);
    const alimentacao = centavos(row.alimentacao);
    return {
      indicacao: normalizeIndicacao(row.indicacao),
      servidor: row.servidor,
      matricula: row.matricula,
      origem: row.origem,
      empresa: row.empresaSecretaria,
      lotacao: row.lotacao,
      funcao: row.funcao,
      remuneracao,
      alimentacao,
      custo: remuneracao + alimentacao,
    };
  });
  detalhe.sort((a, b) => compara(a.indicacao, b.indicacao) || compara(a.servidor, b.servidor));

  const total = somaVazia();
  const grupos = new Map<string, ResumoIndicacao>();
  for (const linha of detalhe) {
    acumular(total, linha);
    const grupo = grupos.get(linha.indicacao) ?? { indicacao: linha.indicacao, ...somaVazia() };
    acumular(grupo, linha);
    grupos.set(linha.indicacao, grupo);
  }
  const semIndicacao = (item: ResumoIndicacao) => (item.indicacao === SEM_INDICACAO ? 1 : 0);
  const resumo = [...grupos.values()].sort(
    (a, b) => semIndicacao(a) - semIndicacao(b) || b.custo - a.custo || b.quantidade - a.quantidade || compara(a.indicacao, b.indicacao),
  );

  return {
    resumo,
    total,
    detalhe,
    opcoes: {
      indicacoes: unicos(rows.map((row) => normalizeIndicacao(row.indicacao))),
      origens: [...new Set(rows.map((row) => row.origem))].sort(compara),
      empresas: unicos(rows.map((row) => row.empresaSecretaria)),
      lotacoes: unicos(rows.map((row) => row.lotacao)),
      funcoes: unicos(rows.map((row) => row.funcao)),
    },
  };
}
