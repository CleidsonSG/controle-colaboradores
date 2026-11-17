/**
 * Exportação do Relatório de Indicações em XLSX (exceljs) e PDF (jspdf + jspdf-autotable).
 * As bibliotecas são carregadas por import() dinâmico, só quando o usuário exporta.
 * O documento contém dados pessoais: uso restrito a administradores.
 */
import { descreverFiltros, type DetalheIndicacao, type FiltroIndicacoes, type RelatorioIndicacoes } from "./folha/indicacoes.ts";

export const XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const PDF_MIME_TYPE = "application/pdf";
export const TITULO_INDICACOES = "Relatório de Indicações";
export const AVISO_RESTRITO = "Documento restrito — contém dados pessoais";

export type OpcoesExportacao = {
  filtro?: FiltroIndicacoes;
  /** Data de geração (padrão: agora). */
  geradoEm?: Date;
};

const dataHora = (data: Date) => data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
const numero = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const reais = (centavos: number) => `R$ ${numero.format(centavos / 100)}`;
const linhaFiltros = (filtro?: FiltroIndicacoes) => {
  const itens = descreverFiltros(filtro);
  return itens.length > 0 ? `Filtros: ${itens.join(" | ")}` : "Filtros: nenhum (todos os registros)";
};

const RESUMO_COLUNAS = ["Indicação", "Quantidade", "Remuneração", "Alimentação", "Custo"];
const DETALHE_COLUNAS = ["Indicação", "Servidor", "Matrícula", "Origem", "Empresa/Secretaria", "Lotação", "Função", "Remuneração"];

/* ---------- XLSX ---------- */

const MOEDA_XLSX = '"R$" #,##0.00';
const COR_CABECALHO = "FF1F3A5F";
const COR_TOTAL = "FFE8EDF3";

type Planilha = import("exceljs").Worksheet;

function cabecalhoDaAba(sheet: Planilha, titulo: string, colunas: number, geradoEm: Date, filtro?: FiltroIndicacoes): number {
  const linhas = [titulo, `Gerado em ${dataHora(geradoEm)}`, linhaFiltros(filtro), AVISO_RESTRITO];
  linhas.forEach((texto, index) => {
    const row = sheet.addRow([texto]);
    sheet.mergeCells(row.number, 1, row.number, colunas);
    row.getCell(1).font = index === 0 ? { bold: true, size: 14 } : { italic: index === 3, size: 10 };
  });
  sheet.addRow([]);
  return sheet.rowCount;
}

function estilizarCabecalho(sheet: Planilha, nomes: string[]): void {
  const row = sheet.addRow(nomes);
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COR_CABECALHO } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  sheet.views = [{ state: "frozen", ySplit: row.number }];
}

function estilizarTotal(row: import("exceljs").Row): void {
  row.eachCell((cell) => {
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COR_TOTAL } };
  });
}

function larguras(sheet: Planilha, larguraPorColuna: number[], colunasMoeda: number[]): void {
  larguraPorColuna.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width;
  });
  for (const coluna of colunasMoeda) sheet.getColumn(coluna).numFmt = MOEDA_XLSX;
}

/** Gera o XLSX com as abas "Resumo" e "Detalhe". */
export async function gerarXlsxIndicacoes(relatorio: RelatorioIndicacoes, opcoes: OpcoesExportacao = {}): Promise<Blob> {
  const exceljs: typeof import("exceljs") & { default?: typeof import("exceljs") } = await import("exceljs");
  const Workbook = exceljs.default?.Workbook ?? exceljs.Workbook;
  const geradoEm = opcoes.geradoEm ?? new Date();
  const workbook = new Workbook();

  const resumo = workbook.addWorksheet("Resumo");
  cabecalhoDaAba(resumo, `${TITULO_INDICACOES} — Resumo por indicação`, RESUMO_COLUNAS.length, geradoEm, opcoes.filtro);
  estilizarCabecalho(resumo, RESUMO_COLUNAS);
  for (const item of relatorio.resumo) {
    resumo.addRow([item.indicacao, item.quantidade, item.remuneracao / 100, item.alimentacao / 100, item.custo / 100]);
  }
  const t = relatorio.total;
  estilizarTotal(resumo.addRow(["Total geral", t.quantidade, t.remuneracao / 100, t.alimentacao / 100, t.custo / 100]));
  larguras(resumo, [36, 14, 18, 18, 18], [3, 4, 5]);

  const detalhe = workbook.addWorksheet("Detalhe");
  cabecalhoDaAba(detalhe, `${TITULO_INDICACOES} — Detalhe`, DETALHE_COLUNAS.length, geradoEm, opcoes.filtro);
  estilizarCabecalho(detalhe, DETALHE_COLUNAS);
  const subtotal = (indicacao: string) => {
    const soma = relatorio.resumo.find((item) => item.indicacao === indicacao);
    estilizarTotal(detalhe.addRow([`Total — ${indicacao}`, "", "", "", "", "", `${soma?.quantidade ?? 0} registro(s)`, (soma?.remuneracao ?? 0) / 100]));
  };
  let atual: string | null = null;
  for (const linha of relatorio.detalhe) {
    if (atual !== null && atual !== linha.indicacao) subtotal(atual);
    atual = linha.indicacao;
    detalhe.addRow(linhaDetalhe(linha, linha.remuneracao / 100));
  }
  if (atual !== null) subtotal(atual);
  estilizarTotal(detalhe.addRow(["Total geral", "", "", "", "", "", `${t.quantidade} registro(s)`, t.remuneracao / 100]));
  larguras(detalhe, [28, 34, 14, 14, 30, 30, 30, 18], [8]);

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer as ArrayBuffer], { type: XLSX_MIME_TYPE });
}

function linhaDetalhe(linha: DetalheIndicacao, remuneracao: number | string): (string | number)[] {
  return [linha.indicacao, linha.servidor, linha.matricula, linha.origem, linha.empresa, linha.lotacao, linha.funcao, remuneracao];
}

/* ---------- PDF ---------- */

const MARGEM_MM = 12;

/** Gera o PDF (A4 paisagem): resumo por indicação e detalhe, com rodapé "Página X de Y". */
export async function gerarPdfIndicacoes(relatorio: RelatorioIndicacoes, opcoes: OpcoesExportacao = {}): Promise<Blob> {
  const [{ jsPDF }, autotable] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const autoTable = autotable.default ?? autotable.autoTable;
  const geradoEm = opcoes.geradoEm ?? new Date();
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const largura = doc.internal.pageSize.getWidth();

  const titulo = (texto: string) => {
    doc.setFont("helvetica", "bold").setFontSize(15).text(texto, MARGEM_MM, 16);
    doc.setFont("helvetica", "normal").setFontSize(9);
    doc.text(`Gerado em ${dataHora(geradoEm)}`, MARGEM_MM, 22);
    doc.text(doc.splitTextToSize(linhaFiltros(opcoes.filtro), largura - 2 * MARGEM_MM), MARGEM_MM, 27);
  };
  const estiloTabela = {
    margin: { left: MARGEM_MM, right: MARGEM_MM, top: 16, bottom: 14 },
    styles: { font: "helvetica", fontSize: 8, cellPadding: 1.6 },
    headStyles: { fillColor: [31, 58, 95] as [number, number, number], textColor: 255, fontStyle: "bold" as const },
    showHead: "everyPage" as const,
  };
  const direita = { halign: "right" as const };
  const t = relatorio.total;

  titulo(`${TITULO_INDICACOES} — Resumo por indicação`);
  autoTable(doc, {
    ...estiloTabela,
    startY: 34,
    head: [RESUMO_COLUNAS],
    body: relatorio.resumo.map((i) => [i.indicacao, String(i.quantidade), reais(i.remuneracao), reais(i.alimentacao), reais(i.custo)]),
    foot: [["Total geral", String(t.quantidade), reais(t.remuneracao), reais(t.alimentacao), reais(t.custo)]],
    footStyles: { fillColor: [232, 237, 243] as [number, number, number], textColor: 20, fontStyle: "bold" as const },
    columnStyles: { 1: direita, 2: direita, 3: direita, 4: direita },
  });

  doc.addPage();
  titulo(`${TITULO_INDICACOES} — Detalhe`);
  autoTable(doc, {
    ...estiloTabela,
    startY: 34,
    head: [DETALHE_COLUNAS],
    body: relatorio.detalhe.map((l) => linhaDetalhe(l, reais(l.remuneracao)).map(String)),
    foot: [["Total geral", "", "", "", "", "", `${t.quantidade} registro(s)`, reais(t.remuneracao)]],
    footStyles: { fillColor: [232, 237, 243] as [number, number, number], textColor: 20, fontStyle: "bold" as const },
    columnStyles: { 7: direita },
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
