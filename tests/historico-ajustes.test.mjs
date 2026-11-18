import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRetratos, calcularHistorico, chaveIdentidadeBase, competenciaAtual, normalizarIdentidade, registrosDeRetratos, validarCompetencia, MSG_COMPETENCIA_FUTURA, MSG_COMPETENCIA_VAZIA } from "../lib/folha/historico.ts";
import {
  aplicarAjustes,
  parseValorBr,
  validarValor,
  MSG_REIMPORTADO,
  MSG_VALOR_CONFIRMAR,
  MSG_VALOR_INVALIDO,
  MSG_VALOR_MAXIMO,
  MSG_VALOR_VAZIO,
} from "../lib/folha/ajustes.ts";
import { conciliarRemuneracao, agregarPorFuncao } from "../lib/folha/conciliacao.ts";
import { createMemoryStore } from "../lib/storage/memory-store.ts";

// Dados 100% sintéticos.
const pessoa = (over = {}) => ({
  matricula: "",
  servidor: "Pessoa Exemplo 01",
  empresaSecretaria: "Empresa Exemplo A",
  lotacao: "Lotação Exemplo",
  funcao: "FUNÇÃO EXEMPLO A",
  remuneracao: null,
  alimentacao: 100,
  indicacao: "Indicação Exemplo",
  origem: "Terceirizado",
  linha: 2,
  possivelDuplicidade: false,
  ...over,
});

const IMPORT_1 = "2026-10-01T12:00:00.000Z";
const IMPORT_2 = "2026-11-01T12:00:00.000Z";
const ajuste = (over = {}) => ({
  id: 1,
  importedAt: IMPORT_2,
  posicao: 0,
  origem: "Terceirizado",
  linha: 2,
  valorCentavos: 185000,
  nome: "Pessoa Exemplo 01",
  valorAnteriorCentavos: null,
  alteradoPorNome: "Usuário Exemplo",
  alteradoEm: "2026-11-02T10:00:00.000Z",
  ...over,
});

test("identidade: matrícula para comissionado, nome + empresa normalizados para quem não tem", () => {
  assert.equal(chaveIdentidadeBase(pessoa({ matricula: " 00 123 " })), "m:00123");
  assert.equal(chaveIdentidadeBase(pessoa({ servidor: "  Pessoa  Exemplo 01 ", empresaSecretaria: "Empresa Exemplo - Á" })), "n:pessoa exemplo 01|empresa exemplo a");
  assert.equal(normalizarIdentidade("JOÃO  da Silva!"), "joao da silva");
});

test("buildRetratos: homônimos recebem #2 e ficam marcados; sem campos monetários nem CPF", () => {
  const retratos = buildRetratos([
    pessoa(),
    pessoa({ linha: 3, lotacao: "Outra Lotação" }),
    pessoa({ servidor: "Pessoa Exemplo 02", linha: 4 }),
    pessoa({ matricula: "0042", origem: "Comissionado", servidor: "Pessoa Exemplo 03", linha: 5 }),
  ]);
  assert.deepEqual(retratos.map((r) => r.chaveIdentidade), [
    "n:pessoa exemplo 01|empresa exemplo a",
    "n:pessoa exemplo 01|empresa exemplo a#2",
    "n:pessoa exemplo 02|empresa exemplo a",
    "m:0042",
  ]);
  assert.deepEqual(retratos.map((r) => r.possivelDuplicidade), [true, true, false, false]);
  for (const retrato of retratos) {
    assert.deepEqual(Object.keys(retrato).sort(), ["chaveIdentidade", "empresaSecretaria", "funcao", "lotacao", "matricula", "nome", "origem", "possivelDuplicidade"]);
    assert.ok(!("remuneracao" in retrato) && !("alimentacao" in retrato) && !("indicacao" in retrato) && !("cpf" in retrato));
  }
});

test("competência: obrigatória e não pode ser mês futuro (fuso de São Paulo)", () => {
  const agora = new Date("2026-11-01T02:00:00Z"); // ainda 31/10 em São Paulo
  assert.equal(competenciaAtual(agora), "2026-10");
  assert.equal(validarCompetencia("", agora), MSG_COMPETENCIA_VAZIA);
  assert.equal(validarCompetencia("2026-13", agora), MSG_COMPETENCIA_VAZIA);
  assert.equal(validarCompetencia("2026-11", agora), MSG_COMPETENCIA_FUTURA);
  assert.equal(validarCompetencia("2026-10", agora), null);
});

test("histórico com 3 competências sintéticas pelo armazenamento", async () => {
  const store = createMemoryStore();
  const meses = [
    ["2026-08", { funcao: "FUNÇÃO EXEMPLO A", lotacao: "Lotação 1" }],
    ["2026-09", { funcao: "FUNÇÃO EXEMPLO B", lotacao: "Lotação 1" }],
    ["2026-10", { funcao: "FUNÇÃO EXEMPLO B", lotacao: "Lotação 2" }],
  ];
  for (const [competencia, over] of meses) {
    const total = await store.replaceCompetencia({ competencia, fileName: "cadastro.xlsm", importedAt: `${competencia}-05T12:00:00.000Z` }, buildRetratos([pessoa(over), pessoa({ servidor: "Pessoa Exemplo 02" })]));
    assert.equal(total, 2);
  }
  // Reimportar a mesma competência substitui (idempotente).
  await store.replaceCompetencia({ competencia: "2026-10", fileName: "cadastro.xlsm", importedAt: IMPORT_2 }, buildRetratos([pessoa({ funcao: "FUNÇÃO EXEMPLO B", lotacao: "Lotação 2" })]));
  assert.equal((await store.loadRetratosCompetencia("2026-10")).length, 1);
  assert.deepEqual((await store.listCompetencias()).map((c) => c.competencia), ["2026-10", "2026-09", "2026-08"]);

  const retratos = await store.loadHistoricoPessoa("n:pessoa exemplo 01|empresa exemplo a");
  assert.deepEqual(retratos.map((r) => r.competencia), ["2026-10", "2026-09", "2026-08"]);
  const h = calcularHistorico(registrosDeRetratos(retratos));
  assert.deepEqual(h.resumo, { mesesRegistrados: 3, cargosOcupados: 2, mudancasCargo: 1, mudancasLotacao: 1 });
  assert.deepEqual(h.linhas.map((l) => l.mudanca), ["Lotação", "Cargo", "Início do registro"]);

  await assert.rejects(store.replaceCompetencia({ competencia: "2999-01", fileName: "x", importedAt: IMPORT_2 }, []), { message: MSG_COMPETENCIA_FUTURA });
  await store.clearHistorico();
  assert.deepEqual(await store.listCompetencias(), []);
});

test("valor (V1–V5): formato pt-BR, maior que zero, confirmação acima de R$ 100.000,00 e limite", () => {
  assert.equal(parseValorBr("1.850,00"), 185000);
  assert.equal(parseValorBr("R$ 1850,5"), 185050);
  assert.equal(parseValorBr("1850"), 185000);
  assert.equal(parseValorBr("1,850.00"), null);
  assert.deepEqual(validarValor("  "), { ok: false, mensagem: MSG_VALOR_VAZIO });
  assert.deepEqual(validarValor("abc"), { ok: false, mensagem: MSG_VALOR_INVALIDO });
  assert.deepEqual(validarValor("-10,00"), { ok: false, mensagem: MSG_VALOR_INVALIDO });
  assert.deepEqual(validarValor("0,00"), { ok: false, mensagem: MSG_VALOR_INVALIDO });
  assert.deepEqual(validarValor("1.850,00"), { ok: true, centavos: 185000 });
  assert.deepEqual(validarValor("150.000,00"), { ok: false, mensagem: MSG_VALOR_CONFIRMAR, confirmar: 15000000 });
  assert.deepEqual(validarValor("150.000,00", 15000000), { ok: true, centavos: 15000000 });
  assert.deepEqual(validarValor("150.000,01", 15000000).ok, false);
  assert.deepEqual(validarValor("1.000.000,01", 100000001), { ok: false, mensagem: MSG_VALOR_MAXIMO });
});

test("ajustes valem só para a mesma importação e recalculam a conferência", () => {
  const records = [pessoa(), pessoa({ servidor: "Pessoa Exemplo 02", linha: 3, remuneracao: 1000 })];
  const ajustes = [
    ajuste({ id: 1, importedAt: IMPORT_1, valorCentavos: 999900 }), // importação anterior: ignorado
    ajuste({ id: 2, valorCentavos: 170000 }),
    ajuste({ id: 3, valorCentavos: 185000, importedAt: "2026-11-01T12:00:00+00:00" }), // vigente (maior id), outro formato
    ajuste({ id: 4, posicao: 1, linha: 99 }), // registro não bate: ignorado
  ];
  const aplicados = aplicarAjustes(records, IMPORT_2, ajustes);
  assert.equal(aplicados[0].remuneracao, 1850);
  assert.equal(aplicados[0].ajuste.alteradoPorNome, "Usuário Exemplo");
  assert.equal(aplicados[1].remuneracao, 1000);
  assert.equal(aplicados[1].ajuste, undefined);
  assert.equal(records[0].remuneracao, null, "não altera a entrada");

  assert.equal(aplicarAjustes(records, "2026-12-01T00:00:00.000Z", ajustes), records, "reimportação invalida os ajustes");

  const tabela = [{ cargo: "FUNÇÃO EXEMPLO A", salario: 1850, linha: 2, origem: "Terceirizado" }];
  const antes = agregarPorFuncao(conciliarRemuneracao(records, tabela).rows);
  assert.equal(antes[0].pendentes.length, 2);
  assert.deepEqual(antes[0].pendentes.map((p) => p.posicao).sort(), [0, 1]);
  const depois = agregarPorFuncao(conciliarRemuneracao(aplicados, tabela).rows);
  assert.deepEqual(depois[0].pendentes.map((p) => p.servidor), ["Pessoa Exemplo 02"]);
});

test("armazenamento local: ajuste confere a importação e guarda o valor anterior", async () => {
  const store = createMemoryStore();
  const planilha = { kind: "planilha", fileName: "c.xlsm", importedAt: IMPORT_2, schemaVersion: 1, records: [pessoa({ remuneracao: 1500 })], countsBySheet: [], warnings: [] };
  await store.replace("planilha", planilha);
  const novo = { importedAt: IMPORT_2, posicao: 0, origem: "Terceirizado", linha: 2, valorCentavos: 185000 };
  const primeiro = await store.saveAjuste(novo);
  assert.equal(primeiro.valorAnteriorCentavos, 150000);
  assert.equal(primeiro.nome, "Pessoa Exemplo 01");
  const segundo = await store.saveAjuste({ ...novo, valorCentavos: 190000 });
  assert.equal(segundo.valorAnteriorCentavos, 185000);
  assert.deepEqual((await store.loadAjustes(IMPORT_2)).map((a) => a.valorCentavos), [190000]);
  await assert.rejects(store.saveAjuste({ ...novo, importedAt: IMPORT_1 }), { message: MSG_REIMPORTADO });
  await store.clear("planilha");
  assert.deepEqual(await store.loadAjustes(IMPORT_2), []);
});
