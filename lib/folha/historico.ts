/** Histórico do funcionário: lógica pura (sem dados pessoais reais nem acesso a banco). */

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
