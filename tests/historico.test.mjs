import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularHistorico, iniciais, normalizarTexto, periodoBr } from "../lib/folha/historico.ts";

test("cenario da especificacao: 4 meses, 2 cargos, 1 mudanca de cargo e 1 de lotacao", () => {
  const h = calcularHistorico([
    { competencia: "2026-01", cargo: "ASSESSOR 1", lotacao: "SECRETARIA A" },
    { competencia: "2026-02", cargo: "ASSESSOR 1", lotacao: "SECRETARIA A" },
    { competencia: "2026-03", cargo: "ASSESSOR 2", lotacao: "SECRETARIA A" },
    { competencia: "2026-04", cargo: "ASSESSOR 2", lotacao: "SECRETARIA B" },
  ]);
  assert.deepEqual(h.resumo, { mesesRegistrados: 4, cargosOcupados: 2, mudancasCargo: 1, mudancasLotacao: 1 });
  assert.deepEqual(h.atual, { cargo: "ASSESSOR 2", lotacao: "SECRETARIA B", periodo: "04/2026" });
  assert.deepEqual(h.linhas.map((l) => l.periodo), ["04/2026", "03/2026", "02/2026", "01/2026"]);
  assert.deepEqual(h.linhas.map((l) => l.mudanca), ["Lotação", "Cargo", "Sem mudança", "Início do registro"]);
  assert.equal(h.linhas[0].detalhe, "Lotação: de SECRETARIA A para SECRETARIA B");
});

test("lacuna de meses gera nota e nao conta como mudanca", () => {
  const h = calcularHistorico([
    { competencia: "2026-04", cargo: "Assessor 1", lotacao: "Secretaria A" },
    { competencia: "2026-01", cargo: "ASSESSOR 1", lotacao: "SECRETARIA A" },
  ]);
  assert.equal(h.resumo.mesesRegistrados, 2);
  assert.equal(h.resumo.mudancasCargo, 0);
  assert.equal(h.linhas[0].mudanca, "Sem mudança");
  assert.equal(h.linhas[0].nota, "após 2 meses sem registro");
  assert.equal(h.linhas[1].nota, "");
});

test("cargo e lotacao mudando juntos; um unico registro", () => {
  const h = calcularHistorico([
    { competencia: "2025-12", cargo: "A", lotacao: "X" },
    { competencia: "2026-01", cargo: "B", lotacao: "Y" },
  ]);
  assert.equal(h.linhas[0].mudanca, "Cargo e lotação");
  const unico = calcularHistorico([{ competencia: "2026-11", cargo: "A", lotacao: "X" }]);
  assert.deepEqual(unico.resumo, { mesesRegistrados: 1, cargosOcupados: 1, mudancasCargo: 0, mudancasLotacao: 0 });
  assert.equal(unico.linhas[0].mudanca, "Início do registro");
  assert.equal(calcularHistorico([]).atual, null);
});

test("normalizacao e iniciais", () => {
  assert.equal(normalizarTexto("  Função   Exemplo "), "FUNCAO EXEMPLO");
  assert.equal(periodoBr("2026-04"), "04/2026");
  assert.equal(iniciais("Pessoa Exemplo 01"), "PE");
  assert.equal(iniciais("Pessoa Exemplo"), "PE");
  assert.equal(iniciais("pessoa maria exemplo"), "PE");
  assert.equal(iniciais("Unico"), "U");
});
