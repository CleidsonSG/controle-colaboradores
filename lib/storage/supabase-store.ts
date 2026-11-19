import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_SETTINGS, type AjusteRemuneracao, type AnyStoredDataset, type ColaboradorPlanilha, type CompetenciaImportada, type DataStore, type ImportKind, type Origem, type RetratoFuncional } from "../import/types.ts";
import { ajustesVigentes, MSG_FALHA_SALVAR, MSG_SO_ADMIN } from "../folha/ajustes.ts";
import { competenciaParaData, dataParaCompetencia } from "../folha/historico.ts";

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
const VALOR_INVALIDO = "22023";

type CompetenciaRow = { competencia: string; arquivo: string; importado_em: string; total: number };
type RetratoRow = {
  competencia: string;
  chave_identidade: string;
  origem: Origem;
  matricula: string;
  nome: string;
  empresa_secretaria: string;
  funcao: string;
  lotacao: string;
  possivel_duplicidade: boolean;
};
type AjusteRow = {
  id: number;
  importado_em: string;
  posicao: number;
  origem: Origem;
  linha: number;
  nome: string;
  valor_centavos: number;
  valor_anterior_centavos: number | null;
  alterado_por_nome: string;
  alterado_em: string;
};

const COLUNAS_COMPETENCIA = "competencia,arquivo,importado_em,total";
const COLUNAS_RETRATO = "competencia,chave_identidade,origem,matricula,nome,empresa_secretaria,funcao,lotacao,possivel_duplicidade";
const COLUNAS_AJUSTE = "id,importado_em,posicao,origem,linha,nome,valor_centavos,valor_anterior_centavos,alterado_por_nome,alterado_em";

const competenciaDeRow = (row: CompetenciaRow): CompetenciaImportada => ({
  competencia: dataParaCompetencia(row.competencia),
  fileName: row.arquivo,
  importedAt: row.importado_em,
  total: row.total,
});

const retratoDeRow = (row: RetratoRow): RetratoFuncional => ({
  competencia: dataParaCompetencia(row.competencia),
  chaveIdentidade: row.chave_identidade,
  origem: row.origem,
  matricula: row.matricula,
  nome: row.nome,
  empresaSecretaria: row.empresa_secretaria,
  funcao: row.funcao,
  lotacao: row.lotacao,
  possivelDuplicidade: row.possivel_duplicidade,
});

const ajusteDeRow = (row: AjusteRow): AjusteRemuneracao => ({
  id: Number(row.id),
  importedAt: row.importado_em,
  posicao: row.posicao,
  origem: row.origem,
  linha: row.linha,
  nome: row.nome,
  valorCentavos: Number(row.valor_centavos),
  valorAnteriorCentavos: row.valor_anterior_centavos === null ? null : Number(row.valor_anterior_centavos),
  alteradoPorNome: row.alterado_por_nome,
  alteradoEm: row.alterado_em,
});

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

  async function clearAjustes() {
    const { error } = await supabase.from("ajustes_remuneracao").delete().gte("id", 0);
    if (error) fail("apagar os ajustes de remuneração", error.code);
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
      await clearAjustes();
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
    async replaceCompetencia(meta, retratos) {
      const { data, error } = await supabase.rpc("substituir_historico_competencia", {
        p_competencia: competenciaParaData(meta.competencia),
        p_arquivo: meta.fileName.slice(0, 255),
        p_importado_em: meta.importedAt,
        p_retratos: retratos.map((r) => ({
          chave_identidade: r.chaveIdentidade,
          origem: r.origem,
          matricula: r.matricula,
          nome: r.nome,
          empresa_secretaria: r.empresaSecretaria,
          funcao: r.funcao,
          lotacao: r.lotacao,
          possivel_duplicidade: r.possivelDuplicidade,
        })),
      });
      if (error) {
        if (error.code === VALOR_INVALIDO && error.message) throw new Error(error.message);
        fail("gravar o histórico da competência", error.code);
      }
      return typeof data === "number" ? data : retratos.length;
    },
    async listCompetencias() {
      const { data, error } = await supabase.from("historico_competencias").select(COLUNAS_COMPETENCIA).order("competencia", { ascending: false });
      if (error) fail("ler as competências");
      return ((data ?? []) as CompetenciaRow[]).map(competenciaDeRow);
    },
    async loadHistoricoPessoa(chave) {
      const { data, error } = await supabase.from("historico_retratos").select(COLUNAS_RETRATO).eq("chave_identidade", chave).order("competencia", { ascending: false });
      if (error) fail("ler o histórico");
      return ((data ?? []) as RetratoRow[]).map(retratoDeRow);
    },
    async loadRetratosCompetencia(competencia) {
      const { data, error } = await supabase.from("historico_retratos").select(COLUNAS_RETRATO).eq("competencia", competenciaParaData(competencia));
      if (error) fail("ler o histórico");
      return ((data ?? []) as RetratoRow[]).map(retratoDeRow);
    },
    async clearHistorico(competencia) {
      const query = supabase.from("historico_competencias").delete();
      const { error } = competencia === undefined ? await query.gte("competencia", "2000-01-01") : await query.eq("competencia", competenciaParaData(competencia));
      if (error) fail("apagar o histórico", error.code);
    },
    async saveAjuste(novo) {
      const { data, error } = await supabase
        .from("ajustes_remuneracao")
        .insert({ importado_em: novo.importedAt, posicao: novo.posicao, origem: novo.origem, linha: novo.linha, valor_centavos: novo.valorCentavos })
        .select(COLUNAS_AJUSTE)
        .single<AjusteRow>();
      if (error) {
        if (error.code === SEM_PERMISSAO) throw new Error(MSG_SO_ADMIN);
        if (error.code === VALOR_INVALIDO && error.message) throw new Error(error.message);
        throw new Error(MSG_FALHA_SALVAR);
      }
      if (!data) throw new Error(MSG_SO_ADMIN);
      return ajusteDeRow(data);
    },
    async saveAjustes(lote) {
      if (lote.length === 0) return [];
      // Um único insert de várias linhas: o PostgREST grava tudo ou nada.
      const { data, error } = await supabase
        .from("ajustes_remuneracao")
        .insert(lote.map((novo) => ({ importado_em: novo.importedAt, posicao: novo.posicao, origem: novo.origem, linha: novo.linha, valor_centavos: novo.valorCentavos })))
        .select(COLUNAS_AJUSTE);
      if (error) {
        if (error.code === SEM_PERMISSAO) throw new Error(MSG_SO_ADMIN);
        if (error.code === VALOR_INVALIDO && error.message) throw new Error(error.message);
        throw new Error(MSG_FALHA_SALVAR);
      }
      if (!data || data.length !== lote.length) throw new Error(MSG_SO_ADMIN);
      return (data as AjusteRow[]).map(ajusteDeRow);
    },
    async loadAjustes(importedAt) {
      const { data, error } = await supabase.from("ajustes_remuneracao").select(COLUNAS_AJUSTE).eq("importado_em", importedAt).order("id", { ascending: false });
      if (error) fail("ler os ajustes de remuneração");
      return ajustesVigentes(((data ?? []) as AjusteRow[]).map(ajusteDeRow));
    },
  };
}
