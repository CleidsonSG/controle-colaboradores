import { DEFAULT_SETTINGS, type AjusteRemuneracao, type CargoSalario, type ColaboradorPlanilha, type CompetenciaImportada, type DataStore, type ImportKind, type RetratoFuncional, type ServidorECidade, type Settings, type StoredDataset } from "../import/types.ts";
import { ajustesVigentes, mesmoInstante, prepararAjusteLocal } from "../folha/ajustes.ts";
import { validarSubstituicao } from "../folha/historico.ts";

const porCompetenciaDesc = (a: { competencia: string }, b: { competencia: string }) => b.competencia.localeCompare(a.competencia);

/** Armazenamento em memória, usado em testes. */
export function createMemoryStore(): DataStore {
  const data = new Map<ImportKind, unknown>();
  let settings: Settings = { ...DEFAULT_SETTINGS };
  const competencias = new Map<string, CompetenciaImportada>();
  let retratos: RetratoFuncional[] = [];
  let ajustes: AjusteRemuneracao[] = [];
  let proximoId = 1;

  function load(kind: "ecidade"): Promise<StoredDataset<ServidorECidade> | null>;
  function load(kind: "planilha"): Promise<StoredDataset<ColaboradorPlanilha> | null>;
  function load(kind: "salarial"): Promise<StoredDataset<CargoSalario> | null>;
  async function load(kind: ImportKind): Promise<unknown> {
    const value = data.get(kind);
    return value === undefined ? null : structuredClone(value);
  }

  return {
    load,
    async replace(kind, dataset) {
      data.set(kind, structuredClone(dataset));
    },
    async clear(kind) {
      if (kind) data.delete(kind);
      else data.clear();
      if (!kind || kind === "planilha") ajustes = [];
    },
    async loadSettings() {
      return { ...settings };
    },
    async saveSettings(next) {
      settings = { ...next };
    },
    async replaceCompetencia(meta, novos) {
      validarSubstituicao(meta.competencia, novos);
      competencias.set(meta.competencia, { ...meta, total: novos.length });
      retratos = [...retratos.filter((r) => r.competencia !== meta.competencia), ...novos.map((r) => ({ ...r, competencia: meta.competencia }))];
      return novos.length;
    },
    async listCompetencias() {
      return [...competencias.values()].map((c) => ({ ...c })).sort(porCompetenciaDesc);
    },
    async loadHistoricoPessoa(chave) {
      return retratos.filter((r) => r.chaveIdentidade === chave).map((r) => ({ ...r })).sort(porCompetenciaDesc);
    },
    async loadRetratosCompetencia(competencia) {
      return retratos.filter((r) => r.competencia === competencia).map((r) => ({ ...r }));
    },
    async clearHistorico(competencia) {
      if (competencia === undefined) {
        competencias.clear();
        retratos = [];
        return;
      }
      competencias.delete(competencia);
      retratos = retratos.filter((r) => r.competencia !== competencia);
    },
    async saveAjuste(novo) {
      const planilha = (await load("planilha")) as StoredDataset<ColaboradorPlanilha> | null;
      const anteriores = ajustes.filter((a) => mesmoInstante(a.importedAt, novo.importedAt));
      const linha: AjusteRemuneracao = { ...prepararAjusteLocal(planilha, novo, anteriores), id: proximoId++ };
      ajustes.push(linha);
      return { ...linha };
    },
    async loadAjustes(importedAt) {
      return ajustesVigentes(ajustes.filter((a) => mesmoInstante(a.importedAt, importedAt))).map((a) => ({ ...a }));
    },
  };
}
