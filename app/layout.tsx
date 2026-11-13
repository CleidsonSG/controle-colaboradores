import type { Metadata } from "next";
import type { ReactNode } from "react";
import AppShell from "@/components/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Importar dados · Controle Colaboradores",
    template: "%s · Controle Colaboradores",
  },
  description: "Prévia local de importação para gestão de colaboradores.",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
