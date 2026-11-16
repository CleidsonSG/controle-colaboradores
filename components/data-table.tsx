"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { buildCsvBlob } from "@/lib/export-data";
import { formatDateBr } from "@/lib/import";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type ColumnKind = "text" | "date" | "money";

export type Column<T> = {
  key: string;
  header: string;
  kind?: ColumnKind;
  /** Valor bruto: texto, número, data ISO (aaaa-mm-dd) ou nulo. */
  value: (row: T) => string | number | null;
  /** Conteúdo visual opcional (ex.: selo). A busca e a exportação usam o texto formatado. */
  render?: (row: T) => ReactNode;
};

type SortState = { key: string; direction: "asc" | "desc" } | null;

export const PAGE_SIZE = 50;

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatMoney(value: number | null): string {
  return value === null ? "" : currency.format(value);
}

export function formatCell(kind: ColumnKind | undefined, raw: string | number | null): string {
  if (raw === null || raw === "") return "";
  if (kind === "date") return formatDateBr(String(raw));
  if (kind === "money") return typeof raw === "number" ? formatMoney(raw) : String(raw);
  return String(raw);
}

export function normalizeSearch(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function compareValues(a: string | number | null, b: string | number | null): number {
  if (a === null || a === "") return b === null || b === "" ? 0 : 1;
  if (b === null || b === "") return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "pt-BR", { numeric: true, sensitivity: "base" });
}

type DataTableProps<T> = {
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  exportFileName: string;
  /** Recebe as linhas após a busca (antes da paginação), para somas e rodapés. */
  footer?: (rows: T[]) => ReactNode;
  emptyMessage?: string;
};

export default function DataTable<T>({ caption, columns, rows, rowKey, exportFileName, footer, emptyMessage }: DataTableProps<T>) {
  const searchId = useId();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState>(null);
  const [page, setPage] = useState(0);
  // Filtros externos mudam o array de linhas: volta para a 1ª página.
  const [previousRows, setPreviousRows] = useState(rows);
  if (previousRows !== rows) {
    setPreviousRows(rows);
    setPage(0);
  }

  const searched = useMemo(() => {
    const needle = normalizeSearch(query);
    if (!needle) return rows;
    return rows.filter((row) =>
      columns.some((column) => normalizeSearch(formatCell(column.kind, column.value(row))).includes(needle)),
    );
  }, [rows, columns, query]);

  const sorted = useMemo(() => {
    if (!sort) return searched;
    const column = columns.find((item) => item.key === sort.key);
    if (!column) return searched;
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...searched].sort((a, b) => factor * compareValues(column.value(a), column.value(b)));
  }, [searched, columns, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = sorted.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const first = sorted.length === 0 ? 0 : currentPage * PAGE_SIZE + 1;
  const last = currentPage * PAGE_SIZE + visible.length;

  function toggleSort(key: string) {
    setPage(0);
    setSort((current) => {
      if (!current || current.key !== key) return { key, direction: "asc" };
      return current.direction === "asc" ? { key, direction: "desc" } : null;
    });
  }

  function exportCsv() {
    const blob = buildCsvBlob(
      columns.map((column) => column.header),
      sorted.map((row) => columns.map((column) => formatCell(column.kind, column.value(row)))),
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = exportFileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const SortIcon = (active: "asc" | "desc" | null) => (active === "asc" ? ArrowUp : active === "desc" ? ArrowDown : ArrowUpDown);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex w-full flex-col gap-1.5 sm:max-w-sm">
          <label className="text-sm font-medium" htmlFor={searchId}>Buscar</label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id={searchId}
              className="pl-9"
              type="search"
              value={query}
              placeholder="Nome, matrícula, cargo…"
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
            />
          </div>
        </div>
        <Button variant="outline" type="button" onClick={exportCsv} disabled={sorted.length === 0}>
          <Download aria-hidden="true" />
          Exportar CSV
        </Button>
      </div>
      <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
        <span className="font-medium text-foreground tabular-nums">{sorted.length.toLocaleString("pt-BR")}</span> de{" "}
        <span className="tabular-nums">{rows.length.toLocaleString("pt-BR")}</span> registros
      </p>
      <div className="max-h-[65vh] overflow-auto rounded-lg border bg-card" tabIndex={0} role="region" aria-label={caption}>
        <Table>
          <caption className="sr-only">{caption}</caption>
          <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm">
            <TableRow className="hover:bg-transparent">
              {columns.map((column) => {
                const active = sort?.key === column.key ? sort.direction : null;
                const Icon = SortIcon(active);
                return (
                  <TableHead
                    key={column.key}
                    scope="col"
                    className={cn(column.kind === "money" && "text-right")}
                    aria-sort={active === "asc" ? "ascending" : active === "desc" ? "descending" : "none"}
                  >
                    <button
                      className={cn(
                        "-mx-1.5 inline-flex min-h-8 items-center gap-1.5 rounded-sm px-1.5 hover:text-foreground",
                        active && "text-foreground",
                      )}
                      type="button"
                      onClick={() => toggleSort(column.key)}
                    >
                      {column.header}
                      <Icon className={cn("size-3.5", !active && "opacity-50")} aria-hidden="true" />
                    </button>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell className="py-12 text-center text-muted-foreground" colSpan={columns.length}>
                  {emptyMessage ?? "Nenhum registro encontrado para os filtros atuais."}
                </TableCell>
              </TableRow>
            ) : (
              visible.map((row, index) => (
                <TableRow key={rowKey(row, currentPage * PAGE_SIZE + index)}>
                  {columns.map((column) => {
                    const text = formatCell(column.kind, column.value(row));
                    return (
                      <TableCell key={column.key} className={cn(column.kind === "money" ? "text-right tabular-nums whitespace-nowrap" : column.kind === "date" && "tabular-nums whitespace-nowrap")}>
                        {column.render ? column.render(row) : text || <span className="text-muted-foreground" aria-label="vazio">—</span>}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {footer && <div>{footer(sorted)}</div>}
      <nav className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" aria-label={`Paginação: ${caption}`}>
        <span className="text-sm text-muted-foreground tabular-nums">
          {first.toLocaleString("pt-BR")}–{last.toLocaleString("pt-BR")} · Página {currentPage + 1} de {pageCount}
        </span>
        <div className="flex gap-1.5">
          <Button variant="outline" size="icon" type="button" aria-label="Primeira página" onClick={() => setPage(0)} disabled={currentPage === 0}>
            <ChevronFirst aria-hidden="true" />
          </Button>
          <Button variant="outline" type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 0}>
            <ChevronLeft aria-hidden="true" />
            Anterior
          </Button>
          <Button variant="outline" type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= pageCount - 1}>
            Próxima
            <ChevronRight aria-hidden="true" />
          </Button>
          <Button variant="outline" size="icon" type="button" aria-label="Última página" onClick={() => setPage(pageCount - 1)} disabled={currentPage >= pageCount - 1}>
            <ChevronLast aria-hidden="true" />
          </Button>
        </div>
      </nav>
    </div>
  );
}
