import type { Cell, Worksheet } from "exceljs";
import { matriculaToText, normalizeHeader, parseMoney, WarningCollector } from "./text.ts";
import { ImportFileError, type ColaboradorPlanilha, type ImportResult, type Origem } from "./types.ts";

const SHEET_ORIGINS: Origem[] = ["Comissionado", "Terceirizado"];
const FALLBACK_HEADER_ROW = 2;
const MAX_HEADER_SCAN = 15;

const COLUMNS: { label: string; aliases: string[] }[] = [
  { label: "Matrícula", aliases: ["matricula"] },
  { label: "Servidor", aliases: ["servidor"] },
  { label: "Empresa/Secretaria", aliases: ["empresa/secretaria", "empresa / secretaria", "empresa", "secretaria"] },
  { label: "Lotação", aliases: ["lotacao"] },
  { label: "Função", aliases: ["funcao"] },
  { label: "Remuneração", aliases: ["remuneracao"] },
  { label: "Alimentação", aliases: ["alimentacao"] },
  { label: "Indicação", aliases: ["indicacao"] },
];

type ReadCell = { value: string | number | null; formulaWithoutValue: boolean };

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function readCell(cell: Cell): ReadCell {
  let value: unknown = cell.value;
  let formulaWithoutValue = false;
  if (value !== null && typeof value === "object" && !(value instanceof Date)) {
    const object = value as Record<string, unknown>;
    if ("formula" in object || "sharedFormula" in object) {
      const result = object.result;
      value = result === undefined || (typeof result === "object" && result !== null && !(result instanceof Date)) ? null : result;
      formulaWithoutValue = value === null;
    } else if ("error" in object) {
      value = null;
      formulaWithoutValue = true;
    } else if (Array.isArray(object.richText)) {
      value = (object.richText as { text?: string }[]).map((part) => part.text ?? "").join("");
    } else if (typeof object.text === "string") {
      value = object.text;
    } else {
      value = null;
    }
  }
  if (value instanceof Date) {
    value = `${pad(value.getUTCDate())}/${pad(value.getUTCMonth() + 1)}/${value.getUTCFullYear()}`;
  }
  if (typeof value === "boolean") value = value ? "Sim" : "Não";
  if (typeof value === "string") value = value.trim();
  if (value === "") value = null;
  return { value: (value as string | number | null) ?? null, formulaWithoutValue };
}

function rowTexts(worksheet: Worksheet, rowNumber: number): string[] {
  const texts: string[] = [];
  worksheet.getRow(rowNumber).eachCell({ includeEmpty: true }, (cell, column) => {
    const read = readCell(cell).value;
    texts[column] = read === null ? "" : normalizeHeader(String(read));
  });
  return texts;
}

function findHeaderRow(worksheet: Worksheet): number {
  const limit = Math.min(worksheet.rowCount, MAX_HEADER_SCAN);
  for (let row = 1; row <= limit; row += 1) {
    const texts = rowTexts(worksheet, row);
    if (texts.includes("matricula") && texts.includes("servidor")) return row;
  }
  return FALLBACK_HEADER_ROW;
}

async function loadWorkbook(buffer: ArrayBuffer) {
  const exceljs: typeof import("exceljs") & { default?: typeof import("exceljs") } = await import("exceljs");
  const Workbook = exceljs.default?.Workbook ?? exceljs.Workbook;
  const workbook = new Workbook();
  try {
    await workbook.xlsx.load(buffer);
  } catch {
    throw new ImportFileError(
      "formato",
      "Não foi possível ler a planilha. Verifique se o arquivo não está corrompido ou protegido por senha.",
    );
  }
  return workbook;
}

/** Lê as duas primeiras abas (por ordem) da planilha XLSX/XLSM como dados; macros nunca são executadas. */
export async function parsePlanilhaWorkbook(buffer: ArrayBuffer, fileName: string): Promise<ImportResult<ColaboradorPlanilha>> {
  if (buffer.byteLength === 0) throw new ImportFileError("vazio", "O arquivo está vazio.");
  const workbook = await loadWorkbook(buffer);
  const orderOf = (sheet: Worksheet) => (sheet as Worksheet & { orderNo?: number }).orderNo ?? sheet.id;
  const sheets = [...workbook.worksheets].sort((a, b) => orderOf(a) - orderOf(b)).slice(0, SHEET_ORIGINS.length);
  if (sheets.length === 0) throw new ImportFileError("vazio", "A planilha não tem abas.");

  const warnings = new WarningCollector();
  const records: ColaboradorPlanilha[] = [];
  const countsBySheet: ImportResult<ColaboradorPlanilha>["countsBySheet"] = [];

  sheets.forEach((worksheet, sheetIndex) => {
    const origem = SHEET_ORIGINS[sheetIndex];
    let count = 0;
    if (worksheet.rowCount > 0 && worksheet.actualRowCount > 0) {
      const headerRow = findHeaderRow(worksheet);
      const headers = rowTexts(worksheet, headerRow);
      const positions = COLUMNS.map((column) => headers.findIndex((text) => text !== undefined && column.aliases.includes(text)));
      const missing = [0, 1].filter((i) => positions[i] < 0).map((i) => COLUMNS[i].label);
      if (missing.length > 0) {
        throw new ImportFileError("cabecalho", `Não encontramos o cabeçalho esperado na aba "${worksheet.name}".`, missing);
      }
      for (let rowNumber = headerRow + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
        const row = worksheet.getRow(rowNumber);
        const cells = COLUMNS.map((_, index): ReadCell => {
          if (positions[index] < 0) return { value: null, formulaWithoutValue: false };
          const read = readCell(row.getCell(positions[index]));
          if (read.formulaWithoutValue) {
            warnings.add("formula-sem-valor", "Fórmulas sem valor calculado foram deixadas em branco.", rowNumber);
          }
          return read;
        });
        if (cells.every((cell) => cell.value === null)) continue;
        const matricula = matriculaToText(cells[0].value ?? "");
        const servidor = String(cells[1].value ?? "");
        if (matricula === "" || servidor === "") {
          warnings.add("linha-ignorada", "Linhas sem matrícula ou servidor foram ignoradas.", rowNumber);
          continue;
        }
        const text = (index: number) => (cells[index].value === null ? "" : String(cells[index].value));
        const money = (index: number) => {
          const parsed = parseMoney(cells[index].value);
          if (parsed.invalid) warnings.add("valor-invalido", "Valores monetários inválidos foram deixados em branco.", rowNumber);
          return parsed.value;
        };
        records.push({
          matricula,
          servidor,
          empresaSecretaria: text(2),
          lotacao: text(3),
          funcao: text(4),
          remuneracao: money(5),
          alimentacao: money(6),
          indicacao: text(7),
          origem,
          linha: rowNumber,
          possivelDuplicidade: false,
        });
        count += 1;
      }
    }
    countsBySheet.push({ sheet: worksheet.name, origem, count });
  });

  const origensPorMatricula = new Map<string, Set<Origem>>();
  for (const record of records) {
    const set = origensPorMatricula.get(record.matricula) ?? new Set<Origem>();
    set.add(record.origem);
    origensPorMatricula.set(record.matricula, set);
  }
  for (const record of records) {
    if ((origensPorMatricula.get(record.matricula)?.size ?? 0) > 1) {
      record.possivelDuplicidade = true;
      warnings.add(
        "duplicidade",
        "Matrículas presentes nas duas abas foram mantidas e marcadas como possível duplicidade.",
        record.linha,
      );
    }
  }

  if (records.length === 0) throw new ImportFileError("vazio", "Não encontramos registros nesta planilha.");
  return { kind: "planilha", fileName, records, countsBySheet, warnings: warnings.list() };
}
