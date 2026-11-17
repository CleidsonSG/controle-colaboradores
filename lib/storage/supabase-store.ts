import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_SETTINGS, type AnyStoredDataset, type ColaboradorPlanilha, type DataStore, type ImportKind } from "../import/types.ts";

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

/** Indicação de um registro da planilha, guardada em `public.indicacoes` (só administradores leem e gravam). */
export type IndicacaoGuardada = { matricula: string; origem: string; indicacao: string };

const chaveIndicacao = (matricula: string, origem: string) => `${matricula}|${origem}`;

/** Separa a indicação dos registros: `publicos` vão para `datasets` (todos os aprovados leem) sem a coluna. */
export function separarIndicacoes(records: ColaboradorPlanilha[]): { publicos: Omit<ColaboradorPlanilha, "indicacao">[]; indicacoes: IndicacaoGuardada[] } {
  const publicos = records.map((record) => {
    const resto: Partial<ColaboradorPlanilha> = { ...record };
    delete resto.indicacao;
    return resto as Omit<ColaboradorPlanilha, "indicacao">;
  });
  const indicacoes = records.map((r) => ({ matricula: r.matricula, origem: r.origem, indicacao: r.indicacao ?? "" }));
  return { publicos, indicacoes };
}

/** Recoloca a indicação (mesma posição; se a ordem divergir, por matrícula + origem). Sem acesso → "". */
export function juntarIndicacoes(records: Record<string, unknown>[], indicacoes: IndicacaoGuardada[]): ColaboradorPlanilha[] {
  const porChave = new Map(indicacoes.map((i) => [chaveIndicacao(i.matricula, i.origem), i.indicacao]));
  return records.map((record, index) => {
    const matricula = String(record.matricula ?? "");
    const origem = String(record.origem ?? "");
    const mesmaPosicao = indicacoes[index];
    const indicacao = mesmaPosicao && mesmaPosicao.matricula === matricula && mesmaPosicao.origem === origem
      ? mesmaPosicao.indicacao
      : porChave.get(chaveIndicacao(matricula, origem)) ?? "";
    return { ...record, indicacao } as ColaboradorPlanilha;
  });
}

function fail(action: string, code?: string): never {
  if (code === SEM_PERMISSAO) throw new Error("Só administradores podem importar, apagar ou alterar os dados.");
  throw new Error(`Não foi possível ${action} no Supabase.`);
}

/**
 * Armazenamento no Supabase (tabelas `datasets` e `configuracoes`, ver supabase/schema.sql).
 * As regras (RLS) liberam a leitura para usuários aprovados e a gravação só para administradores.
 * A coluna "Indicação" da planilha fica à parte, em `indicacoes`, que só administradores leem (RLS).
 */
export function createSupabaseStore(supabase: SupabaseClient): DataStore {
  /** Não administrador recebe 0 linhas pela RLS; tabela ausente ou erro → sem indicações (nunca expõe nada). */
  async function loadIndicacoes(): Promise<IndicacaoGuardada[]> {
    const { data, error } = await supabase.from("indicacoes").select("records").eq("id", 1).maybeSingle<{ records: IndicacaoGuardada[] }>();
    if (error || !data || !Array.isArray(data.records)) return [];
    return data.records;
  }

  async function load(kind: ImportKind): Promise<AnyStoredDataset | null> {
    const { data, error } = await supabase.from("datasets").select("*").eq("kind", kind).maybeSingle<DatasetRow>();
    if (error) fail("ler os dados");
    if (!data) return null;
    const records = kind === "planilha"
      ? juntarIndicacoes(data.records as Record<string, unknown>[], await loadIndicacoes())
      : data.records;
    return {
      kind: data.kind,
      fileName: data.file_name,
      importedAt: data.imported_at,
      schemaVersion: 1,
      records,
      countsBySheet: data.counts_by_sheet ?? [],
      warnings: data.warnings ?? [],
    } as AnyStoredDataset;
  }

  return {
    load: load as DataStore["load"],
    async replace(kind, dataset) {
      let records: unknown[] = dataset.records;
      if (kind === "planilha") {
        // Indicações primeiro: se falhar (ex.: tabela ainda não criada), nada é alterado e o erro aparece.
        const separado = separarIndicacoes(dataset.records as ColaboradorPlanilha[]);
        const { error } = await supabase.from("indicacoes").upsert({ id: 1, records: separado.indicacoes }, { onConflict: "id" });
        if (error) fail("gravar as indicações", error.code);
        records = separado.publicos;
      }
      const row: DatasetRow = {
        kind,
        file_name: dataset.fileName,
        imported_at: dataset.importedAt,
        schema_version: dataset.schemaVersion,
        records,
        counts_by_sheet: dataset.countsBySheet,
        warnings: dataset.warnings,
      };
      const { error } = await supabase.from("datasets").upsert(row, { onConflict: "kind" });
      if (error) fail("gravar os dados", error.code);
    },
    async clear(kind) {
      const { error } = await supabase.from("datasets").delete().in("kind", kind ? [kind] : KINDS);
      if (error) fail("apagar os dados", error.code);
      if (kind && kind !== "planilha") return;
      const indicacoes = await supabase.from("indicacoes").delete().eq("id", 1);
      if (indicacoes.error) fail("apagar as indicações", indicacoes.error.code);
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
