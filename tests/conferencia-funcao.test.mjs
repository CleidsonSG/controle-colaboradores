// Dados 100% fictícios.
import { test } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { agregarPorFuncao, conciliarRemuneracao, MOTIVO_DIVERGE, MOTIVO_NAO_INFORMADA, precisaAtencao } from "../lib/folha/conciliacao.ts";
import { gerarPdfTabela, gerarXlsxTabela, tabelaDetalheFuncao, tabelaDivergencias } from "../lib/export-funcionarios.ts";

const p = (servidor, funcao, remuneracao, empresa = "Empresa Exemplo", origem = "Terceirizado") => ({
  matricula: "",
  servidor,
  empresaSecretaria: empresa,
  lotacao: "Lotação Exemplo",
  funcao,
  remuneracao,
  alimentacao: 0,
  indicacao: "",
  origem,
  linha: 3,
  possivelDuplicidade: false,
});
const tabela = [
  { cargo: "FUNÇÃO EXEMPLO A", salario: 2000, linha: 2, origem: "Terceirizado" },
  { cargo: "FUNÇÃO EXEMPLO B", salario: 1500, linha: 3, origem: "Terceirizado" },
  { cargo: "FUNÇÃO EXEMPLO C", salario: 1000, linha: 4, origem: "Terceirizado" },
  { cargo: "FUNÇÃO EXEMPLO D", salario: null, linha: 5, origem: "Terceirizado" },
];
const rows = [
  p("Pessoa Exemplo 01", "FUNÇÃO EXEMPLO A", 2100),
  p("Pessoa Exemplo 02", "FUNÇÃO EXEMPLO A", 2100),
  p("Pessoa Exemplo 03", "FUNÇÃO EXEMPLO A", 1900),
  p("Pessoa Exemplo 04", "FUNÇÃO EXEMPLO A", 2000),
  p("Pessoa Exemplo 05", "FUNÇÃO EXEMPLO B", null),
  p("Pessoa Exemplo 06", "FUNÇÃO EXEMPLO B", 1500),
  p("Pessoa Exemplo 07", "FUNÇÃO EXEMPLO C", 1000),
  p("Pessoa Exemplo 08", "FUNÇÃO EXEMPLO D", 1234.5),
  p("Pessoa Exemplo 09", "FUNÇÃO EXEMPLO E", 999),
];
const funcoes = agregarPorFuncao(conciliarRemuneracao(rows, tabela).rows);
const por = (nome) => funcoes.find((f) => f.funcao === nome);

test("agregação: uma linha por função, em ordem alfabética", () => {
  assert.deepEqual(funcoes.map((f) => f.funcao), ["FUNÇÃO EXEMPLO A", "FUNÇÃO EXEMPLO B", "FUNÇÃO EXEMPLO C", "FUNÇÃO EXEMPLO D", "FUNÇÃO EXEMPLO E"]);
  assert.equal(por("FUNÇÃO EXEMPLO A").pessoas, 4);
});

test("mais de um valor informado vira 'Vários valores' (lista com 3 distintos)", () => {
  const a = por("FUNÇÃO EXEMPLO A");
  assert.deepEqual(a.valoresInformados, [190000, 200000, 210000]);
  assert.equal(a.valorReferencia, 200000);
  assert.equal(a.situacao, "diverge");
  assert.deepEqual(por("FUNÇÃO EXEMPLO C").valoresInformados, [100000]);
});

test("sem referência não conta como divergência e não abre detalhe", () => {
  for (const nome of ["FUNÇÃO EXEMPLO D", "FUNÇÃO EXEMPLO E"]) {
    const f = por(nome);
    assert.equal(f.situacao, "sem-referencia");
    assert.equal(f.valorReferencia, null);
    assert.equal(precisaAtencao(f), false);
    assert.deepEqual(f.pendentes, []);
  }
  assert.equal(funcoes.filter(precisaAtencao).length, 2);
  assert.equal(por("FUNÇÃO EXEMPLO C").situacao, "confere");
});

test("detalhe: divergentes e sem remuneração, com motivo", () => {
  const a = por("FUNÇÃO EXEMPLO A");
  assert.equal(a.pendentes.length, 3);
  assert.ok(a.pendentes.every((x) => x.motivo === MOTIVO_DIVERGE && x.valorReferencia === 200000));
  const b = por("FUNÇÃO EXEMPLO B");
  assert.equal(b.situacao, "nao-informada");
  assert.deepEqual(b.pendentes.map((x) => [x.servidor, x.valorInformado, x.motivo]), [["Pessoa Exemplo 05", null, MOTIVO_NAO_INFORMADA]]);
});

test("xlsx: N linhas de dados com os cabeçalhos visíveis; PDF gera blob", async () => {
  const tab = tabelaDetalheFuncao(por("FUNÇÃO EXEMPLO A"));
  const blob = await gerarXlsxTabela(tab, { geradoEm: new Date(2026, 10, 18) });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await blob.arrayBuffer());
  const sheet = wb.worksheets[0];
  const cab = ["Servidor", "Empresa/Secretaria", "Valor de referência", "Valor informado", "Motivo"];
  let cabecalho = 0;
  sheet.eachRow((row, n) => {
    if (row.getCell(1).value === "Servidor") cabecalho = n;
  });
  assert.ok(cabecalho > 0);
  assert.deepEqual(cab.map((_, i) => sheet.getRow(cabecalho).getCell(i + 1).value), cab);
  assert.equal(sheet.rowCount - cabecalho, 3);
  assert.equal(sheet.getRow(cabecalho + 1).getCell(3).value, 2000);

  const pdf = await gerarPdfTabela(tabelaDivergencias(funcoes.filter(precisaAtencao)));
  assert.equal(pdf.type, "application/pdf");
  assert.ok(pdf.size > 500);
});
