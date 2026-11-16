import type { Metadata } from "next";
import Orcamento from "@/components/orcamento";

export const metadata: Metadata = { title: "Orçamento" };

export default function BudgetPage() {
  return <Orcamento />;
}
