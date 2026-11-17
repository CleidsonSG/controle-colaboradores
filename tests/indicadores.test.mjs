import { test } from "node:test";
import assert from "node:assert/strict";
import { custoAlimentacao, movimentacaoMensal, ocupacaoPorLotacao } from "../lib/folha/indicadores.ts";

// Dados 100% sintéticos.
const srv = (over) => ({ matricula: "1", nome: "Pessoa Teste", descricaoCargo: "Assessor", lotacao: "Gabinete", admissao: null, rescisao: null, comissionado: true, ...over });
const TABELA = [
  { cargo: "Assessor", salario: 5000, linha: 2 },
  { cargo: "Diretor", salario: 8000.5, linha: 3 },
  { cargo: "Assessor", salario: 999, linha: 4, origem: "Terceirizado" },
];

test("ocupação por lotação: só 282/16 ativos, custo da aba Comissionado, ordenado por custo", () => {
  const r = ocupacaoPorLotacao(
    [
      srv({ lotacao: "Gabinete" }),
      srv({ lotacao: "  gabinete ", descricaoCargo: "Diretor" }),
      srv({ lotacao: "Saúde", descricaoCargo: "Assessor" }),
      srv({ lotacao: "Saúde", descricaoCargo: "Cargo Fora Da Tabela" }),
      srv({ lotacao: "Saúde", rescisao: "2026-01-01" }),
      srv({ lotacao: "Obras", comissionado: false }),
      srv({ lotacao: "", descricaoCargo: "Assessor" }),
    ],
    TABELA,
    "2026-06-01",
  );
  assert.deepEqual(r.lotacoes.map((l) => [l.lotacao, l.servidores, l.custo, l.semSalario]), [
    ["Gabinete", 2, 1300050, 0],
    ["Saúde", 2, 500000, 1],
    ["Sem lotação informada", 1, 500000, 0],
  ]);
  assert.equal(r.servidores, 5);
  assert.equal(r.custo, 2300050);
  assert.equal(r.semSalario, 1);
});

test("ocupação sem tabela: custo 0 e tudo sem salário", () => {
  const r = ocupacaoPorLotacao([srv({})], null, "2026-06-01");
  assert.deepEqual([r.custo, r.semSalario, r.servidores], [0, 1, 1]);
});

test("movimentação mensal: contagens, saldo, meses sem movimento e período", () => {
  const r = movimentacaoMensal([
    srv({ admissao: "2025-11-10" }),
    srv({ admissao: "2025-11-30", rescisao: "2026-02-01" }),
    srv({ admissao: "2026-01-05", comissionado: false }),
    srv({ admissao: null, rescisao: "invalido" }),
  ]);
  assert.deepEqual(r.meses.map((m) => [m.mes, m.admissoes, m.rescisoes, m.saldo]), [
    ["2025-11", 2, 0, 2],
    ["2025-12", 0, 0, 0],
    ["2026-01", 1, 0, 1],
    ["2026-02", 0, 1, -1],
  ]);
  assert.deepEqual([r.totalAdmissoes, r.totalRescisoes, r.saldo], [3, 1, 2]);
  assert.deepEqual(r.periodo, { inicio: "2025-11-10", fim: "2026-02-01" });
  assert.equal(movimentacaoMensal([srv({ admissao: "2026-01-05", comissionado: false })], { somenteComissionados: true }).periodo, null);
  assert.deepEqual(movimentacaoMensal([]).meses, []);
});

const row = (origem, remuneracao, alimentacao) => ({ origem, remuneracao, alimentacao, empresaSecretaria: "Empresa" });

test("custo com alimentação: totais, médias e arredondamento", () => {
  const r = custoAlimentacao([
    row("Comissionado", 1000, 100),
    row("Comissionado", 2000.01, null),
    row("Terceirizado", 1500, 300.5),
  ]);
  assert.deepEqual([r.comissionados.quantidade, r.comissionados.remuneracao, r.comissionados.alimentacao, r.comissionados.custo], [2, 300001, 10000, 310001]);
  assert.equal(r.comissionados.mediaCusto, 155001);
  assert.equal(r.terceirizados.mediaAlimentacao, 30050);
  assert.deepEqual([r.total.quantidade, r.total.custo], [3, 490051]);
  const vazio = custoAlimentacao([]);
  assert.deepEqual([vazio.total.quantidade, vazio.total.mediaCusto], [0, 0]);
});
