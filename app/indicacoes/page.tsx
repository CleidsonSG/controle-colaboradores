import type { Metadata } from "next";
import RelatorioIndicacoes from "@/components/relatorio-indicacoes";

export const metadata: Metadata = { title: "Relatório de indicações" };

export default function IndicacoesPage() {
  return <RelatorioIndicacoes />;
}
