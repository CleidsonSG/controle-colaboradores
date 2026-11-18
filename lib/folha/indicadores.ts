/**
 * Indicadores puros (valores monetários em centavos):
 * ocupação e custo por lotação e movimentação mensal (e-Cidade + tabela salarial) e custo com alimentação (planilha).
 */
import { normalizeHeader } from "../import/text.ts";
import type { CargoSalario, ColaboradorPlanilha, ServidorECidade } from "../import/types.ts";
import { chaveCargo, estaAtivo, hojeIso } from "./apuracao.ts";
import { subtotais, type Soma } from "./funcionarios.ts";

export const SEM_LOTACAO = "Sem lotação informada";

/* ---------- a) Ocupação e custo por lotação ---------- */

export type OcupacaoLotacao = {
  lotacao: string;
  /** Comissionados ativos (282/16) na lotação. */
  servidores: number;
  /** Σ salário da aba Comissionado da tabela salarial, em centavos. */
  custo: number;
  /** Servidores cuja função não tem salário na tabela (não entram no custo). */
  semSalario: number;
};

export type OcupacaoPorLotacao = {
  /** Ordenado por custo decrescente (desempate: servidores e nome). */
  lotacoes: OcupacaoLotacao[];
  servidores: number;
  custo: number;
  semSalario: number;
};

function mapaSalarios(tabela: CargoSalario[] | null): Map<string, number | null> {
  const salarios = new Map<string, number | null>();
  for (const linha of tabela ?? []) {
    if (linha.origem === "Terceirizado") continue;
    const chave = chaveCargo(linha.cargo);
    if (salarios.get(chave) == null) salarios.set(chave, linha.salario === null ? null : Math.round(linha.salario * 100));
  }
  return salarios;
}

export function ocupacaoPorLotacao(
  servidores: ServidorECidade[],
  tabela: CargoSalario[] | null,
  referencia: string = hojeIso(),
): OcupacaoPorLotacao {
  const salarios = mapaSalarios(tabela);
  const grupos = new Map<string, { nomes: Map<string, number> } & Omit<OcupacaoLotacao, "lotacao">>();
  for (const servidor of servidores) {
    if (!servidor.comissionado || !estaAtivo(servidor, referencia)) continue;
    const nome = servidor.lotacao.replace(/\s+/g, " ").trim() || SEM_LOTACAO;
    const chave = normalizeHeader(nome);
    const grupo = grupos.get(chave) ?? { nomes: new Map(), servidores: 0, custo: 0, semSalario: 0 };
    grupo.nomes.set(nome, (grupo.nomes.get(nome) ?? 0) + 1);
    grupo.servidores += 1;
    const salario = salarios.get(chaveCargo(servidor.descricaoCargo)) ?? null;
    if (salario === null) grupo.semSalario += 1;
    else grupo.custo += salario;
    grupos.set(chave, grupo);
  }
  const lotacoes = [...grupos.values()]
    .map(({ nomes, ...resto }) => ({ lotacao: [...nomes].sort((a, b) => b[1] - a[1])[0][0], ...resto }))
    .sort((a, b) => b.custo - a.custo || b.servidores - a.servidores || a.lotacao.localeCompare(b.lotacao, "pt-BR", { sensitivity: "base" }));
  return {
    lotacoes,
    servidores: lotacoes.reduce((soma, l) => soma + l.servidores, 0),
    custo: lotacoes.reduce((soma, l) => soma + l.custo, 0),
    semSalario: lotacoes.reduce((soma, l) => soma + l.semSalario, 0),
  };
}

/* ---------- b) Movimentação mensal ---------- */

export type MovimentoMes = {
  /** AAAA-MM. */
  mes: string;
  admissoes: number;
  rescisoes: number;
  /** admissões − rescisões. */
  saldo: number;
};

export type Movimentacao = {
  /** Todos os meses entre o primeiro e o último evento (meses sem movimento aparecem zerados). */
  meses: MovimentoMes[];
  totalAdmissoes: number;
  totalRescisoes: number;
  saldo: number;
  /** Menor e maior data (AAAA-MM-DD) de admissão ou rescisão; null sem nenhum evento. */
  periodo: { inicio: string; fim: string } | null;
};

const DATA_ISO = /^(\d{4})-(\d{2})-\d{2}$/;

function proximoMes(mes: string): string {
  const [ano, m] = mes.split("-").map(Number);
  return m === 12 ? `${ano + 1}-01` : `${ano}-${String(m + 1).padStart(2, "0")}`;
}

export function movimentacaoMensal(servidores: ServidorECidade[], opcoes: { somenteComissionados?: boolean } = {}): Movimentacao {
  const porMes = new Map<string, MovimentoMes>();
  const datas: string[] = [];
  const registrar = (data: string | null, campo: "admissoes" | "rescisoes") => {
    const partes = data ? DATA_ISO.exec(data) : null;
    if (!data || !partes) return;
    const mes = `${partes[1]}-${partes[2]}`;
    datas.push(data);
    const movimento = porMes.get(mes) ?? { mes, admissoes: 0, rescisoes: 0, saldo: 0 };
    movimento[campo] += 1;
    porMes.set(mes, movimento);
  };
  for (const servidor of servidores) {
    if (opcoes.somenteComissionados && !servidor.comissionado) continue;
    registrar(servidor.admissao, "admissoes");
    registrar(servidor.rescisao, "rescisoes");
  }
  if (datas.length === 0) return { meses: [], totalAdmissoes: 0, totalRescisoes: 0, saldo: 0, periodo: null };
  datas.sort();
  const inicio = datas[0];
  const fim = datas[datas.length - 1];
  const meses: MovimentoMes[] = [];
  for (let mes = inicio.slice(0, 7); mes <= fim.slice(0, 7); mes = proximoMes(mes)) {
    const movimento = porMes.get(mes) ?? { mes, admissoes: 0, rescisoes: 0, saldo: 0 };
    movimento.saldo = movimento.admissoes - movimento.rescisoes;
    meses.push(movimento);
  }
  const totalAdmissoes = meses.reduce((soma, m) => soma + m.admissoes, 0);
  const totalRescisoes = meses.reduce((soma, m) => soma + m.rescisoes, 0);
  return { meses, totalAdmissoes, totalRescisoes, saldo: totalAdmissoes - totalRescisoes, periodo: { inicio, fim } };
}

/* ---------- c) Custo com alimentação ---------- */

export type CustoAlimentacaoLinha = Soma & {
  /** Médias por pessoa em centavos (arredondadas; 0 sem pessoas). */
  mediaRemuneracao: number;
  mediaAlimentacao: number;
  mediaCusto: number;
};

export type CustoAlimentacao = {
  comissionados: CustoAlimentacaoLinha;
  terceirizados: CustoAlimentacaoLinha;
  total: CustoAlimentacaoLinha;
};

function comMedias(soma: Soma): CustoAlimentacaoLinha {
  const media = (valor: number) => (soma.quantidade === 0 ? 0 : Math.round(valor / soma.quantidade));
  return {
    ...soma,
    mediaRemuneracao: media(soma.remuneracao),
    mediaAlimentacao: media(soma.alimentacao),
    mediaCusto: media(soma.custo),
  };
}

export function custoAlimentacao(rows: ColaboradorPlanilha[]): CustoAlimentacao {
  const { comissionados, terceirizados, total } = subtotais(rows);
  return { comissionados: comMedias(comissionados), terceirizados: comMedias(terceirizados), total: comMedias(total) };
}
