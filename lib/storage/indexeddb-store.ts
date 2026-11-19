import { DEFAULT_SETTINGS, type AjusteRemuneracao, type CargoSalario, type ColaboradorPlanilha, type CompetenciaImportada, type DataStore, type ImportKind, type RetratoFuncional, type ServidorECidade, type Settings, type StoredDataset } from "../import/types.ts";
import { ajustesVigentes, prepararAjusteLocal } from "../folha/ajustes.ts";
import { validarSubstituicao } from "../folha/historico.ts";

const DB_NAME = "controle-colaboradores";
const DB_VERSION = 3;
const DATASET_KEY = "dataset";
const STORE_BY_KIND: Record<ImportKind, string> = {
  ecidade: "servidoresComissionadosECidade",
  planilha: "colaboradoresTerceirizadosFusao",
  salarial: "tabelaSalarial",
};
const SETTINGS_STORE = "configuracoes";
const SETTINGS_KEY = "geral";
const KINDS = Object.keys(STORE_BY_KIND) as ImportKind[];
const COMPETENCIAS_STORE = "historicoCompetencias";
const RETRATOS_STORE = "historicoRetratos";
const AJUSTES_STORE = "ajustesRemuneracao";

/** Todas as chaves que começam por `prefixo` num keyPath composto (arrays ordenam depois de strings). */
const prefixRange = (prefixo: string) => IDBKeyRange.bound([prefixo], [prefixo, []]);

/** v3 (histórico e ajustes): só cria o que falta, sem tocar nas stores da v2. */
function upgradeHistorico(db: IDBDatabase) {
  if (!db.objectStoreNames.contains(COMPETENCIAS_STORE)) db.createObjectStore(COMPETENCIAS_STORE, { keyPath: "competencia" });
  if (!db.objectStoreNames.contains(RETRATOS_STORE)) {
    const retratos = db.createObjectStore(RETRATOS_STORE, { keyPath: ["competencia", "chaveIdentidade"] });
    retratos.createIndex("porPessoa", ["chaveIdentidade", "competencia"]);
    retratos.createIndex("porCompetencia", "competencia");
  }
  if (!db.objectStoreNames.contains(AJUSTES_STORE)) {
    db.createObjectStore(AJUSTES_STORE, { keyPath: "id", autoIncrement: true }).createIndex("porImportacao", ["importedAt", "posicao"]);
  }
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Falha ao acessar o armazenamento do navegador."));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new Error("Falha ao gravar no armazenamento do navegador."));
    transaction.onabort = () => reject(new Error("Gravação cancelada no armazenamento do navegador."));
  });
}

/** Armazenamento nativo no IndexedDB. Só deve ser criado e usado no cliente (efeitos e handlers). */
export function createIndexedDbStore(): DataStore {
  let dbPromise: Promise<IDBDatabase> | null = null;

  function openDb(): Promise<IDBDatabase> {
    dbPromise ??= new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        for (const kind of KINDS) {
          if (!request.result.objectStoreNames.contains(STORE_BY_KIND[kind])) {
            request.result.createObjectStore(STORE_BY_KIND[kind]);
          }
        }
        if (!request.result.objectStoreNames.contains(SETTINGS_STORE)) request.result.createObjectStore(SETTINGS_STORE);
        upgradeHistorico(request.result);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        dbPromise = null;
        reject(new Error("Não foi possível abrir o armazenamento do navegador."));
      };
    });
    return dbPromise;
  }

  function load(kind: "ecidade"): Promise<StoredDataset<ServidorECidade> | null>;
  function load(kind: "planilha"): Promise<StoredDataset<ColaboradorPlanilha> | null>;
  function load(kind: "salarial"): Promise<StoredDataset<CargoSalario> | null>;
  async function load(kind: ImportKind): Promise<unknown> {
    const db = await openDb();
    const store = db.transaction(STORE_BY_KIND[kind], "readonly").objectStore(STORE_BY_KIND[kind]);
    return (await requestToPromise(store.get(DATASET_KEY))) ?? null;
  }

  return {
    load,
    async replace(kind, dataset) {
      const db = await openDb();
      const transaction = db.transaction(STORE_BY_KIND[kind], "readwrite");
      const store = transaction.objectStore(STORE_BY_KIND[kind]);
      store.clear();
      store.put(dataset, DATASET_KEY);
      await transactionDone(transaction);
    },
    async clear(kind) {
      const db = await openDb();
      const names = (kind ? [kind] : KINDS).map((item) => STORE_BY_KIND[item]);
      if (!kind || kind === "planilha") names.push(AJUSTES_STORE);
      const transaction = db.transaction(names, "readwrite");
      for (const name of names) transaction.objectStore(name).clear();
      await transactionDone(transaction);
    },
    async loadSettings() {
      const db = await openDb();
      const store = db.transaction(SETTINGS_STORE, "readonly").objectStore(SETTINGS_STORE);
      const saved = (await requestToPromise(store.get(SETTINGS_KEY))) as Partial<Settings> | undefined;
      return { ...DEFAULT_SETTINGS, ...(saved ?? {}) };
    },
    async saveSettings(settings) {
      const db = await openDb();
      const transaction = db.transaction(SETTINGS_STORE, "readwrite");
      transaction.objectStore(SETTINGS_STORE).put(settings, SETTINGS_KEY);
      await transactionDone(transaction);
    },
    async replaceCompetencia(meta, retratos) {
      validarSubstituicao(meta.competencia, retratos);
      const db = await openDb();
      const transaction = db.transaction([COMPETENCIAS_STORE, RETRATOS_STORE], "readwrite");
      const competencia: CompetenciaImportada = { ...meta, total: retratos.length };
      transaction.objectStore(COMPETENCIAS_STORE).put(competencia);
      const store = transaction.objectStore(RETRATOS_STORE);
      store.delete(prefixRange(meta.competencia));
      for (const retrato of retratos) store.put({ ...retrato, competencia: meta.competencia } satisfies RetratoFuncional);
      await transactionDone(transaction);
      return retratos.length;
    },
    async listCompetencias() {
      const db = await openDb();
      const store = db.transaction(COMPETENCIAS_STORE, "readonly").objectStore(COMPETENCIAS_STORE);
      const lista = (await requestToPromise(store.getAll())) as CompetenciaImportada[];
      return lista.reverse();
    },
    async loadHistoricoPessoa(chave) {
      const db = await openDb();
      const index = db.transaction(RETRATOS_STORE, "readonly").objectStore(RETRATOS_STORE).index("porPessoa");
      const lista = (await requestToPromise(index.getAll(prefixRange(chave)))) as RetratoFuncional[];
      return lista.reverse();
    },
    async loadRetratosCompetencia(competencia) {
      const db = await openDb();
      const store = db.transaction(RETRATOS_STORE, "readonly").objectStore(RETRATOS_STORE);
      return (await requestToPromise(store.getAll(prefixRange(competencia)))) as RetratoFuncional[];
    },
    async clearHistorico(competencia) {
      const db = await openDb();
      const transaction = db.transaction([COMPETENCIAS_STORE, RETRATOS_STORE], "readwrite");
      if (competencia === undefined) {
        transaction.objectStore(COMPETENCIAS_STORE).clear();
        transaction.objectStore(RETRATOS_STORE).clear();
      } else {
        transaction.objectStore(COMPETENCIAS_STORE).delete(competencia);
        transaction.objectStore(RETRATOS_STORE).delete(prefixRange(competencia));
      }
      await transactionDone(transaction);
    },
    async saveAjuste(novo) {
      const db = await openDb();
      const transaction = db.transaction([STORE_BY_KIND.planilha, AJUSTES_STORE], "readwrite");
      const done = transactionDone(transaction);
      // Leituras e gravação na mesma transação: só requisições IDB entre os awaits, para ela não fechar.
      const planilha = ((await requestToPromise(transaction.objectStore(STORE_BY_KIND.planilha).get(DATASET_KEY))) ?? null) as StoredDataset<ColaboradorPlanilha> | null;
      const ajustes = transaction.objectStore(AJUSTES_STORE);
      const anteriores = (await requestToPromise(ajustes.index("porImportacao").getAll(IDBKeyRange.only([novo.importedAt, novo.posicao])))) as AjusteRemuneracao[];
      let linha: Omit<AjusteRemuneracao, "id">;
      try {
        linha = prepararAjusteLocal(planilha, novo, anteriores);
      } catch (error) {
        transaction.abort();
        await done.catch(() => undefined);
        throw error;
      }
      const id = Number(await requestToPromise(ajustes.add(linha)));
      await done;
      return { ...linha, id };
    },
    async saveAjustes(lote) {
      if (lote.length === 0) return [];
      const db = await openDb();
      const transaction = db.transaction([STORE_BY_KIND.planilha, AJUSTES_STORE], "readwrite");
      const done = transactionDone(transaction);
      try {
        const planilha = ((await requestToPromise(transaction.objectStore(STORE_BY_KIND.planilha).get(DATASET_KEY))) ?? null) as StoredDataset<ColaboradorPlanilha> | null;
        const ajustes = transaction.objectStore(AJUSTES_STORE);
        const linhas: Omit<AjusteRemuneracao, "id">[] = [];
        for (const novo of lote) {
          const anteriores = (await requestToPromise(ajustes.index("porImportacao").getAll(IDBKeyRange.only([novo.importedAt, novo.posicao])))) as AjusteRemuneracao[];
          linhas.push(prepararAjusteLocal(planilha, novo, anteriores));
        }
        const gravadas: AjusteRemuneracao[] = [];
        for (const linha of linhas) gravadas.push({ ...linha, id: Number(await requestToPromise(ajustes.add(linha))) });
        await done;
        return gravadas;
      } catch (error) {
        try {
          transaction.abort();
        } catch {
          // transação já encerrada
        }
        await done.catch(() => undefined);
        throw error;
      }
    },
    async loadAjustes(importedAt) {
      const db = await openDb();
      const index = db.transaction(AJUSTES_STORE, "readonly").objectStore(AJUSTES_STORE).index("porImportacao");
      const lista = (await requestToPromise(index.getAll(IDBKeyRange.bound([importedAt], [importedAt, []])))) as AjusteRemuneracao[];
      return ajustesVigentes(lista);
    },
  };
}
