import Papa from "papaparse";
import type { Worksheet } from "exceljs";
import { orderedSheets, readCell, rowTexts, type LoadedWorkbook } from "./planilha-excel.ts";
import { decodeText, detectDelimiter, normalizeHeader, parseMoney, WarningCollector } from "./text.ts";
import { ImportFileError, type CargoSalario, type ImportResult } from "./types.ts";

const MAX_HEADER_SCAN = 30;
const CARGO_ALIASES = ["cargo", "descricao do cargo", "descricao cargo", "funcao"];
const SALARIO_ALIASES = ["salario", "salario base", "vencimento", "vencimento base", "remuneracao", "valor"];

/** Cabeçalho de tabela salarial: tem cargo e salário, e não tem matrícula (que indicaria lista de pessoas). */
export function isSalarialHeader(cells: string[]): boolean {
  const normalized = cells.map((cell) => normalizeHeader(cell ?? ""));
  const hasCargo = normalized.some((cell) => CARGO_ALIASES.includes(cell));
  const hasSalario = normalized.some((cell) => SALARIO_ALIASES.includes(cell));
  return hasCargo && hasSalario && !normalized.includes("matricula");
}

function columnIndex(cells: string[], aliases: string[]): number {
  // A primeira lista de aliases tem prioridade: "cargo" vence "funcao", "salario" vence "valor".
  for (const alias of aliases) {
    const index = cells.findIndex((cell) => cell === alias);
    if (index >= 0) return index;
  }
  return -1;
}

/** Junta as linhas lidas, avisando sobre cargos repetidos (vale o primeiro) e salários inválidos. */
function finish(fileName: string, rows: { cargo: string; salario: string | number | null; linha: number }[], sheet?: string): ImportResult<CargoSalario> {
  const warnings = new WarningCollector();
  const seen = new Set<string>();
  const records: CargoSalario[] = [];
  for (const row of rows) {
    const cargo = row.cargo.trim();
    if (cargo === "") {
      if (row.salario !== null && String(row.salario).trim() !== "") {
        warnings.add("linha-ignorada", "Linhas sem cargo foram ignoradas.", row.linha);
      }
      continue;
    }
    const key = normalizeHeader(cargo);
    if (seen.has(key)) {
      warnings.add("duplicidade", "Cargos repetidos na tabela: foi usado o primeiro salário encontrado.", row.linha);
      continue;
    }
    seen.add(key);
    const money = parseMoney(row.salario);
    if (money.invalid || money.value === null) {
      warnings.add("valor-invalido", "Cargos sem salário válido ficaram sem valor.", row.linha);
    }
    records.push({ cargo, salario: money.invalid ? null : money.value, linha: row.linha });
  }
  if (records.length === 0) throw new ImportFileError("vazio", "Não encontramos cargos nesta tabela salarial.");
  return {
    kind: "salarial",
    fileName,
    records,
    countsBySheet: sheet ? [{ sheet, count: records.length }] : [],
    warnings: warnings.list(),
  };
}

const MISSING = ["Cargo", "Salário"];

/** Lê a tabela salarial em CSV (UTF-8 ou windows-1252). */
export function parseTabelaSalarialCsv(buffer: ArrayBuffer, fileName: string): ImportResult<CargoSalario> {
  if (buffer.byteLength === 0) throw new ImportFileError("vazio", "O arquivo está vazio.");
  const lines = decodeText(buffer).split(/\r\n|\n|\r/);
  const headerIndex = lines.slice(0, MAX_HEADER_SCAN).findIndex((line) => isSalarialHeader(line.split(detectDelimiter(line))));
  if (headerIndex < 0) throw new ImportFileError("cabecalho", "Não encontramos as colunas da tabela salarial.", MISSING);
  const delimiter = detectDelimiter(lines[headerIndex]);
  const table = Papa.parse<string[]>(lines.slice(headerIndex).join("\n"), { delimiter, skipEmptyLines: false }).data;
  const header = (table[0] ?? []).map((cell) => normalizeHeader(String(cell)));
  const cargoAt = columnIndex(header, CARGO_ALIASES);
  const salarioAt = columnIndex(header, SALARIO_ALIASES);
  const rows = table.slice(1).map((cells, index) => ({
    cargo: String(cells[cargoAt] ?? ""),
    salario: cells[salarioAt] === undefined ? null : String(cells[salarioAt]),
    linha: headerIndex + index + 2,
  }));
  return finish(fileName, rows);
}

function findSalarialHeaderRow(worksheet: Worksheet): number {
  const limit = Math.min(worksheet.rowCount, MAX_HEADER_SCAN);
  for (let row = 1; row <= limit; row += 1) {
    if (isSalarialHeader(rowTexts(worksheet, row))) return row;
  }
  return -1;
}

/** Procura a primeira aba com cabeçalho de tabela salarial. */
export function findSalarialSheet(workbook: LoadedWorkbook): { worksheet: Worksheet; headerRow: number } | null {
  for (const worksheet of orderedSheets(workbook)) {
    if (worksheet.actualRowCount === 0) continue;
    const headerRow = findSalarialHeaderRow(worksheet);
    if (headerRow > 0) return { worksheet, headerRow };
  }
  return null;
}

/** Lê a tabela salarial de uma pasta de trabalho XLSX/XLSM já carregada (macros nunca são executadas). */
export function parseTabelaSalarialWorkbook(workbook: LoadedWorkbook, fileName: string): ImportResult<CargoSalario> {
  const found = findSalarialSheet(workbook);
  if (!found) throw new ImportFileError("cabecalho", "Não encontramos as colunas da tabela salarial.", MISSING);
  const { worksheet, headerRow } = found;
  const header = rowTexts(worksheet, headerRow).map((cell) => cell ?? "");
  const cargoAt = columnIndex(header, CARGO_ALIASES);
  const salarioAt = columnIndex(header, SALARIO_ALIASES);
  const rows: { cargo: string; salario: string | number | null; linha: number }[] = [];
  for (let rowNumber = headerRow + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const cargo = readCell(row.getCell(cargoAt)).value;
    const salario = readCell(row.getCell(salarioAt)).value;
    rows.push({ cargo: cargo === null ? "" : String(cargo), salario, linha: rowNumber });
  }
  return finish(fileName, rows, worksheet.name);
}
