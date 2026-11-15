import type { Metadata } from "next";
import FolhaView from "@/components/folha-view";

export const metadata: Metadata = { title: "Orçamento" };

export default function BudgetPage() {
  return <FolhaView />;
}
