import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { analyzeRows } from "../lib/import-data.ts";
import { FIRST_RECORD, makeCpf, makeSource, maskCpf } from "./helpers.mjs";

const CPF_ISSUE = "CPF: número inválido";
const DUPLICATE_PREFIX = "Matrícula: duplicada no mesmo mês/ano";

const VALID_CPF = makeCpf("123456789");
const LEADING_ZERO_CPF = makeCpf("001234567");

function analyzeEmployees(rows) {
  const { source, mapping } = makeSource("employees", rows);
  return analyzeRows(source, "employees", mapping);
}

function analyzeCpf(cpf) {
  return analyzeEmployees([{ cpf }]).rows[0];
}

function duplicateIssues(row) {
  return row.issues.filter((issue) => issue.startsWith(DUPLICATE_PREFIX));
}

describe("oráculo de CPF sintético", () => {
  test("gera dígitos verificadores conhecidos", () => {
    assert.equal(VALID_CPF, "12345678909");
    assert.equal(LEADING_ZERO_CPF, "00123456797");
  });
});

describe("CPF", () => {
  test("aceita CPF válido sem máscara e normaliza com máscara", () => {
    const row = analyzeCpf(VALID_CPF);
    assert.deepEqual(row.issues, []);
    assert.equal(row.normalized.cpf, "123.456.789-09");
  });

  test("aceita CPF válido com máscara", () => {
    const row = analyzeCpf(maskCpf(VALID_CPF));
    assert.deepEqual(row.issues, []);
    assert.equal(row.normalized.cpf, "123.456.789-09");
  });

  test("aceita CPF com espaços e barra como separadores", () => {
    const row = analyzeCpf("123 456 789/09");
    assert.deepEqual(row.issues, []);
    assert.equal(row.normalized.cpf, "123.456.789-09");
  });

  test("completa com zeros à esquerda o CPF só com dígitos e menos de 11", () => {
    const row = analyzeCpf("123456797");
    assert.deepEqual(row.issues, []);
    assert.equal(row.normalized.cpf, "001.234.567-97");
  });

  test("não completa CPF curto com máscara, mesmo que completado fosse válido", () => {
    const row = analyzeCpf("1.234.567-97");
    assert.deepEqual(row.issues, [CPF_ISSUE]);
  });

  test("rejeita o exemplo mascarado curto 12.345.678-90", () => {
    assert.deepEqual(analyzeCpf("12.345.678-90").issues, [CPF_ISSUE]);
  });

  test("rejeita dígito verificador errado", () => {
    assert.deepEqual(analyzeCpf("12345678908").issues, [CPF_ISSUE]);
  });

  test("rejeita dígito verificador errado com máscara", () => {
    assert.deepEqual(analyzeCpf("123.456.789-00").issues, [CPF_ISSUE]);
  });

  for (const repeated of ["11111111111", "111.111.111-11", "00000000000", "0"]) {
    test(`rejeita CPF com todos os dígitos iguais: "${repeated}"`, () => {
      assert.deepEqual(analyzeCpf(repeated).issues, [CPF_ISSUE]);
    });
  }

  test("rejeita CPF com letras", () => {
    assert.deepEqual(analyzeCpf("123.456.789-0A").issues, [CPF_ISSUE]);
  });

  test("rejeita CPF com mais de 11 dígitos", () => {
    assert.deepEqual(analyzeCpf(`${VALID_CPF}1`).issues, [CPF_ISSUE]);
  });

  test("CPF vazio é opcional e não gera erro", () => {
    const row = analyzeCpf("   ");
    assert.deepEqual(row.issues, []);
    assert.equal(row.normalized.cpf, "");
  });

  test("values guarda o texto da fonte (trim) e normalized o CPF formatado", () => {
    const row = analyzeCpf("  12345678909  ");
    assert.equal(row.values.cpf, "12345678909");
    assert.equal(row.normalized.cpf, "123.456.789-09");
  });

  test("CPF inválido mantém o texto da fonte também em normalized", () => {
    const row = analyzeCpf(" 123.456.789-00 ");
    assert.equal(row.values.cpf, "123.456.789-00");
    assert.equal(row.normalized.cpf, "123.456.789-00");
  });

  test("CPF inválido torna a linha inválida nas contagens", () => {
    const analysis = analyzeEmployees([{ cpf: VALID_CPF }, { registration: "M-002", cpf: "12345678900" }]);
    assert.equal(analysis.validCount, 1);
    assert.equal(analysis.invalidCount, 1);
  });
});

describe("normalized de campos numéricos", () => {
  test("ano e mês são normalizados sem zeros à esquerda", () => {
    const row = analyzeEmployees([{ year: "2025", month: "03" }]).rows[0];
    assert.equal(row.values.month, "03");
    assert.equal(row.normalized.month, "3");
  });
});

describe("matrícula duplicada no mesmo mês/ano", () => {
  test("ignora caixa e espaços e marca todas as ocorrências", () => {
    const analysis = analyzeEmployees([{ registration: "m-001" }, { registration: "  M-001 " }]);
    assert.deepEqual(duplicateIssues(analysis.rows[0]), [`${DUPLICATE_PREFIX} (registros ${FIRST_RECORD + 1})`]);
    assert.deepEqual(duplicateIssues(analysis.rows[1]), [`${DUPLICATE_PREFIX} (registros ${FIRST_RECORD})`]);
  });

  test('compara mês numericamente ("03" = "3")', () => {
    const analysis = analyzeEmployees([{ month: "03" }, { month: "3" }]);
    assert.equal(analysis.invalidCount, 2);
  });

  test('compara ano numericamente ("2.025" = "2025")', () => {
    const analysis = analyzeEmployees([{ year: "2.025" }, { year: "2025" }]);
    assert.equal(analysis.invalidCount, 2);
  });

  test("com 3 ocorrências cada uma lista as outras duas", () => {
    const analysis = analyzeEmployees([{}, {}, {}]);
    assert.deepEqual(
      analysis.rows.map(duplicateIssues),
      [
        [`${DUPLICATE_PREFIX} (registros 3, 4)`],
        [`${DUPLICATE_PREFIX} (registros 2, 4)`],
        [`${DUPLICATE_PREFIX} (registros 2, 3)`],
      ],
    );
  });

  test('com mais de 5 outras ocorrências lista 5 e informa "e mais N"', () => {
    const analysis = analyzeEmployees(Array.from({ length: 8 }, () => ({})));
    assert.deepEqual(duplicateIssues(analysis.rows[0]), [`${DUPLICATE_PREFIX} (registros 3, 4, 5, 6, 7 e mais 2)`]);
  });

  test('com exatamente 5 outras ocorrências não usa "e mais"', () => {
    const analysis = analyzeEmployees(Array.from({ length: 6 }, () => ({})));
    assert.deepEqual(duplicateIssues(analysis.rows[0]), [`${DUPLICATE_PREFIX} (registros 3, 4, 5, 6, 7)`]);
  });

  test("mesma matrícula em meses diferentes não é duplicidade", () => {
    const analysis = analyzeEmployees([{ month: "3" }, { month: "4" }]);
    assert.equal(analysis.invalidCount, 0);
  });

  test("mesma matrícula em anos diferentes não é duplicidade", () => {
    const analysis = analyzeEmployees([{ year: "2024" }, { year: "2025" }]);
    assert.equal(analysis.invalidCount, 0);
  });

  test("matrículas diferentes no mesmo mês/ano não são duplicidade", () => {
    const analysis = analyzeEmployees([{ registration: "M-001" }, { registration: "M-002" }]);
    assert.equal(analysis.invalidCount, 0);
  });

  test("linha com mês inválido fica fora da regra de duplicidade", () => {
    const analysis = analyzeEmployees([{ month: "13" }, { month: "3" }]);
    assert.deepEqual(duplicateIssues(analysis.rows[0]), []);
    assert.deepEqual(analysis.rows[1].issues, []);
  });

  test("linha com ano inválido fica fora da regra de duplicidade", () => {
    const analysis = analyzeEmployees([{ year: "abc" }, { year: "2025" }]);
    assert.deepEqual(duplicateIssues(analysis.rows[0]), []);
    assert.deepEqual(analysis.rows[1].issues, []);
  });

  test("matrículas vazias não são tratadas como duplicadas", () => {
    const analysis = analyzeEmployees([{ registration: "" }, { registration: "  " }]);
    assert.deepEqual(analysis.rows.map(duplicateIssues), [[], []]);
  });

  test("linha com outro erro (CPF) ainda participa da duplicidade", () => {
    const analysis = analyzeEmployees([{ cpf: "12345678900" }, {}]);
    assert.deepEqual(analysis.rows[0].issues, [CPF_ISSUE, `${DUPLICATE_PREFIX} (registros 3)`]);
    assert.deepEqual(analysis.rows[1].issues, [`${DUPLICATE_PREFIX} (registros 2)`]);
  });

  test("contagens consideram as duplicadas inválidas", () => {
    const analysis = analyzeEmployees([{}, { registration: "M-002" }, { registration: "m-001" }]);
    assert.equal(analysis.validCount, 1);
    assert.equal(analysis.invalidCount, 2);
  });

  test("não se aplica a estatísticas de cargo", () => {
    const { source, mapping } = makeSource("position-statistics", [{}, {}]);
    const analysis = analyzeRows(source, "position-statistics", mapping);
    assert.equal(analysis.validCount, 2);
    assert.equal(analysis.invalidCount, 0);
  });
});
