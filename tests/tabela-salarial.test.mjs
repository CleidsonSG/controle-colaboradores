// Dados 100% fictícios.
import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { importFile, parseTabelaSalarialCsv } from "../lib/import/index.ts";
import { csvWindows1252 } from "./fixtures.mjs";

const enc = (text) => new TextEncoder().encode(text).buffer;

test("CSV da tabela salarial: ; e R$, cargos repetidos e salário inválido", () => {
  const csv = "Tabela salarial fictícia\r\nCARGO;SALÁRIO\r\nASSESSOR 1 - AS 1;R$ 8.500,00\r\nASSESSOR 6 - AS 6;2600\r\nASSESSOR 1 - AS 1;9000\r\nDIRETOR;abc\r\n;\r\n";
  const r = parseTabelaSalarialCsv(enc(csv), "tabela.csv");
  assert.equal(r.kind, "salarial");
  assert.deepEqual(r.records.map((x) => [x.cargo, x.salario]), [["ASSESSOR 1 - AS 1", 8500], ["ASSESSOR 6 - AS 6", 2600], ["DIRETOR", null]]);
  assert.deepEqual(r.warnings.map((w) => w.code).sort(), ["valor-invalido", "valores-divergentes"]);
});

test("CSV sem as colunas Cargo e Salário é recusado", () => {
  assert.throws(() => parseTabelaSalarialCsv(enc("Nome;Valor\r\nx;1\r\n"), "x.csv"), (e) => e.code === "cabecalho");
});

test("importFile reconhece a tabela salarial pelo cabeçalho do CSV", async () => {
  const r = await importFile(new File(["Cargo,Salario\nAS 1,8500\n"], "qualquer.csv"));
  assert.equal(r.kind, "salarial");
  const e = await importFile(new File([csvWindows1252()], "servidores.csv"));
  assert.equal(e.kind, "ecidade");
});

test("importFile com tipo forçado lê como tabela salarial", async () => {
  await assert.rejects(() => importFile(new File([csvWindows1252()], "s.csv"), "salarial"), (e) => e.code === "cabecalho");
});

test("XLSX da tabela salarial é reconhecido e lido", async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Salários");
  ws.addRow(["Tabela fictícia"]);
  ws.addRow(["Cargo", "Salário"]);
  ws.addRow(["ASSESSOR 2 - AS 2", 6800]);
  ws.addRow(["ASSESSOR 3 - AS 3", "R$ 5.400,00"]);
  const buf = await wb.xlsx.writeBuffer();
  const r = await importFile(new File([buf], "tabela.xlsx"));
  assert.equal(r.kind, "salarial");
  assert.deepEqual(r.records.map((x) => x.salario), [6800, 5400]);
  assert.deepEqual(r.countsBySheet, [{ sheet: "Salários", count: 2 }]);
});

test("XLSX com abas Comissionado e Terceirizado: lê as duas, com origem e Função/Remuneração", async () => {
  const wb = new ExcelJS.Workbook();
  const com = wb.addWorksheet("Comissionado");
  com.addRow(["CARGO", "SALÁRIO"]);
  com.addRow(["AGENTE EDUCACIONAL", "R$ 1.978,55"]);
  com.addRow(["ASSESSOR 1 - AS 1", 6812.77]);
  const ter = wb.addWorksheet("Terceirizado");
  ter.addRow(["FUNÇÃO", "REMUNERAÇÃO"]);
  ter.addRow(["AGENTE EDUCACIONAL", "R$ 6.780,60"]);
  ter.addRow(["ARQUITETO", 12307.69]);
  const buf = await wb.xlsx.writeBuffer();
  const r = await importFile(new File([buf], "tabela.xlsx"));
  assert.equal(r.kind, "salarial");
  assert.deepEqual(r.records.map((x) => [x.origem, x.cargo, x.salario]), [
    ["Comissionado", "AGENTE EDUCACIONAL", 1978.55],
    ["Comissionado", "ASSESSOR 1 - AS 1", 6812.77],
    ["Terceirizado", "AGENTE EDUCACIONAL", 6780.6],
    ["Terceirizado", "ARQUITETO", 12307.69],
  ]);
  assert.deepEqual(r.countsBySheet, [
    { sheet: "Comissionado", origem: "Comissionado", count: 2 },
    { sheet: "Terceirizado", origem: "Terceirizado", count: 2 },
  ]);
  assert.deepEqual(r.warnings, []);
});

test("duplicada com mesmo valor = duplicidade; sem valor = aviso com contagem; aba nomeada no aviso", async () => {
  const wb = new ExcelJS.Workbook();
  const com = wb.addWorksheet("Comissionado");
  com.addRow(["CARGO", "SALÁRIO"]);
  com.addRow(["AS 1", 100]);
  com.addRow(["AS 1", 100]);
  const ter = wb.addWorksheet("Terceirizado");
  ter.addRow(["FUNÇÃO", "REMUNERAÇÃO"]);
  ter.addRow(["VIGIA", null]);
  ter.addRow(["ROCADOR", null]);
  ter.addRow(["SERVENTE", 2000]);
  ter.addRow(["SERVENTE", 3000]);
  const r = await importFile(new File([await wb.xlsx.writeBuffer()], "t.xlsx"));
  const by = (code) => r.warnings.filter((w) => w.code === code);
  assert.equal(by("duplicidade").length, 1);
  assert.equal(by("valores-divergentes").length, 1);
  assert.ok(by("valores-divergentes")[0].message.includes("Terceirizado"));
  assert.equal(by("sem-valor")[0].rows.length, 2);
  assert.equal(r.records.find((x) => x.cargo === "SERVENTE").salario, 2000);
});
