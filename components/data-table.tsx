"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { buildCsvBlob } from "@/lib/export-data";
import { formatDateBr } from "@/lib/import";

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

  return (
    <div className="data-table">
      <div className="data-table-toolbar">
        <div className="data-table-search">
          <label htmlFor={searchId}>Buscar</label>
          <input
            id={searchId}
            type="search"
            value={query}
            placeholder="Digite parte de qualquer valor"
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
          />
        </div>
        <button className="button button-outline" type="button" onClick={exportCsv} disabled={sorted.length === 0}>
          Exportar CSV (filtrado)
        </button>
      </div>
      <p className="data-table-count" role="status" aria-live="polite">
        {sorted.length.toLocaleString("pt-BR")} de {rows.length.toLocaleString("pt-BR")} registros
      </p>
      <div className="table-scroll data-table-scroll" tabIndex={0} role="region" aria-label={caption}>
        <table className="data-grid">
          <caption className="visually-hidden">{caption}</caption>
          <thead>
            <tr>
              {columns.map((column) => {
                const active = sort?.key === column.key ? sort.direction : null;
                return (
                  <th
                    key={column.key}
                    scope="col"
                    className={column.kind === "money" ? "cell-number" : undefined}
                    aria-sort={active === "asc" ? "ascending" : active === "desc" ? "descending" : "none"}
                  >
                    <button className="sort-button" type="button" onClick={() => toggleSort(column.key)}>
                      {column.header}
                      <span className="sort-mark" aria-hidden="true">{active === "asc" ? "▲" : active === "desc" ? "▼" : "↕"}</span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td className="data-table-empty" colSpan={columns.length}>
                  {emptyMessage ?? "Nenhum registro encontrado para os filtros atuais."}
                </td>
              </tr>
            ) : (
              visible.map((row, index) => (
                <tr key={rowKey(row, currentPage * PAGE_SIZE + index)}>
                  {columns.map((column) => {
                    const text = formatCell(column.kind, column.value(row));
                    return (
                      <td key={column.key} className={column.kind === "money" ? "cell-number" : undefined}>
                        {column.render ? column.render(row) : text || <span className="empty-cell">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {footer && <div className="data-table-footer">{footer(sorted)}</div>}
      <nav className="data-table-pager" aria-label={`Paginação: ${caption}`}>
        <span>
          {first.toLocaleString("pt-BR")}–{last.toLocaleString("pt-BR")} · Página {currentPage + 1} de {pageCount}
        </span>
        <div>
          <button className="button button-outline" type="button" onClick={() => setPage(0)} disabled={currentPage === 0}>Primeira</button>
          <button className="button button-outline" type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 0}>Anterior</button>
          <button className="button button-outline" type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= pageCount - 1}>Próxima</button>
          <button className="button button-outline" type="button" onClick={() => setPage(pageCount - 1)} disabled={currentPage >= pageCount - 1}>Última</button>
        </div>
      </nav>
    </div>
  );
}
