import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { parseECidadeCsv } from "../lib/import/ecidade-csv.ts";
import { parsePlanilhaWorkbook } from "../lib/import/planilha-excel.ts";
import { toArrayBuffer } from "./fixtures.mjs";

const csvPath = process.env.ECIDADE_CSV || new URL("../amostras/GERAL_ECIDADE.csv", import.meta.url);
const xlsmPath = process.env.PLANILHA_XLSM || new URL("../amostras/CADASTRO_FUNCIONAL.xlsm", import.meta.url);

test("amostra real e-Cidade CSV (só contagens)", (t) => {
  if (!existsSync(csvPath)) return t.skip("amostra ausente");
  const r = parseECidadeCsv(toArrayBuffer(readFileSync(csvPath)), "GERAL_ECIDADE.csv");
  assert.equal(r.records.length, 3421);
  assert.ok(r.records.every((x) => x.matricula && x.nome));
  assert.ok(!r.records.some((x) => x.lotacao.includes("�") || x.nome.includes("�") || x.descricaoCargo.includes("�")));
});

test("amostra real planilha xlsm (só contagens)", async (t) => {
  if (!existsSync(xlsmPath)) return t.skip("amostra ausente");
  const r = await parsePlanilhaWorkbook(toArrayBuffer(readFileSync(xlsmPath)), "CADASTRO_FUNCIONAL.xlsm");
  assert.equal(r.countsBySheet.length, 2);
  assert.ok(r.countsBySheet.every((c) => c.origem));
  assert.ok(r.records.length > 0);
});
