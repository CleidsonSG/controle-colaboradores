// Dados 100% sintéticos (nomes inventados), gerados em memória.
import ExcelJS from "exceljs";

export function toArrayBuffer(buf) {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

const REPORT = ["Relatorio Ficticio de Servidores", "Prefeitura de Teste", "Emitido em 01/01/2026", ""];
const HEADER = ["Matrícula", "Nome", "Descrição do cargo", "Lotação", "Admissão", "Rescisão", "PADRAO"];

// U+0093 / U+0094 viram os bytes 0x93 / 0x94 em latin1 (aspas curvas do windows-1252).
export const CSV_DATA_ROWS = [
  ["1001", "Maria da Conceição Teste", "Auxiliar \u0093Administrativo\u0094", "Secretaria de Lotação Um", "01/02/2010", "", "10"],
  ["1002", "João Ficticio Silva", "Professor", "Escola Modelo", "15/03/2015", "30/06/2020", "11"],
  ["1003", "Ana Sem Admissao", "Agente", "Saúde", "", "", "12"],
  ["1004", "Pedro Comissionado Teste", "Assessor", "Gabinete", "10/10/2018", "", "282/16"],
  ["", "", "", "", "", "", ""],
  ["1005", "Lia Data Invalida", "Motorista", "Transporte", "31/02/2020", "", "13"],
];

function csvText({ delimiter = ";", withReport = true, header = HEADER, rows = CSV_DATA_ROWS } = {}) {
  const line = (cells) => cells.join(delimiter) + (delimiter === ";" ? ";" : "");
  const lines = [...(withReport ? REPORT : []), line(header), ...rows.map(line)];
  return lines.join("\r\n") + "\r\n";
}

const straight = (s) => s.replace(/[\u0093\u0094]/g, '"');
const dropQuotes = (s) => s.replace(/[\u0093\u0094]/g, "");

/** CSV padrão: windows-1252, byte 0x93 presente. */
export function csvWindows1252() {
  return toArrayBuffer(Buffer.from(csvText(), "latin1"));
}
export function csvUtf8Bom() {
  return toArrayBuffer(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(straight(csvText()), "utf8")]));
}
export function csvUtf8() {
  return toArrayBuffer(Buffer.from(straight(csvText()), "utf8"));
}
export function csvComma() {
  return toArrayBuffer(Buffer.from(dropQuotes(csvText({ delimiter: "," })), "utf8"));
}
export function csvTab() {
  return toArrayBuffer(Buffer.from(dropQuotes(csvText({ delimiter: "\t" })), "utf8"));
}
/** Sem as 4 linhas de relatório (busca robusta do cabeçalho). */
export function csvNoReport() {
  return toArrayBuffer(Buffer.from(csvText({ withReport: false }), "latin1"));
}
/** Relatório com 6 linhas antes do cabeçalho. */
export function csvLongReport() {
  return toArrayBuffer(Buffer.from("a\r\nb\r\n" + csvText(), "latin1"));
}
/** Cabeçalho sem Lotação nem Descrição do cargo. */
export function csvMissingColumns() {
  return toArrayBuffer(
    Buffer.from(csvText({ header: ["Matrícula", "Nome", "Admissão"], rows: [["1", "X", "01/01/2020"]] }), "latin1"),
  );
}
export function csvOnlyHeader() {
  return toArrayBuffer(Buffer.from(csvText({ rows: [] }), "latin1"));
}

// ---------- XLSX ----------
const XL_HEADER = ["Matrícula", "Servidor", "Empresa/Secretaria", "Lotação", "Função", "Remuneração", "Alimentação", "Indicação"];

function fillSheet(ws, rows, header = XL_HEADER) {
  ws.addRow(["Título fictício da aba"]);
  ws.addRow(header);
  for (const r of rows) ws.addRow(r);
}

export const COM_ROWS = [
  [2001, "Carla Fictícia", "Secretaria Teste", "Lotação A", "Chefe", 5000.5, "R$ 1.234,56", "Fulano"],
  ["2002", "Bruno Inventado", "Secretaria Teste", "Lotação B", "Assessor", { formula: "1000+500", result: 1500 }, 100, ""],
  ["2003", "Dora Sem Cache", "Secretaria Teste", "Lotação C", "Diretor", { formula: "A1+1" }, "abc", ""],
  ["9999", "Eva Repetida", "Secretaria Teste", "Lotação D", "Chefe", 3000, 0, ""],
];
export const TER_ROWS = [
  ["3001", "Gil Terceirizado", "Empresa Ficticia Ltda", "Lotação E", "Vigia", 2000, 500, ""],
  ["9999", "Eva Repetida", "Empresa Ficticia Ltda", "Lotação D", "Vigia", 2100, 500, ""],
];

/** opts: emptySecond, hiddenFirst, header (alternativo), noData (omite aba DADOS), withDate (data na Indicação da 1ª linha). */
export async function buildXlsx({ emptySecond = false, hiddenFirst = false, header, noData = false, withDate = false } = {}) {
  const wb = new ExcelJS.Workbook();
  const a = wb.addWorksheet("CADASTRO_COM");
  const rows = COM_ROWS.map((r) => [...r]);
  if (withDate) rows[0][7] = new Date(Date.UTC(2020, 1, 29));
  fillSheet(a, rows, header);
  if (hiddenFirst) a.state = "hidden";
  const b = wb.addWorksheet("CADASTRO_TER");
  if (!emptySecond) fillSheet(b, TER_ROWS, header);
  if (!noData) {
    const d = wb.addWorksheet("DADOS");
    d.addRow(["Sem relação"]);
    d.addRow(["x", "y"]);
    d.addRow([{ formula: "SOMA(", result: 1 }, "ZZZ"]);
  }
  const buf = await wb.xlsx.writeBuffer();
  return toArrayBuffer(Buffer.from(buf));
}
