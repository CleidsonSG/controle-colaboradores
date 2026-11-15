"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import {
  ChartColumn,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  LayoutGrid,
  Menu,
  Monitor,
  Moon,
  Settings,
  ShieldCheck,
  Sun,
  Upload,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const navigation: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutGrid },
  { label: "Funcionários", href: "/employees", icon: Users },
  { label: "Orçamento", href: "/budget", icon: Wallet },
  { label: "Importar Dados", href: "/", icon: Upload },
  { label: "Estatísticas de Cargo", href: "/statistics", icon: ChartColumn },
  { label: "Manutenção de Cargos", href: "/positions", icon: ClipboardList },
  { label: "Configurações", href: "/settings", icon: Settings },
  { label: "Ajuda", href: "/help", icon: CircleHelp },
];

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

const THEME_ICONS: Record<ThemePreference, LucideIcon> = { light: Sun, dark: Moon, system: Monitor };

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
    <div className="flex items-center gap-0.5 rounded-md border bg-muted p-0.5" role="radiogroup" aria-label="Tema da interface">
      {THEME_OPTIONS.map((item) => (
        <button
          key={item.value}
          ref={(element) => {
            refs.current[item.value] = element;
          }}
          className="inline-flex h-8 min-w-8 items-center justify-center gap-1.5 rounded-sm px-2 text-sm text-muted-foreground transition-colors hover:text-foreground aria-checked:bg-card aria-checked:text-foreground aria-checked:shadow-xs"
          type="button"
          role="radio"
          aria-checked={theme === item.value}
          aria-label={item.label}
          tabIndex={theme === item.value ? 0 : -1}
          onClick={() => applyTheme(item.value)}
          onKeyDown={onKeyDown}
        >
          {(() => {
            const Icon = THEME_ICONS[item.value];
            return <Icon className="size-4" aria-hidden="true" />;
          })()}
          <span className="hidden lg:inline" aria-hidden="true">{item.label}</span>
        </button>
      ))}
    </div>
  );
}

const MOBILE_QUERY = "(max-width: 767px)";

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

  const currentLabel = navigation.find((item) => item.href === current)?.label ?? "Início";

  return (
    <div className="min-h-dvh md:pl-64" onKeyDown={onShellKeyDown}>
      <a
        className="sr-only z-[60] rounded-md bg-primary px-4 py-2 text-primary-foreground focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
        href="#main-content"
      >
        Pular para o conteúdo
      </a>
      {menuOpen && (
        <button className="fixed inset-0 z-40 bg-foreground/40 md:hidden" type="button" aria-label="Fechar navegação" tabIndex={-1} onClick={closeMenu} />
      )}
      <div
        ref={sidebar}
        id="primary-navigation"
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar text-sidebar-foreground transition-transform duration-200 md:translate-x-0",
          menuOpen ? "translate-x-0" : "-translate-x-full",
          !menuOpen && "max-md:invisible",
        )}
      >
        <Link className="flex items-center gap-3 px-5 pt-6 pb-7 rounded-md focus-visible:outline-sidebar-ring" href="/" onClick={onNavigate}>
          <span className="grid size-9 place-items-center rounded-md bg-sidebar-ring/15 text-sidebar-ring" aria-hidden="true">
            <Users className="size-5" />
          </span>
          <span className="flex flex-col leading-tight">
            <span className="text-[0.95rem] font-semibold text-white">Controle</span>
            <span className="text-sm text-sidebar-muted">Colaboradores</span>
          </span>
        </Link>
        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3" aria-label="Navegação principal">
          {navigation.map((item) => {
            const active = current === item.href;
            const Icon = item.icon;
            return (
              <Link
                className={cn(
                  "relative flex min-h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors focus-visible:outline-sidebar-ring",
                  active
                    ? "bg-sidebar-accent font-medium text-white before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-sidebar-ring"
                    : "text-sidebar-foreground/85 hover:bg-sidebar-accent/60 hover:text-white",
                )}
                href={item.href}
                key={item.href}
                aria-current={active ? "page" : undefined}
                onClick={onNavigate}
              >
                <Icon className={cn("size-[18px] shrink-0", active ? "text-sidebar-ring" : "text-sidebar-muted")} aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="m-3 flex items-center gap-2.5 rounded-md border border-sidebar-border px-3 py-2.5 text-xs text-sidebar-muted">
          <ShieldCheck className="size-4 shrink-0 text-sidebar-ring" aria-hidden="true" />
          <span>Dados guardados só neste navegador</span>
        </div>
      </div>
      <div className="flex min-h-dvh flex-col" inert={isMobileMenuOpen}>
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/85 px-4 backdrop-blur-sm sm:px-6 lg:px-8">
          <Button
            ref={menuButton}
            className="md:hidden"
            variant="ghost"
            size="icon"
            type="button"
            aria-label={menuOpen ? "Fechar navegação" : "Abrir navegação"}
            aria-expanded={menuOpen}
            aria-controls="primary-navigation"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </Button>
          <p className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground">
            <span className="hidden sm:inline">Gestão de pessoas</span>
            <ChevronRight className="hidden size-4 sm:inline" aria-hidden="true" />
            <strong className="truncate font-medium text-foreground">{currentLabel}</strong>
          </p>
          <div className="ml-auto">
            <ThemeSwitch />
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 outline-none sm:px-6 lg:px-8" id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
