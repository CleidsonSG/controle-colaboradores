export const CSV_MIME_TYPE = "text/csv;charset=utf-8";

const CSV_DELIMITER = ";";
const CSV_LINE_BREAK = "\r\n";
const UTF8_BOM = "﻿";
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;
const PURE_NUMBER = /^[+-]?\d+(?:[.,]\d+)?$/;
const CSV_NEEDS_QUOTES = /[";\r\n]/;

/** Prefixa com apóstrofo valores que uma planilha interpretaria como fórmula (injeção de CSV), exceto números puros. */
export function neutralizeFormula(value: string): string {
  return FORMULA_TRIGGER.test(value) && !PURE_NUMBER.test(value) ? `'${value}` : value;
}

function toCsvCell(value: string): string {
  const safeValue = neutralizeFormula(value);
  return CSV_NEEDS_QUOTES.test(safeValue) ? `"${safeValue.replaceAll('"', '""')}"` : safeValue;
}

/** Serializa linhas como CSV para o Excel pt-BR: BOM UTF-8, delimitador ";" e quebras CRLF. */
export function toCsv(rows: string[][]): string {
  const lines = rows.map((row) => row.map(toCsvCell).join(CSV_DELIMITER));
  return UTF8_BOM + lines.join(CSV_LINE_BREAK) + CSV_LINE_BREAK;
}

/** Gera o Blob do CSV (cabeçalho + linhas) inteiramente em memória. */
export function buildCsvBlob(headers: string[], rows: string[][]): Blob {
  return new Blob([toCsv([headers, ...rows])], { type: CSV_MIME_TYPE });
}
