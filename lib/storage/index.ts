import { createIndexedDbStore } from "./indexeddb-store.ts";
import { createSupabaseStore } from "./supabase-store.ts";
import { getSupabase, isSupabaseConfigured } from "../supabase/client.ts";
import type { DataStore } from "../import/types.ts";

export { createMemoryStore } from "./memory-store.ts";
export type { DataStore, StoredDataset } from "./types.ts";

let store: DataStore | null = null;

/** Onde os dados ficam: "supabase" (com login) quando configurado; senão "local" (IndexedDB deste navegador). */
export function storageMode(): "supabase" | "local" {
  return isSupabaseConfigured() ? "supabase" : "local";
}

/** Retorna o armazenamento ativo. Chamar apenas no cliente, em efeitos ou handlers. */
export function getDataStore(): DataStore {
  if (store) return store;
  if (isSupabaseConfigured()) {
    store = createSupabaseStore(getSupabase());
    return store;
  }
  if (typeof indexedDB === "undefined") {
    throw new Error("O armazenamento do navegador não está disponível neste ambiente.");
  }
  store = createIndexedDbStore();
  return store;
}
