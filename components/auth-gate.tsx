"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { CircleAlert, Clock, KeyRound, Loader2, LockKeyhole, LogOut, MailCheck, RefreshCw, ShieldX, UserPlus, Users } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { carregarMeuPerfil, emailValido, enviarLinkNovaSenha, mensagemErroCadastro, type Perfil } from "@/lib/supabase/perfis";

type AuthInfo = {
  userId: string | null;
  email: string | null;
  nome: string | null;
  isAdmin: boolean;
  signOut: (() => Promise<void>) | null;
};

const AuthContext = createContext<AuthInfo>({ userId: null, email: null, nome: null, isAdmin: false, signOut: null });

/** Usuário logado e aprovado (quando o Supabase está configurado). */
export function useAuth(): AuthInfo {
  return useContext(AuthContext);
}

const SENHA_MINIMA = 8;

function sair() {
  return getSupabase().auth.signOut().then(() => undefined);
}

/* ---------- Moldura das telas de acesso ---------- */

function Moldura({ children }: { children: ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-10">
      <div className="flex w-full max-w-sm flex-col gap-8">
        <div className="flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-md bg-sidebar text-sidebar-ring" aria-hidden="true">
            <Users className="size-5" />
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-lg font-semibold">Controle Colaboradores</span>
            <span className="text-sm text-muted-foreground">Gestão de pessoas</span>
          </div>
        </div>
        {children}
        <p className="text-center text-xs text-muted-foreground">
          <Link className="underline underline-offset-4 hover:text-foreground" href="/privacidade">Aviso de privacidade</Link>
        </p>
      </div>
    </main>
  );
}

function Erro({ texto }: { texto: string }) {
  return (
    <Alert variant="destructive" role="alert">
      <CircleAlert aria-hidden="true" />
      <AlertDescription className="text-foreground">{texto}</AlertDescription>
    </Alert>
  );
}

/* ---------- Entrar ---------- */

/** Mensagem clara + detalhe técnico (ajuda a diagnosticar endereço ou chave do Supabase errados). */
function mensagemErroEntrar(mensagem: string, status?: number): string {
  const m = mensagem.toLowerCase();
  if (m.includes("not confirmed")) return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
  if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos. Confira e tente novamente.";
  if (m.includes("api key") || m.includes("apikey") || status === 401) {
    return `O sistema não foi aceito pelo Supabase: confira a chave anon em .env.local. (detalhe: ${mensagem})`;
  }
  if (m.includes("fetch") || m.includes("network") || m.includes("load failed")) {
    return `Não foi possível conectar ao Supabase: confira o endereço em .env.local e a internet. (detalhe: ${mensagem})`;
  }
  return `Não foi possível entrar agora. (detalhe: ${status ? `${status} ` : ""}${mensagem})`;
}

function FormEntrar({ onCadastrar, onEsqueci }: { onCadastrar: () => void; onEsqueci: () => void }) {
  const emailId = useId();
  const senhaId = useId();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");

  async function entrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setErro("");
    try {
      const { error } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password: senha });
      setBusy(false);
      if (error) setErro(mensagemErroEntrar(error.message, error.status));
    } catch (e) {
      setBusy(false);
      setErro(mensagemErroEntrar(e instanceof Error ? e.message : String(e)));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form className="flex flex-col gap-5 rounded-lg border bg-card p-6 shadow-xs" onSubmit={entrar} noValidate>
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">Entrar</h1>
          <p className="text-sm text-muted-foreground">Use o e-mail e a senha do seu acesso.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor={emailId}>E-mail</label>
          <Input id={emailId} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <label className="text-sm font-medium" htmlFor={senhaId}>Senha</label>
            <Button variant="link" className="h-auto p-0 text-sm" type="button" onClick={onEsqueci}>
              Esqueci minha senha
            </Button>
          </div>
          <Input id={senhaId} type="password" autoComplete="current-password" required value={senha} onChange={(e) => setSenha(e.target.value)} />
        </div>
        {erro && <Erro texto={erro} />}
        <Button type="submit" size="lg" disabled={busy || email.trim() === "" || senha === ""}>
          {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}
          Entrar
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Ainda não tem acesso?{" "}
        <Button variant="link" className="h-auto p-0" type="button" onClick={onCadastrar}>
          Solicitar acesso
        </Button>
      </p>
    </div>
  );
}

/* ---------- Solicitar acesso ---------- */

function FormCadastro({ onEntrar }: { onEntrar: () => void }) {
  const nomeId = useId();
  const emailId = useId();
  const senhaId = useId();
  const confirmaId = useId();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [enviado, setEnviado] = useState(false);

  async function cadastrar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (senha.length < SENHA_MINIMA) return setErro(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`);
    if (senha !== confirma) return setErro("As senhas não são iguais.");
    setBusy(true);
    setErro("");
    const base = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
    const { data, error } = await getSupabase().auth.signUp({
      email: email.trim(),
      password: senha,
      options: { data: { nome: nome.trim() }, emailRedirectTo: `${window.location.origin}${base}/` },
    });
    setBusy(false);
    if (error) return setErro(mensagemErroCadastro(error.message));
    // Com confirmação de e-mail ligada, não há sessão ainda: a pessoa confirma e depois entra.
    if (!data.session) setEnviado(true);
  }

  if (enviado) {
    return (
      <div className="flex flex-col gap-5 rounded-lg border bg-card p-6 shadow-xs" role="status">
        <span className="grid size-11 place-items-center rounded-full bg-secondary text-secondary-foreground" aria-hidden="true">
          <MailCheck className="size-5" />
        </span>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-xl font-semibold tracking-tight">Pedido enviado</h1>
          <p className="text-sm text-muted-foreground">
            Enviamos um link para <strong className="font-medium text-foreground">{email.trim()}</strong>. Confirme o e-mail e depois entre: seu
            acesso fica liberado quando um administrador aprovar.
          </p>
        </div>
        <Button variant="outline" type="button" onClick={onEntrar}>Voltar para Entrar</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form className="flex flex-col gap-5 rounded-lg border bg-card p-6 shadow-xs" onSubmit={cadastrar} noValidate>
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">Solicitar acesso</h1>
          <p className="text-sm text-muted-foreground">Um administrador vai analisar o pedido. Você só vê os dados depois da aprovação.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor={nomeId}>Nome completo</label>
          <Input id={nomeId} autoComplete="name" required maxLength={120} value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor={emailId}>E-mail</label>
          <Input id={emailId} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor={senhaId}>Senha</label>
          <Input
            id={senhaId}
            type="password"
            autoComplete="new-password"
            required
            minLength={SENHA_MINIMA}
            aria-describedby={`${senhaId}-dica`}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />
          <p id={`${senhaId}-dica`} className="text-xs text-muted-foreground">Pelo menos {SENHA_MINIMA} caracteres.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor={confirmaId}>Confirme a senha</label>
          <Input id={confirmaId} type="password" autoComplete="new-password" required value={confirma} onChange={(e) => setConfirma(e.target.value)} />
        </div>
        {erro && <Erro texto={erro} />}
        <Button type="submit" size="lg" disabled={busy || nome.trim() === "" || email.trim() === "" || senha === "" || confirma === ""}>
          {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <UserPlus aria-hidden="true" />}
          Enviar pedido de acesso
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Já tem acesso?{" "}
        <Button variant="link" className="h-auto p-0" type="button" onClick={onEntrar}>
          Entrar
        </Button>
      </p>
    </div>
  );
}

/* ---------- Esqueci minha senha ---------- */

function FormEsqueci({ onEntrar }: { onEntrar: () => void }) {
  const emailId = useId();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [enviado, setEnviado] = useState(false);

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!emailValido(email)) return setErro("Digite um e-mail válido.");
    setBusy(true);
    setErro("");
    try {
      await enviarLinkNovaSenha(getSupabase(), email);
      setEnviado(true);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar o link.");
    } finally {
      setBusy(false);
    }
  }

  if (enviado) {
    return (
      <div className="flex flex-col gap-5 rounded-lg border bg-card p-6 shadow-xs" role="status">
        <span className="grid size-11 place-items-center rounded-full bg-secondary text-secondary-foreground" aria-hidden="true">
          <MailCheck className="size-5" />
        </span>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-xl font-semibold tracking-tight">Confira seu e-mail</h1>
          <p className="text-sm text-muted-foreground">
            Se <strong className="font-medium text-foreground">{email.trim()}</strong> tiver cadastro, você vai receber um link para criar uma senha nova.
          </p>
        </div>
        <Button variant="outline" type="button" onClick={onEntrar}>Voltar para Entrar</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <form className="flex flex-col gap-5 rounded-lg border bg-card p-6 shadow-xs" onSubmit={enviar} noValidate>
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">Esqueci minha senha</h1>
          <p className="text-sm text-muted-foreground">Informe seu e-mail e enviaremos um link para criar uma senha nova.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor={emailId}>E-mail</label>
          <Input id={emailId} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {erro && <Erro texto={erro} />}
        <Button type="submit" size="lg" disabled={busy || email.trim() === ""}>
          {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <KeyRound aria-hidden="true" />}
          Enviar link
        </Button>
      </form>
      <p className="text-center text-sm text-muted-foreground">
        Lembrou a senha?{" "}
        <Button variant="link" className="h-auto p-0" type="button" onClick={onEntrar}>
          Entrar
        </Button>
      </p>
    </div>
  );
}

/* ---------- Nova senha (ao voltar pelo link do e-mail) ---------- */

function FormNovaSenha({ onConcluir }: { onConcluir: () => void }) {
  const senhaId = useId();
  const confirmaId = useId();
  const [senha, setSenha] = useState("");
  const [confirma, setConfirma] = useState("");
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (senha.length < SENHA_MINIMA) return setErro(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`);
    if (senha !== confirma) return setErro("As senhas não são iguais.");
    setBusy(true);
    setErro("");
    const { error } = await getSupabase().auth.updateUser({ password: senha });
    setBusy(false);
    if (error) {
      setErro(error.message.toLowerCase().includes("different") ? "A senha nova precisa ser diferente da anterior." : "Não foi possível salvar a senha. Peça um link novo.");
      return;
    }
    onConcluir();
  }

  return (
    <Moldura>
      <form className="flex flex-col gap-5 rounded-lg border bg-card p-6 shadow-xs" onSubmit={salvar} noValidate>
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold tracking-tight">Criar senha nova</h1>
          <p className="text-sm text-muted-foreground">Escolha uma senha com pelo menos {SENHA_MINIMA} caracteres.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor={senhaId}>Senha nova</label>
          <Input id={senhaId} type="password" autoComplete="new-password" required value={senha} onChange={(e) => setSenha(e.target.value)} autoFocus />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor={confirmaId}>Confirme a senha nova</label>
          <Input id={confirmaId} type="password" autoComplete="new-password" required value={confirma} onChange={(e) => setConfirma(e.target.value)} />
        </div>
        {erro && <Erro texto={erro} />}
        <Button type="submit" size="lg" disabled={busy || senha === "" || confirma === ""}>
          {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <KeyRound aria-hidden="true" />}
          Salvar senha
        </Button>
      </form>
    </Moldura>
  );
}

/* ---------- Pendente / bloqueado ---------- */

function TelaSituacao({ perfil, email, onVerificar, verificando }: { perfil: Perfil | null; email: string; onVerificar: () => void; verificando: boolean }) {
  const bloqueado = perfil?.status === "bloqueado";
  const Icone = bloqueado ? ShieldX : Clock;
  return (
    <Moldura>
      <div className="flex flex-col gap-5 rounded-lg border bg-card p-6 shadow-xs" role="status">
        <span
          className={bloqueado ? "grid size-11 place-items-center rounded-full bg-destructive/10 text-destructive" : "grid size-11 place-items-center rounded-full bg-warning/10 text-warning"}
          aria-hidden="true"
        >
          <Icone className="size-5" />
        </span>
        <div className="flex flex-col gap-1.5">
          <h1 className="text-xl font-semibold tracking-tight">{bloqueado ? "Acesso bloqueado" : "Aguardando aprovação"}</h1>
          <p className="text-sm text-muted-foreground">
            {bloqueado
              ? "Seu acesso foi bloqueado por um administrador. Se achar que é um engano, fale com o responsável pelo sistema."
              : "Seu pedido foi recebido. Assim que um administrador aprovar, você verá os dados ao entrar."}
          </p>
          <p className="text-sm text-muted-foreground">
            Conta: <span className="font-medium text-foreground">{email}</span>
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          {!bloqueado && (
            <Button type="button" onClick={onVerificar} disabled={verificando}>
              {verificando ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
              Verificar de novo
            </Button>
          )}
          <Button variant="outline" type="button" onClick={() => void sair()}>
            <LogOut aria-hidden="true" />
            Sair
          </Button>
        </div>
      </div>
    </Moldura>
  );
}

/* ---------- Portão ---------- */

function Verificando({ texto }: { texto: string }) {
  return (
    <div className="grid min-h-dvh place-items-center" role="status">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        {texto}
      </span>
    </div>
  );
}

type EstadoPerfil = { status: "carregando" } | { status: "ok"; perfil: Perfil | null } | { status: "erro" };

// Retorno do link do e-mail de convite (#access_token=...&type=invite). Lido ao carregar o módulo, antes de o cliente
// do Supabase processar e limpar o endereço; nesse caso a pessoa define a senha antes de entrar no sistema.
// Vale uma vez só: depois de mostrar a tela, outros eventos de login não a reabrem.
let conviteAguardandoSenha =
  typeof window !== "undefined" &&
  (() => {
    const hash = new URLSearchParams(window.location.hash.slice(1));
    return hash.get("type") === "invite" && hash.has("access_token");
  })();

function SupabaseGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  // Link de cadastro enviado no convite (?cadastro=1) abre direto em "Solicitar acesso".
  // Seguro na pré-renderização: o formulário só aparece depois que a sessão é verificada no navegador.
  const [modo, setModo] = useState<"entrar" | "cadastrar" | "esqueci">(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).has("cadastro") ? "cadastrar" : "entrar",
  );
  const [recuperando, setRecuperando] = useState(false);
  const [perfil, setPerfil] = useState<EstadoPerfil>({ status: "carregando" });
  const [verificando, setVerificando] = useState(false);
  const userId = session?.user.id ?? null;

  useEffect(() => {
    const supabase = getSupabase();
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((event, next) => {
      const definirSenhaDoConvite = conviteAguardandoSenha && next !== null && (event === "SIGNED_IN" || event === "INITIAL_SESSION");
      if (definirSenhaDoConvite) conviteAguardandoSenha = false;
      if (event === "PASSWORD_RECOVERY" || definirSenhaDoConvite) setRecuperando(true);
      setSession(next);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const carregar = useCallback(async (id: string) => {
    try {
      setPerfil({ status: "ok", perfil: await carregarMeuPerfil(getSupabase(), id) });
    } catch {
      setPerfil({ status: "erro" });
    }
  }, []);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    void carregarMeuPerfil(getSupabase(), userId)
      .then((p) => active && setPerfil({ status: "ok", perfil: p }))
      .catch(() => active && setPerfil({ status: "erro" }));
    return () => {
      active = false;
      setPerfil({ status: "carregando" });
    };
  }, [userId]);

  if (session === undefined) return <Verificando texto="Verificando acesso…" />;
  if (!session) {
    return (
      <Moldura>
        {modo === "entrar" && <FormEntrar onCadastrar={() => setModo("cadastrar")} onEsqueci={() => setModo("esqueci")} />}
        {modo === "cadastrar" && <FormCadastro onEntrar={() => setModo("entrar")} />}
        {modo === "esqueci" && <FormEsqueci onEntrar={() => setModo("entrar")} />}
      </Moldura>
    );
  }
  if (recuperando) return <FormNovaSenha onConcluir={() => setRecuperando(false)} />;
  if (perfil.status === "carregando") return <Verificando texto="Carregando seu perfil…" />;
  if (perfil.status === "erro") {
    return (
      <Moldura>
        <div className="flex flex-col gap-4 rounded-lg border bg-card p-6 shadow-xs">
          <Erro texto="Não foi possível verificar seu acesso. Confira a conexão e se o script supabase/schema.sql foi executado." />
          <div className="flex gap-2">
            <Button type="button" onClick={() => void carregar(session.user.id)}>Tentar de novo</Button>
            <Button variant="outline" type="button" onClick={() => void sair()}>Sair</Button>
          </div>
        </div>
      </Moldura>
    );
  }
  if (perfil.perfil?.status !== "aprovado") {
    return (
      <TelaSituacao
        perfil={perfil.perfil}
        email={session.user.email ?? ""}
        verificando={verificando}
        onVerificar={() => {
          setVerificando(true);
          void carregar(session.user.id).finally(() => setVerificando(false));
        }}
      />
    );
  }

  const info: AuthInfo = {
    userId: session.user.id,
    email: session.user.email ?? null,
    nome: perfil.perfil.nome || null,
    isAdmin: perfil.perfil.papel === "admin",
    signOut: sair,
  };
  return <AuthContext.Provider value={info}>{children}</AuthContext.Provider>;
}

/** Com Supabase configurado, exige login e aprovação antes de mostrar o sistema. Sem Supabase, os dados ficam no navegador e não há login. */
export default function AuthGate({ children }: { children: ReactNode }) {
  // O aviso de privacidade é público: abre sem login.
  const pathname = usePathname();
  if ((pathname ?? "").replace(/\/+$/, "") === "/privacidade") return <>{children}</>;
  if (!isSupabaseConfigured()) return <>{children}</>;
  return <SupabaseGate>{children}</SupabaseGate>;
}
