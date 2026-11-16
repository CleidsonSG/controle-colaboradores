import type { Metadata } from "next";
import GestaoUsuarios from "@/components/gestao-usuarios";

export const metadata: Metadata = { title: "Configurações" };

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex max-w-2xl flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Gerencie quem acessa o sistema.</p>
      </header>
      <GestaoUsuarios />
    </div>
  );
}
