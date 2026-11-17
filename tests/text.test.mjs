import { test } from "node:test";
import assert from "node:assert/strict";
import { decodeText, detectDelimiter, formatDateBr, matriculaToText, normalizeHeader, parseDateToIso, parseMoney } from "../lib/import/text.ts";
import { csvUtf8Bom, csvWindows1252, toArrayBuffer } from "./fixtures.mjs";

test("normalizeHeader remove acentos, caixa e espaços", () => {
  assert.equal(normalizeHeader("  Descrição   do CARGO "), "descricao do cargo");
  assert.equal(normalizeHeader("Matrícula"), "matricula");
  assert.equal(normalizeHeader("LOTAÇÃO"), "lotacao");
});

test("decodeText: utf-8 e acentos", () => {
  assert.equal(decodeText(toArrayBuffer(Buffer.from("Conceição", "utf8"))), "Conceição");
});
test("decodeText: windows-1252 com byte 0x93", () => {
  const out = decodeText(csvWindows1252());
  assert.ok(out.includes("Conceição"));
  assert.ok(out.includes("“Administrativo"));
  assert.ok(!out.includes("�"));
});
test("decodeText: remove BOM", () => {
  const out = decodeText(csvUtf8Bom());
  assert.notEqual(out.charCodeAt(0), 0xfeff);
  assert.ok(out.startsWith("FUNCION"));
});

test("detectDelimiter", () => {
  assert.equal(detectDelimiter("a;b;c"), ";");
  assert.equal(detectDelimiter("a,b,c"), ",");
  assert.equal(detectDelimiter("a\tb\tc"), "\t");
  assert.equal(detectDelimiter("a;b,c"), ";");
  assert.equal(detectDelimiter("abc"), ";");
});

test("datas dd/mm/aaaa para ISO", () => {
  assert.deepEqual(parseDateToIso("05/03/2020"), { iso: "2020-03-05", invalid: false });
  assert.deepEqual(parseDateToIso(""), { iso: null, invalid: false });
});
test("29/02 bissexto valido, nao bissexto invalido", () => {
  assert.equal(parseDateToIso("29/02/2020").iso, "2020-02-29");
  assert.equal(parseDateToIso("29/02/2021").invalid, true);
});
test("31/02 e texto invalidos", () => {
  assert.deepEqual(parseDateToIso("31/02/2020"), { iso: null, invalid: true });
  assert.equal(parseDateToIso("abc").invalid, true);
});
test("formatDateBr", () => {
  assert.equal(formatDateBr("2020-03-05"), "05/03/2020");
  assert.equal(formatDateBr(null), "");
});

test("dinheiro pt-BR", () => {
  assert.deepEqual(parseMoney("R$ 1.234,56"), { value: 1234.56, invalid: false });
  assert.deepEqual(parseMoney("1.234"), { value: 1234, invalid: false });
  assert.deepEqual(parseMoney(10.5), { value: 10.5, invalid: false });
  assert.deepEqual(parseMoney(null), { value: null, invalid: false });
  assert.deepEqual(parseMoney(""), { value: null, invalid: false });
  assert.equal(parseMoney("abc").invalid, true);
});

test("matrícula numérica vira texto", () => {
  assert.equal(matriculaToText(2001), "2001");
  assert.equal(matriculaToText(123456789012345), "123456789012345");
  assert.equal(matriculaToText(" 77 "), "77");
});

import { normalizeIndicacao, normalizeLabel, parseMoney as parseMoneyTolerante } from "../lib/import/text.ts";
test("normalizeLabel/normalizeIndicacao", () => {
  assert.equal(normalizeLabel("  SECRETARIA   DE  SAÚDE "), "SECRETARIA DE SAÚDE");
  assert.equal(normalizeLabel("Assessor TI"), "Assessor TI");
  assert.equal(normalizeIndicacao(""), "SEM INDICAÇÃO");
  assert.equal(normalizeIndicacao(" sem   indicação. "), "SEM INDICAÇÃO");
  assert.equal(normalizeIndicacao("FULANO DA SILVA"), "FULANO DA SILVA");
});
test("parseMoney tolerante", () => {
  for (const [entrada, esperado] of [["R$ 1.234,56", 1234.56], ["1234,5", 1234.5], ["R$1500", 1500], ["1.234.567", 1234567], ["R$ 0,00", 0], [" ", null]]) {
    assert.equal(parseMoneyTolerante(entrada).value, esperado);
  }
  assert.equal(parseMoneyTolerante("abc").invalid, true);
});
