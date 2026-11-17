// Dados 100% fictícios.
import { test } from "node:test";
import assert from "node:assert/strict";
import { conferirTerceirizados, custoMensal, subtotais } from "../lib/folha/funcionarios.ts";

const p = (origem, empresa, funcao, remuneracao, alimentacao, extra = {}) => ({
  matricula: "x",
  servidor: "Pessoa Fictícia",
  empresaSecretaria: empresa,
  lotacao: "",
  funcao,
  remuneracao,
  alimentacao,
  indicacao: "",
  origem,
  linha: 3,
  possivelDuplicidade: false,
  ...extra,
});
const rows = [
  p("Comissionado", "Prefeitura", "AS 1", 1000.1, 100),
  p("Comissionado", "Prefeitura", "AS 2", 0, 0),
  p("Terceirizado", "Empresa B", "VIGIA", 2000, 500),
  p("Terceirizado", "Empresa A", "VIGIA", 2100, 0),
  p("Terceirizado", "Empresa A", "SERVENTE", null, null),
];

test("custo mensal por pessoa = remuneração + alimentação", () => {
  assert.equal(custoMensal(rows[0]), 1100.1);
  assert.equal(custoMensal(rows[2]), 2500);
  assert.equal(custoMensal(rows[4]), null);
});

test("subtotais: comissionados, terceirizados e total; R$ 0,00 conta na quantidade", () => {
  const s = subtotais(rows);
  assert.deepEqual(s.comissionados, { quantidade: 2, remuneracao: 100010, alimentacao: 10000, custo: 110010 });
  assert.deepEqual(s.terceirizados, { quantidade: 3, remuneracao: 410000, alimentacao: 50000, custo: 460000 });
  assert.deepEqual(s.total, { quantidade: 5, remuneracao: 510010, alimentacao: 60000, custo: 570010 });
});

test("subtotais de terceirizados por empresa, em ordem alfabética", () => {
  const s = subtotais(rows);
  assert.deepEqual(s.porEmpresa.map((e) => [e.empresa, e.quantidade, e.custo]), [["Empresa A", 2, 210000], ["Empresa B", 1, 250000]]);
});

test("subtotais respeitam o filtro aplicado às linhas", () => {
  const s = subtotais(rows.filter((r) => r.origem === "Terceirizado"));
  assert.equal(s.comissionados.quantidade, 0);
  assert.equal(s.total.quantidade, 3);
});

test("conferência: divergentes e funções sem valor (só contagens e funções)", () => {
  const tabela = [
    { cargo: "Vigia", salario: 2000, linha: 2, origem: "Terceirizado" },
    { cargo: "SERVENTE", salario: null, linha: 3, origem: "Terceirizado" },
    { cargo: "AS 1", salario: 5, linha: 4, origem: "Comissionado" },
  ];
  const c = conferirTerceirizados(rows, tabela);
  assert.equal(c.terceirizados, 3);
  assert.equal(c.divergentes, 1, "VIGIA de 2.100 difere de 2.000");
  assert.equal(c.funcoesSemValor, 1);
  assert.deepEqual(c.funcoes.map((f) => [f.funcao, f.pessoas, f.divergentes]), [["VIGIA", 2, 1], ["SERVENTE", 1, 0]]);
  assert.ok(!JSON.stringify(c).includes("Pessoa Fictícia"));
});

test("conferência: função ausente da tabela conta como sem valor", () => {
  const c = conferirTerceirizados(rows, []);
  assert.equal(c.funcoesSemValor, 2);
  assert.equal(c.divergentes, 0);
});
