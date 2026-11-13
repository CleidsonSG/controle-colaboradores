import type { ImportAnalysis, LoadType, RowResult } from "./import-data";

export type ExportKind = "valid" | "errors";
export type ExportFormat = "xlsx" | "csv";

export type ExportOptions = {
  kind: ExportKind;
  format: ExportFormat;
  date?: Date;
};

export type ExportFile = {
  blob: Blob;
  filename: string;
};

export const XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const CSV_MIME_TYPE = "text/csv;charset=utf-8";

const CSV_DELIMITER = ";";
const CSV_LINE_BREAK = "\r\n";
const UTF8_BOM = "﻿";
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;
const PURE_NUMBER = /^[+-]?\d+(?:[.,]\d+)?$/;
const CSV_NEEDS_QUOTES = /[";\r\n]/;
const INTEGER_TEXT = /^-?\d+$/;

const RECORD_HEADER = "Registro";
const ISSUES_HEADER = "Problemas";
const ISSUES_SEPARATOR = "; ";

const FILE_PREFIX: Record<LoadType, string> = {
  employees: "colaboradores",
  "position-statistics": "estatisticas-cargo",
};
const KIND_SUFFIX: Record<ExportKind, string> = { valid: "validos", errors: "erros" };
const SHEET_NAME: Record<ExportKind, string> = { valid: "Válidos", errors: "Erros" };

export class ExportFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExportFileError";
  }
}

function selectRows(analysis: ImportAnalysis, kind: ExportKind): RowResult[] {
  return analysis.rows.filter((row) => (kind === "valid" ? row.issues.length === 0 : row.issues.length > 0));
}

/**
 * Builds the export matrix (header + data rows) before serialization.
 * Valid rows use normalized values; error rows keep the source text so the user can find and fix it.
 */
export function buildExportRows(analysis: ImportAnalysis, kind: ExportKind): string[][] {
  const fieldKeys = analysis.fields.map((field) => field.key);
  const labels = analysis.fields.map((field) => field.label);
  const rows = selectRows(analysis, kind);

  if (kind === "valid") {
    return [labels, ...rows.map((row) => fieldKeys.map((key) => row.normalized[key] ?? ""))];
  }
  return [
    [RECORD_HEADER, ...labels, ISSUES_HEADER],
    ...rows.map((row) => [
      String(row.record),
      ...fieldKeys.map((key) => row.values[key] ?? ""),
      row.issues.join(ISSUES_SEPARATOR),
    ]),
  ];
}

/** Prefixes values that a spreadsheet would interpret as a formula (CSV injection), except plain numbers. */
export function neutralizeFormula(value: string): string {
  return FORMULA_TRIGGER.test(value) && !PURE_NUMBER.test(value) ? `'${value}` : value;
}

function toCsvCell(value: string): string {
  const safeValue = neutralizeFormula(value);
  return CSV_NEEDS_QUOTES.test(safeValue) ? `"${safeValue.replaceAll('"', '""')}"` : safeValue;
}

/** Serializes rows as CSV for Excel pt-BR: UTF-8 BOM, ";" delimiter, CRLF line breaks. */
export function toCsv(rows: string[][]): string {
  const lines = rows.map((row) => row.map(toCsvCell).join(CSV_DELIMITER));
  return UTF8_BOM + lines.join(CSV_LINE_BREAK) + CSV_LINE_BREAK;
}

function formatLocalDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function buildExportFilename(type: LoadType, kind: ExportKind, format: ExportFormat, date = new Date()): string {
  return `${FILE_PREFIX[type]}-${KIND_SUFFIX[kind]}-${formatLocalDate(date)}.${format}`;
}

function numericColumnIndexes(analysis: ImportAnalysis, kind: ExportKind): Set<number> {
  if (kind === "errors") return new Set([0]);
  const indexes = analysis.fields.flatMap((field, index) => (field.numeric ? [index] : []));
  return new Set(indexes);
}

function toXlsxCell(value: string, isNumericColumn: boolean): string | number {
  return isNumericColumn && INTEGER_TEXT.test(value) ? Number(value) : value;
}

async function loadWorkbookConstructor(): Promise<typeof import("exceljs").Workbook> {
  try {
    const workbookModule: typeof import("exceljs") & { default?: typeof import("exceljs") } = await import("exceljs");
    return workbookModule.default?.Workbook ?? workbookModule.Workbook;
  } catch {
    throw new ExportFileError("Não foi possível iniciar o gerador de planilhas neste navegador.");
  }
}

async function toXlsxBlob(rows: string[][], numericColumns: Set<number>, sheetName: string): Promise<Blob> {
  const Workbook = await loadWorkbookConstructor();
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  rows.forEach((row, rowIndex) => {
    const isHeader = rowIndex === 0;
    sheet.addRow(row.map((value, column) => toXlsxCell(value, !isHeader && numericColumns.has(column))));
  });
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: "frozen", ySplit: 1 }];

  try {
    const buffer = await workbook.xlsx.writeBuffer();
    return new Blob([buffer as ArrayBuffer], { type: XLSX_MIME_TYPE });
  } catch {
    throw new ExportFileError("Não foi possível gerar a planilha para download.");
  }
}

/** Generates the downloadable file entirely in memory; nothing is sent or stored. */
export async function buildExport(analysis: ImportAnalysis, type: LoadType, options: ExportOptions): Promise<ExportFile> {
  const { kind, format, date } = options;
  const rows = buildExportRows(analysis, kind);
  const filename = buildExportFilename(type, kind, format, date);
  if (format === "csv") {
    return { blob: new Blob([toCsv(rows)], { type: CSV_MIME_TYPE }), filename };
  }
  const blob = await toXlsxBlob(rows, numericColumnIndexes(analysis, kind), SHEET_NAME[kind]);
  return { blob, filename };
}
