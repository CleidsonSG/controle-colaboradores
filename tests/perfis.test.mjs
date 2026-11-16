// Dados 100% fictícios.
import { test } from "node:test";
import assert from "node:assert/strict";
import { acoesPermitidas, mensagemErroCadastro, ordenarPerfis } from "../lib/supabase/perfis.ts";

const p = (userId, status, papel = "usuario", criadoEm = "2026-11-16T10:00:00Z") => ({ userId, email: `${userId}@exemplo.test`, nome: userId, status, papel, criadoEm, atualizadoEm: criadoEm });

test("ordena pendentes primeiro e mais recentes antes", () => {
  const lista = ordenarPerfis([p("a", "aprovado"), p("b", "bloqueado"), p("c", "pendente", "usuario", "2026-11-15T00:00:00Z"), p("d", "pendente")]);
  assert.deepEqual(lista.map((x) => x.userId), ["d", "c", "a", "b"]);
});

test("ações do administrador por situação, nunca sobre si mesmo", () => {
  assert.deepEqual(acoesPermitidas(p("x", "pendente"), "eu"), ["aprovar", "bloquear"]);
  assert.deepEqual(acoesPermitidas(p("x", "aprovado"), "eu"), ["tornar-admin", "bloquear"]);
  assert.deepEqual(acoesPermitidas(p("x", "aprovado", "admin"), "eu"), ["remover-admin", "bloquear"]);
  assert.deepEqual(acoesPermitidas(p("x", "bloqueado"), "eu"), ["desbloquear"]);
  assert.deepEqual(acoesPermitidas(p("eu", "aprovado", "admin"), "eu"), []);
});

test("mensagens de erro do cadastro em português", () => {
  assert.match(mensagemErroCadastro("User already registered"), /já tem cadastro/);
  assert.match(mensagemErroCadastro("Password should be at least 8 characters"), /8 caracteres/);
  assert.match(mensagemErroCadastro("Signups not allowed for this instance"), /desativados/);
  assert.match(mensagemErroCadastro("algo inesperado"), /Tente novamente/);
});

import { emailValido, normalizarEmail } from "../lib/supabase/perfis.ts";

test("e-mail do convite é normalizado e validado", () => {
  assert.equal(normalizarEmail("  Pessoa@Exemplo.TEST "), "pessoa@exemplo.test");
  assert.equal(emailValido("pessoa@exemplo.test"), true);
  assert.equal(emailValido("pessoa@exemplo"), false);
  assert.equal(emailValido("sem arroba.test"), false);
});
