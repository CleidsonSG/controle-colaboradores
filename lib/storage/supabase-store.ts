import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_SETTINGS, type AnyStoredDataset, type DataStore, type ImportKind } from "../import/types.ts";

const KINDS: ImportKind[] = ["ecidade", "planilha", "salarial"];

type DatasetRow = {
  kind: ImportKind;
  file_name: string;
  imported_at: string;
  schema_version: number;
  records: unknown[];
  counts_by_sheet: AnyStoredDataset["countsBySheet"];
  warnings: AnyStoredDataset["warnings"];
};

const SEM_PERMISSAO = "42501";

function fail(action: string, code?: string): never {
  if (code === SEM_PERMISSAO) throw new Error("Só administradores podem importar, apagar ou alterar os dados.");
  throw new Error(`Não foi possível ${action} no Supabase.`);
}

/**
 * Armazenamento no Supabase (tabelas `datasets` e `configuracoes`, ver supabase/schema.sql).
 * As regras (RLS) liberam a leitura para usuários aprovados e a gravação só para administradores.
 */
export function createSupabaseStore(supabase: SupabaseClient): DataStore {
  async function load(kind: ImportKind): Promise<AnyStoredDataset | null> {
    const { data, error } = await supabase.from("datasets").select("*").eq("kind", kind).maybeSingle<DatasetRow>();
    if (error) fail("ler os dados");
    if (!data) return null;
    return {
      kind: data.kind,
      fileName: data.file_name,
      importedAt: data.imported_at,
      schemaVersion: 1,
      records: data.records,
      countsBySheet: data.counts_by_sheet ?? [],
      warnings: data.warnings ?? [],
    } as AnyStoredDataset;
  }

  return {
    load: load as DataStore["load"],
    async replace(kind, dataset) {
      const row: DatasetRow = {
        kind,
        file_name: dataset.fileName,
        imported_at: dataset.importedAt,
        schema_version: dataset.schemaVersion,
        records: dataset.records,
        counts_by_sheet: dataset.countsBySheet,
        warnings: dataset.warnings,
      };
      const { error } = await supabase.from("datasets").upsert(row, { onConflict: "kind" });
      if (error) fail("gravar os dados", error.code);
    },
    async clear(kind) {
      const { error } = await supabase.from("datasets").delete().in("kind", kind ? [kind] : KINDS);
      if (error) fail("apagar os dados", error.code);
    },
    async loadSettings() {
      const { data, error } = await supabase.from("configuracoes").select("teto_folha_centavos").eq("id", 1).maybeSingle<{ teto_folha_centavos: number | null }>();
      if (error) fail("ler as configurações");
      return { ...DEFAULT_SETTINGS, tetoFolha: data?.teto_folha_centavos ?? null };
    },
    async saveSettings(settings) {
      const { error } = await supabase.from("configuracoes").upsert({ id: 1, teto_folha_centavos: settings.tetoFolha }, { onConflict: "id" });
      if (error) fail("gravar as configurações", error.code);
    },
  };
}
