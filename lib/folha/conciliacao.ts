/**
 * Conciliação da remuneração informada na planilha da empresa (CADASTRO FUNCIONAL) com a TABELA SALARIAL da Prefeitura.
 * A planilha prevalece: o custo continua pelo valor informado; a tabela é só referência de conferência.
 * Origem pela aba (Comissionado com a aba Comissionado, Terceirizado com a aba Terceirizado). Comparação em centavos.
 */
import { chaveFuncao } from "../import/tabela-salarial.ts";
import type { CargoSalario, ColaboradorPlanilha, Origem, SituacaoRemuneracao } from "../import/types.ts";

export const SEM_EMPRESA_CONCILIACAO = "Sem empresa informada";
export const SEM_FUNCAO_CONCILIACAO = "Sem função informada";

const centavos = (valor: number) => Math.round(valor * 100);

export type GrupoConciliacao = {
  origem: Origem;
  empresa: string;
  funcao: string;
  /** Lotações das pessoas do grupo, sem repetição e em ordem alfabética. */
  lotacoes: string[];
  pessoas: number;
  situacao: SituacaoRemuneracao;
  /** Valor da tabela em centavos; null = função sem valor ou fora da tabela. */
  valorTabela: number | null;
  /** Valor informado em centavos (igual para todas as pessoas do grupo); null = não informado. */
  valorInformado: number | null;
  /** informado − tabela, por pessoa (centavos); null quando falta um dos dois valores. */
  diferencaUnitaria: number | null;
  /** diferença unitária × pessoas (centavos); null quando falta um dos dois valores. */
  diferencaMensal: number | null;
};

export type ResumoConciliacao = {
  pessoas: number;
  porSituacao: Record<SituacaoRemuneracao, number>;
  /** Soma de (informado − tabela) das pessoas com os dois valores, em centavos. */
  diferencaTotal: number;
  /** Funções (por origem) sem valor na tabela ou fora dela, entre as pessoas com remuneração informada. */
  funcoesSemReferencia: number;
};

export type Conciliacao = {
  rows: ColaboradorPlanilha[];
  /** Agrupado por origem, empresa, função e valor informado; sem dados de pessoas. */
  grupos: GrupoConciliacao[];
  resumo: ResumoConciliacao;
};

type ValoresPorOrigem = Map<string, number | null>;

/** Valores da tabela por origem; linhas sem origem (CSV ou aba única) servem às duas. Primeiro valor não vazio vence. */
function indexarTabela(tabela: CargoSalario[]): Record<Origem | "qualquer", ValoresPorOrigem> {
  const indice: Record<Origem | "qualquer", ValoresPorOrigem> = { Comissionado: new Map(), Terceirizado: new Map(), qualquer: new Map() };
  for (const linha of tabela) {
    const mapa = indice[linha.origem ?? "qualquer"];
    const chave = chaveFuncao(linha.cargo);
    if (mapa.get(chave) != null) continue;
    mapa.set(chave, linha.salario === null ? null : centavos(linha.salario));
  }
  return indice;
}

function buscar(indice: Record<Origem | "qualquer", ValoresPorOrigem>, origem: Origem, chave: string): number | null | undefined {
  const mapa = indice[origem].has(chave) ? indice[origem] : indice.qualquer;
  return mapa.get(chave);
}

function situacaoDe(informado: number | null, tabela: number | null | undefined): SituacaoRemuneracao {
  if (informado === null) return "nao-informada";
  if (tabela === undefined) return "fora-da-tabela";
  if (tabela === null) return "sem-valor";
  return informado === tabela ? "confere" : "diverge";
}

const porTexto = (a: string, b: string) => a.localeCompare(b, "pt-BR", { sensitivity: "base" });

/** Enriquece cada linha com o valor da tabela e a situação, e resume por origem, empresa e função. Não altera remuneracao. */
export function conciliarRemuneracao(rows: ColaboradorPlanilha[], tabela: CargoSalario[]): Conciliacao {
  const indice = indexarTabela(tabela);
  const grupos = new Map<string, GrupoConciliacao>();
  const porSituacao: Record<SituacaoRemuneracao, number> = { confere: 0, diverge: 0, "sem-valor": 0, "fora-da-tabela": 0, "nao-informada": 0 };
  const semReferencia = new Set<string>();
  let diferencaTotal = 0;

  const enriquecidas = rows.map((row) => {
    const chave = chaveFuncao(row.funcao);
    const referencia = buscar(indice, row.origem, chave);
    const informado = row.remuneracao === null ? null : centavos(row.remuneracao);
    const situacao = situacaoDe(informado, referencia);
    porSituacao[situacao] += 1;
    if (informado !== null && (situacao === "sem-valor" || situacao === "fora-da-tabela")) semReferencia.add(`${row.origem}|${chave}`);
    const valorTabela = typeof referencia === "number" ? referencia : null;
    const diferenca = informado !== null && valorTabela !== null ? informado - valorTabela : null;
    if (diferenca !== null) diferencaTotal += diferenca;

    const empresa = row.empresaSecretaria.trim() || SEM_EMPRESA_CONCILIACAO;
    const chaveGrupo = `${row.origem}|${empresa}|${chave}|${informado ?? "x"}`;
    const grupo = grupos.get(chaveGrupo) ?? {
      origem: row.origem,
      empresa,
      funcao: row.funcao.trim() || SEM_FUNCAO_CONCILIACAO,
      lotacoes: [],
      pessoas: 0,
      situacao,
      valorTabela,
      valorInformado: informado,
      diferencaUnitaria: diferenca,
      diferencaMensal: 0,
    };
    grupo.pessoas += 1;
    grupo.diferencaMensal = diferenca === null ? null : diferenca * grupo.pessoas;
    const lotacao = row.lotacao.trim();
    if (lotacao && !grupo.lotacoes.includes(lotacao)) grupo.lotacoes.push(lotacao);
    grupos.set(chaveGrupo, grupo);

    return { ...row, remuneracaoTabela: valorTabela === null ? null : valorTabela / 100, situacaoRemuneracao: situacao };
  });

  const lista = [...grupos.values()];
  for (const grupo of lista) grupo.lotacoes.sort(porTexto);
  lista.sort((a, b) => porTexto(a.origem, b.origem) || porTexto(a.empresa, b.empresa) || porTexto(a.funcao, b.funcao));
  return {
    rows: enriquecidas,
    grupos: lista,
    resumo: { pessoas: rows.length, porSituacao, diferencaTotal, funcoesSemReferencia: semReferencia.size },
  };
}

/** Reconcilia as linhas com a tabela (idempotente): usada na importação e na leitura de dados salvos antes desta versão, que não têm os campos. Sem tabela, devolve as linhas como estão. */
export function garantirConciliacao(rows: ColaboradorPlanilha[], tabela: CargoSalario[] | null): ColaboradorPlanilha[] {
  if (!tabela) return rows;
  return conciliarRemuneracao(rows, tabela).rows;
}

export const DIVERGENCIAS_CSV_HEADERS = ["Empresa", "Origem", "Função", "Lotação", "Pessoas", "Valor tabela", "Valor informado", "Diferença unitária", "Diferença mensal"];

const decimal = (centavosValor: number | null) => (centavosValor === null ? "" : (centavosValor / 100).toFixed(2).replace(".", ","));

/** Linhas do CSV de divergências: só os grupos que divergem, agregados e sem nome, matrícula ou CPF. */
export function divergenciasParaCsv(grupos: GrupoConciliacao[]): string[][] {
  return grupos
    .filter((grupo) => grupo.situacao === "diverge")
    .map((grupo) => [
      grupo.empresa,
      grupo.origem,
      grupo.funcao,
      grupo.lotacoes.join(" / "),
      String(grupo.pessoas),
      decimal(grupo.valorTabela),
      decimal(grupo.valorInformado),
      decimal(grupo.diferencaUnitaria),
      decimal(grupo.diferencaMensal),
    ]);
}
