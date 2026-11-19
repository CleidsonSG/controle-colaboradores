/**
 * Exportação da tela Funcionários em XLSX (exceljs) e PDF (jspdf + jspdf-autotable), a partir de uma tabela genérica.
 * As bibliotecas são carregadas por import() dinâmico, só quando o usuário exporta. O documento contém dados pessoais.
 */
import { AVISO_RESTRITO, PDF_MIME_TYPE, XLSX_MIME_TYPE } from "./export-indicacoes.ts";
import type { FuncaoConferida, PendenciaFuncao } from "./folha/conciliacao.ts";
import type { LinhaHistorico } from "./folha/historico.ts";

export type Celula = string | number | null;
export type ColunaExportacao = { titulo: string; moeda?: boolean };
export type TabelaExportacao = {
  titulo: string;
  /** Nome da aba do Excel (máx. 31 caracteres). */
  aba: string;
  colunas: ColunaExportacao[];
  /** Colunas de moeda recebem número em reais. */
  linhas: Celula[][];
};
export type OpcoesExportacao = { geradoEm?: Date };

const dataHora = (data: Date) => data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
const numero = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const texto = (celula: Celula, moeda?: boolean) => (celula === null ? "" : moeda && typeof celula === "number" ? `R$ ${numero.format(celula)}` : String(celula));

const MOEDA_XLSX = '"R$" #,##0.00';
const COR_CABECALHO = "FF1F3A5F";
const MARGEM_MM = 12;

/** Gera um XLSX: título, data de geração, aviso, linha em branco, cabeçalho (congelado) e uma linha por registro. */
export async function gerarXlsxTabela(tabela: TabelaExportacao, opcoes: OpcoesExportacao = {}): Promise<Blob> {
  const exceljs: typeof import("exceljs") & { default?: typeof import("exceljs") } = await import("exceljs");
  const Workbook = exceljs.default?.Workbook ?? exceljs.Workbook;
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet(tabela.aba.slice(0, 31));
  const geradoEm = opcoes.geradoEm ?? new Date();

  [tabela.titulo, `Gerado em ${dataHora(geradoEm)}`, AVISO_RESTRITO].forEach((linha, index) => {
    const row = sheet.addRow([linha]);
    if (tabela.colunas.length > 1) sheet.mergeCells(row.number, 1, row.number, tabela.colunas.length);
    row.getCell(1).font = index === 0 ? { bold: true, size: 14 } : { italic: index === 2, size: 10 };
  });
  sheet.addRow([]);
  const cabecalho = sheet.addRow(tabela.colunas.map((coluna) => coluna.titulo));
  cabecalho.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COR_CABECALHO } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  sheet.views = [{ state: "frozen", ySplit: cabecalho.number }];
  for (const linha of tabela.linhas) sheet.addRow(linha.map((celula) => celula ?? ""));
  tabela.colunas.forEach((coluna, index) => {
    const alvo = sheet.getColumn(index + 1);
    alvo.width = coluna.moeda ? 20 : 28;
    if (coluna.moeda) alvo.numFmt = MOEDA_XLSX;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer as ArrayBuffer], { type: XLSX_MIME_TYPE });
}

/** Gera um PDF A4 paisagem com a tabela e o rodapé "Página X de Y". */
export async function gerarPdfTabela(tabela: TabelaExportacao, opcoes: OpcoesExportacao = {}): Promise<Blob> {
  const [{ jsPDF }, autotable] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = autotable.default ?? autotable.autoTable;
  const geradoEm = opcoes.geradoEm ?? new Date();
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const largura = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold").setFontSize(15).text(tabela.titulo, MARGEM_MM, 16);
  doc.setFont("helvetica", "normal").setFontSize(9).text(`Gerado em ${dataHora(geradoEm)}`, MARGEM_MM, 22);
  autoTable(doc, {
    margin: { left: MARGEM_MM, right: MARGEM_MM, top: 16, bottom: 14 },
    styles: { font: "helvetica", fontSize: 8, cellPadding: 1.6 },
    headStyles: { fillColor: [31, 58, 95] as [number, number, number], textColor: 255, fontStyle: "bold" as const },
    showHead: "everyPage" as const,
    startY: 27,
    head: [tabela.colunas.map((coluna) => coluna.titulo)],
    body: tabela.linhas.map((linha) => linha.map((celula, index) => texto(celula, tabela.colunas[index]?.moeda))),
    columnStyles: Object.fromEntries(tabela.colunas.flatMap((coluna, index) => (coluna.moeda ? [[index, { halign: "right" as const }]] : []))),
  });

  const paginas = doc.getNumberOfPages();
  const altura = doc.internal.pageSize.getHeight();
  for (let pagina = 1; pagina <= paginas; pagina += 1) {
    doc.setPage(pagina);
    doc.setFont("helvetica", "normal").setFontSize(8).setTextColor(90);
    doc.text(AVISO_RESTRITO, MARGEM_MM, altura - 7);
    doc.text(`Página ${pagina} de ${paginas}`, largura - MARGEM_MM, altura - 7, { align: "right" });
  }
  return new Blob([doc.output("arraybuffer")], { type: PDF_MIME_TYPE });
}

export type TipoExportacao = "xlsx" | "pdf";

export const gerarArquivo = (tipo: TipoExportacao, tabela: TabelaExportacao, opcoes?: OpcoesExportacao) =>
  tipo === "xlsx" ? gerarXlsxTabela(tabela, opcoes) : gerarPdfTabela(tabela, opcoes);

const reais = (centavos: number | null) => (centavos === null ? null : centavos / 100);

const COLUNAS_PENDENCIA: ColunaExportacao[] = [
  { titulo: "Servidor" },
  { titulo: "Empresa/Secretaria" },
  { titulo: "Valor de referência", moeda: true },
  { titulo: "Valor informado", moeda: true },
  { titulo: "Motivo" },
];

const linhaPendencia = (p: PendenciaFuncao): Celula[] => [p.servidor, p.empresa, reais(p.valorReferencia), reais(p.valorInformado), p.motivo];

/** Detalhe de uma função: todas as pessoas, pendentes primeiro, com o motivo. */
export function tabelaDetalheFuncao(funcao: FuncaoConferida): TabelaExportacao {
  return {
    titulo: `Detalhe da função: ${funcao.funcao}`,
    aba: "Detalhe da função",
    colunas: COLUNAS_PENDENCIA,
    linhas: funcao.todas.map(linhaPendencia),
  };
}

/** Divergências da conferência: todas as pessoas pendentes, com a função na primeira coluna. */
export function tabelaDivergencias(funcoes: FuncaoConferida[]): TabelaExportacao {
  return {
    titulo: "Divergências da conferência de remuneração",
    aba: "Divergências",
    colunas: [{ titulo: "Função" }, ...COLUNAS_PENDENCIA],
    linhas: funcoes.flatMap((funcao) => funcao.pendentes.map((p) => [funcao.funcao, ...linhaPendencia(p)])),
  };
}

/** Histórico de uma pessoa: uma linha por competência, da mais recente para a mais antiga. Sem valores nem CPF. */
export function tabelaHistoricoPessoa(nome: string, linhas: LinhaHistorico[]): TabelaExportacao {
  return {
    titulo: `Histórico do funcionário: ${nome}`,
    aba: "Histórico",
    colunas: [{ titulo: "Período" }, { titulo: "Cargo" }, { titulo: "Lotação" }, { titulo: "Mudança" }, { titulo: "Detalhe" }],
    linhas: linhas.map((linha) => [linha.periodo, linha.cargo, linha.lotacao, linha.mudanca, [linha.detalhe, linha.nota].filter(Boolean).join("; ")]),
  };
}
