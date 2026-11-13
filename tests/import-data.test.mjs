import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";
import {
  analyzeRows,
  IMPORT_FIELDS,
  ImportFileError,
  MAX_FILE_SIZE,
  MAX_RECORDS,
  parseLocalFile,
  suggestMapping,
} from "../lib/import-data.ts";

function makeFile(content, name) {
  return new File([content], name);
}

async function makeWorkbookFile(name) {
  const workbook = new ExcelJS.Workbook();
  workbook.addWorksheet("Rascunho").addRow(["ignorar"]);
  const sheet = workbook.addWorksheet("Dados");
  sheet.addRow(["Matrícula", "Nome", "CPF", "Cargo", "Lotação", "Ano", "Mês"]);
  sheet.addRow([
    "M-001",
    "Ana",
    { formula: '"12345678900"', result: "12345678900" },
    "Analista",
    "Financeiro",
    2025,
    2,
  ]);
  const buffer = await workbook.xlsx.writeBuffer();
  return new File([new Uint8Array(buffer)], name);
}

test("lê CSV UTF-8 com BOM e preserva valores textuais", async () => {
  const file = makeFile(
    "\uFEFFMatrícula;Nome;CPF;Cargo;Lotação;Ano;Mês\n001;Ana;00123456797;Analista;Financeiro;2025;02",
    "funcionarios.csv",
  );
  const parsed = await parseLocalFile(file);
  const analysis = analyzeRows(parsed, "employees", suggestMapping(parsed.headers, "employees"));

  assert.equal(parsed.kind, "csv");
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].values[0], "001");
  assert.equal(analysis.validCount, 1);
  assert.equal(analysis.rows[0].values.cpf, "00123456797");
  assert.equal(analysis.rows[0].normalized.cpf, "001.234.567-97");
});

for (const extension of ["xlsx", "xlsm"]) {
  test(`lê ${extension.toUpperCase()}, permite escolher aba e não usa resultado de fórmula`, async () => {
    const parsed = await parseLocalFile(await makeWorkbookFile(`funcionarios.${extension}`), "Dados");

    assert.deepEqual(parsed.sheetNames, ["Rascunho", "Dados"]);
    assert.equal(parsed.sheetName, "Dados");
    assert.equal(parsed.rows[0].values[2], "");
    const analysis = analyzeRows(parsed, "employees", suggestMapping(parsed.headers, "employees"));
    assert.equal(analysis.validCount, 1);
  });
}

test("identifica campos obrigatórios e valores numéricos inválidos", async () => {
  const file = makeFile(
    "Matrícula;Nome;Cargo;Lotação;Ano;Mês\n001;Ana;Analista;Financeiro;2025;02\n002;;Analista;Financeiro;2025;13",
    "funcionarios.csv",
  );
  const parsed = await parseLocalFile(file);
  const analysis = analyzeRows(parsed, "employees", suggestMapping(parsed.headers, "employees"));

  assert.equal(analysis.validCount, 1);
  assert.equal(analysis.invalidCount, 1);
  assert.match(analysis.rows[1].issues.join(" "), /Nome: campo obrigatório vazio/);
  assert.match(analysis.rows[1].issues.join(" "), /Mês: informe um mês entre 1 e 12/);
});

test("aceita CSV válido de uma coluna para que o mapeamento reporte campos ausentes", async () => {
  const parsed = await parseLocalFile(makeFile("Nome\nAna", "uma-coluna.csv"));

  assert.deepEqual(parsed.headers, ["Nome"]);
  assert.equal(parsed.rows.length, 1);
});

test("rejeita mapeamentos ausentes, repetidos ou fora das colunas", () => {
  const source = {
    kind: "csv",
    sheetNames: ["Arquivo CSV"],
    sheetName: "Arquivo CSV",
    headers: ["Matrícula", "Nome", "Cargo", "Lotação", "Ano", "Mês"],
    rows: [],
  };
  const missing = analyzeRows(source, "employees", {});
  assert.ok(missing.configurationIssues.some((issue) => issue.includes("Matrícula")));

  const duplicateMapping = Object.fromEntries(IMPORT_FIELDS.employees.map((field) => [field.key, "0"]));
  const duplicate = analyzeRows(source, "employees", duplicateMapping);
  assert.ok(duplicate.configurationIssues.includes("Cada campo deve usar uma coluna diferente do arquivo."));

  const invalidMapping = suggestMapping(source.headers, "employees");
  invalidMapping.year = "999";
  const invalid = analyzeRows(source, "employees", invalidMapping);
  assert.ok(invalid.configurationIssues.some((issue) => issue.includes("coluna válida para Ano")));
});

test("rejeita arquivo acima do limite e extensão não suportada", async () => {
  await assert.rejects(
    parseLocalFile({ name: "grande.csv", size: MAX_FILE_SIZE + 1 }),
    ImportFileError,
  );
  await assert.rejects(parseLocalFile(makeFile("conteúdo", "dados.xls")), ImportFileError);
});

test("rejeita arquivos sem cabeçalho e acima do limite de registros", async () => {
  await assert.rejects(parseLocalFile(makeFile("\n\n", "vazio.csv")), /não contém um cabeçalho/i);

  const csv = ["Nome;Cargo", ...Array(MAX_RECORDS + 1).fill("Ana;Analista")].join("\n");
  await assert.rejects(parseLocalFile(makeFile(csv, "muitos-registros.csv")), /20\.000 registros/i);
});
