/**
 * Distribuição de vagas de cargos comissionados dentro de um teto fixo de folha de pagamento.
 * Valores monetários em centavos (inteiros) para evitar erro de arredondamento.
 */

export type Cargo = {
  id: string;
  nome: string;
  /** Salário mensal em centavos. */
  salario: number;
  /** Vagas criadas (autorizadas) para o cargo. */
  vagas: number;
  /** Vagas com pessoa nomeada. */
  ocupadas: number;
};

export type Folha = {
  /** Teto mensal da folha em centavos. */
  teto: number;
  cargos: Cargo[];
};

export type ResumoFolha = {
  teto: number;
  /** Custo de todas as vagas criadas (ocupadas + livres). */
  comprometido: number;
  /** Custo só das vagas ocupadas (o que é pago hoje). */
  emUso: number;
  /** Teto menos o comprometido. Negativo = folha estourada. */
  saldo: number;
  vagas: number;
  ocupadas: number;
  livres: number;
};

export type Troca = {
  /** Cargo que perde vagas (normalmente de salário maior). */
  origem: string;
  /** Cargo que ganha vagas (normalmente de salário menor). */
  destino: string;
  /** Vagas retiradas do cargo de origem. */
  reduzir: number;
};

export type ResultadoTroca =
  | {
      ok: true;
      /** Vagas que cabem no cargo de destino. */
      ganho: number;
      /** Vagas ocupadas que precisariam de exoneração para a troca. */
      exoneracoes: number;
      /** Valor liberado pela redução (centavos). */
      liberado: number;
      /** Saldo da folha depois da troca (centavos). */
      saldoDepois: number;
    }
  | { ok: false; motivo: string };

/** Valores fictícios para simulação, até o usuário informar os reais. */
export const FOLHA_SIMULADA: Folha = {
  teto: 10_000_000,
  cargos: [
    { id: "AS1", nome: "Assessor 1 (AS 1)", salario: 850_000, vagas: 2, ocupadas: 2 },
    { id: "AS2", nome: "Assessor 2 (AS 2)", salario: 680_000, vagas: 3, ocupadas: 3 },
    { id: "AS3", nome: "Assessor 3 (AS 3)", salario: 540_000, vagas: 4, ocupadas: 3 },
    { id: "AS4", nome: "Assessor 4 (AS 4)", salario: 420_000, vagas: 5, ocupadas: 5 },
    { id: "AS5", nome: "Assessor 5 (AS 5)", salario: 330_000, vagas: 3, ocupadas: 2 },
    { id: "AS6", nome: "Assessor 6 (AS 6)", salario: 260_000, vagas: 3, ocupadas: 3 },
  ],
};

export function custoCargo(cargo: Cargo): number {
  return cargo.salario * cargo.vagas;
}

export function resumir(folha: Folha): ResumoFolha {
  let comprometido = 0;
  let emUso = 0;
  let vagas = 0;
  let ocupadas = 0;
  for (const cargo of folha.cargos) {
    comprometido += custoCargo(cargo);
    emUso += cargo.salario * cargo.ocupadas;
    vagas += cargo.vagas;
    ocupadas += cargo.ocupadas;
  }
  return { teto: folha.teto, comprometido, emUso, saldo: folha.teto - comprometido, vagas, ocupadas, livres: vagas - ocupadas };
}

/** Quantas vagas a mais deste cargo cabem no saldo atual. */
export function vagasQueCabem(folha: Folha, cargoId: string): number {
  const cargo = folha.cargos.find((item) => item.id === cargoId);
  if (!cargo || cargo.salario <= 0) return 0;
  const { saldo } = resumir(folha);
  return saldo > 0 ? Math.floor(saldo / cargo.salario) : 0;
}

/** Calcula quantas vagas do destino cabem ao retirar vagas da origem, usando também o saldo já existente. */
export function simularTroca(folha: Folha, troca: Troca): ResultadoTroca {
  const origem = folha.cargos.find((item) => item.id === troca.origem);
  const destino = folha.cargos.find((item) => item.id === troca.destino);
  if (!origem || !destino) return { ok: false, motivo: "Escolha os dois cargos da troca." };
  if (origem.id === destino.id) return { ok: false, motivo: "Escolha cargos diferentes para reduzir e para aumentar." };
  if (!Number.isInteger(troca.reduzir) || troca.reduzir < 1) return { ok: false, motivo: "Informe ao menos 1 vaga para reduzir." };
  if (troca.reduzir > origem.vagas) {
    return { ok: false, motivo: `${origem.nome} tem só ${origem.vagas} ${origem.vagas === 1 ? "vaga" : "vagas"}.` };
  }
  if (destino.salario <= 0) return { ok: false, motivo: "O cargo de destino precisa ter salário maior que zero." };

  const saldoAntes = resumir(folha).saldo;
  const liberado = origem.salario * troca.reduzir;
  const disponivel = saldoAntes + liberado;
  const ganho = disponivel > 0 ? Math.floor(disponivel / destino.salario) : 0;
  const livresOrigem = origem.vagas - origem.ocupadas;
  const exoneracoes = Math.max(0, troca.reduzir - livresOrigem);
  return { ok: true, ganho, exoneracoes, liberado, saldoDepois: disponivel - ganho * destino.salario };
}

/** Aplica a troca simulada: retira vagas da origem (exonerando se preciso) e cria as vagas do destino. */
export function aplicarTroca(folha: Folha, troca: Troca): Folha {
  const resultado = simularTroca(folha, troca);
  if (!resultado.ok) return folha;
  return {
    ...folha,
    cargos: folha.cargos.map((cargo) => {
      if (cargo.id === troca.origem) {
        const vagas = cargo.vagas - troca.reduzir;
        return { ...cargo, vagas, ocupadas: Math.min(cargo.ocupadas, vagas) };
      }
      if (cargo.id === troca.destino) return { ...cargo, vagas: cargo.vagas + resultado.ganho };
      return cargo;
    }),
  };
}

/** Altera as vagas de um cargo. Não deixa estourar o teto nem ficar abaixo das vagas ocupadas. */
export function alterarVagas(folha: Folha, cargoId: string, delta: number): Folha {
  const cargo = folha.cargos.find((item) => item.id === cargoId);
  if (!cargo) return folha;
  const vagas = cargo.vagas + delta;
  if (vagas < cargo.ocupadas || vagas < 0) return folha;
  if (delta > 0 && resumir(folha).saldo < cargo.salario * delta) return folha;
  return { ...folha, cargos: folha.cargos.map((item) => (item.id === cargoId ? { ...item, vagas } : item)) };
}

/** Situação de ocupação de um cargo, sempre com texto (não só cor). */
export function situacaoCargo(cargo: Cargo): { rotulo: string; tom: "success" | "warning" | "neutral" } {
  if (cargo.vagas === 0) return { rotulo: "Sem vagas", tom: "warning" };
  const taxa = cargo.ocupadas / cargo.vagas;
  // Cargo lotado é situação normal (não erro): tom neutro.
  if (taxa >= 1) return { rotulo: "Lotado", tom: "neutral" };
  if (taxa >= 0.8) return { rotulo: "Quase lotado", tom: "warning" };
  return { rotulo: "Com vagas", tom: "success" };
}
