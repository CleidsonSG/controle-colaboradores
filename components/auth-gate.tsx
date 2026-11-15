"use client";

import { createContext, useContext, useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { CircleAlert, Loader2, LockKeyhole, Users } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";

type AuthInfo = { email: string | null; signOut: (() => Promise<void>) | null };

const AuthContext = createContext<AuthInfo>({ email: null, signOut: null });

/** Usuário logado (quando o Supabase está configurado). */
export function useAuth(): AuthInfo {
  return useContext(AuthContext);
}

function LoginForm() {
  const emailId = useId();
  const passwordId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const { error: authError } = await getSupabase().auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (authError) {
      setError(
        authError.message.toLowerCase().includes("invalid")
          ? "E-mail ou senha incorretos. Confira e tente novamente."
          : "Não foi possível entrar agora. Verifique a conexão e tente novamente.",
      );
    }
  }

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
        <form className="flex flex-col gap-5 rounded-lg border bg-card p-6 shadow-xs" onSubmit={onSubmit} noValidate>
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold tracking-tight">Entrar</h1>
            <p className="text-sm text-muted-foreground">Use o e-mail e a senha cadastrados pelo administrador.</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor={emailId}>E-mail</label>
            <Input id={emailId} type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor={passwordId}>Senha</label>
            <Input id={passwordId} type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          {error && (
            <Alert variant="destructive" role="alert">
              <CircleAlert aria-hidden="true" />
              <AlertDescription className="text-foreground">{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" size="lg" disabled={busy || email.trim() === "" || password === ""}>
            {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LockKeyhole aria-hidden="true" />}
            Entrar
          </Button>
        </form>
      </div>
    </main>
  );
}

function SupabaseGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    const supabase = getSupabase();
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  if (session === undefined) {
    return (
      <div className="grid min-h-dvh place-items-center" role="status">
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Verificando acesso…
        </span>
      </div>
    );
  }
  if (!session) return <LoginForm />;

  const info: AuthInfo = {
    email: session.user.email ?? null,
    signOut: async () => {
      await getSupabase().auth.signOut();
    },
  };
  return <AuthContext.Provider value={info}>{children}</AuthContext.Provider>;
}

/** Com Supabase configurado, exige login antes de mostrar o sistema. Sem Supabase, os dados ficam no navegador e não há login. */
export default function AuthGate({ children }: { children: ReactNode }) {
  if (!isSupabaseConfigured()) return <>{children}</>;
  return <SupabaseGate>{children}</SupabaseGate>;
}
