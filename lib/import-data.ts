export const MAX_FILE_SIZE = 25 * 1024 * 1024;
export const MAX_RECORDS = 20_000;

export type LoadType = "employees" | "position-statistics";

export type ImportField = {
  key: string;
  label: string;
  required: boolean;
  sensitive?: boolean;
  numeric?: "year" | "month" | "quantity";
  format?: "cpf";
  aliases: string[];
};

export const IMPORT_FIELDS: Record<LoadType, ImportField[]> = {
  employees: [
    { key: "registration", label: "Matrícula", required: true, aliases: ["matricula", "registro", "id funcional"] },
    { key: "name", label: "Nome", required: true, aliases: ["nome", "nome completo", "servidor"] },
    { key: "cpf", label: "CPF", required: false, sensitive: true, format: "cpf", aliases: ["cpf"] },
    { key: "position", label: "Cargo", required: true, aliases: ["cargo", "funcao", "função"] },
    { key: "unit", label: "Lotação", required: true, aliases: ["lotacao", "lotação", "unidade"] },
    { key: "phone", label: "Telefone", required: false, sensitive: true, aliases: ["telefone", "tel", "fone"] },
    { key: "mobile", label: "Celular", required: false, sensitive: true, aliases: ["celular", "telefone celular", "whatsapp"] },
    { key: "year", label: "Ano", required: true, numeric: "year", aliases: ["ano", "exercicio", "exercício"] },
    { key: "month", label: "Mês", required: true, numeric: "month", aliases: ["mes", "mês", "competencia mes"] },
  ],
  "position-statistics": [
    { key: "position", label: "Cargo", required: true, aliases: ["cargo", "funcao", "função"] },
    { key: "quantity", label: "Quantidade", required: true, numeric: "quantity", aliases: ["quantidade", "qtd", "total", "numero de cargos"] },
    { key: "year", label: "Ano", required: true, numeric: "year", aliases: ["ano", "exercicio", "exercício"] },
    { key: "month", label: "Mês", required: true, numeric: "month", aliases: ["mes", "mês", "competencia mes"] },
  ],
};

export type SourceRow = {
  record: number;
  values: string[];
};

export type ParsedFile = {
  kind: "csv" | "excel";
  sheetNames: string[];
  sheetName: string;
  headers: string[];
  rows: SourceRow[];
};

export type RowResult = {
  record: number;
  /** Trimmed text exactly as read from the source file. */
  values: Record<string, string>;
  /** Normalized value when the field is valid (CPF formatted, integers without padding); source text otherwise. */
  normalized: Record<string, string>;
  issues: string[];
};

export type ImportAnalysis = {
  /** Fields of the analyzed load type, in display/export order. */
  fields: ImportField[];
  validCount: number;
  invalidCount: number;
  rows: RowResult[];
  configurationIssues: string[];
};

export class ImportFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportFileError";
  }
}

export function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function suggestMapping(headers: string[], type: LoadType): Record<string, string> {
  const normalizedHeaders = headers.map(normalizeHeader);
  return Object.fromEntries(
    IMPORT_FIELDS[type].map((field) => {
      const aliases = new Set(field.aliases.map(normalizeHeader));
      const index = normalizedHeaders.findIndex((header) => aliases.has(header));
      return [field.key, index === -1 ? "" : String(index)];
    }),
  );
}

function isBlankRow(values: string[]): boolean {
  return values.every((value) => value.trim() === "");
}

function makeParsedFile(
  kind: ParsedFile["kind"],
  sheetNames: string[],
  sheetName: string,
  rawRows: string[][],
): ParsedFile {
  const headerIndex = rawRows.findIndex((row) => !isBlankRow(row));
  if (headerIndex === -1) {
    throw new ImportFileError("O arquivo não contém um cabeçalho legível.");
  }

  const headers = rawRows[headerIndex].map((value) => value.trim());
  if (!headers.some(Boolean)) {
    throw new ImportFileError("Não foi possível identificar os cabeçalhos do arquivo.");
  }

  const rows = rawRows
    .slice(headerIndex + 1)
    .map((values, index) => ({ record: headerIndex + index + 2, values }))
    .filter((row) => !isBlankRow(row.values));

  if (rows.length > MAX_RECORDS) {
    throw new ImportFileError("O arquivo ultrapassa o limite de 20.000 registros por análise.");
  }

  return { kind, sheetNames, sheetName, headers, rows };
}

function cellToText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "object") return "";

  const cellValue = value as { formula?: unknown; sharedFormula?: unknown; text?: unknown; richText?: unknown };
  if (cellValue.formula !== undefined || cellValue.sharedFormula !== undefined) return "";
  if (typeof cellValue.text === "string") return cellValue.text;
  if (Array.isArray(cellValue.richText)) {
    return cellValue.richText
      .map((part) => (typeof part === "object" && part !== null && "text" in part ? String(part.text) : ""))
      .join("");
  }
  return "";
}

async function parseExcelFile(file: File, requestedSheet?: string): Promise<ParsedFile> {
  let workbookModule: typeof import("exceljs") & { default?: typeof import("exceljs") };
  try {
    workbookModule = await import("exceljs");
  } catch {
    throw new ImportFileError("Não foi possível iniciar o leitor de planilhas neste navegador.");
  }

  const Workbook = workbookModule.default?.Workbook ?? workbookModule.Workbook;
  const workbook = new Workbook();
  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    throw new ImportFileError("Não foi possível ler a planilha. Confira se o arquivo XLSX ou XLSM está íntegro.");
  }

  const visibleSheets = workbook.worksheets.filter((sheet) => sheet.state === "visible");
  const sheetNames = visibleSheets.map((sheet) => sheet.name);
  const selectedSheet = visibleSheets.find((sheet) => sheet.name === requestedSheet) ?? visibleSheets[0];
  if (!selectedSheet) {
    throw new ImportFileError("A pasta de trabalho não contém uma planilha visível para análise.");
  }

  const rawRows: string[][] = [];
  selectedSheet.eachRow({ includeEmpty: false }, (row) => {
    if (row.number > MAX_RECORDS + 1) {
      throw new ImportFileError("A planilha ultrapassa o limite de 20.000 registros por análise.");
    }
    const values: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, column) => { values[column - 1] = cellToText(cell.value); });
    rawRows[row.number - 1] = values;
  });
  for (let index = 0; index < rawRows.length; index += 1) {
    rawRows[index] ??= [];
  }

  return makeParsedFile("excel", sheetNames, selectedSheet.name, rawRows);
}

export async function parseLocalFile(file: File, requestedSheet?: string): Promise<ParsedFile> {
  if (file.size > MAX_FILE_SIZE) {
    throw new ImportFileError("O arquivo excede o limite de 25 MB.");
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "xlsx" || extension === "xlsm") {
    return parseExcelFile(file, requestedSheet);
  }
  if (extension !== "csv") {
    throw new ImportFileError("Formato não aceito. Selecione um arquivo CSV, XLSX ou XLSM.");
  }

  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
  } catch {
    throw new ImportFileError("Não foi possível ler o CSV como UTF-8.");
  }

  try {
    const Papa = (await import("papaparse")).default;
    const result = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), {
      delimiter: "",
      delimitersToGuess: [";", ",", "\t", "|"],
      dynamicTyping: false,
      header: false,
      skipEmptyLines: false,
    });
    const fatalErrors = result.errors.filter((parseError) => parseError.code !== "UndetectableDelimiter");
    if (fatalErrors.length > 0) {
      if (result.data.every(isBlankRow)) {
        throw new ImportFileError("O arquivo não contém um cabeçalho legível.");
      }
      throw new ImportFileError("Não foi possível interpretar o CSV. Confira o delimitador e as aspas.");
    }
    return makeParsedFile("csv", ["Arquivo CSV"], "Arquivo CSV", result.data);
  } catch (error) {
    if (error instanceof ImportFileError) throw error;
    throw new ImportFileError("Não foi possível interpretar o arquivo CSV.");
  }
}

function parseInteger(value: string): number | undefined {
  let normalized = value.trim().replace(/[\s\u00a0]/g, "");
  if (!normalized) return undefined;

  if (normalized.includes(",") && normalized.includes(".")) {
    const decimalMark = normalized.lastIndexOf(",") > normalized.lastIndexOf(".") ? "," : ".";
    const groupingMark = decimalMark === "," ? "." : ",";
    normalized = normalized.replaceAll(groupingMark, "").replace(decimalMark, ".");
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(",", ".");
  } else if (/^-?\d{1,3}(?:\.\d{3})+$/.test(normalized)) {
    normalized = normalized.replaceAll(".", "");
  }

  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return undefined;
  const number = Number(normalized);
  return Number.isSafeInteger(number) ? number : undefined;
}

const CPF_LENGTH = 11;
const CPF_SEPARATORS = /[.\-/\s ]/g;
const YEAR_RANGE = { min: 1900, max: 2100 };
const MONTH_RANGE = { min: 1, max: 12 };
const MAX_LISTED_DUPLICATES = 5;

function cpfCheckDigit(digits: string, length: number): number {
  let sum = 0;
  for (let index = 0; index < length; index += 1) {
    sum += Number(digits[index]) * (length + 1 - index);
  }
  const remainder = (sum * 10) % 11;
  return remainder === 10 ? 0 : remainder;
}

/** Checks an 11-digit CPF (no punctuation): rejects repeated digits and wrong check digits. */
export function isValidCpf(digits: string): boolean {
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;
  return cpfCheckDigit(digits, 9) === Number(digits[9]) && cpfCheckDigit(digits, 10) === Number(digits[10]);
}

export function formatCpf(digits: string): string {
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

/**
 * Returns the CPF formatted as 000.000.000-00, or undefined when invalid.
 * Bare numbers shorter than 11 digits are left-padded with zeros (Excel drops leading zeros).
 */
export function normalizeCpf(value: string): string | undefined {
  const trimmed = value.trim();
  const digits = trimmed.replace(CPF_SEPARATORS, "");
  if (!/^\d+$/.test(digits)) return undefined;
  const candidate = /^\d+$/.test(trimmed) ? digits.padStart(CPF_LENGTH, "0") : digits;
  return isValidCpf(candidate) ? formatCpf(candidate) : undefined;
}

type FieldCheck = {
  normalized: string;
  issue?: string;
  numericValue?: number;
};

function checkNumericField(field: ImportField, value: string): FieldCheck {
  const numericValue = parseInteger(value);
  const invalid = (issue: string): FieldCheck => ({ normalized: value, issue });
  if (numericValue === undefined) return invalid(`${field.label}: informe um número inteiro`);
  if (field.numeric === "year" && (numericValue < YEAR_RANGE.min || numericValue > YEAR_RANGE.max)) {
    return invalid(`${field.label}: informe um ano entre ${YEAR_RANGE.min} e ${YEAR_RANGE.max}`);
  }
  if (field.numeric === "month" && (numericValue < MONTH_RANGE.min || numericValue > MONTH_RANGE.max)) {
    return invalid(`${field.label}: informe um mês entre ${MONTH_RANGE.min} e ${MONTH_RANGE.max}`);
  }
  if (field.numeric === "quantity" && numericValue < 0) {
    return invalid(`${field.label}: informe uma quantidade igual ou maior que zero`);
  }
  return { normalized: String(numericValue), numericValue };
}

function checkField(field: ImportField, value: string): FieldCheck {
  if (!value) {
    return field.required ? { normalized: value, issue: `${field.label}: campo obrigatório vazio` } : { normalized: value };
  }
  if (field.format === "cpf") {
    const cpf = normalizeCpf(value);
    return cpf ? { normalized: cpf } : { normalized: value, issue: `${field.label}: número inválido` };
  }
  return field.numeric ? checkNumericField(field, value) : { normalized: value };
}

type AnalyzedRow = {
  result: RowResult;
  numericValues: Map<string, number>;
};

function analyzeRow(sourceRow: SourceRow, fields: ImportField[], columnIndexByField: Map<string, number>): AnalyzedRow {
  const result: RowResult = { record: sourceRow.record, values: {}, normalized: {}, issues: [] };
  const numericValues = new Map<string, number>();
  for (const field of fields) {
    const columnIndex = columnIndexByField.get(field.key);
    const value = columnIndex === undefined ? "" : (sourceRow.values[columnIndex] ?? "").trim();
    const check = checkField(field, value);
    result.values[field.key] = value;
    result.normalized[field.key] = check.normalized;
    if (check.issue) result.issues.push(check.issue);
    if (check.numericValue !== undefined) numericValues.set(field.key, check.numericValue);
  }
  return { result, numericValues };
}

function registrationPeriodKey({ result, numericValues }: AnalyzedRow): string | undefined {
  const registration = result.values.registration?.toLowerCase();
  const year = numericValues.get("year");
  const month = numericValues.get("month");
  if (!registration || year === undefined || month === undefined) return undefined;
  return JSON.stringify([registration, year, month]);
}

function describeOtherRecords(records: number[]): string {
  const listed = records.slice(0, MAX_LISTED_DUPLICATES).join(", ");
  const remaining = records.length - MAX_LISTED_DUPLICATES;
  return remaining > 0 ? `${listed} e mais ${remaining}` : listed;
}

/** Same registration (case-insensitive) in the same year and month is an error in every occurrence. */
function flagDuplicateRegistrations(rows: AnalyzedRow[]): void {
  const groups = new Map<string, RowResult[]>();
  for (const row of rows) {
    const key = registrationPeriodKey(row);
    if (key === undefined) continue;
    const group = groups.get(key) ?? [];
    group.push(row.result);
    groups.set(key, group);
  }
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    for (const result of group) {
      const others = group.filter((other) => other !== result).map((other) => other.record);
      result.issues.push(`Matrícula: duplicada no mesmo mês/ano (registros ${describeOtherRecords(others)})`);
    }
  }
}

function resolveMapping(
  source: ParsedFile,
  fields: ImportField[],
  mapping: Record<string, string>,
): { columnIndexByField: Map<string, number>; configurationIssues: string[] } {
  const configurationIssues: string[] = [];
  const columnIndexByField = new Map<string, number>();

  for (const field of fields) {
    const selectedColumn = mapping[field.key];
    if (selectedColumn === undefined || selectedColumn.trim() === "") {
      if (field.required) configurationIssues.push(`Selecione uma coluna para ${field.label}.`);
      continue;
    }

    const columnIndex = Number(selectedColumn);
    if (!Number.isInteger(columnIndex) || columnIndex < 0 || columnIndex >= source.headers.length) {
      configurationIssues.push(`Selecione uma coluna válida para ${field.label}.`);
      continue;
    }
    columnIndexByField.set(field.key, columnIndex);
  }

  const selectedColumns = [...columnIndexByField.values()];
  if (new Set(selectedColumns).size !== selectedColumns.length) {
    configurationIssues.push("Cada campo deve usar uma coluna diferente do arquivo.");
  }
  return { columnIndexByField, configurationIssues };
}

export function analyzeRows(
  source: ParsedFile,
  type: LoadType,
  mapping: Record<string, string>,
): ImportAnalysis {
  const fields = IMPORT_FIELDS[type];
  const { columnIndexByField, configurationIssues } = resolveMapping(source, fields, mapping);
  if (configurationIssues.length > 0) {
    return { fields, validCount: 0, invalidCount: 0, rows: [], configurationIssues };
  }

  const analyzedRows = source.rows.map((sourceRow) => analyzeRow(sourceRow, fields, columnIndexByField));
  if (type === "employees") flagDuplicateRegistrations(analyzedRows);

  const rows = analyzedRows.map(({ result }) => result);
  const invalidCount = rows.filter((row) => row.issues.length > 0).length;
  return {
    fields,
    validCount: rows.length - invalidCount,
    invalidCount,
    rows,
    configurationIssues: [],
  };
}
