"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";

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

type ThemePreference = "light" | "dark" | "system";

const THEME_KEY = "cc-theme";
const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Claro" },
  { value: "dark", label: "Escuro" },
  { value: "system", label: "Sistema" },
];
const themeListeners = new Set<() => void>();
let memoryTheme: ThemePreference = "system";

function readTheme(): ThemePreference {
  try {
    const saved = window.localStorage.getItem(THEME_KEY);
    if (saved === "light" || saved === "dark") return saved;
    if (saved === "system") return "system";
  } catch {
    return memoryTheme;
  }
  return memoryTheme;
}

function applyTheme(value: ThemePreference) {
  memoryTheme = value;
  if (value === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", value);
  try {
    if (value === "system") window.localStorage.removeItem(THEME_KEY);
    else window.localStorage.setItem(THEME_KEY, value);
  } catch {
    // Sem armazenamento: a preferência vale apenas nesta sessão.
  }
  themeListeners.forEach((listener) => listener());
}

function subscribeToTheme(onChange: () => void) {
  themeListeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    themeListeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function ThemeIcon({ name }: { name: ThemePreference }) {
  const paths: Record<ThemePreference, ReactNode> = {
    light: <><circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" /></>,
    dark: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" />,
    system: <><rect x="3" y="4.5" width="18" height="12" rx="2" /><path d="M9 20h6M12 16.5V20" /></>,
  };
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

function ThemeSwitch() {
  const theme = useSyncExternalStore(subscribeToTheme, readTheme, () => "system" as ThemePreference);
  const refs = useRef<Record<ThemePreference, HTMLButtonElement | null>>({ light: null, dark: null, system: null });

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const index = THEME_OPTIONS.findIndex((item) => item.value === theme);
    let next = -1;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % THEME_OPTIONS.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + THEME_OPTIONS.length) % THEME_OPTIONS.length;
    if (next < 0) return;
    event.preventDefault();
    const value = THEME_OPTIONS[next].value;
    applyTheme(value);
    refs.current[value]?.focus();
  }

  return (
    <div className="theme-switch" role="radiogroup" aria-label="Tema da interface">
      {THEME_OPTIONS.map((item) => (
        <button
          key={item.value}
          ref={(element) => {
            refs.current[item.value] = element;
          }}
          className="theme-option"
          type="button"
          role="radio"
          aria-checked={theme === item.value}
          aria-label={item.label}
          tabIndex={theme === item.value ? 0 : -1}
          onClick={() => applyTheme(item.value)}
          onKeyDown={onKeyDown}
        >
          <ThemeIcon name={item.value} />
          <span className="theme-label" aria-hidden="true">{item.label}</span>
        </button>
      ))}
    </div>
  );
}

const MOBILE_QUERY = "(max-width: 680px)";

function subscribeToMobileQuery(onChange: () => void) {
  const query = window.matchMedia(MOBILE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribeToMobileQuery,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false,
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const current = pathname.replace(/\/+$/, "") || "/";
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const isMobileMenuOpen = menuOpen && isMobile;

  useEffect(() => {
    if (isMobileMenuOpen) sidebar.current?.querySelector<HTMLAnchorElement>("a")?.focus();
  }, [isMobileMenuOpen]);

  function closeMenu() {
    setMenuOpen(false);
    menuButton.current?.focus();
  }

  function onShellKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && menuOpen) closeMenu();
  }

  function onNavigate() {
    if (!menuOpen) return;
    flushSync(() => setMenuOpen(false));
    document.getElementById("main-content")?.focus();
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
      {menuOpen && <button className="nav-scrim" type="button" aria-label="Fechar navegação" tabIndex={-1} onClick={closeMenu} />}
      <div ref={sidebar} id="primary-navigation" className={`sidebar${menuOpen ? " sidebar-open" : ""}`}>
        <Link className="brand" href="/" onClick={onNavigate}>
          <span className="brand-mark" aria-hidden="true"><span /></span>
          <span className="brand-name">Controle<span>Colaboradores</span></span>
        </Link>
        <div className="nav-caption">Área de gestão</div>
        <nav className="primary-navigation" aria-label="Navegação principal">
          {navigation.map((item) => {
            const active = current === item.href;
            return (
              <Link
                className={`nav-link${active ? " nav-link-active" : ""}`}
                href={item.href}
                key={item.href}
                aria-current={active ? "page" : undefined}
                onClick={onNavigate}
              >
                <NavIcon name={item.icon} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <span className="status-dot" aria-hidden="true" />
          <span>Dados só neste navegador</span>
        </div>
      </div>
      <div className="page-column" inert={isMobileMenuOpen}>
        <header className="topbar">
          <p className="topbar-trail">
            Gestão de pessoas <span aria-hidden="true">/</span> <strong>{navigation.find((item) => item.href === current)?.label ?? "Início"}</strong>
          </p>
          <ThemeSwitch />
        </header>
        <main className="main-content" id="main-content" tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}
