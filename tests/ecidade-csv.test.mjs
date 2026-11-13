import { test } from "node:test";
import assert from "node:assert/strict";
import { parseECidadeCsv } from "../lib/import/ecidade-csv.ts";
import { ImportFileError } from "../lib/import/types.ts";
import * as fx from "./fixtures.mjs";

test("lê CSV windows-1252: cabeçalho na linha 5, contagem e acentos", () => {
  const r = parseECidadeCsv(fx.csvWindows1252(), "a.csv");
  assert.equal(r.kind, "ecidade");
  assert.equal(r.records.length, 5);
  assert.deepEqual(r.countsBySheet, [{ sheet: "CSV", count: 5 }]);
  assert.equal(r.records[0].matricula, "1001");
  assert.equal(r.records[0].nome, "Maria da Conceição Teste");
  assert.equal(r.records[0].lotacao, "Secretaria de Lotação Um");
  assert.equal(r.records[0].descricaoCargo, "Auxiliar “Administrativo”");
  assert.equal(r.records[0].admissao, "2010-02-01");
  assert.equal(r.records[0].rescisao, null);
  assert.equal(r.records[1].rescisao, "2020-06-30");
});
test("PADRAO e coluna final vazia são ignoradas; só o booleano comissionado fica", () => {
  const r = parseECidadeCsv(fx.csvWindows1252(), "a.csv");
  for (const rec of r.records) {
    assert.deepEqual(Object.keys(rec).sort(), ["admissao", "comissionado", "descricaoCargo", "lotacao", "matricula", "nome", "rescisao"]);
  }
  assert.deepEqual(r.records.map((x) => x.comissionado), [false, false, false, true, false]);
});
test("admissão ausente = null sem aviso; data 31/02 = null + aviso", () => {
  const r = parseECidadeCsv(fx.csvWindows1252(), "a.csv");
  assert.equal(r.records[2].admissao, null);
  assert.equal(r.records[4].admissao, null);
  const w = r.warnings.find((x) => x.code === "data-invalida");
  assert.ok(w);
  assert.equal(w.rows.length, 1);
  assert.ok(!r.warnings.some((x) => x.code === "linha-ignorada"));
});
test("UTF-8 com BOM, vírgula e tab dão o mesmo resultado", () => {
  for (const f of [fx.csvUtf8Bom, fx.csvUtf8, fx.csvComma, fx.csvTab]) {
    const r = parseECidadeCsv(f(), "a.csv");
    assert.equal(r.records.length, 5);
    assert.equal(r.records[0].nome, "Maria da Conceição Teste");
    assert.equal(r.records[3].comissionado, true);
  }
});
test("cabeçalho sem linhas de relatório ou com relatório maior é localizado", () => {
  assert.equal(parseECidadeCsv(fx.csvNoReport(), "a.csv").records.length, 5);
  assert.equal(parseECidadeCsv(fx.csvLongReport(), "a.csv").records.length, 5);
});
test("colunas faltando: ImportFileError cabecalho com missingColumns", () => {
  assert.throws(
    () => parseECidadeCsv(fx.csvMissingColumns(), "a.csv"),
    (e) => e instanceof ImportFileError && e.code === "cabecalho" && e.missingColumns.includes("Lotação") && e.missingColumns.includes("Descrição do cargo"),
  );
});
test("arquivo sem bytes ou sem registros: vazio", () => {
  assert.throws(() => parseECidadeCsv(new ArrayBuffer(0), "a.csv"), (e) => e.code === "vazio");
  assert.throws(() => parseECidadeCsv(fx.csvOnlyHeader(), "a.csv"), (e) => e.code === "vazio");
});
