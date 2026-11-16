"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, CircleAlert, Loader2, RefreshCw, ShieldCheck, ShieldMinus, ShieldPlus, ShieldX, Undo2 } from "lucide-react";
import { useAuth } from "@/components/auth-gate";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import { acoesPermitidas, atualizarPerfil, listarPerfis, ordenarPerfis, type Perfil, type StatusPerfil } from "@/lib/supabase/perfis";
import { cn } from "@/lib/utils";

type Acao = ReturnType<typeof acoesPermitidas>[number];

const ACAO: Record<Acao, { rotulo: string; mudanca: Partial<Pick<Perfil, "status" | "papel">>; feito: string; destrutiva?: boolean; Icone: typeof Check }> = {
  aprovar: { rotulo: "Aprovar", mudanca: { status: "aprovado" }, feito: "aprovado", Icone: Check },
  bloquear: { rotulo: "Bloquear", mudanca: { status: "bloqueado" }, feito: "bloqueado", destrutiva: true, Icone: ShieldX },
  desbloquear: { rotulo: "Desbloquear", mudanca: { status: "aprovado" }, feito: "desbloqueado", Icone: Undo2 },
  "tornar-admin": { rotulo: "Tornar administrador", mudanca: { papel: "admin" }, feito: "agora é administrador", Icone: ShieldPlus },
  "remover-admin": { rotulo: "Remover administrador", mudanca: { papel: "usuario" }, feito: "deixou de ser administrador", Icone: ShieldMinus },
};

const SITUACAO: Record<StatusPerfil, { rotulo: string; variant: "warning" | "success" | "destructive" }> = {
  pendente: { rotulo: "Pendente", variant: "warning" },
  aprovado: { rotulo: "Aprovado", variant: "success" },
  bloqueado: { rotulo: "Bloqueado", variant: "destructive" },
};

const dataHora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

function Linha({ perfil, meuId, ocupado, onAcao }: { perfil: Perfil; meuId: string; ocupado: boolean; onAcao: (acao: Acao) => void }) {
  const acoes = acoesPermitidas(perfil, meuId);
  const situacao = SITUACAO[perfil.status];
  const voce = perfil.userId === meuId;
  return (
    <li className={cn("flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5", perfil.status === "pendente" && "bg-warning/5")}>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{perfil.nome || "Sem nome"}</span>
          <Badge variant={situacao.variant}>{situacao.rotulo}</Badge>
          {perfil.papel === "admin" && (
            <Badge variant="secondary">
              <ShieldCheck aria-hidden="true" />
              Administrador
            </Badge>
          )}
          {voce && <span className="text-sm text-muted-foreground">(você)</span>}
        </p>
        <p className="truncate text-sm text-muted-foreground">{perfil.email}</p>
        <p className="text-xs text-muted-foreground">Pedido em {dataHora.format(new Date(perfil.criadoEm))}</p>
      </div>
      {acoes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {acoes.map((acao) => {
            const { rotulo, destrutiva, Icone } = ACAO[acao];
            return (
              <Button
                key={acao}
                size="sm"
                variant={acao === "aprovar" ? "default" : "outline"}
                className={cn(destrutiva && "text-destructive hover:bg-destructive/10 hover:text-destructive")}
                type="button"
                disabled={ocupado}
                onClick={() => onAcao(acao)}
                aria-label={`${rotulo}: ${perfil.nome || perfil.email}`}
              >
                <Icone aria-hidden="true" />
                {rotulo}
              </Button>
            );
          })}
        </div>
      )}
    </li>
  );
}

export default function UsuariosView() {
  const { userId, isAdmin } = useAuth();
  const [perfis, setPerfis] = useState<Perfil[] | null>(null);
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState<{ perfil: Perfil; acao: Acao } | null>(null);

  const carregar = useCallback(async () => {
    setErro("");
    try {
      setPerfis(await listarPerfis(getSupabase()));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar os usuários.");
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured() || !isAdmin) return;
    let active = true;
    listarPerfis(getSupabase())
      .then((lista) => active && setPerfis(lista))
      .catch((e) => active && setErro(e instanceof Error ? e.message : "Não foi possível carregar os usuários."));
    return () => {
      active = false;
    };
  }, [isAdmin]);

  const ordenados = useMemo(() => (perfis ? ordenarPerfis(perfis) : []), [perfis]);
  const pendentes = ordenados.filter((p) => p.status === "pendente").length;

  async function executar(perfil: Perfil, acao: Acao) {
    setOcupado(true);
    setErro("");
    setAviso("");
    try {
      const atualizado = await atualizarPerfil(getSupabase(), perfil.userId, ACAO[acao].mudanca);
      setPerfis((lista) => (lista ?? []).map((p) => (p.userId === atualizado.userId ? atualizado : p)));
      setAviso(`${atualizado.nome || atualizado.email} ${ACAO[acao].feito}.`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar a alteração.");
    } finally {
      setOcupado(false);
      setConfirmar(null);
    }
  }

  const cabecalho = (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex max-w-2xl flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Usuários</h1>
        <p className="text-muted-foreground">Aprove pedidos de acesso, bloqueie contas e defina administradores.</p>
      </div>
      {isAdmin && isSupabaseConfigured() && (
        <Button variant="outline" type="button" onClick={() => void carregar()} disabled={ocupado}>
          <RefreshCw aria-hidden="true" />
          Atualizar lista
        </Button>
      )}
    </header>
  );

  if (!isSupabaseConfigured()) {
    return (
      <div className="flex flex-col gap-8">
        {cabecalho}
        <Alert variant="info">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>Disponível só com o Supabase</AlertTitle>
          <AlertDescription>Sem as variáveis do Supabase, o sistema funciona só neste navegador e não tem usuários.</AlertDescription>
        </Alert>
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="flex flex-col gap-8">
        {cabecalho}
        <Alert variant="warning">
          <ShieldX aria-hidden="true" />
          <AlertTitle>Apenas administradores</AlertTitle>
          <AlertDescription>Peça a um administrador para liberar ou alterar acessos.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {cabecalho}

      <div className="flex flex-col gap-3 empty:hidden">
        {erro && (
          <Alert variant="destructive" role="alert">
            <CircleAlert aria-hidden="true" />
            <AlertDescription className="text-foreground">{erro}</AlertDescription>
          </Alert>
        )}
        {aviso && (
          <Alert variant="success" role="status">
            <Check aria-hidden="true" />
            <AlertDescription className="text-foreground">{aviso}</AlertDescription>
          </Alert>
        )}
      </div>

      {perfis === null && !erro ? (
        <div className="flex flex-col gap-2" role="status" aria-label="Carregando usuários">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (
        <section className="flex flex-col gap-3" aria-labelledby="lista-usuarios">
          <h2 id="lista-usuarios" className="text-sm text-muted-foreground">
            {ordenados.length.toLocaleString("pt-BR")} {ordenados.length === 1 ? "usuário" : "usuários"}
            {pendentes > 0 && (
              <>
                , <strong className="font-medium text-warning">{pendentes} {pendentes === 1 ? "pedido pendente" : "pedidos pendentes"}</strong>
              </>
            )}
          </h2>
          <ul className="divide-y overflow-hidden rounded-lg border bg-card">
            {ordenados.map((perfil) => (
              <Linha
                key={perfil.userId}
                perfil={perfil}
                meuId={userId ?? ""}
                ocupado={ocupado}
                onAcao={(acao) => (ACAO[acao].destrutiva || acao === "tornar-admin" || acao === "remover-admin" ? setConfirmar({ perfil, acao }) : void executar(perfil, acao))}
              />
            ))}
          </ul>
        </section>
      )}

      <Dialog open={confirmar !== null} onOpenChange={(aberto) => { if (!aberto && !ocupado) setConfirmar(null); }}>
        {confirmar && (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{ACAO[confirmar.acao].rotulo}?</DialogTitle>
              <DialogDescription>
                {confirmar.acao === "bloquear"
                  ? `${confirmar.perfil.nome || confirmar.perfil.email} perde o acesso aos dados imediatamente. Você pode desbloquear depois.`
                  : confirmar.acao === "tornar-admin"
                    ? `${confirmar.perfil.nome || confirmar.perfil.email} poderá aprovar e bloquear usuários, inclusive outros administradores.`
                    : `${confirmar.perfil.nome || confirmar.perfil.email} continua com acesso aos dados, mas não gerencia mais usuários.`}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setConfirmar(null)} disabled={ocupado} autoFocus>Cancelar</Button>
              <Button
                variant={ACAO[confirmar.acao].destrutiva ? "destructive" : "default"}
                type="button"
                disabled={ocupado}
                onClick={() => void executar(confirmar.perfil, confirmar.acao)}
              >
                {ocupado && <Loader2 className="animate-spin" aria-hidden="true" />}
                {ACAO[confirmar.acao].rotulo}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
