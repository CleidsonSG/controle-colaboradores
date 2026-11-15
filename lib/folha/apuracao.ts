/**
 * Apuração feita depois da importação: conta servidores por cargo (coluna "Descrição do cargo" do e-Cidade),
 * cruza com a tabela salarial e calcula custo e vagas livres a partir do teto da folha.
 * Valores monetários em centavos.
 */
import { normalizeHeader } from "../import/text.ts";
import type { CargoSalario, ServidorECidade } from "../import/types.ts";
import type { Folha } from "./simulacao.ts";

export const SEM_CARGO = "Sem cargo informado";

export type CargoApurado = {
  /** Nome normalizado, usado para cruzar com a tabela salarial. */
  chave: string;
  nome: string;
  /** Servidores ativos no cargo = vagas ocupadas. */
  servidores: number;
  /** Quantos deles têm a marca 282/16 (comissionados). */
  comissionados: number;
  /** Salário mensal em centavos (da tabela salarial); null = cargo fora da tabela ou sem valor. */
  salario: number | null;
  /** salário × servidores, em centavos; null sem salário. */
  custo: number | null;
  /** Quantas vagas cabem no saldo atual da folha; null sem salário ou sem teto. */
  livres: number | null;
  /** Cargo está na tabela salarial. */
  naTabela: boolean;
};

export type Apuracao = {
  cargos: CargoApurado[];
  /** Servidores sem data de rescisão (ou com rescisão futura). */
  servidoresAtivos: number;
  /** Servidores com rescisão até a data de referência: não ocupam vaga. */
  desligados: number;
  /** Soma de salário × servidores dos cargos com salário (centavos). */
  custoTotal: number;
  teto: number | null;
  /** teto − custoTotal; null sem teto. */
  saldo: number | null;
  cargosSemSalario: number;
  servidoresSemSalario: number;
};

export function chaveCargo(nome: string): string {
  return normalizeHeader(nome);
}

function hojeIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Servidor ocupa vaga se não tem rescisão ou se a rescisão é posterior à data de referência. */
export function estaAtivo(servidor: ServidorECidade, referencia: string): boolean {
  return !servidor.rescisao || servidor.rescisao > referencia;
}

export function apurar(
  servidores: ServidorECidade[],
  tabela: CargoSalario[] | null,
  teto: number | null,
  referencia: string = hojeIso(),
): Apuracao {
  const salarios = new Map<string, { nome: string; salario: number | null }>();
  for (const linha of tabela ?? []) {
    const chave = chaveCargo(linha.cargo);
    if (!salarios.has(chave)) {
      salarios.set(chave, { nome: linha.cargo, salario: linha.salario === null ? null : Math.round(linha.salario * 100) });
    }
  }

  const grupos = new Map<string, { nomes: Map<string, number>; servidores: number; comissionados: number }>();
  let desligados = 0;
  for (const servidor of servidores) {
    if (!estaAtivo(servidor, referencia)) {
      desligados += 1;
      continue;
    }
    const nome = servidor.descricaoCargo.trim() || SEM_CARGO;
    const chave = chaveCargo(nome);
    const grupo = grupos.get(chave) ?? { nomes: new Map(), servidores: 0, comissionados: 0 };
    grupo.servidores += 1;
    if (servidor.comissionado) grupo.comissionados += 1;
    grupo.nomes.set(nome, (grupo.nomes.get(nome) ?? 0) + 1);
    grupos.set(chave, grupo);
  }

  // Cargos da tabela salarial sem nenhum servidor também aparecem (0 ocupadas).
  for (const [chave, linha] of salarios) {
    if (!grupos.has(chave)) grupos.set(chave, { nomes: new Map([[linha.nome, 0]]), servidores: 0, comissionados: 0 });
  }

  let custoTotal = 0;
  const parciais = [...grupos].map(([chave, grupo]) => {
    // Nome exibido: a grafia mais frequente no arquivo.
    const nome = [...grupo.nomes].sort((a, b) => b[1] - a[1])[0][0];
    const tabelado = salarios.get(chave);
    const salario = tabelado?.salario ?? null;
    const custo = salario === null ? null : salario * grupo.servidores;
    if (custo !== null) custoTotal += custo;
    return { chave, nome, servidores: grupo.servidores, comissionados: grupo.comissionados, salario, custo, naTabela: Boolean(tabelado) };
  });

  const saldo = teto === null ? null : teto - custoTotal;
  const cargos: CargoApurado[] = parciais.map((cargo) => ({
    ...cargo,
    livres: saldo === null || cargo.salario === null || cargo.salario <= 0 ? null : Math.max(0, Math.floor(saldo / cargo.salario)),
  }));

  const semSalario = cargos.filter((cargo) => cargo.salario === null && cargo.servidores > 0);
  return {
    cargos,
    servidoresAtivos: servidores.length - desligados,
    desligados,
    custoTotal,
    teto,
    saldo,
    cargosSemSalario: semSalario.length,
    servidoresSemSalario: semSalario.reduce((soma, cargo) => soma + cargo.servidores, 0),
  };
}

/** Monta a folha do simulador de trocas a partir da apuração (só cargos com salário; vagas = ocupadas). */
export function folhaDaApuracao(apuracao: Apuracao): Folha | null {
  if (apuracao.teto === null) return null;
  const cargos = apuracao.cargos
    .filter((cargo) => cargo.salario !== null && cargo.salario > 0)
    .map((cargo) => ({ id: cargo.chave, nome: cargo.nome, salario: cargo.salario as number, vagas: cargo.servidores, ocupadas: cargo.servidores }));
  return cargos.length > 0 ? { teto: apuracao.teto, cargos } : null;
}
