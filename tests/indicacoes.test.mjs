import { test } from "node:test";
import assert from "node:assert/strict";
import { descreverFiltros, montarRelatorioIndicacoes } from "../lib/folha/indicacoes.ts";
import { gerarPdfIndicacoes, gerarXlsxIndicacoes, PDF_MIME_TYPE, XLSX_MIME_TYPE } from "../lib/export-indicacoes.ts";

// Dados 100% sintéticos.
const row = (over) => ({
  matricula: "1", servidor: "Pessoa A", empresaSecretaria: "Empresa Um", lotacao: "Lot X", funcao: "Auxiliar",
  remuneracao: 1000, alimentacao: 100, indicacao: "Indicador Alfa", origem: "Terceirizado", linha: 2, possivelDuplicidade: false, ...over,
});
const ROWS = [
  row({ servidor: "Beta Pessoa", remuneracao: 2000.5 }),
  row({ servidor: "Alfa Pessoa", matricula: "2" }),
  row({ servidor: "Gama Pessoa", indicacao: "indicador beta", origem: "Comissionado", empresaSecretaria: "Prefeitura", lotacao: "Lot Y", funcao: "Assessor", alimentacao: null }),
  row({ servidor: "Delta Pessoa", indicacao: "" }),
  row({ servidor: "Eta Pessoa", indicacao: "SEM INDICAÇÃO", remuneracao: null, alimentacao: null }),
];

test("resumo por indicação: soma em centavos, 'Sem indicação' por último, total geral", () => {
  const r = montarRelatorioIndicacoes(ROWS);
  assert.deepEqual(r.resumo.map((i) => [i.indicacao, i.quantidade, i.remuneracao, i.alimentacao, i.custo]), [
    ["Indicador Alfa", 2, 300050, 20000, 320050],
    ["indicador beta", 1, 100000, 0, 100000],
    ["SEM INDICAÇÃO", 2, 100000, 10000, 110000],
  ]);
  assert.deepEqual([r.total.quantidade, r.total.custo], [5, 530050]);
  assert.equal(r.detalhe.length, 5);
  assert.deepEqual(r.detalhe.filter((d) => d.indicacao === "Indicador Alfa").map((d) => d.servidor), ["Alfa Pessoa", "Beta Pessoa"]);
});

test("filtros combinados (sem acento/caixa) e opções sobre todos os registros", () => {
  const r = montarRelatorioIndicacoes(ROWS, { origem: "Terceirizado", empresa: "EMPRESA um", indicacao: "sem indicacao" });
  assert.equal(r.detalhe.length, 2);
  assert.equal(r.total.quantidade, 2);
  assert.equal(r.opcoes.indicacoes.length, 3);
  assert.deepEqual(r.opcoes.origens, ["Comissionado", "Terceirizado"]);
  assert.equal(montarRelatorioIndicacoes(ROWS, { lotacao: "lot y", funcao: "assessor" }).detalhe.length, 1);
  assert.equal(montarRelatorioIndicacoes(ROWS, { funcao: "inexistente" }).resumo.length, 0);
});

test("descreverFiltros", () => {
  assert.deepEqual(descreverFiltros({}), []);
  assert.deepEqual(descreverFiltros({ origem: "Comissionado", lotacao: "Lot Y", funcao: "" }), ["Origem: Comissionado", "Lotação: Lot Y"]);
});

test("XLSX: abas Resumo e Detalhe, cabeçalho congelado, moeda e totais", async () => {
  const blob = await gerarXlsxIndicacoes(montarRelatorioIndicacoes(ROWS, { origem: "Terceirizado" }), {
    filtro: { origem: "Terceirizado" },
    geradoEm: new Date(2026, 10, 17, 9, 30),
  });
  assert.equal(blob.type, XLSX_MIME_TYPE);
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await blob.arrayBuffer());
  assert.deepEqual(wb.worksheets.map((w) => w.name), ["Resumo", "Detalhe"]);
  const resumo = wb.getWorksheet("Resumo");
  assert.equal(resumo.views[0].state, "frozen");
  const texto = [];
  resumo.eachRow((r) => texto.push(String(r.getCell(1).value)));
  assert.ok(texto.some((t) => t.includes("Origem: Terceirizado")));
  assert.ok(texto.some((t) => t.startsWith("Gerado em 17/11/2026")));
  const total = resumo.lastRow;
  assert.equal(total.getCell(1).value, "Total geral");
  assert.equal(total.getCell(5).value, 4300.5);
  assert.equal(total.getCell(2).value, 4);
  assert.match(resumo.getColumn(5).numFmt, /R\$/);
  assert.equal(resumo.getRow(6).getCell(1).font.bold, true);
  const detalhe = wb.getWorksheet("Detalhe");
  assert.equal(detalhe.lastRow.getCell(1).value, "Total geral");
});

test("PDF: gera documento A4 paisagem com rodapé de páginas", async () => {
  const blob = await gerarPdfIndicacoes(montarRelatorioIndicacoes(ROWS), { geradoEm: new Date(2026, 10, 17) });
  assert.equal(blob.type, PDF_MIME_TYPE);
  const texto = Buffer.from(await blob.arrayBuffer()).toString("latin1");
  assert.ok(texto.startsWith("%PDF-"));
  assert.match(texto, /MediaBox \[0 0 841\.88\d* 595\.27\d*\]/);
  assert.match(texto, /Documento restrito/);
  assert.match(texto, /P.gina 2 de 2/);
});
