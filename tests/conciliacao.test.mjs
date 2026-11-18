// Dados 100% fictícios.
import { test } from "node:test";
import assert from "node:assert/strict";
import { conciliarRemuneracao, divergenciasParaCsv, garantirConciliacao } from "../lib/folha/conciliacao.ts";
import { subtotais, custoMensal } from "../lib/folha/funcionarios.ts";
import { chaveFuncao } from "../lib/import/tabela-salarial.ts";

const p = (origem, empresa, funcao, remuneracao, alimentacao = 0, lotacao = "Lotação X") => ({
  matricula: "x",
  servidor: "Pessoa Fictícia",
  empresaSecretaria: empresa,
  lotacao,
  funcao,
  remuneracao,
  alimentacao,
  indicacao: "",
  origem,
  linha: 3,
  possivelDuplicidade: false,
});
const tabela = [
  { cargo: "Vigia", salario: 2000, linha: 2, origem: "Terceirizado" },
  { cargo: "SERVENTE", salario: null, linha: 3, origem: "Terceirizado" },
  { cargo: "AS 1", salario: 5000, linha: 2, origem: "Comissionado" },
  { cargo: "VIGIA", salario: 9999, linha: 4, origem: "Comissionado" },
];
const rows = [
  p("Terceirizado", "Empresa A", "VIGIA", 2000),
  p("Terceirizado", "Empresa A", "VIGIA", 2100.1, 0, "Lotação Y"),
  p("Terceirizado", "Empresa A", "VIGIA", 2100.1, 0, "Lotação X"),
  p("Terceirizado", "Empresa B", "SERVENTE", 1500),
  p("Terceirizado", "Empresa B", "JARDINEIRO", 1500),
  p("Terceirizado", "Empresa B", "VIGIA", null),
  p("Comissionado", "Prefeitura", "AS 1", 5000.0),
  p("Comissionado", "Prefeitura", "Vigia", 1000),
];
const situacoes = (c) => c.rows.map((r) => r.situacaoRemuneracao);

test("situações: confere, diverge, sem-valor, fora-da-tabela e nao-informada", () => {
  const c = conciliarRemuneracao(rows, tabela);
  assert.deepEqual(situacoes(c), ["confere", "diverge", "diverge", "sem-valor", "fora-da-tabela", "nao-informada", "confere", "diverge"]);
  assert.deepEqual(c.resumo.porSituacao, { confere: 2, diverge: 3, "sem-valor": 1, "fora-da-tabela": 1, "nao-informada": 1 });
  assert.equal(c.resumo.pessoas, 8);
});

test("origem pela aba: a mesma função usa o valor da aba da própria origem", () => {
  const c = conciliarRemuneracao(rows, tabela);
  assert.equal(c.rows[0].remuneracaoTabela, 2000);
  assert.equal(c.rows[7].remuneracaoTabela, 9999);
  assert.equal(c.rows[3].remuneracaoTabela, null);
  assert.equal(c.rows[4].remuneracaoTabela, null);
});

test("totais e grupos em centavos, sem erro de ponto flutuante", () => {
  const c = conciliarRemuneracao(rows, tabela);
  const g = c.grupos.find((x) => x.empresa === "Empresa A" && x.valorInformado === 210010);
  assert.equal(g.pessoas, 2);
  assert.equal(g.valorTabela, 200000);
  assert.equal(g.diferencaUnitaria, 10010);
  assert.equal(g.diferencaMensal, 20020);
  assert.deepEqual(g.lotacoes, ["Lotação X", "Lotação Y"]);
  // 2 x 100,10 + (1000 - 9999 = -8999,00)
  assert.equal(c.resumo.diferencaTotal, 20020 - 899900);
});

test("custo NÃO muda: subtotais e custo mensal seguem o valor informado", () => {
  const c = conciliarRemuneracao(rows, tabela);
  assert.deepEqual(subtotais(c.rows), subtotais(rows));
  assert.equal(custoMensal(c.rows[1]), 2100.1);
  assert.deepEqual(c.rows.map((r) => r.remuneracao), rows.map((r) => r.remuneracao));
});

test("CSV de divergências: só grupos divergentes, agregado e sem dados de pessoas", () => {
  const linhas = divergenciasParaCsv(conciliarRemuneracao(rows, tabela).grupos);
  assert.equal(linhas.length, 2);
  assert.deepEqual(linhas[1], ["Empresa A", "Terceirizado", "VIGIA", "Lotação X / Lotação Y", "2", "2000,00", "2100,10", "100,10", "200,20"]);
  assert.ok(!JSON.stringify(linhas).includes("Pessoa Fictícia"));
});

test("garantirConciliacao: sem tabela devolve as linhas; com tabela é idempotente", () => {
  assert.equal(garantirConciliacao(rows, null), rows);
  const uma = garantirConciliacao(rows, tabela);
  assert.deepEqual(garantirConciliacao(uma, tabela), uma);
});

test("tabela sem origem (CSV) vale para as duas origens; chaveFuncao ignora acento e caixa", () => {
  const csv = [{ cargo: "Roçador", salario: 1851.9, linha: 2 }];
  const c = conciliarRemuneracao([p("Terceirizado", "E", "ROCADOR", 1851.9), p("Comissionado", "P", "rocador", 1)], csv);
  assert.deepEqual(situacoes(c), ["confere", "diverge"]);
  assert.equal(chaveFuncao(" Roçador "), chaveFuncao("ROCADOR"));
});
