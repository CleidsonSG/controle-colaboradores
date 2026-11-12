"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, type KeyboardEvent, type ReactNode } from "react";

const navigation = [
  { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
  { label: "Funcionários", href: "/employees", icon: "people" },
  { label: "Orçamento", href: "/budget", icon: "budget" },
  { label: "Importar Dados", href: "/", icon: "import" },
  { label: "Estatísticas de Cargo", href: "/statistics", icon: "chart" },
  { label: "Manutenção de Cargos", href: "/positions", icon: "roles" },
  { label: "Configurações", href: "/settings", icon: "settings" },
  { label: "Ajuda", href: "/help", icon: "help" },
];

function NavIcon({ name }: { name: string }) {
  const common = { width: 19, height: 19, viewBox: "0 0 24 24", fill: "none", "aria-hidden": true as const };
  const paths: Record<string, ReactNode> = {
    dashboard: <><rect x="3.5" y="3.5" width="7" height="7" rx="1" /><rect x="13.5" y="3.5" width="7" height="7" rx="1" /><rect x="3.5" y="13.5" width="7" height="7" rx="1" /><rect x="13.5" y="13.5" width="7" height="7" rx="1" /></>,
    people: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19v-1a5.5 5.5 0 0 1 11 0v1zM16 5.5a3 3 0 0 1 0 5.8M18 14a4.5 4.5 0 0 1 2.5 4v1" /></>,
    budget: <><path d="M4 5.5h16v13H4zM8 9h8M8 13h3M16.5 12.5h.01" /><path d="M7 5.5V3.8h10v1.7" /></>,
    import: <><path d="M12 15V4m0 0L8 8m4-4 4 4M5 14v5h14v-5" /></>,
    chart: <><path d="M4 19.5h16M6.5 16v-5m5 5V5m5 11v-8" /><circle cx="6.5" cy="9" r="1" /><circle cx="11.5" cy="3" r="1" /><circle cx="16.5" cy="6" r="1" /></>,
    roles: <><path d="M5 4.5h14v15H5zM8 8h8M8 12h5M8 16h3" /><path d="m15.5 15.5 1.5 1.5 3-3" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.5 1.2-1.5 2.6-1.8-.7a7.8 7.8 0 0 1-1.5.9l-.3 1.9h-3l-.3-1.9a7.8 7.8 0 0 1-1.5-.9l-1.8.7-1.5-2.6L7.3 15a7.7 7.7 0 0 1 0-1.8l-1.5-1.3 1.5-2.6 1.8.7a7.8 7.8 0 0 1 1.5-.9l.3-1.9h3l.3 1.9a7.8 7.8 0 0 1 1.5.9l1.8-.7 1.5 2.6-1.5 1.3a7.7 7.7 0 0 1 0 1.8Z" /></>,
    help: <><circle cx="12" cy="12" r="8.5" /><path d="M9.8 9a2.3 2.3 0 1 1 3.9 1.7c-1 .9-1.7 1.2-1.7 2.8M12 17h.01" /></>,
  };
  return (
    <svg {...common} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  function onShellKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && menuOpen) {
      setMenuOpen(false);
      menuButton.current?.focus();
    }
  }

  return (
    <div className="app-frame" onKeyDown={onShellKeyDown}>
      <a className="skip-link" href="#main-content">Pular para o conteúdo</a>
      <button
        ref={menuButton}
        className="mobile-menu-button"
        type="button"
        aria-label={menuOpen ? "Fechar navegação" : "Abrir navegação"}
        aria-expanded={menuOpen}
        aria-controls="primary-navigation"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span aria-hidden="true">{menuOpen ? "×" : "☰"}</span>
      </button>
      {menuOpen && <button className="nav-scrim" type="button" aria-label="Fechar navegação" tabIndex={-1} onClick={() => { setMenuOpen(false); menuButton.current?.focus(); }} />}
      <aside className={`sidebar${menuOpen ? " sidebar-open" : ""}`}>
        <Link className="brand" href="/" onClick={() => setMenuOpen(false)}>
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span className="brand-name">Controle<span>Colaboradores</span></span>
        </Link>
        <div className="nav-caption">ÁREA DE GESTÃO</div>
        <nav id="primary-navigation" className="primary-navigation" aria-label="Navegação principal">
          {navigation.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname === item.href;
            return (
              <Link
                className={`nav-link${active ? " nav-link-active" : ""}`}
                href={item.href}
                key={item.href}
                aria-current={active ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
              >
                <NavIcon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <span className="status-dot" aria-hidden="true" />
          <span>Prévia local · sem backend</span>
        </div>
      </aside>
      <div className="page-column">
        <header className="topbar">
          <p>GESTÃO DE PESSOAS <span aria-hidden="true">/</span> AMBIENTE DE PRÉVIA</p>
          <span className="topbar-badge"><span aria-hidden="true" /> MVP local</span>
        </header>
        <main className="main-content" id="main-content" tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}
