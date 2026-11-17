/**
 * Apuração feita depois da importação: conta servidores comissionados (marca 282/16) por função (coluna "Descrição do cargo" do e-Cidade),
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
  /** Servidores comissionados ativos na função = vagas ocupadas. */
  servidores: number;
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
  /** Comissionados (282/16) sem data de rescisão (ou com rescisão futura). */
  servidoresAtivos: number;
  /** Comissionados com rescisão até a data de referência: não ocupam vaga. */
  desligados: number;
  /** Ativos sem a marca 282/16 (estagiários, contratos etc.): fora da contagem. */
  foraDaContagem: number;
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

export function hojeIso(): string {
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
  // O Painel usa a aba Comissionado da tabela salarial; a aba Terceirizado não entra aqui.
  for (const linha of tabela ?? []) {
    if (linha.origem === "Terceirizado") continue;
    const chave = chaveCargo(linha.cargo);
    if (!salarios.has(chave)) {
      salarios.set(chave, { nome: linha.cargo, salario: linha.salario === null ? null : Math.round(linha.salario * 100) });
    }
  }

  const grupos = new Map<string, { nomes: Map<string, number>; servidores: number }>();
  let desligados = 0;
  let foraDaContagem = 0;
  for (const servidor of servidores) {
    if (!servidor.comissionado) {
      if (estaAtivo(servidor, referencia)) foraDaContagem += 1;
      continue;
    }
    if (!estaAtivo(servidor, referencia)) {
      desligados += 1;
      continue;
    }
    const nome = servidor.descricaoCargo.trim() || SEM_CARGO;
    const chave = chaveCargo(nome);
    const grupo = grupos.get(chave) ?? { nomes: new Map(), servidores: 0 };
    grupo.servidores += 1;
    grupo.nomes.set(nome, (grupo.nomes.get(nome) ?? 0) + 1);
    grupos.set(chave, grupo);
  }

  // Cargos da tabela salarial sem nenhum servidor também aparecem (0 ocupadas).
  for (const [chave, linha] of salarios) {
    if (!grupos.has(chave)) grupos.set(chave, { nomes: new Map([[linha.nome, 0]]), servidores: 0 });
  }

  let custoTotal = 0;
  const parciais = [...grupos].map(([chave, grupo]) => {
    // Nome exibido: a grafia mais frequente no arquivo.
    const nome = [...grupo.nomes].sort((a, b) => b[1] - a[1])[0][0];
    const tabelado = salarios.get(chave);
    const salario = tabelado?.salario ?? null;
    const custo = salario === null ? null : salario * grupo.servidores;
    if (custo !== null) custoTotal += custo;
    return { chave, nome, servidores: grupo.servidores, salario, custo, naTabela: Boolean(tabelado) };
  });

  const saldo = teto === null ? null : teto - custoTotal;
  const cargos: CargoApurado[] = parciais.map((cargo) => ({
    ...cargo,
    livres: saldo === null || cargo.salario === null || cargo.salario <= 0 ? null : Math.max(0, Math.floor(saldo / cargo.salario)),
  }));

  const semSalario = cargos.filter((cargo) => cargo.salario === null && cargo.servidores > 0);
  return {
    cargos,
    servidoresAtivos: [...grupos.values()].reduce((soma, grupo) => soma + grupo.servidores, 0),
    desligados,
    foraDaContagem,
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
