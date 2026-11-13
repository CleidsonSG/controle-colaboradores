import { test } from "node:test";
import assert from "node:assert/strict";
import { detectKind, importFile, MAX_FILE_BYTES } from "../lib/import/index.ts";
import { buildXlsx, csvWindows1252 } from "./fixtures.mjs";

test("detectKind por extensão", () => {
  assert.equal(detectKind("a.csv"), "ecidade");
  assert.equal(detectKind("A.CSV"), "ecidade");
  assert.equal(detectKind("a.xlsx"), "planilha");
  assert.equal(detectKind("a.xlsm"), "planilha");
  assert.equal(detectKind("a.pdf"), null);
  assert.equal(detectKind("semextensao"), null);
});
test("formato inválido", async () => {
  await assert.rejects(() => importFile(new File(["x"], "a.txt")), (e) => e.code === "formato");
});
test("limite de 25 MB", async () => {
  const big = new File([new Uint8Array(MAX_FILE_BYTES + 1)], "a.csv");
  await assert.rejects(() => importFile(big), (e) => e.code === "tamanho");
});
test("arquivo vazio", async () => {
  await assert.rejects(() => importFile(new File([], "a.csv")), (e) => e.code === "vazio");
});
test("despacha CSV e XLSM", async () => {
  const c = await importFile(new File([csvWindows1252()], "a.csv"));
  assert.equal(c.kind, "ecidade");
  assert.equal(c.fileName, "a.csv");
  const x = await importFile(new File([await buildXlsx()], "p.xlsm"));
  assert.equal(x.kind, "planilha");
});
