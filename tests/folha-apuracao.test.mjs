// Dados 100% fictícios.
import { test } from "node:test";
import assert from "node:assert/strict";
import { SEM_CARGO, apurar, folhaDaApuracao } from "../lib/folha/apuracao.ts";

const s = (matricula, descricaoCargo, extra = {}) => ({
  matricula,
  nome: `Pessoa ${matricula}`,
  descricaoCargo,
  lotacao: "Gabinete",
  admissao: "2020-01-01",
  rescisao: null,
  comissionado: false,
  ...extra,
});

const servidores = [
  s("1", "ASSESSOR 1 - AS 1", { comissionado: true }),
  s("2", "Assessor 1 - AS 1"),
  s("3", "ASSESSOR 6 - AS 6"),
  s("4", "PROFESSOR"),
  s("5", ""),
  s("6", "ASSESSOR 6 - AS 6", { rescisao: "2025-12-31" }),
  s("7", "ASSESSOR 6 - AS 6", { rescisao: "2027-01-31" }),
];
const tabela = [
  { cargo: "Assessor 1 - AS 1", salario: 8500, linha: 2 },
  { cargo: "ASSESSOR 6 - AS 6", salario: 2600, linha: 3 },
  { cargo: "ASSESSOR 3 - AS 3", salario: 5400, linha: 4 },
];
const REF = "2026-11-15";

test("conta servidores ativos por cargo, ignorando caixa e acentos", () => {
  const a = apurar(servidores, tabela, 10_000_000, REF);
  const por = Object.fromEntries(a.cargos.map((c) => [c.chave, c]));
  assert.equal(por["assessor 1 - as 1"].servidores, 2);
  assert.equal(por["assessor 1 - as 1"].comissionados, 1);
  assert.equal(por["assessor 6 - as 6"].servidores, 2, "rescisão futura ainda ocupa vaga");
  assert.equal(por["professor"].servidores, 1);
  assert.equal(por["sem cargo informado"].nome, SEM_CARGO);
  assert.equal(a.servidoresAtivos, 6);
  assert.equal(a.desligados, 1);
});

test("custo = salário da tabela × servidores; livres pelo saldo do teto", () => {
  const a = apurar(servidores, tabela, 10_000_000, REF);
  const por = Object.fromEntries(a.cargos.map((c) => [c.chave, c]));
  assert.equal(por["assessor 1 - as 1"].custo, 1_700_000);
  assert.equal(por["assessor 6 - as 6"].custo, 520_000);
  assert.equal(a.custoTotal, 2_220_000);
  assert.equal(a.saldo, 7_780_000);
  assert.equal(por["assessor 1 - as 1"].livres, 9); // 77.800 / 8.500
  assert.equal(por["assessor 6 - as 6"].livres, 29); // 77.800 / 2.600
  assert.equal(por["professor"].livres, null, "sem salário não calcula livres");
});

test("cargo da tabela sem servidores aparece com 0 ocupadas", () => {
  const a = apurar(servidores, tabela, 10_000_000, REF);
  const as3 = a.cargos.find((c) => c.chave === "assessor 3 - as 3");
  assert.equal(as3.servidores, 0);
  assert.equal(as3.custo, 0);
  assert.equal(as3.livres, 14);
});

test("cargos sem salário são contados à parte", () => {
  const a = apurar(servidores, tabela, 10_000_000, REF);
  assert.equal(a.cargosSemSalario, 2); // PROFESSOR e Sem cargo
  assert.equal(a.servidoresSemSalario, 2);
});

test("sem teto: saldo e livres ficam nulos; folha estourada dá 0 livres", () => {
  const sem = apurar(servidores, tabela, null, REF);
  assert.equal(sem.saldo, null);
  assert.ok(sem.cargos.every((c) => c.livres === null));
  const estourada = apurar(servidores, tabela, 1_000_000, REF);
  assert.equal(estourada.saldo, -1_220_000);
  assert.equal(estourada.cargos.find((c) => c.chave === "assessor 6 - as 6").livres, 0);
});

test("folhaDaApuracao alimenta o simulador só com cargos com salário", () => {
  const folha = folhaDaApuracao(apurar(servidores, tabela, 10_000_000, REF));
  assert.equal(folha.teto, 10_000_000);
  assert.deepEqual(folha.cargos.map((c) => [c.vagas, c.ocupadas, c.salario]).sort((a, b) => b[2] - a[2]), [[2, 2, 850_000], [0, 0, 540_000], [2, 2, 260_000]]);
  assert.equal(folhaDaApuracao(apurar(servidores, tabela, null, REF)), null);
});

test("apuração do e-Cidade usa só a aba Comissionado da tabela salarial", async () => {
  const { apurar } = await import("../lib/folha/apuracao.ts");
  const servidor = { matricula: "1", nome: "Pessoa Fictícia", descricaoCargo: "AGENTE EDUCACIONAL", lotacao: "", admissao: null, rescisao: null, comissionado: true };
  const tabela = [
    { cargo: "AGENTE EDUCACIONAL", salario: 6780.6, linha: 2, origem: "Terceirizado" },
    { cargo: "AGENTE EDUCACIONAL", salario: 1978.55, linha: 2, origem: "Comissionado" },
    { cargo: "ARQUITETO", salario: 12307.69, linha: 3, origem: "Terceirizado" },
  ];
  const a = apurar([servidor], tabela, null, "2026-01-01");
  assert.deepEqual(a.cargos.map((c) => [c.nome, c.salario]), [["AGENTE EDUCACIONAL", 197855]]);
});
