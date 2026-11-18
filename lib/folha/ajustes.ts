/**
 * Ajuste de remuneração feito no sistema (R7, decisão P2): vale só para a importação do Cadastro funcional
 * identificada por `importedAt`; reimportar invalida os ajustes anteriores. Lógica pura (sem acesso a banco).
 */
import type { AjusteRemuneracao, ColaboradorPlanilha, NovoAjuste, StoredDataset } from "../import/types.ts";

export const VALOR_MAXIMO_CENTAVOS = 100_000_000;
export const VALOR_CONFIRMACAO_CENTAVOS = 10_000_000;

export const MSG_VALOR_VAZIO = "Informe o valor da remuneração.";
export const MSG_VALOR_INVALIDO = "Use um valor em reais, por exemplo 1.850,00.";
export const MSG_VALOR_CONFIRMAR = "Valor acima de R$ 100.000,00. Confira e salve de novo para confirmar.";
export const MSG_VALOR_MAXIMO = "O valor máximo é R$ 1.000.000,00.";
export const MSG_SO_ADMIN = "Só administradores podem alterar valores.";
export const MSG_REIMPORTADO = "O cadastro funcional foi reimportado. Atualize a tela e tente de novo.";
export const MSG_REGISTRO_AUSENTE = "Registro não encontrado no cadastro funcional atual.";
export const MSG_FALHA_SALVAR = "Não foi possível salvar. Tente de novo.";

/** Mesmo instante, ainda que o texto venha formatado de outro jeito (ex.: "+00:00" do Postgres). */
export function mesmoInstante(a: string, b: string): boolean {
  const ta = Date.parse(a);
  return !Number.isNaN(ta) && ta === Date.parse(b);
}

/** "1.850,00", "1850", "1850,5" ou "R$ 1.850,00" → centavos; null se não for um valor em reais pt-BR. */
export function parseValorBr(texto: string): number | null {
  const limpo = texto.replace(/R\$/i, "").replace(/\s/g, "");
  if (!/^(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?$/.test(limpo)) return null;
  const [inteiro = "0", decimais = ""] = limpo.replace(/\./g, "").split(",");
  return Number(inteiro) * 100 + Number(decimais.padEnd(2, "0"));
}

export type ValidacaoValor = { ok: true; centavos: number } | { ok: false; mensagem: string; confirmar?: number };

/**
 * V1–V3 e limite. `confirmado` = centavos já avisados acima de R$ 100.000,00: salvar de novo o mesmo valor confirma.
 */
export function validarValor(texto: string, confirmado: number | null = null): ValidacaoValor {
  if (texto.trim() === "") return { ok: false, mensagem: MSG_VALOR_VAZIO };
  const centavos = parseValorBr(texto.trim());
  if (centavos === null || centavos <= 0) return { ok: false, mensagem: MSG_VALOR_INVALIDO };
  if (centavos > VALOR_MAXIMO_CENTAVOS) return { ok: false, mensagem: MSG_VALOR_MAXIMO };
  if (centavos > VALOR_CONFIRMACAO_CENTAVOS && confirmado !== centavos) return { ok: false, mensagem: MSG_VALOR_CONFIRMAR, confirmar: centavos };
  return { ok: true, centavos };
}

/** Só o ajuste vigente (maior id) de cada posição. */
export function ajustesVigentes(ajustes: AjusteRemuneracao[]): AjusteRemuneracao[] {
  const porPosicao = new Map<number, AjusteRemuneracao>();
  for (const ajuste of ajustes) {
    const atual = porPosicao.get(ajuste.posicao);
    if (!atual || ajuste.id > atual.id) porPosicao.set(ajuste.posicao, ajuste);
  }
  return [...porPosicao.values()];
}

/**
 * Aplica sobre os registros os ajustes da mesma importação (`importedAt`) cujo registro ainda bate (origem + linha).
 * Ajuste de importação anterior é ignorado. Não altera os registros recebidos.
 */
export function aplicarAjustes(records: ColaboradorPlanilha[], importedAt: string, ajustes: AjusteRemuneracao[]): ColaboradorPlanilha[] {
  const validos = ajustesVigentes(ajustes.filter((ajuste) => mesmoInstante(ajuste.importedAt, importedAt)));
  if (validos.length === 0) return records;
  const porPosicao = new Map(validos.map((ajuste) => [ajuste.posicao, ajuste]));
  return records.map((record, posicao) => {
    const ajuste = porPosicao.get(posicao);
    if (!ajuste || ajuste.origem !== record.origem || ajuste.linha !== record.linha) return record;
    return {
      ...record,
      remuneracao: ajuste.valorCentavos / 100,
      ajuste: { valorAnteriorCentavos: ajuste.valorAnteriorCentavos, alteradoPorNome: ajuste.alteradoPorNome, alteradoEm: ajuste.alteradoEm },
    };
  });
}

/**
 * Equivalente local do gatilho `preparar_ajuste_remuneracao` (IndexedDB e memória): confere a importação e o registro
 * e preenche nome, valor anterior e data. `anteriores` = ajustes já gravados daquela importação e posição.
 */
export function prepararAjusteLocal(
  planilha: StoredDataset<ColaboradorPlanilha> | null,
  novo: NovoAjuste,
  anteriores: AjusteRemuneracao[],
  agora: Date = new Date(),
): Omit<AjusteRemuneracao, "id"> {
  if (!planilha || !mesmoInstante(planilha.importedAt, novo.importedAt)) throw new Error(MSG_REIMPORTADO);
  const record = planilha.records[novo.posicao];
  if (!record || record.origem !== novo.origem || record.linha !== novo.linha) throw new Error(MSG_REGISTRO_AUSENTE);
  if (!Number.isInteger(novo.valorCentavos) || novo.valorCentavos < 0 || novo.valorCentavos > VALOR_MAXIMO_CENTAVOS) throw new Error(MSG_VALOR_INVALIDO);
  const ultimo = ajustesVigentes(anteriores.filter((a) => a.posicao === novo.posicao))[0];
  const daPlanilha = record.remuneracao === null ? null : Math.round(record.remuneracao * 100);
  return {
    ...novo,
    nome: record.servidor.slice(0, 200),
    valorAnteriorCentavos: ultimo ? ultimo.valorCentavos : daPlanilha,
    alteradoPorNome: "Este navegador",
    alteradoEm: agora.toISOString(),
  };
}
