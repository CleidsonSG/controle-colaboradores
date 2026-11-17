// Arquivos reais só por variáveis de ambiente (fora do Git; nunca copiar nomes ou matrículas). Só contagens.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { parseECidadeCsv } from "../lib/import/ecidade-csv.ts";
import { parsePlanilhaWorkbook } from "../lib/import/planilha-excel.ts";
import { importFile } from "../lib/import/index.ts";
import { apurar } from "../lib/folha/apuracao.ts";
import { subtotais } from "../lib/folha/funcionarios.ts";
import { toArrayBuffer } from "./fixtures.mjs";

const csvPath = process.env.ECIDADE_CSV;
const xlsmPath = process.env.PLANILHA_XLSM;
const xlsxPath = process.env.TABELA_XLSX;
const has = (path) => Boolean(path) && existsSync(path);

test("amostra real e-Cidade CSV (só contagens)", (t) => {
  if (!has(csvPath)) return t.skip("defina ECIDADE_CSV");
  const r = parseECidadeCsv(toArrayBuffer(readFileSync(csvPath)), "GERAL_ECIDADE.csv");
  assert.ok(r.records.length > 0);
  assert.ok(r.records.every((x) => x.matricula && x.nome));
  assert.ok(!r.records.some((x) => x.lotacao.includes("�") || x.nome.includes("�") || x.descricaoCargo.includes("�")));
  const apuracao = apurar(r.records, null, null);
  const relatorio = r.warnings.some((w) => w.code === "relatorio");
  console.log(`# e-Cidade: ${r.records.length} registros; comissionados ativos ${apuracao.servidoresAtivos}; ativos fora da contagem ${apuracao.foraDaContagem}; aviso de relatório: ${relatorio}`);
  if (process.env.ECIDADE_ESPERADO === "971") {
    assert.equal(r.records.length, 971);
    assert.ok(!relatorio);
  }
});

test("amostra real cadastro funcional xlsm (só contagens)", async (t) => {
  if (!has(xlsmPath)) return t.skip("defina PLANILHA_XLSM");
  const r = await parsePlanilhaWorkbook(toArrayBuffer(readFileSync(xlsmPath)), "CADASTRO_FUNCIONAL.xlsm");
  assert.deepEqual(r.countsBySheet.map((c) => [c.sheet, c.origem, c.count]), [["CADASTRO_COM", "Comissionado", 12], ["CADASTRO_TER", "Terceirizado", 22]]);
  assert.equal(subtotais(r.records).total.quantidade, 34);
});

test("amostra real tabela salarial xlsx (só contagens)", async (t) => {
  if (!has(xlsxPath)) return t.skip("defina TABELA_XLSX");
  const r = await importFile(new File([readFileSync(xlsxPath)], "TABELA_SALARIAL.xlsx"));
  assert.equal(r.kind, "salarial");
  assert.deepEqual(r.countsBySheet.map((c) => [c.origem, c.count]), [["Comissionado", 21], ["Terceirizado", 469]]);
  assert.ok(r.warnings.some((w) => w.code === "sem-valor"));
});
