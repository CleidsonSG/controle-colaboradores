import { test } from "node:test";
import assert from "node:assert/strict";
import { createSupabaseStore, juntarIndicacoes, separarIndicacoes } from "../lib/storage/supabase-store.ts";

/** Cliente falso: tabelas em memória; `isAdmin = false` imita a RLS (0 linhas / erro 42501 em indicacoes). */
function fakeClient({ isAdmin = true, failIndicacoes = false } = {}) {
  const tables = { datasets: new Map(), indicacoes: new Map(), configuracoes: new Map() };
  const keyOf = (table, row) => (table === "datasets" ? row.kind : row.id);
  const denied = (table) => table === "indicacoes" && (!isAdmin || failIndicacoes);
  const from = (table) => {
    const filters = [];
    const rows = () => [...tables[table].values()].filter((r) => filters.every(([c, v]) => (Array.isArray(v) ? v.includes(r[c]) : r[c] === v)));
    const q = {
      select: () => q,
      eq: (c, v) => (filters.push([c, v]), q),
      in: (c, v) => (filters.push([c, v]), q),
      maybeSingle: async () => (denied(table) && failIndicacoes ? { data: null, error: { code: "42P01" } } : { data: denied(table) ? null : rows()[0] ?? null, error: null }),
      upsert: async (row) => {
        if (denied(table)) return { error: { code: failIndicacoes ? "42P01" : "42501" } };
        tables[table].set(keyOf(table, row), structuredClone(row));
        return { error: null };
      },
      delete: () => {
        const d = {
          eq: (c, v) => (filters.push([c, v]), d),
          in: (c, v) => (filters.push([c, v]), d),
          then: (resolve) => {
            if (!denied(table)) for (const r of rows()) tables[table].delete(keyOf(table, r));
            resolve({ error: null });
          },
        };
        return d;
      },
    };
    return q;
  };
  return { client: { from }, tables };
}

const rec = (matricula, origem, indicacao) => ({ matricula, servidor: `Pessoa Teste ${matricula}`, empresaSecretaria: "Empresa X", lotacao: "Lot", funcao: "F", remuneracao: 1, alimentacao: 1, indicacao, origem, linha: 2, possivelDuplicidade: false });
const dataset = (records) => ({ kind: "planilha", fileName: "p.xlsx", importedAt: "2026-01-01T00:00:00.000Z", schemaVersion: 1, records, countsBySheet: [], warnings: [] });

test("indicação não vai para datasets e volta para o administrador", async () => {
  const { client, tables } = fakeClient();
  const store = createSupabaseStore(client);
  await store.replace("planilha", dataset([rec("1", "Comissionado", "Indicador A"), rec("2", "Terceirizado", "SEM INDICAÇÃO")]));
  assert.ok(tables.datasets.get("planilha").records.every((r) => !("indicacao" in r)));
  const loaded = await store.load("planilha");
  assert.deepEqual(loaded.records.map((r) => r.indicacao), ["Indicador A", "SEM INDICAÇÃO"]);
});

test("usuário comum não recebe indicações", async () => {
  const admin = fakeClient();
  await createSupabaseStore(admin.client).replace("planilha", dataset([rec("1", "Comissionado", "Indicador A")]));
  const comum = fakeClient({ isAdmin: false });
  comum.tables.datasets = admin.tables.datasets;
  comum.tables.indicacoes = admin.tables.indicacoes;
  const loaded = await createSupabaseStore(comum.client).load("planilha");
  assert.equal(loaded.records[0].indicacao, "");
  assert.equal(loaded.records[0].servidor, "Pessoa Teste 1");
});

test("falha ao gravar indicações não altera datasets", async () => {
  const { client, tables } = fakeClient({ failIndicacoes: true });
  await assert.rejects(createSupabaseStore(client).replace("planilha", dataset([rec("1", "Comissionado", "X")])));
  assert.equal(tables.datasets.size, 0);
});

test("clear da planilha apaga as indicações", async () => {
  const { client, tables } = fakeClient();
  const store = createSupabaseStore(client);
  await store.replace("planilha", dataset([rec("1", "Comissionado", "X")]));
  await store.clear("planilha");
  assert.equal(tables.indicacoes.size, 0);
});

test("juntar por matrícula + origem quando a ordem diverge", () => {
  const { publicos, indicacoes } = separarIndicacoes([rec("1", "Comissionado", "A"), rec("2", "Terceirizado", "B")]);
  const juntos = juntarIndicacoes([publicos[1], publicos[0], { matricula: "9", origem: "Comissionado" }], indicacoes);
  assert.deepEqual(juntos.map((r) => r.indicacao), ["B", "A", ""]);
});
