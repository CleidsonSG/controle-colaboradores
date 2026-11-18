// Dados 100% fictícios.
import { test } from "node:test";
import assert from "node:assert/strict";
import { empresasSelecionadas, kpisDaSelecao, proporcaoDoMaior, rankingEmpresas } from "../lib/folha/empresas.ts";

const p = (origem, empresa, remuneracao, alimentacao) => ({
  matricula: "x",
  servidor: "Pessoa Fictícia",
  empresaSecretaria: empresa,
  lotacao: "",
  funcao: "VIGIA",
  remuneracao,
  alimentacao,
  indicacao: "",
  origem,
  linha: 3,
  possivelDuplicidade: false,
});
const rows = [
  p("Comissionado", "Prefeitura", 5000, 0),
  ...Array.from({ length: 10 }, () => p("Terceirizado", "Empresa Exemplo A", 2000, 500)),
  ...Array.from({ length: 8 }, () => p("Terceirizado", "Empresa Exemplo B", 3000, 0)),
  ...Array.from({ length: 4 }, () => p("Terceirizado", "Empresa Exemplo C", 1000, 100)),
];

test("ranking: só terceirizados, do maior custo para o menor", () => {
  const r = rankingEmpresas(rows);
  assert.deepEqual(r.map((e) => [e.empresa, e.quantidade, e.custo]), [
    ["Empresa Exemplo A", 10, 2500000],
    ["Empresa Exemplo B", 8, 2400000],
    ["Empresa Exemplo C", 4, 440000],
  ]);
});

test("seleção vazia = todas; uma empresa; nomes inexistentes viram todas", () => {
  const r = rankingEmpresas(rows);
  assert.equal(empresasSelecionadas(r, []).length, 3);
  assert.deepEqual(empresasSelecionadas(r, ["Empresa Exemplo B"]).map((e) => e.empresa), ["Empresa Exemplo B"]);
  assert.equal(empresasSelecionadas(r, ["Inexistente"]).length, 3);
});

test("KPIs da seleção: só a empresa B", () => {
  const k = kpisDaSelecao(empresasSelecionadas(rankingEmpresas(rows), ["Empresa Exemplo B"]));
  assert.deepEqual(k, { quantidade: 8, remuneracao: 2400000, alimentacao: 0, custo: 2400000, custoMedio: 300000, empresas: 1 });
});

test("KPIs de várias empresas e custo médio arredondado", () => {
  const k = kpisDaSelecao(empresasSelecionadas(rankingEmpresas(rows), ["Empresa Exemplo A", "Empresa Exemplo C"]));
  assert.equal(k.quantidade, 14);
  assert.equal(k.custo, 2940000);
  assert.equal(k.custoMedio, 210000);
  assert.equal(kpisDaSelecao([]).custoMedio, 0);
});

test("proporção das barras relativa ao maior custo", () => {
  const r = rankingEmpresas(rows);
  assert.equal(proporcaoDoMaior(r[0].custo, r), 1);
  assert.equal(proporcaoDoMaior(r[2].custo, r), 0.176);
  assert.equal(proporcaoDoMaior(10, []), 0);
});
