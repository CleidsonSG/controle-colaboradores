import { test } from "node:test";
import assert from "node:assert/strict";
import { FOLHA_SIMULADA, aplicarTroca, alterarVagas, resumir, simularTroca, situacaoCargo, vagasQueCabem } from "../lib/folha/simulacao.ts";

const folha = FOLHA_SIMULADA;

test("resumo da folha simulada fica dentro do teto", () => {
  const r = resumir(folha);
  assert.equal(r.teto, 10_000_000);
  assert.equal(r.comprometido, 9_770_000);
  assert.equal(r.saldo, 230_000);
  assert.equal(r.vagas, 20);
  assert.equal(r.ocupadas, 18);
  assert.equal(r.livres, 2);
});

test("vagasQueCabem usa só o saldo", () => {
  assert.equal(vagasQueCabem(folha, "AS6"), 0);
  assert.equal(vagasQueCabem({ ...folha, teto: 10_300_000 }, "AS6"), 2);
});

test("trocar 1 AS 1 por AS 6 rende 4 vagas e exige 1 exoneração", () => {
  const r = simularTroca(folha, { origem: "AS1", destino: "AS6", reduzir: 1 });
  assert.equal(r.ok, true);
  assert.equal(r.liberado, 850_000);
  assert.equal(r.ganho, 4); // (230.000 + 850.000) / 260.000 = 4,15
  assert.equal(r.exoneracoes, 1);
  assert.equal(r.saldoDepois, 40_000);
});

test("vaga livre na origem não exige exoneração", () => {
  const r = simularTroca(folha, { origem: "AS3", destino: "AS6", reduzir: 1 });
  assert.equal(r.ok, true);
  assert.equal(r.exoneracoes, 0);
});

test("troca inválida explica o motivo", () => {
  assert.equal(simularTroca(folha, { origem: "AS1", destino: "AS1", reduzir: 1 }).ok, false);
  assert.equal(simularTroca(folha, { origem: "AS1", destino: "AS6", reduzir: 3 }).ok, false);
  assert.equal(simularTroca(folha, { origem: "AS1", destino: "AS6", reduzir: 0 }).ok, false);
});

test("aplicarTroca mantém a folha dentro do teto", () => {
  const nova = aplicarTroca(folha, { origem: "AS1", destino: "AS6", reduzir: 1 });
  const as1 = nova.cargos.find((c) => c.id === "AS1");
  const as6 = nova.cargos.find((c) => c.id === "AS6");
  assert.equal(as1.vagas, 1);
  assert.equal(as1.ocupadas, 1);
  assert.equal(as6.vagas, 7);
  assert.ok(resumir(nova).saldo >= 0);
});

test("alterarVagas respeita teto e ocupadas", () => {
  assert.equal(alterarVagas(folha, "AS6", 1), folha, "sem saldo para +1 AS 6");
  assert.equal(alterarVagas(folha, "AS1", -1), folha, "não reduz abaixo das ocupadas");
  const menos = alterarVagas(folha, "AS3", -1);
  assert.equal(menos.cargos.find((c) => c.id === "AS3").vagas, 3);
});

test("situacaoCargo sempre traz rótulo em texto", () => {
  assert.equal(situacaoCargo({ id: "x", nome: "x", salario: 1, vagas: 2, ocupadas: 2 }).rotulo, "Lotado");
  assert.equal(situacaoCargo({ id: "x", nome: "x", salario: 1, vagas: 5, ocupadas: 4 }).rotulo, "Quase lotado");
  assert.equal(situacaoCargo({ id: "x", nome: "x", salario: 1, vagas: 4, ocupadas: 1 }).rotulo, "Com vagas");
});
