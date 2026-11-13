import { parseECidadeCsv } from "./ecidade-csv.ts";
import { parsePlanilhaWorkbook } from "./planilha-excel.ts";
import { ImportFileError, type ColaboradorPlanilha, type ImportKind, type ImportResult, type ServidorECidade } from "./types.ts";

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const FORMAT_ERROR_MESSAGE = "Formato não suportado. Envie um arquivo CSV, XLSX ou XLSM de até 25 MB.";

export { parseECidadeCsv } from "./ecidade-csv.ts";
export { parsePlanilhaWorkbook } from "./planilha-excel.ts";
export { formatDateBr, normalizeHeader } from "./text.ts";
export { ImportFileError } from "./types.ts";
export type {
  ColaboradorPlanilha,
  DataStore,
  ImportKind,
  ImportResult,
  ImportWarning,
  Origem,
  ServidorECidade,
  StoredDataset,
} from "./types.ts";

export function detectKind(fileName: string): ImportKind | null {
  const extension = fileName.toLowerCase().split(".").pop() ?? "";
  if (extension === "csv") return "ecidade";
  if (extension === "xlsx" || extension === "xlsm") return "planilha";
  return null;
}

/** Valida tamanho e extensão e despacha para o leitor correto. */
export async function importFile(file: File): Promise<ImportResult<ServidorECidade> | ImportResult<ColaboradorPlanilha>> {
  const kind = detectKind(file.name);
  if (!kind) throw new ImportFileError("formato", FORMAT_ERROR_MESSAGE);
  if (file.size > MAX_FILE_BYTES) throw new ImportFileError("tamanho", FORMAT_ERROR_MESSAGE);
  if (file.size === 0) throw new ImportFileError("vazio", "O arquivo está vazio.");
  const buffer = await file.arrayBuffer();
  return kind === "ecidade" ? parseECidadeCsv(buffer, file.name) : parsePlanilhaWorkbook(buffer, file.name);
}
