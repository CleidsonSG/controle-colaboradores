export const MAX_FILE_SIZE = 25 * 1024 * 1024;
export const MAX_RECORDS = 20_000;

export type LoadType = "employees" | "position-statistics";

export type ImportField = {
  key: string;
  label: string;
  required: boolean;
  sensitive?: boolean;
  numeric?: "year" | "month" | "quantity";
  aliases: string[];
};

export const IMPORT_FIELDS: Record<LoadType, ImportField[]> = {
  employees: [
    { key: "registration", label: "Matrícula", required: true, aliases: ["matricula", "registro", "id funcional"] },
    { key: "name", label: "Nome", required: true, aliases: ["nome", "nome completo", "servidor"] },
    { key: "cpf", label: "CPF", required: false, sensitive: true, aliases: ["cpf"] },
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
  values: Record<string, string>;
  issues: string[];
};

export type ImportAnalysis = {
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

export function analyzeRows(
  source: ParsedFile,
  type: LoadType,
  mapping: Record<string, string>,
): ImportAnalysis {
  const fields = IMPORT_FIELDS[type];
  const configurationIssues: string[] = [];
  const selectedColumns: number[] = [];
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

    selectedColumns.push(columnIndex);
    columnIndexByField.set(field.key, columnIndex);
  }
  if (new Set(selectedColumns).size !== selectedColumns.length) {
    configurationIssues.push("Cada campo deve usar uma coluna diferente do arquivo.");
  }
  if (configurationIssues.length > 0) {
    return { validCount: 0, invalidCount: 0, rows: [], configurationIssues };
  }

  const results: RowResult[] = source.rows.map((sourceRow) => {
    const values: Record<string, string> = {};
    const issues: string[] = [];
    for (const field of fields) {
      const columnIndex = columnIndexByField.get(field.key);
      const value = columnIndex === undefined ? "" : (sourceRow.values[columnIndex] ?? "").trim();
      values[field.key] = value;

      if (field.required && !value) {
        issues.push(`${field.label}: campo obrigatório vazio`);
        continue;
      }
      if (!value || !field.numeric) continue;

      const numericValue = parseInteger(value);
      if (numericValue === undefined) {
        issues.push(`${field.label}: informe um número inteiro`);
      } else if (field.numeric === "year" && (numericValue < 1900 || numericValue > 2100)) {
        issues.push(`${field.label}: informe um ano entre 1900 e 2100`);
      } else if (field.numeric === "month" && (numericValue < 1 || numericValue > 12)) {
        issues.push(`${field.label}: informe um mês entre 1 e 12`);
      } else if (field.numeric === "quantity" && numericValue < 0) {
        issues.push(`${field.label}: informe uma quantidade igual ou maior que zero`);
      }
    }
    return { record: sourceRow.record, values, issues };
  });

  const invalidCount = results.filter((row) => row.issues.length > 0).length;
  return {
    validCount: results.length - invalidCount,
    invalidCount,
    rows: results,
    configurationIssues: [],
  };
}
