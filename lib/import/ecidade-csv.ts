import Papa from "papaparse";
import { decodeText, detectDelimiter, normalizeHeader, parseDateToIso, WarningCollector } from "./text.ts";
import { ImportFileError, type ImportResult, type ServidorECidade } from "./types.ts";

const FALLBACK_HEADER_INDEX = 4;
const MAX_HEADER_SCAN = 30;
const COMISSIONADO_MARK = "282/16";

const COLUMNS: { label: string; aliases: string[]; required: boolean }[] = [
  { label: "Matrícula", aliases: ["matricula"], required: true },
  { label: "Nome", aliases: ["nome"], required: true },
  { label: "Descrição do cargo", aliases: ["descricao do cargo", "descricao cargo"], required: true },
  { label: "Lotação", aliases: ["lotacao"], required: true },
  { label: "Admissão", aliases: ["admissao"], required: false },
  { label: "Rescisão", aliases: ["rescisao"], required: false },
];

function findHeaderLine(lines: string[]): number {
  const limit = Math.min(lines.length, MAX_HEADER_SCAN);
  for (let index = 0; index < limit; index += 1) {
    const normalized = normalizeHeader(lines[index]);
    if (normalized.includes("matricula") && normalized.includes("nome")) return index;
  }
  return Math.min(FALLBACK_HEADER_INDEX, lines.length - 1);
}

const TITLE_LABEL = "Funcionários admitidos";

/** Confere o título do relatório (linhas antes do cabeçalho): admitidos/geral é o esperado. */
function reportTitleWarning(lines: string[]): string | null {
  const title = lines.map((line) => normalizeHeader(line.replace(/[;,	]+/g, " "))).filter((line) => line !== "");
  if (title.length === 0) return null;
  const joined = title.join(" ");
  if (joined.includes("demitidos")) {
    return `Este relatório é de funcionários DEMITIDOS. O Painel de Cargos espera o relatório de ${TITLE_LABEL.toLowerCase()} (ou geral): a contagem de ativos ficará vazia ou incorreta.`;
  }
  if (joined.includes("admitidos") || joined.includes("geral")) return null;
  return `O título deste relatório não indica "${TITLE_LABEL}" nem "Geral". Confira se é o relatório correto do e-Cidade.`;
}

/** Lê o relatório CSV do e-Cidade (UTF-8 ou windows-1252). */
export function parseECidadeCsv(buffer: ArrayBuffer, fileName: string): ImportResult<ServidorECidade> {
  if (buffer.byteLength === 0) throw new ImportFileError("vazio", "O arquivo está vazio.");
  const lines = decodeText(buffer).split(/\r\n|\n|\r/);
  const headerIndex = findHeaderLine(lines);
  const delimiter = detectDelimiter(lines[headerIndex] ?? "");
  const parsed = Papa.parse<string[]>(lines.slice(headerIndex).join("\n"), { delimiter, skipEmptyLines: false });
  const table = parsed.data;
  const headerCells = (table[0] ?? []).map((cell) => normalizeHeader(String(cell)));

  const positions = COLUMNS.map((column) => headerCells.findIndex((cell) => column.aliases.includes(cell)));
  const missing = COLUMNS.filter((column, index) => column.required && positions[index] < 0).map((column) => column.label);
  if (missing.length > 0) {
    throw new ImportFileError("cabecalho", "Não encontramos o cabeçalho esperado do relatório do e-Cidade.", missing);
  }

  const warnings = new WarningCollector();
  const titleWarning = reportTitleWarning(lines.slice(0, headerIndex));
  if (titleWarning) warnings.add("relatorio", titleWarning, 1);
  const records: ServidorECidade[] = [];
  let declaredTotal: number | null = null;
  for (let index = 1; index < table.length; index += 1) {
    const raw = table[index].map((cell) => String(cell ?? "").trim());
    if (raw.every((cell) => cell === "")) continue;
    const fileRow = headerIndex + index + 1;
    const pick = (columnIndex: number) => (positions[columnIndex] >= 0 ? (raw[positions[columnIndex]] ?? "") : "");
    const matricula = pick(0);
    const nome = pick(1);
    // Rodapé do relatório: "TOTAL : 3420 FUNCIONÁRIOS" na 1ª coluna, demais vazias.
    const footer = raw.filter((cell) => cell !== "").length === 1 ? /^total\s*:?\s*(\d+)/.exec(normalizeHeader(raw.find((cell) => cell !== "") ?? "")) : null;
    if (footer) {
      declaredTotal = Number(footer[1]);
      continue;
    }
    if (matricula === "" || nome === "") {
      warnings.add("linha-ignorada", "Linhas sem matrícula ou nome foram ignoradas.", fileRow);
      continue;
    }
    const admissao = parseDateToIso(pick(4));
    const rescisao = parseDateToIso(pick(5));
    if (admissao.invalid || rescisao.invalid) {
      warnings.add("data-invalida", "Datas inválidas foram deixadas em branco.", fileRow);
    }
    const comissionado = raw.some((cell) => cell.includes(COMISSIONADO_MARK));
    if (!comissionado) {
      warnings.add("nao-comissionado", "Registros sem a marca 282/16 (não comissionados, como estagiários e contratos) ficam fora da contagem do Painel de Cargos.", fileRow);
    }
    records.push({
      matricula,
      nome,
      descricaoCargo: pick(2),
      lotacao: pick(3),
      admissao: admissao.iso,
      rescisao: rescisao.iso,
      comissionado,
    });
  }

  if (records.length === 0) throw new ImportFileError("vazio", "Não encontramos registros neste arquivo.");
  if (declaredTotal !== null && declaredTotal !== records.length) {
    warnings.add("linha-ignorada", `O rodapé do relatório informa ${declaredTotal} funcionários, mas ${records.length} foram importados.`, table.length + headerIndex);
  }
  return {
    kind: "ecidade",
    fileName,
    records,
    countsBySheet: [{ sheet: "CSV", count: records.length }],
    warnings: warnings.list(),
  };
}
