import Papa from "papaparse";
import type { Worksheet } from "exceljs";
import { orderedSheets, readCell, rowTexts, type LoadedWorkbook } from "./planilha-excel.ts";
import { decodeText, detectDelimiter, normalizeHeader, parseMoney, WarningCollector } from "./text.ts";
import { ImportFileError, type CargoSalario, type ImportResult, type ImportWarning, type Origem } from "./types.ts";

const MAX_HEADER_SCAN = 30;
const CARGO_ALIASES = ["funcao", "cargo", "descricao do cargo", "descricao cargo"];
const SALARIO_ALIASES = ["remuneracao", "salario", "salario base", "vencimento", "vencimento base", "valor"];

/** Cabeçalho de tabela salarial: tem função (ou cargo) e remuneração (ou salário), e não tem matrícula (que indicaria lista de pessoas). */
export function isSalarialHeader(cells: string[]): boolean {
  const normalized = cells.map((cell) => normalizeHeader(cell ?? ""));
  const hasCargo = normalized.some((cell) => CARGO_ALIASES.includes(cell));
  const hasSalario = normalized.some((cell) => SALARIO_ALIASES.includes(cell));
  return hasCargo && hasSalario && !normalized.includes("matricula");
}

function columnIndex(cells: string[], aliases: string[]): number {
  // A ordem dos aliases é a prioridade: "funcao" vence "cargo", "remuneracao" vence "salario" e "valor".
  for (const alias of aliases) {
    const index = cells.findIndex((cell) => cell === alias);
    if (index >= 0) return index;
  }
  return -1;
}

type LinhaSalarial = { cargo: string; salario: string | number | null; linha: number };
type GrupoSalarial = { rows: LinhaSalarial[]; sheet?: string; origem?: Origem };

/** Origem pela aba: "Comissionado(s)" ou "Terceirizado(s)"; sem nome reconhecível, vale a posição (1ª = comissionados). */
function origemDaAba(nome: string, posicao: number, total: number): Origem | undefined {
  const chave = normalizeHeader(nome);
  if (chave.includes("terceir")) return "Terceirizado";
  if (chave.includes("comiss")) return "Comissionado";
  if (total < 2) return undefined;
  return posicao === 0 ? "Comissionado" : posicao === 1 ? "Terceirizado" : undefined;
}

/** Chave única de função/cargo (sem acento, caixa ou espaços repetidos) para cruzar planilha, tabela salarial e e-Cidade. */
export function chaveFuncao(nome: string): string {
  return normalizeHeader(nome);
}

const MAX_NOMES_AVISO = 30;
const reaisTexto = (valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function listarNomes(nomes: string[]): string {
  const mostrados = nomes.slice(0, MAX_NOMES_AVISO).join(", ");
  return nomes.length > MAX_NOMES_AVISO ? `${mostrados} e mais ${nomes.length - MAX_NOMES_AVISO}` : mostrados;
}

type FuncaoLida = { record: CargoSalario; invalida: boolean; valores: number[]; linhasDivergentes: number[] };

/** Junta as linhas lidas: em função repetida na mesma aba vale o primeiro valor preenchido; avisa (com os nomes) valores divergentes e funções sem remuneração. */
function finish(fileName: string, grupos: GrupoSalarial[]): ImportResult<CargoSalario> {
  const warnings: ImportWarning[] = [];
  const records: CargoSalario[] = [];
  const countsBySheet: ImportResult<CargoSalario>["countsBySheet"] = [];
  for (const grupo of grupos) {
    const collector = new WarningCollector();
    const lidas = new Map<string, FuncaoLida>();
    for (const row of grupo.rows) {
      const cargo = row.cargo.trim();
      if (cargo === "") {
        if (row.salario !== null && String(row.salario).trim() !== "") {
          collector.add("linha-ignorada", "Linhas sem função foram ignoradas.", row.linha);
        }
        continue;
      }
      const key = chaveFuncao(cargo);
      const money = parseMoney(row.salario);
      const salario = money.invalid ? null : money.value;
      const existente = lidas.get(key);
      if (!existente) {
        const record: CargoSalario = { cargo, salario, linha: row.linha };
        if (grupo.origem) record.origem = grupo.origem;
        records.push(record);
        lidas.set(key, { record, invalida: money.invalid, valores: salario === null ? [] : [salario], linhasDivergentes: [] });
        if (money.invalid) collector.add("valor-invalido", "Remunerações inválidas: as funções ficaram sem valor.", row.linha);
        continue;
      }
      const diverge = salario !== null && existente.record.salario !== null && !existente.valores.includes(salario);
      if (diverge) existente.linhasDivergentes.push(row.linha);
      else collector.add("duplicidade", "Funções repetidas na mesma aba: foi usado o primeiro valor preenchido.", row.linha);
      if (salario === null) continue;
      if (existente.record.salario === null) existente.record.salario = salario;
      if (!existente.valores.includes(salario)) existente.valores.push(salario);
    }
    const lista = [...lidas.values()];
    const semValor = lista.filter((f) => f.record.salario === null && !f.invalida);
    const divergentes = lista.filter((f) => f.linhasDivergentes.length > 0);
    const prefix = grupos.length > 1 && grupo.sheet ? `Aba ${grupo.sheet}: ` : "";
    const extras: ImportWarning[] = [];
    if (divergentes.length > 0) {
      const nomes = divergentes.map((f) => `${f.record.cargo} (${f.valores.map(reaisTexto).join(" / ")})`);
      extras.push({
        code: "valores-divergentes",
        message: `Funções repetidas com valores diferentes (vale o primeiro valor preenchido): ${listarNomes(nomes)}.`,
        rows: divergentes.flatMap((f) => f.linhasDivergentes),
      });
    }
    if (semValor.length > 0) {
      extras.push({
        code: "sem-valor",
        message: `Funções sem remuneração na tabela (ficam sem valor): ${listarNomes(semValor.map((f) => f.record.cargo))}.`,
        rows: semValor.map((f) => f.record.linha),
      });
    }
    for (const warning of [...collector.list(), ...extras]) warnings.push({ ...warning, message: `${prefix}${warning.message}` });
    const count = lista.length;
    if (grupo.sheet) countsBySheet.push(grupo.origem ? { sheet: grupo.sheet, origem: grupo.origem, count } : { sheet: grupo.sheet, count });
  }
  if (records.length === 0) throw new ImportFileError("vazio", "Não encontramos funções nesta tabela salarial.");
  return { kind: "salarial", fileName, records, countsBySheet, warnings };
}

const MISSING = ["Função (ou Cargo)", "Remuneração (ou Salário)"];

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
  const rows: LinhaSalarial[] = table.slice(1).map((cells, index) => ({
    cargo: String(cells[cargoAt] ?? ""),
    salario: cells[salarioAt] === undefined ? null : String(cells[salarioAt]),
    linha: headerIndex + index + 2,
  }));
  return finish(fileName, [{ rows }]);
}

function findSalarialHeaderRow(worksheet: Worksheet): number {
  const limit = Math.min(worksheet.rowCount, MAX_HEADER_SCAN);
  for (let row = 1; row <= limit; row += 1) {
    if (isSalarialHeader(rowTexts(worksheet, row))) return row;
  }
  return -1;
}

/** Abas com cabeçalho de tabela salarial, na ordem da pasta de trabalho. */
export function findSalarialSheets(workbook: LoadedWorkbook): { worksheet: Worksheet; headerRow: number }[] {
  const found: { worksheet: Worksheet; headerRow: number }[] = [];
  for (const worksheet of orderedSheets(workbook)) {
    if (worksheet.actualRowCount === 0) continue;
    const headerRow = findSalarialHeaderRow(worksheet);
    if (headerRow > 0) found.push({ worksheet, headerRow });
  }
  return found;
}

/** Primeira aba com cabeçalho de tabela salarial (usada para reconhecer o tipo do arquivo). */
export function findSalarialSheet(workbook: LoadedWorkbook): { worksheet: Worksheet; headerRow: number } | null {
  return findSalarialSheets(workbook)[0] ?? null;
}

/**
 * Lê a tabela salarial de uma pasta de trabalho XLSX/XLSM já carregada (macros nunca são executadas).
 * Todas as abas com Função/Remuneração (ou Cargo/Salário) são lidas; a aba define a origem
 * (Comissionado ou Terceirizado), e a mesma função pode ter remunerações diferentes em cada aba.
 */
export function parseTabelaSalarialWorkbook(workbook: LoadedWorkbook, fileName: string): ImportResult<CargoSalario> {
  const abas = findSalarialSheets(workbook);
  if (abas.length === 0) throw new ImportFileError("cabecalho", "Não encontramos as colunas da tabela salarial.", MISSING);
  const grupos = abas.map(({ worksheet, headerRow }, posicao) => {
    const header = rowTexts(worksheet, headerRow).map((cell) => cell ?? "");
    const cargoAt = columnIndex(header, CARGO_ALIASES);
    const salarioAt = columnIndex(header, SALARIO_ALIASES);
    const rows: LinhaSalarial[] = [];
    for (let rowNumber = headerRow + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      const cargo = readCell(row.getCell(cargoAt)).value;
      const salario = readCell(row.getCell(salarioAt)).value;
      rows.push({ cargo: cargo === null ? "" : String(cargo), salario, linha: rowNumber });
    }
    return { rows, sheet: worksheet.name, origem: origemDaAba(worksheet.name, posicao, abas.length) };
  });
  return finish(fileName, grupos);
}
