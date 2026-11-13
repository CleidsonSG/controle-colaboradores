import type { ColaboradorPlanilha, DataStore, ImportKind, ServidorECidade, StoredDataset } from "../import/types.ts";

const DB_NAME = "controle-colaboradores";
const DB_VERSION = 1;
const DATASET_KEY = "dataset";
const STORE_BY_KIND: Record<ImportKind, string> = {
  ecidade: "servidoresComissionadosECidade",
  planilha: "colaboradoresTerceirizadosFusao",
};
const KINDS = Object.keys(STORE_BY_KIND) as ImportKind[];

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
      const transaction = db.transaction(names, "readwrite");
      for (const name of names) transaction.objectStore(name).clear();
      await transactionDone(transaction);
    },
  };
}
