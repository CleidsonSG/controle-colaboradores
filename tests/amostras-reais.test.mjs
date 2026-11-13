import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { parseECidadeCsv } from "../lib/import/ecidade-csv.ts";
import { parsePlanilhaWorkbook } from "../lib/import/planilha-excel.ts";
import { toArrayBuffer } from "./fixtures.mjs";

// Aceita "GERAL_ECIDADE.csv" ou "GERAL ECIDADE.csv" (idem para a planilha).
const firstExisting = (...names) => names.map((n) => new URL(`../amostras/${n}`, import.meta.url)).find((u) => existsSync(u)) ?? "ausente";
const csvPath = process.env.ECIDADE_CSV || firstExisting("GERAL_ECIDADE.csv", "GERAL ECIDADE.csv");
const xlsmPath = process.env.PLANILHA_XLSM || firstExisting("CADASTRO_FUNCIONAL.xlsm", "CADASTRO FUNCIONAL.xlsm");

test("amostra real e-Cidade CSV (só contagens)", (t) => {
  if (!existsSync(csvPath)) return t.skip("amostra ausente");
  const r = parseECidadeCsv(toArrayBuffer(readFileSync(csvPath)), "GERAL_ECIDADE.csv");
  // 3.420 linhas de funcionários (matrículas únicas); a 3.421ª linha é o rodapé do relatório,
  // que declara "TOTAL : 3419" — divergência do próprio e-Cidade, sinalizada como aviso.
  assert.equal(r.records.length, 3420);
  assert.ok(r.warnings.every((w) => w.code === "linha-ignorada" && w.message.includes("rodapé")));
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
