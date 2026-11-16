import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import AppShell from "@/components/app-shell";
import AuthGate from "@/components/auth-gate";
import "./globals.css";

// Public Sans: tipografia criada para serviços públicos, empacotada no build (sem CDN em tempo de execução).
const publicSans = localFont({
  src: "../node_modules/@fontsource-variable/public-sans/files/public-sans-latin-wght-normal.woff2",
  variable: "--font-public-sans",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Painel de cargos · Controle Colaboradores",
    template: "%s · Controle Colaboradores",
  },
  description: "Painel de cargos, vagas e folha de pagamento.",
};

// Aplica o tema salvo antes da primeira pintura (evita flash). Sem valor salvo, vale o tema do sistema.
const THEME_SCRIPT = `try{var t=localStorage.getItem("cc-theme");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR" className={publicSans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <AuthGate>
          <AppShell>{children}</AppShell>
        </AuthGate>
      </body>
    </html>
  );
}
