import assert from "node:assert/strict";
import { describe, test } from "node:test";
import ExcelJS from "exceljs";
import {
  buildExport,
  buildExportFilename,
  buildExportRows,
  CSV_MIME_TYPE,
  ExportFileError,
  neutralizeFormula,
  toCsv,
  XLSX_MIME_TYPE,
} from "../lib/export-data.ts";
import { analyzeRows, IMPORT_FIELDS } from "../lib/import-data.ts";
import { makeCpf, makeSource } from "./helpers.mjs";

const FIXED_DATE = new Date(2026, 0, 5);
const EMPLOYEE_LABELS = IMPORT_FIELDS.employees.map((field) => field.label);
const CPF = makeCpf("123456789");

function analyze(type, rows) {
  const { source, mapping } = makeSource(type, rows);
  return analyzeRows(source, type, mapping);
}

function mixedEmployees() {
  return analyze("employees", [
    { registration: "001", cpf: CPF, month: "03" },
    { registration: "002", name: "", cpf: "12345678900", month: "13" },
  ]);
}

async function readWorkbook(blob) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await blob.arrayBuffer());
  return workbook;
}

describe("buildExportRows", () => {
  test("válidos: cabeçalho segue a ordem de IMPORT_FIELDS", () => {
    const [header] = buildExportRows(mixedEmployees(), "valid");
    assert.deepEqual(header, EMPLOYEE_LABELS);
  });

  test("válidos: usa valores normalizados (CPF formatado, mês sem zero)", () => {
    const [, row] = buildExportRows(mixedEmployees(), "valid");
    assert.deepEqual(row, ["001", "Pessoa Teste", "123.456.789-09", "Analista", "Setor A", "", "", "2025", "3"]);
  });

  test("válidos: exclui linhas com problemas", () => {
    assert.equal(buildExportRows(mixedEmployees(), "valid").length, 2);
  });

  test("erros: cabeçalho com Registro, campos e Problemas", () => {
    const [header] = buildExportRows(mixedEmployees(), "errors");
    assert.deepEqual(header, ["Registro", ...EMPLOYEE_LABELS, "Problemas"]);
  });

  test("erros: mantém valores crus e junta problemas com '; '", () => {
    const rows = buildExportRows(mixedEmployees(), "errors");
    assert.deepEqual(rows.slice(1), [[
      "3", "002", "", "12345678900", "Analista", "Setor A", "", "", "2025", "13",
      "Nome: campo obrigatório vazio; CPF: número inválido; Mês: informe um mês entre 1 e 12",
    ]]);
  });

  test("sem linhas do tipo pedido retorna apenas o cabeçalho", () => {
    const analysis = analyze("employees", [{}]);
    assert.deepEqual(buildExportRows(analysis, "errors"), [["Registro", ...EMPLOYEE_LABELS, "Problemas"]]);
  });

  test("estatísticas de cargo usam os campos do próprio tipo", () => {
    const analysis = analyze("position-statistics", [{ quantity: "007" }]);
    assert.deepEqual(buildExportRows(analysis, "valid"), [
      ["Cargo", "Quantidade", "Ano", "Mês"],
      ["Analista", "7", "2025", "3"],
    ]);
  });
});

describe("neutralizeFormula", () => {
  for (const value of ["=1+1", "+A1", "-A1", "@SUM(A1)", "\t=1", "\r=1", "-1+2", "=", "+"]) {
    test(`prefixa com apóstrofo: ${JSON.stringify(value)}`, () => {
      assert.equal(neutralizeFormula(value), `'${value}`);
    });
  }

  for (const value of ["-5", "+1,5", "-1.5", "+10", "10", "Ana", "", "1=2", "a-b"]) {
    test(`não altera: ${JSON.stringify(value)}`, () => {
      assert.equal(neutralizeFormula(value), value);
    });
  }
});

describe("toCsv", () => {
  test("começa com BOM, usa ';' e termina cada linha com CRLF", () => {
    assert.equal(toCsv([["a", "b"], ["c", "d"]]), "﻿a;b\r\nc;d\r\n");
  });

  test("coloca entre aspas valor com ';'", () => {
    assert.equal(toCsv([["a;b"]]), '﻿"a;b"\r\n');
  });

  test("coloca entre aspas valor com quebra de linha", () => {
    assert.equal(toCsv([["linha 1\nlinha 2"]]), '﻿"linha 1\nlinha 2"\r\n');
  });

  test("duplica aspas internas", () => {
    assert.equal(toCsv([['diz "oi"']]), '﻿"diz ""oi"""\r\n');
  });

  test("neutraliza fórmula antes de serializar", () => {
    assert.equal(toCsv([["=HYPERLINK(\"x\")"]]), '﻿"\'=HYPERLINK(""x"")"\r\n');
  });

  test("neutraliza e coloca entre aspas valor iniciado por CR", () => {
    assert.equal(toCsv([["\r=1"]]), "﻿\"'\r=1\"\r\n");
  });

  test("não altera números negativos ou com vírgula", () => {
    assert.equal(toCsv([["-5", "+1,5"]]), "﻿-5;+1,5\r\n");
  });

  test("lista vazia produz só o BOM e uma quebra", () => {
    assert.equal(toCsv([]), "﻿\r\n");
  });
});

describe("buildExportFilename", () => {
  const cases = [
    ["employees", "valid", "xlsx", "colaboradores-validos-2026-01-05.xlsx"],
    ["employees", "errors", "csv", "colaboradores-erros-2026-01-05.csv"],
    ["position-statistics", "valid", "csv", "estatisticas-cargo-validos-2026-01-05.csv"],
    ["position-statistics", "errors", "xlsx", "estatisticas-cargo-erros-2026-01-05.xlsx"],
  ];
  for (const [type, kind, format, expected] of cases) {
    test(`gera ${expected}`, () => {
      assert.equal(buildExportFilename(type, kind, format, FIXED_DATE), expected);
    });
  }

  test("usa a data local com mês e dia em dois dígitos", () => {
    assert.equal(buildExportFilename("employees", "valid", "csv", new Date(2026, 10, 30, 23, 59)), "colaboradores-validos-2026-11-30.csv");
  });
});

describe("buildExport CSV", () => {
  test("blob começa com os bytes EF BB BF", async () => {
    const { blob } = await buildExport(mixedEmployees(), "employees", { kind: "valid", format: "csv", date: FIXED_DATE });
    const bytes = new Uint8Array(await blob.arrayBuffer()).slice(0, 3);
    assert.deepEqual([...bytes], [0xef, 0xbb, 0xbf]);
  });

  test("usa o MIME de CSV e o nome com data", async () => {
    const file = await buildExport(mixedEmployees(), "employees", { kind: "errors", format: "csv", date: FIXED_DATE });
    assert.equal(file.blob.type, CSV_MIME_TYPE);
    assert.equal(file.filename, "colaboradores-erros-2026-01-05.csv");
  });

  test("conteúdo decodificado corresponde a toCsv das linhas", async () => {
    const analysis = mixedEmployees();
    const { blob } = await buildExport(analysis, "employees", { kind: "errors", format: "csv", date: FIXED_DATE });
    const text = new TextDecoder("utf-8", { ignoreBOM: true }).decode(await blob.arrayBuffer());
    assert.equal(text, toCsv(buildExportRows(analysis, "errors")));
  });
});

describe("buildExport XLSX", () => {
  test("usa o MIME de XLSX e o nome com data", async () => {
    const file = await buildExport(mixedEmployees(), "employees", { kind: "valid", format: "xlsx", date: FIXED_DATE });
    assert.equal(file.blob.type, XLSX_MIME_TYPE);
    assert.equal(file.filename, "colaboradores-validos-2026-01-05.xlsx");
  });

  test("válidos: aba 'Válidos', ano/mês numéricos e matrícula como texto", async () => {
    const { blob } = await buildExport(mixedEmployees(), "employees", { kind: "valid", format: "xlsx", date: FIXED_DATE });
    const workbook = await readWorkbook(blob);
    const sheet = workbook.worksheets[0];
    const row = sheet.getRow(2);
    assert.deepEqual(
      { name: sheet.name, header: sheet.getRow(1).getCell(1).value, registration: row.getCell(1).value, cpf: row.getCell(3).value, year: row.getCell(8).value, month: row.getCell(9).value },
      { name: "Válidos", header: "Matrícula", registration: "001", cpf: "123.456.789-09", year: 2025, month: 3 },
    );
  });

  test("erros: aba 'Erros', Registro numérico e valores crus como texto", async () => {
    const { blob } = await buildExport(mixedEmployees(), "employees", { kind: "errors", format: "xlsx", date: FIXED_DATE });
    const sheet = (await readWorkbook(blob)).worksheets[0];
    const row = sheet.getRow(2);
    assert.deepEqual(
      { name: sheet.name, record: row.getCell(1).value, month: row.getCell(10).value },
      { name: "Erros", record: 3, month: "13" },
    );
  });

  test("estatísticas de cargo: quantidade, ano e mês numéricos", async () => {
    const analysis = analyze("position-statistics", [{ quantity: "12", month: "07" }]);
    const { blob, filename } = await buildExport(analysis, "position-statistics", { kind: "valid", format: "xlsx", date: FIXED_DATE });
    const row = (await readWorkbook(blob)).worksheets[0].getRow(2);
    assert.deepEqual(
      { filename, values: row.values.slice(1) },
      { filename: "estatisticas-cargo-validos-2026-01-05.xlsx", values: ["Analista", 12, 2025, 7] },
    );
  });
});

describe("ExportFileError", () => {
  test("é um Error com nome próprio", () => {
    const error = new ExportFileError("falha");
    assert.ok(error instanceof Error);
    assert.equal(error.name, "ExportFileError");
  });
});
