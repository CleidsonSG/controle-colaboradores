/** Histórico do funcionário: lógica pura (sem dados pessoais reais nem acesso a banco). */
import type { ColaboradorPlanilha, Competencia, RetratoFuncional } from "../import/types.ts";

export type RegistroHistorico = { competencia: string; cargo: string; lotacao: string };

export type TipoMudanca = "inicio" | "nenhuma" | "cargo" | "lotacao" | "cargo-lotacao";

export type LinhaHistorico = {
  /** "mm/aaaa" */
  periodo: string;
  competencia: string;
  cargo: string;
  lotacao: string;
  tipo: TipoMudanca;
  /** Texto da coluna Mudança. */
  mudanca: string;
  /** Ex.: "após 2 meses sem registro"; vazio quando não há lacuna. */
  nota: string;
  /** Ex.: "Cargo: de X para Y"; vazio quando não há mudança. */
  detalhe: string;
};

export type ResumoHistorico = {
  mesesRegistrados: number;
  cargosOcupados: number;
  mudancasCargo: number;
  mudancasLotacao: number;
};

export type Historico = {
  resumo: ResumoHistorico;
  atual: { cargo: string; lotacao: string; periodo: string } | null;
  /** Da competência mais recente para a mais antiga. */
  linhas: LinhaHistorico[];
};

/** Maiúsculas, sem acento e com espaços colapsados. */
export function normalizarTexto(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

/** "aaaa-mm" -> "mm/aaaa". */
export function periodoBr(competencia: string): string {
  const [ano = "", mes = ""] = competencia.split("-");
  return `${mes}/${ano}`;
}

/** Índice absoluto do mês, para medir lacunas. */
function indiceMes(competencia: string): number {
  const [ano = "0", mes = "0"] = competencia.split("-");
  return Number(ano) * 12 + Number(mes);
}

/** Primeira letra do primeiro e do último nome (ignora termos numéricos); um só nome gera uma letra. */
export function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter((parte) => /^\p{L}/u.test(parte));
  if (partes.length === 0) return "";
  const primeira = partes[0]!.charAt(0);
  const ultima = partes.length > 1 ? partes[partes.length - 1]!.charAt(0) : "";
  return `${primeira}${ultima}`.toLocaleUpperCase("pt-BR");
}

export function calcularHistorico(registros: RegistroHistorico[]): Historico {
  // Uma linha por competência (a última informada vence) e ordem cronológica.
  const porCompetencia = new Map<string, RegistroHistorico>();
  for (const registro of registros) porCompetencia.set(registro.competencia, registro);
  const ordenados = [...porCompetencia.values()].sort((a, b) => a.competencia.localeCompare(b.competencia));

  const resumo: ResumoHistorico = { mesesRegistrados: ordenados.length, cargosOcupados: 0, mudancasCargo: 0, mudancasLotacao: 0 };
  resumo.cargosOcupados = new Set(ordenados.map((item) => normalizarTexto(item.cargo))).size;

  const linhas: LinhaHistorico[] = ordenados.map((item, indice) => {
    const anterior = indice > 0 ? ordenados[indice - 1]! : null;
    let tipo: TipoMudanca = "inicio";
    let nota = "";
    let detalhe = "";
    if (anterior) {
      const cargoMudou = normalizarTexto(anterior.cargo) !== normalizarTexto(item.cargo);
      const lotacaoMudou = normalizarTexto(anterior.lotacao) !== normalizarTexto(item.lotacao);
      if (cargoMudou) resumo.mudancasCargo += 1;
      if (lotacaoMudou) resumo.mudancasLotacao += 1;
      tipo = cargoMudou && lotacaoMudou ? "cargo-lotacao" : cargoMudou ? "cargo" : lotacaoMudou ? "lotacao" : "nenhuma";
      const partes: string[] = [];
      if (cargoMudou) partes.push(`Cargo: de ${anterior.cargo} para ${item.cargo}`);
      if (lotacaoMudou) partes.push(`Lotação: de ${anterior.lotacao} para ${item.lotacao}`);
      detalhe = partes.join("; ");
      const faltantes = indiceMes(item.competencia) - indiceMes(anterior.competencia) - 1;
      if (faltantes > 0) nota = `após ${faltantes} ${faltantes === 1 ? "mês" : "meses"} sem registro`;
    }
    const mudanca =
      tipo === "inicio" ? "Início do registro" : tipo === "nenhuma" ? "Sem mudança" : tipo === "cargo" ? "Cargo" : tipo === "lotacao" ? "Lotação" : "Cargo e lotação";
    return { periodo: periodoBr(item.competencia), competencia: item.competencia, cargo: item.cargo, lotacao: item.lotacao, tipo, mudanca, nota, detalhe };
  });

  const ultimo = ordenados[ordenados.length - 1];
  return {
    resumo,
    atual: ultimo ? { cargo: ultimo.cargo, lotacao: ultimo.lotacao, periodo: periodoBr(ultimo.competencia) } : null,
    linhas: linhas.reverse(),
  };
}

// ---------------------------------------------------------------------------
// Retratos por competência (fatia 3). Identidade e validações em docs/HISTORICO-DADOS.md §2.

export const MAX_RETRATOS = 50_000;
export const MSG_COMPETENCIA_VAZIA = "Informe a competência (mês/ano) deste cadastro.";
export const MSG_COMPETENCIA_FUTURA = "A competência não pode ser posterior ao mês atual.";
const FUSO = "America/Sao_Paulo";

/** Minúsculas, sem acento, só letras e números separados por um espaço. */
export function normalizarIdentidade(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** `m:<matrícula>` (zeros à esquerda preservados) ou `n:<nome>|<empresa>` normalizados. */
export function chaveIdentidadeBase(pessoa: Pick<ColaboradorPlanilha, "matricula" | "servidor" | "empresaSecretaria">): string {
  const matricula = pessoa.matricula.replace(/\s+/g, "");
  if (matricula) return `m:${matricula}`;
  return `n:${normalizarIdentidade(pessoa.servidor)}|${normalizarIdentidade(pessoa.empresaSecretaria)}`;
}

/** Um retrato por registro, na ordem do arquivo. Chave repetida: 2ª em diante com "#2", "#3"… e todas marcadas como possível duplicidade. */
export function buildRetratos(records: ColaboradorPlanilha[]): Omit<RetratoFuncional, "competencia">[] {
  const bases = records.map(chaveIdentidadeBase);
  const total = new Map<string, number>();
  for (const base of bases) total.set(base, (total.get(base) ?? 0) + 1);
  const vistos = new Map<string, number>();
  return records.map((record, index) => {
    const base = bases[index]!;
    const ordem = (vistos.get(base) ?? 0) + 1;
    vistos.set(base, ordem);
    return {
      chaveIdentidade: ordem === 1 ? base : `${base}#${ordem}`,
      origem: record.origem,
      matricula: record.matricula.replace(/\s+/g, ""),
      nome: record.servidor.trim(),
      empresaSecretaria: record.empresaSecretaria.trim(),
      funcao: record.funcao.trim(),
      lotacao: record.lotacao.trim(),
      possivelDuplicidade: record.possivelDuplicidade || (total.get(base) ?? 0) > 1,
    };
  });
}

/** Mês atual ("AAAA-MM") no fuso de São Paulo. */
export function competenciaAtual(agora: Date = new Date()): Competencia {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit" }).format(agora).slice(0, 7);
}

/** Mensagem de erro (V6/V7) ou null quando a competência é válida. */
export function validarCompetencia(competencia: string, agora: Date = new Date()): string | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(competencia) || competencia < "2000-01") return MSG_COMPETENCIA_VAZIA;
  if (competencia > competenciaAtual(agora)) return MSG_COMPETENCIA_FUTURA;
  return null;
}

/** Mesmas regras da RPC `substituir_historico_competencia`: competência válida, até 50 000 itens e chaves únicas. Lança Error. */
export function validarSubstituicao(competencia: string, retratos: Omit<RetratoFuncional, "competencia">[], agora: Date = new Date()): void {
  const erro = validarCompetencia(competencia, agora);
  if (erro) throw new Error(erro);
  if (retratos.length > MAX_RETRATOS) throw new Error("Arquivo grande demais para o histórico.");
  const chaves = new Set(retratos.map((retrato) => retrato.chaveIdentidade));
  if (chaves.size !== retratos.length) throw new Error("Há pessoas repetidas no histórico desta competência.");
}

/** "2026-11" ↔ "2026-11-01" (coluna date do banco). */
export const competenciaParaData = (competencia: Competencia) => `${competencia}-01`;
export const dataParaCompetencia = (data: string): Competencia => data.slice(0, 7);

/** Retratos (competência desc ou não) → registros do cálculo do histórico. */
export const registrosDeRetratos = (retratos: RetratoFuncional[]): RegistroHistorico[] =>
  retratos.map((retrato) => ({ competencia: retrato.competencia, cargo: retrato.funcao, lotacao: retrato.lotacao }));
