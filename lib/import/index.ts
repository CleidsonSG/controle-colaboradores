import { parseECidadeCsv } from "./ecidade-csv.ts";
import { loadWorkbook, orderedSheets, parsePlanilhaFromWorkbook, rowTexts } from "./planilha-excel.ts";
import { findSalarialSheet, isSalarialHeader, parseTabelaSalarialCsv, parseTabelaSalarialWorkbook } from "./tabela-salarial.ts";
import { decodeText, detectDelimiter } from "./text.ts";
import { ImportFileError, type AnyImportResult, type ImportKind } from "./types.ts";

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const FORMAT_ERROR_MESSAGE = "Formato não suportado. Envie um arquivo CSV, XLSX ou XLSM de até 25 MB.";

export { parseECidadeCsv } from "./ecidade-csv.ts";
export { parsePlanilhaWorkbook } from "./planilha-excel.ts";
export { parseTabelaSalarialCsv, parseTabelaSalarialWorkbook } from "./tabela-salarial.ts";
export { formatDateBr, normalizeHeader } from "./text.ts";
export { DEFAULT_SETTINGS, ImportFileError } from "./types.ts";
export type {
  AnyImportResult,
  AnyStoredDataset,
  CargoSalario,
  ColaboradorPlanilha,
  DataStore,
  ImportKind,
  ImportResult,
  ImportWarning,
  Origem,
  ServidorECidade,
  Settings,
  StoredDataset,
} from "./types.ts";

/** Tipo provável pela extensão. A tabela salarial (CSV ou Excel) é reconhecida pelo cabeçalho em importFile. */
export function detectKind(fileName: string): ImportKind | null {
  const extension = fileName.toLowerCase().split(".").pop() ?? "";
  if (extension === "csv") return "ecidade";
  if (extension === "xlsx" || extension === "xlsm") return "planilha";
  return null;
}

function csvLooksSalarial(buffer: ArrayBuffer): boolean {
  const head = decodeText(buffer.slice(0, 64 * 1024)).split(/\r\n|\n|\r/).slice(0, 30);
  return head.some((line) => isSalarialHeader(line.split(detectDelimiter(line))));
}

/**
 * Valida tamanho e extensão e despacha para o leitor correto.
 * Sem `kind`, o tipo vem da extensão e do cabeçalho (cargo + salário, sem matrícula = tabela salarial).
 * Com `kind`, o arquivo é lido como aquele tipo (ex.: enviado pelo cartão da tabela salarial).
 */
export async function importFile(file: File, kind?: ImportKind): Promise<AnyImportResult> {
  const byExtension = detectKind(file.name);
  if (!byExtension) throw new ImportFileError("formato", FORMAT_ERROR_MESSAGE);
  if (file.size > MAX_FILE_BYTES) throw new ImportFileError("tamanho", FORMAT_ERROR_MESSAGE);
  if (file.size === 0) throw new ImportFileError("vazio", "O arquivo está vazio.");
  const buffer = await file.arrayBuffer();
  const isCsv = byExtension === "ecidade";
  if (isCsv) {
    if (kind === "planilha") throw new ImportFileError("formato", "A planilha de terceirizados deve ser .xlsx ou .xlsm.");
    const salarial = kind === "salarial" || (!kind && csvLooksSalarial(buffer));
    return salarial ? parseTabelaSalarialCsv(buffer, file.name) : parseECidadeCsv(buffer, file.name);
  }
  if (kind === "ecidade") throw new ImportFileError("formato", "O relatório do e-Cidade deve ser .csv.");
  const workbook = await loadWorkbook(buffer);
  const salarial = kind === "salarial" || (!kind && findSalarialSheet(workbook) !== null && !looksLikePlanilha(workbook));
  return salarial ? parseTabelaSalarialWorkbook(workbook, file.name) : parsePlanilhaFromWorkbook(workbook, file.name);
}

/** Lista de pessoas: alguma das 2 primeiras abas tem matrícula e servidor no cabeçalho. */
function looksLikePlanilha(workbook: Awaited<ReturnType<typeof loadWorkbook>>): boolean {
  return orderedSheets(workbook)
    .slice(0, 2)
    .some((worksheet) => {
      for (let row = 1; row <= Math.min(worksheet.rowCount, 15); row += 1) {
        const texts = rowTexts(worksheet, row);
        if (texts.includes("matricula") && texts.includes("servidor")) return true;
      }
      return false;
    });
}
