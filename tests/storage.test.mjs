import { test } from "node:test";
import assert from "node:assert/strict";
import { createMemoryStore } from "../lib/storage/memory-store.ts";

const ds = (kind, n) => ({
  kind,
  fileName: `${kind}.f`,
  records: Array.from({ length: n }, (_, i) => ({ matricula: String(i) })),
  countsBySheet: [],
  warnings: [],
  schemaVersion: 1,
  importedAt: "2026-01-01T00:00:00.000Z",
});

test("load vazio retorna null", async () => {
  const s = createMemoryStore();
  assert.equal(await s.load("ecidade"), null);
  assert.equal(await s.load("planilha"), null);
});
test("replace substitui o conjunto do tipo", async () => {
  const s = createMemoryStore();
  await s.replace("ecidade", ds("ecidade", 3));
  await s.replace("ecidade", ds("ecidade", 1));
  assert.equal((await s.load("ecidade")).records.length, 1);
});
test("tipos são independentes", async () => {
  const s = createMemoryStore();
  await s.replace("ecidade", ds("ecidade", 2));
  await s.replace("planilha", ds("planilha", 5));
  await s.clear("ecidade");
  assert.equal(await s.load("ecidade"), null);
  assert.equal((await s.load("planilha")).records.length, 5);
});
test("clear geral limpa tudo", async () => {
  const s = createMemoryStore();
  await s.replace("ecidade", ds("ecidade", 2));
  await s.replace("planilha", ds("planilha", 2));
  await s.clear();
  assert.equal(await s.load("ecidade"), null);
  assert.equal(await s.load("planilha"), null);
});
test("dados retornados são cópias", async () => {
  const s = createMemoryStore();
  await s.replace("ecidade", ds("ecidade", 2));
  (await s.load("ecidade")).records.length = 0;
  assert.equal((await s.load("ecidade")).records.length, 2);
});
