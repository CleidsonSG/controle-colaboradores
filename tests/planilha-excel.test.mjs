import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePlanilhaWorkbook } from "../lib/import/planilha-excel.ts";
import { buildXlsx } from "./fixtures.mjs";

test("lê só as 2 primeiras abas; DADOS não é lida", async () => {
  const r = await parsePlanilhaWorkbook(await buildXlsx(), "p.xlsx");
  assert.equal(r.kind, "planilha");
  assert.deepEqual(r.countsBySheet, [
    { sheet: "CADASTRO_COM", origem: "Comissionado", count: 4 },
    { sheet: "CADASTRO_TER", origem: "Terceirizado", count: 2 },
  ]);
  assert.equal(r.records.length, 6);
  assert.ok(!r.records.some((x) => x.servidor === "ZZZ"));
});
test("origem por aba, matrícula numérica vira texto, linha original", async () => {
  const r = await parsePlanilhaWorkbook(await buildXlsx(), "p.xlsx");
  assert.equal(r.records[0].matricula, "2001");
  assert.equal(r.records[0].origem, "Comissionado");
  assert.equal(r.records[0].linha, 3);
  assert.equal(r.records[4].origem, "Terceirizado");
});
test("dinheiro: número, 'R$ 1.234,56', fórmula com result", async () => {
  const r = await parsePlanilhaWorkbook(await buildXlsx(), "p.xlsx");
  assert.equal(r.records[0].remuneracao, 5000.5);
  assert.equal(r.records[0].alimentacao, 1234.56);
  assert.equal(r.records[1].remuneracao, 1500);
});
test("fórmula sem result e valor inválido geram null + avisos", async () => {
  const r = await parsePlanilhaWorkbook(await buildXlsx(), "p.xlsx");
  assert.equal(r.records[2].remuneracao, null);
  assert.equal(r.records[2].alimentacao, null);
  assert.ok(r.warnings.some((w) => w.code === "formula-sem-valor"));
  assert.ok(r.warnings.some((w) => w.code === "valor-invalido"));
});
test("matrícula repetida entre abas: mantém as duas e marca possivelDuplicidade", async () => {
  const r = await parsePlanilhaWorkbook(await buildXlsx(), "p.xlsx");
  const rep = r.records.filter((x) => x.matricula === "9999");
  assert.equal(rep.length, 2);
  assert.ok(rep.every((x) => x.possivelDuplicidade));
  assert.equal(r.records.filter((x) => x.possivelDuplicidade).length, 2);
  assert.ok(r.warnings.some((w) => w.code === "duplicidade"));
});
test("data em célula vira dd/mm/aaaa (texto)", async () => {
  const r = await parsePlanilhaWorkbook(await buildXlsx({ withDate: true }), "p.xlsx");
  assert.equal(r.records[0].indicacao, "29/02/2020");
});
test("aba 2 vazia = 0 registros sem erro", async () => {
  const r = await parsePlanilhaWorkbook(await buildXlsx({ emptySecond: true }), "p.xlsx");
  assert.equal(r.countsBySheet[1].count, 0);
  assert.equal(r.records.length, 4);
  assert.ok(!r.records.some((x) => x.possivelDuplicidade));
});
test("cabeçalho com acentos/caixa diferentes", async () => {
  const header = ["MATRICULA", "SERVIDOR", "EMPRESA / SECRETARIA", "LOTACAO", "FUNCAO", "REMUNERACAO", "ALIMENTACAO", "INDICACAO"];
  const r = await parsePlanilhaWorkbook(await buildXlsx({ header }), "p.xlsx");
  assert.equal(r.records.length, 6);
  assert.equal(r.records[0].lotacao, "Lotação A");
});
test("aba 1 oculta continua sendo a posição 0", async () => {
  const r = await parsePlanilhaWorkbook(await buildXlsx({ hiddenFirst: true }), "p.xlsx");
  assert.equal(r.countsBySheet[0].origem, "Comissionado");
  assert.equal(r.records[0].origem, "Comissionado");
});
test("mesmo buffer como .xlsm; sem aba DADOS também", async () => {
  const r = await parsePlanilhaWorkbook(await buildXlsx({ noData: true }), "p.xlsm");
  assert.equal(r.fileName, "p.xlsm");
  assert.equal(r.records.length, 6);
});
test("buffer vazio e inválido geram ImportFileError", async () => {
  await assert.rejects(() => parsePlanilhaWorkbook(new ArrayBuffer(0), "p.xlsx"), (e) => e.code === "vazio");
  await assert.rejects(() => parsePlanilhaWorkbook(new TextEncoder().encode("nao e zip").buffer, "p.xlsx"), (e) => e.code === "formato");
});
test("cabeçalho sem Matrícula/Servidor: erro cabecalho", async () => {
  const header = ["A", "B", "C", "D", "E", "F", "G", "H"];
  await assert.rejects(
    async () => parsePlanilhaWorkbook(await buildXlsx({ header }), "p.xlsx"),
    (e) => e.code === "cabecalho" && e.missingColumns.length === 2,
  );
});
