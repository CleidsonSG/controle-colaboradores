import type { Metadata } from "next";
import ImportWorkspace from "@/components/import-workspace";

export const metadata: Metadata = { title: "Importar dados" };

export default function ImportPage() {
  return <ImportWorkspace />;
}
