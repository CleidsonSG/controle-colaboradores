import type { SupabaseClient } from "@supabase/supabase-js";

export type StatusPerfil = "pendente" | "aprovado" | "bloqueado";
export type PapelPerfil = "admin" | "usuario";

export type Perfil = {
  userId: string;
  email: string;
  nome: string;
  status: StatusPerfil;
  papel: PapelPerfil;
  criadoEm: string;
  atualizadoEm: string;
};

type PerfilRow = {
  user_id: string;
  email: string;
  nome: string;
  status: StatusPerfil;
  papel: PapelPerfil;
  criado_em: string;
  atualizado_em: string;
};

const COLUNAS = "user_id, email, nome, status, papel, criado_em, atualizado_em";

function deRow(row: PerfilRow): Perfil {
  return {
    userId: row.user_id,
    email: row.email,
    nome: row.nome,
    status: row.status,
    papel: row.papel,
    criadoEm: row.criado_em,
    atualizadoEm: row.atualizado_em,
  };
}

/** Perfil do usuário logado. null = ainda não criado (trate como pendente). */
export async function carregarMeuPerfil(supabase: SupabaseClient, userId: string): Promise<Perfil | null> {
  const { data, error } = await supabase.from("perfis").select(COLUNAS).eq("user_id", userId).maybeSingle<PerfilRow>();
  if (error) throw new Error("Não foi possível verificar seu acesso.");
  return data ? deRow(data) : null;
}

/** Todos os perfis (as regras do banco só liberam para administradores). */
export async function listarPerfis(supabase: SupabaseClient): Promise<Perfil[]> {
  const { data, error } = await supabase.from("perfis").select(COLUNAS).order("criado_em", { ascending: false }).returns<PerfilRow[]>();
  if (error) throw new Error("Não foi possível carregar os usuários.");
  return (data ?? []).map(deRow);
}

export async function atualizarPerfil(supabase: SupabaseClient, userId: string, mudanca: Partial<Pick<Perfil, "status" | "papel">>): Promise<Perfil> {
  const { data, error } = await supabase.from("perfis").update(mudanca).eq("user_id", userId).select(COLUNAS).maybeSingle<PerfilRow>();
  if (error || !data) throw new Error("Não foi possível salvar a alteração. Confira se você ainda é administrador.");
  return deRow(data);
}

/** Pendentes primeiro, depois aprovados e bloqueados; dentro de cada grupo, os mais recentes primeiro. */
export function ordenarPerfis(perfis: Perfil[]): Perfil[] {
  const peso: Record<StatusPerfil, number> = { pendente: 0, aprovado: 1, bloqueado: 2 };
  return [...perfis].sort((a, b) => peso[a.status] - peso[b.status] || b.criadoEm.localeCompare(a.criadoEm));
}

/** Ações que um administrador pode fazer sobre outro perfil (nunca sobre o próprio). */
export function acoesPermitidas(alvo: Perfil, meuId: string): Array<"aprovar" | "bloquear" | "desbloquear" | "tornar-admin" | "remover-admin"> {
  if (alvo.userId === meuId) return [];
  if (alvo.status === "pendente") return ["aprovar", "bloquear"];
  if (alvo.status === "bloqueado") return ["desbloquear"];
  return alvo.papel === "admin" ? ["remover-admin", "bloquear"] : ["tornar-admin", "bloquear"];
}

/** Traduz erros do cadastro do Supabase Auth para mensagens claras. */
export function mensagemErroCadastro(mensagem: string): string {
  const m = mensagem.toLowerCase();
  if (m.includes("already registered") || m.includes("already been registered")) return "Este e-mail já tem cadastro. Use Entrar.";
  if (m.includes("password")) return "A senha precisa ter pelo menos 8 caracteres.";
  if (m.includes("signups not allowed") || m.includes("signup is disabled")) return "Os cadastros estão desativados no momento. Fale com o administrador.";
  if (m.includes("rate limit") || m.includes("too many")) return "Muitas tentativas. Aguarde alguns minutos e tente de novo.";
  if (m.includes("invalid") && m.includes("email")) return "Confira o e-mail digitado.";
  return "Não foi possível enviar o pedido agora. Tente novamente.";
}
