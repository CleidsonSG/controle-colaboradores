"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_SETTINGS, type CargoSalario, type ColaboradorPlanilha, type ServidorECidade, type Settings, type StoredDataset } from "@/lib/import";
import { getDataStore } from "@/lib/storage";

export type DadosImportados =
  | { status: "loading" }
  | { status: "error" }
  | {
      status: "ready";
      ecidade: StoredDataset<ServidorECidade> | null;
      planilha: StoredDataset<ColaboradorPlanilha> | null;
      salarial: StoredDataset<CargoSalario> | null;
      settings: Settings;
    };

/** Carrega os três conjuntos importados e as configurações do armazenamento ativo (Supabase ou navegador). */
export function useDadosImportados() {
  const [dados, setDados] = useState<DadosImportados>({ status: "loading" });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const store = getDataStore();
        const [ecidade, planilha, salarial, settings] = await Promise.all([
          store.load("ecidade"),
          store.load("planilha"),
          store.load("salarial"),
          store.loadSettings().catch(() => DEFAULT_SETTINGS),
        ]);
        if (active) setDados({ status: "ready", ecidade, planilha, salarial, settings });
      } catch {
        if (active) setDados({ status: "error" });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  /** Grava o teto e atualiza a tela; lança erro se não conseguir gravar. */
  const salvarTeto = useCallback(async (tetoFolha: number | null) => {
    await getDataStore().saveSettings({ tetoFolha });
    setDados((atual) => (atual.status === "ready" ? { ...atual, settings: { ...atual.settings, tetoFolha } } : atual));
  }, []);

  return { dados, salvarTeto };
}
