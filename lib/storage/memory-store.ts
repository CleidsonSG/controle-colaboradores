import { DEFAULT_SETTINGS, type CargoSalario, type ColaboradorPlanilha, type DataStore, type ImportKind, type ServidorECidade, type Settings, type StoredDataset } from "../import/types.ts";

/** Armazenamento em memória, usado em testes. */
export function createMemoryStore(): DataStore {
  const data = new Map<ImportKind, unknown>();
  let settings: Settings = { ...DEFAULT_SETTINGS };

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
    },
    async loadSettings() {
      return { ...settings };
    },
    async saveSettings(next) {
      settings = { ...next };
    },
  };
}
