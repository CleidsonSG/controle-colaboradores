import { createIndexedDbStore } from "./indexeddb-store.ts";
import type { DataStore } from "../import/types.ts";

export { createMemoryStore } from "./memory-store.ts";
export type { DataStore, StoredDataset } from "./types.ts";

let store: DataStore | null = null;

/** Retorna o armazenamento do navegador (IndexedDB). Chamar apenas no cliente, em efeitos ou handlers. */
export function getDataStore(): DataStore {
  if (typeof indexedDB === "undefined") {
    throw new Error("O armazenamento do navegador não está disponível neste ambiente.");
  }
  store ??= createIndexedDbStore();
  return store;
}
