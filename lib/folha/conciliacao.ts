/**
 * Conciliação da remuneração informada na planilha da empresa (CADASTRO FUNCIONAL) com a TABELA SALARIAL da Prefeitura.
 * A planilha prevalece: o custo continua pelo valor informado; a tabela é só referência de conferência.
 * Origem pela aba (Comissionado com a aba Comissionado, Terceirizado com a aba Terceirizado). Comparação em centavos.
 */
import { chaveFuncao } from "../import/tabela-salarial.ts";
import type { AjusteAplicado, CargoSalario, ColaboradorPlanilha, Origem, SituacaoRemuneracao } from "../import/types.ts";

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

export const MOTIVO_DIVERGE = "Valor diferente da referência";
export const MOTIVO_NAO_INFORMADA = "Remuneração não informada";
export const MOTIVO_OK = "Ok";
export const MOTIVO_SEM_REFERENCIA = "Sem referência";

/** "sem-referencia" (função sem valor na tabela) não conta como divergência, mas abre o detalhe para o admin informar o valor. */
export type SituacaoFuncao = "confere" | "diverge" | "nao-informada" | "sem-referencia";

export type PendenciaFuncao = {
  servidor: string;
  matricula: string;
  empresa: string;
  /** Centavos; null = função sem valor na tabela. */
  valorReferencia: number | null;
  /** Centavos; null = remuneração não informada. */
  valorInformado: number | null;
  motivo: string;
  /** Índice do registro no conjunto importado (identifica o ajuste de remuneração). */
  posicao: number;
  origem: Origem;
  linha: number;
  ajuste?: AjusteAplicado;
  /** Diverge ou não informada (com referência): conta como "precisa de atenção". */
  pendente: boolean;
};

export type FuncaoConferida = {
  origem: Origem;
  funcao: string;
  pessoas: number;
  /** Valor da tabela em centavos; null = sem referência. */
  valorReferencia: number | null;
  /** Valores informados distintos (centavos, crescente); mais de um = "Vários valores". */
  valoresInformados: number[];
  situacao: SituacaoFuncao;
  /** Pessoas que divergem ou estão sem remuneração, por nome. Vazio em função sem referência. */
  pendentes: PendenciaFuncao[];
  /** Todas as pessoas da função: pendentes primeiro, depois as demais, cada grupo por nome. */
  todas: PendenciaFuncao[];
};

function motivoDe(situacao: SituacaoRemuneracao): string {
  if (situacao === "confere") return MOTIVO_OK;
  if (situacao === "diverge") return MOTIVO_DIVERGE;
  if (situacao === "nao-informada") return MOTIVO_NAO_INFORMADA;
  return MOTIVO_SEM_REFERENCIA;
}

type Acumulador = { item: FuncaoConferida; informados: Set<number>; semReferencia: boolean; diverge: number; naoInformada: number };

/** Uma linha por função (e origem) para a tabela da conferência. Exige linhas já conciliadas, na ordem do conjunto importado (posição); linhas sem situação são ignoradas. */
export function agregarPorFuncao(rows: ColaboradorPlanilha[]): FuncaoConferida[] {
  const mapa = new Map<string, Acumulador>();
  for (const [posicao, row] of rows.entries()) {
    const situacao = row.situacaoRemuneracao;
    if (!situacao) continue;
    const chave = `${row.origem}|${chaveFuncao(row.funcao)}`;
    const acc = mapa.get(chave) ?? {
      item: { origem: row.origem, funcao: row.funcao.trim() || SEM_FUNCAO_CONCILIACAO, pessoas: 0, valorReferencia: null, valoresInformados: [], situacao: "confere" as SituacaoFuncao, pendentes: [], todas: [] },
      informados: new Set<number>(),
      semReferencia: false,
      diverge: 0,
      naoInformada: 0,
    };
    acc.item.pessoas += 1;
    const informado = row.remuneracao === null ? null : centavos(row.remuneracao);
    const referencia = row.remuneracaoTabela == null ? null : centavos(row.remuneracaoTabela);
    if (informado !== null) acc.informados.add(informado);
    if (referencia !== null) acc.item.valorReferencia = referencia;
    if (situacao === "sem-valor" || situacao === "fora-da-tabela") acc.semReferencia = true;
    if (situacao === "diverge") acc.diverge += 1;
    if (situacao === "nao-informada") acc.naoInformada += 1;
    acc.item.todas.push({
      servidor: row.servidor,
      matricula: row.matricula,
      empresa: row.empresaSecretaria.trim() || SEM_EMPRESA_CONCILIACAO,
      valorReferencia: referencia,
      valorInformado: informado,
      motivo: motivoDe(situacao),
      posicao,
      origem: row.origem,
      linha: row.linha,
      pendente: situacao !== "confere",
      ...(row.ajuste ? { ajuste: row.ajuste } : {}),
    });
    mapa.set(chave, acc);
  }
  const lista = [...mapa.values()].map((acc) => {
    const { item } = acc;
    item.valoresInformados = [...acc.informados].sort((a, b) => a - b);
    if (item.valorReferencia === null) {
      item.situacao = acc.semReferencia ? "sem-referencia" : "nao-informada";
    } else {
      item.situacao = acc.diverge > 0 ? "diverge" : acc.naoInformada > 0 ? "nao-informada" : "confere";
    }
    item.todas.sort((a, b) => Number(b.pendente) - Number(a.pendente) || porTexto(a.servidor, b.servidor));
    item.pendentes = item.todas.filter((p) => p.pendente);
    return item;
  });
  return lista.sort((a, b) => porTexto(a.funcao, b.funcao) || porTexto(a.origem, b.origem));
}

/** Funções com pessoas a conferir (divergência, sem remuneração ou sem referência na tabela): entram em "precisam de atenção" e no export de divergências. */
export const precisaAtencao = (funcao: FuncaoConferida) => funcao.situacao !== "confere";
