// Edge Function "convidar-usuario" (Supabase, Deno).
// Um administrador aprovado pede o convite; a função confere o login e o papel de quem chama, pede ao Supabase Auth
// o envio do e-mail de convite (a pessoa define a própria senha pelo link) e registra o perfil escolhido em
// public.convites. O banco só aprova a conta quando ela foi criada pelo convite e o link foi aberto (supabase/schema.sql).
// A chave secreta (SUPABASE_SERVICE_ROLE_KEY) é injetada pelo Supabase no ambiente da função e nunca vai para o site.
import { createClient } from "npm:@supabase/supabase-js@2";

const PRODUCAO = "https://cleidsonsg.github.io";
const LOCAL = "http://localhost:3000";
const ORIGENS_PERMITIDAS = new Set([PRODUCAO, LOCAL]);
const DESTINO_POR_ORIGEM: Record<string, string> = {
  [PRODUCAO]: `${PRODUCAO}/controle-colaboradores/`,
  [LOCAL]: `${LOCAL}/`,
};
const PAPEIS = new Set(["admin", "usuario"]);
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAXIMO = 254;

function cabecalhosCors(origem: string | null): Record<string, string> {
  const base: Record<string, string> = { Vary: "Origin" };
  if (!origem || !ORIGENS_PERMITIDAS.has(origem)) return base;
  return {
    ...base,
    "Access-Control-Allow-Origin": origem,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Max-Age": "86400",
  };
}

function responder(origem: string | null, status: number, corpo: Record<string, unknown>): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cabecalhosCors(origem), "Content-Type": "application/json; charset=utf-8" },
  });
}

function erro(origem: string | null, status: number, mensagem: string): Response {
  return responder(origem, status, { error: mensagem });
}

type Pedido = { email: string; papel: "admin" | "usuario" };

async function lerPedido(req: Request): Promise<Pedido | null> {
  try {
    const corpo = await req.json();
    const email = typeof corpo?.email === "string" ? corpo.email.trim().toLowerCase() : "";
    const papel = typeof corpo?.papel === "string" ? corpo.papel : "";
    if (email.length > EMAIL_MAXIMO || !EMAIL_VALIDO.test(email) || !PAPEIS.has(papel)) return null;
    return { email, papel: papel as Pedido["papel"] };
  } catch {
    return null;
  }
}

function emailJaExiste(e: { code?: string; status?: number; message?: string }): boolean {
  const m = (e.message ?? "").toLowerCase();
  return e.code === "email_exists" || m.includes("already been registered") || m.includes("already registered");
}

Deno.serve(async (req) => {
  const origem = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cabecalhosCors(origem) });
  if (req.method !== "POST") return erro(origem, 405, "Método não permitido.");
  if (origem && !ORIGENS_PERMITIDAS.has(origem)) return erro(origem, 403, "Origem não permitida.");

  const url = Deno.env.get("SUPABASE_URL");
  const chavePublica = Deno.env.get("SUPABASE_ANON_KEY");
  const chaveSecreta = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !chavePublica || !chaveSecreta) return erro(origem, 500, "Função sem configuração do Supabase.");

  const autorizacao = req.headers.get("Authorization") ?? "";
  if (!autorizacao.startsWith("Bearer ")) return erro(origem, 401, "Entre no sistema para convidar usuários.");

  // Cliente com o login de quem chama: valida o JWT no Auth e consulta o papel pelas regras do banco.
  const comoChamador = createClient(url, chavePublica, {
    global: { headers: { Authorization: autorizacao } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: usuario, error: erroUsuario } = await comoChamador.auth.getUser(autorizacao.slice("Bearer ".length));
  if (erroUsuario || !usuario?.user) return erro(origem, 401, "Sessão expirada. Entre de novo.");

  const { data: ehAdmin, error: erroPapel } = await comoChamador.rpc("is_admin");
  if (erroPapel) return erro(origem, 500, "Não foi possível conferir seu acesso.");
  if (ehAdmin !== true) return erro(origem, 403, "Só administradores podem convidar usuários.");

  const pedido = await lerPedido(req);
  if (!pedido) return erro(origem, 400, "Informe um e-mail válido e o perfil (Usuário ou Administrador).");

  // Cliente com a chave secreta: só depois de autorizar o chamador.
  const comoServidor = createClient(url, chaveSecreta, { auth: { persistSession: false, autoRefreshToken: false } });
  const destino = DESTINO_POR_ORIGEM[origem ?? ""] ?? DESTINO_POR_ORIGEM[PRODUCAO];

  const { error: erroConvite } = await comoServidor.auth.admin.inviteUserByEmail(pedido.email, { redirectTo: destino });
  if (erroConvite) {
    if (emailJaExiste(erroConvite)) return erro(origem, 409, "E-mail já cadastrado; aprove ou recuse em Usuários.");
    if (erroConvite.status === 429) return erro(origem, 429, "Muitos envios em pouco tempo. Aguarde alguns minutos e tente de novo.");
    return erro(origem, 502, "O Supabase não conseguiu enviar o convite. Tente novamente.");
  }

  // O convite só é aplicado quando a pessoa abre o link do e-mail, então o registro aqui chega antes dele.
  const { data: convite, error: erroRegistro } = await comoServidor
    .from("convites")
    .upsert(
      { email: pedido.email, papel: pedido.papel, criado_por: usuario.user.id, criado_em: new Date().toISOString(), usado_em: null, usado_por: null },
      { onConflict: "email" },
    )
    .select("email, papel, criado_em, usado_em")
    .single();
  if (erroRegistro || !convite) {
    return erro(origem, 500, "O e-mail de convite foi enviado, mas o perfil não foi registrado. Aprove a pessoa em Usuários quando ela entrar.");
  }

  return responder(origem, 200, { convite });
});
