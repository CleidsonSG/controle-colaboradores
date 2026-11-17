"use client";

import { useCallback, useEffect, useId, useMemo, useState, type FormEvent } from "react";
import { Check, CircleAlert, KeyRound, Loader2, MailPlus, RefreshCw, Search, ShieldCheck, ShieldX, Trash2, Undo2, UserPlus } from "lucide-react";
import { useAuth } from "@/components/auth-gate";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  atualizarPerfil,
  cancelarConvite,
  convidarUsuario,
  emailValido,
  enviarLinkNovaSenha,
  listarConvites,
  listarPerfis,
  normalizarEmail,
  ordenarPerfis,
  type Convite,
  type PapelPerfil,
  type Perfil,
  type StatusPerfil,
} from "@/lib/supabase/perfis";
import { cn } from "@/lib/utils";

const data = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const dataHora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

const SITUACAO: Record<StatusPerfil, { rotulo: string; variant: "warning" | "success" | "destructive" }> = {
  pendente: { rotulo: "Pendente", variant: "warning" },
  aprovado: { rotulo: "Aprovado", variant: "success" },
  bloqueado: { rotulo: "Bloqueado", variant: "destructive" },
};
const PAPEL: Record<PapelPerfil, string> = { admin: "Administrador", usuario: "Usuário" };

type Confirmacao =
  | { tipo: "bloquear"; perfil: Perfil }
  | { tipo: "papel"; perfil: Perfil; papel: PapelPerfil }
  | { tipo: "cancelar-convite"; convite: Convite };

function semAcento(texto: string) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function Pessoa({ perfil, voce }: { perfil: Perfil; voce: boolean }) {
  return (
    <div className="flex min-w-0 flex-col">
      <span className="truncate font-medium">
        {perfil.nome || "Sem nome"}
        {voce && <span className="font-normal text-muted-foreground"> (você)</span>}
      </span>
      <span className="truncate text-sm text-muted-foreground">{perfil.email}</span>
    </div>
  );
}

function Vazio({ texto }: { texto: string }) {
  return <p className="rounded-lg border border-dashed bg-card px-6 py-10 text-center text-sm text-muted-foreground">{texto}</p>;
}

/* ---------- Aba Usuários ---------- */

function AbaUsuarios({
  perfis,
  meuId,
  ocupado,
  onStatus,
  onPedirConfirmacao,
}: {
  perfis: Perfil[];
  meuId: string;
  ocupado: boolean;
  onStatus: (perfil: Perfil, status: StatusPerfil) => void;
  onPedirConfirmacao: (c: Confirmacao) => void;
}) {
  const buscaId = useId();
  const filtroId = useId();
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<StatusPerfil | "todos">("todos");
  const visiveis = useMemo(() => {
    const termo = semAcento(busca.trim());
    return ordenarPerfis(perfis).filter(
      (p) => (filtro === "todos" || p.status === filtro) && (termo === "" || semAcento(`${p.nome} ${p.email}`).includes(termo)),
    );
  }, [perfis, busca, filtro]);

  function acoes(perfil: Perfil) {
    if (perfil.userId === meuId) return <span className="text-sm text-muted-foreground max-md:hidden">—</span>;
    return (
      <div className="flex flex-wrap gap-2">
        {perfil.status === "pendente" && (
          <Button size="sm" type="button" disabled={ocupado} onClick={() => onStatus(perfil, "aprovado")} aria-label={`Aprovar ${perfil.nome || perfil.email}`}>
            <Check aria-hidden="true" />
            Aprovar
          </Button>
        )}
        {perfil.status === "bloqueado" ? (
          <Button size="sm" variant="outline" type="button" disabled={ocupado} onClick={() => onStatus(perfil, "aprovado")} aria-label={`Desbloquear ${perfil.nome || perfil.email}`}>
            <Undo2 aria-hidden="true" />
            Desbloquear
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            type="button"
            disabled={ocupado}
            onClick={() => onPedirConfirmacao({ tipo: "bloquear", perfil })}
            aria-label={`${perfil.status === "pendente" ? "Recusar" : "Bloquear"} ${perfil.nome || perfil.email}`}
          >
            <ShieldX aria-hidden="true" />
            {perfil.status === "pendente" ? "Recusar" : "Bloquear"}
          </Button>
        )}
      </div>
    );
  }

  function seletorPapel(perfil: Perfil) {
    const voce = perfil.userId === meuId;
    return (
      <NativeSelect
        className="h-9 min-w-40"
        aria-label={`Perfil de ${perfil.nome || perfil.email}`}
        value={perfil.papel}
        disabled={ocupado || voce || perfil.status !== "aprovado"}
        title={voce ? "Você não pode alterar o próprio perfil." : perfil.status !== "aprovado" ? "Aprove o usuário antes de mudar o perfil." : undefined}
        onChange={(event) => onPedirConfirmacao({ tipo: "papel", perfil, papel: event.target.value as PapelPerfil })}
      >
        <option value="usuario">Usuário</option>
        <option value="admin">Administrador</option>
      </NativeSelect>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor={buscaId}>Buscar</label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input id={buscaId} type="search" className="pl-9" placeholder="Nome ou e-mail" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium" htmlFor={filtroId}>Situação</label>
          <NativeSelect id={filtroId} value={filtro} onChange={(e) => setFiltro(e.target.value as StatusPerfil | "todos")}>
            <option value="todos">Todas</option>
            <option value="pendente">Pendentes</option>
            <option value="aprovado">Aprovados</option>
            <option value="bloqueado">Bloqueados</option>
          </NativeSelect>
        </div>
      </div>

      {visiveis.length === 0 ? (
        <Vazio texto="Nenhum usuário encontrado com esses filtros." />
      ) : (
        <>
          {/* Desktop: tabela */}
          <div className="hidden overflow-hidden rounded-lg border bg-card md:block">
            <Table>
              <caption className="sr-only">Usuários do sistema</caption>
              <TableHeader className="bg-muted/60">
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="col" className="pl-5">Nome</TableHead>
                  <TableHead scope="col">Situação</TableHead>
                  <TableHead scope="col">Perfil</TableHead>
                  <TableHead scope="col">Cadastro</TableHead>
                  <TableHead scope="col" className="pr-5">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiveis.map((perfil) => (
                  <TableRow key={perfil.userId} className={cn(perfil.status === "pendente" && "bg-warning/5")}>
                    <TableCell className="max-w-72 py-3 pl-5">
                      <Pessoa perfil={perfil} voce={perfil.userId === meuId} />
                    </TableCell>
                    <TableCell>
                      <Badge variant={SITUACAO[perfil.status].variant}>{SITUACAO[perfil.status].rotulo}</Badge>
                    </TableCell>
                    <TableCell>{seletorPapel(perfil)}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums">{data.format(new Date(perfil.criadoEm))}</TableCell>
                    <TableCell className="pr-5">{acoes(perfil)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Celular: lista */}
          <ul className="flex flex-col divide-y overflow-hidden rounded-lg border bg-card md:hidden">
            {visiveis.map((perfil) => (
              <li key={perfil.userId} className={cn("flex flex-col gap-3 p-4", perfil.status === "pendente" && "bg-warning/5")}>
                <div className="flex items-start justify-between gap-3">
                  <Pessoa perfil={perfil} voce={perfil.userId === meuId} />
                  <Badge variant={SITUACAO[perfil.status].variant}>{SITUACAO[perfil.status].rotulo}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">Cadastro em {data.format(new Date(perfil.criadoEm))}</p>
                {seletorPapel(perfil)}
                {acoes(perfil)}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

/* ---------- Aba Convites ---------- */

function AbaConvites({ convites, ocupado, onCancelar }: { convites: Convite[]; ocupado: boolean; onCancelar: (c: Convite) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-prose text-sm text-muted-foreground">
        O convite chega por e-mail. Ao abrir o link e criar a senha, a pessoa entra já aprovada, com o perfil escolhido.
      </p>
      {convites.length === 0 ? (
        <Vazio texto="Nenhum convite aguardando resposta." />
      ) : (
        <ul className="flex flex-col divide-y overflow-hidden rounded-lg border bg-card">
          {convites.map((convite) => (
            <li key={convite.email} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <div className="flex min-w-0 flex-col gap-1">
                <p className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-medium">{convite.email}</span>
                  <Badge variant="secondary">{PAPEL[convite.papel]}</Badge>
                </p>
                <p className="text-xs text-muted-foreground">Convidado em {dataHora.format(new Date(convite.criadoEm))}. Aguardando a pessoa abrir o e-mail.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  type="button"
                  disabled={ocupado}
                  onClick={() => onCancelar(convite)}
                  aria-label={`Cancelar convite de ${convite.email}`}
                >
                  <Trash2 aria-hidden="true" />
                  Cancelar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- Aba Reset de senha ---------- */

function AbaSenha({ perfis }: { perfis: Perfil[] }) {
  const buscaId = useId();
  const [busca, setBusca] = useState("");
  const [enviando, setEnviando] = useState<string | null>(null);
  const [resultado, setResultado] = useState<{ email: string; ok: boolean; texto: string } | null>(null);
  const aprovados = useMemo(() => {
    const termo = semAcento(busca.trim());
    return ordenarPerfis(perfis).filter((p) => p.status === "aprovado" && (termo === "" || semAcento(`${p.nome} ${p.email}`).includes(termo)));
  }, [perfis, busca]);

  async function enviar(perfil: Perfil) {
    setEnviando(perfil.email);
    setResultado(null);
    try {
      await enviarLinkNovaSenha(getSupabase(), perfil.email);
      setResultado({ email: perfil.email, ok: true, texto: `Link enviado para ${perfil.email}. A pessoa cria a senha nova pelo e-mail.` });
    } catch (e) {
      setResultado({ email: perfil.email, ok: false, texto: e instanceof Error ? e.message : "Não foi possível enviar o link." });
    } finally {
      setEnviando(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-prose text-sm text-muted-foreground">
        O sistema não vê nem define senhas. O Supabase envia à pessoa um link para ela mesma criar uma senha nova.
      </p>
      <div className="flex flex-col gap-1.5 sm:max-w-sm">
        <label className="text-sm font-medium" htmlFor={buscaId}>Buscar</label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input id={buscaId} type="search" className="pl-9" placeholder="Nome ou e-mail" value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
      </div>
      {resultado && (
        <Alert variant={resultado.ok ? "success" : "destructive"} role={resultado.ok ? "status" : "alert"}>
          {resultado.ok ? <Check aria-hidden="true" /> : <CircleAlert aria-hidden="true" />}
          <AlertDescription className="text-foreground">{resultado.texto}</AlertDescription>
        </Alert>
      )}
      {aprovados.length === 0 ? (
        <Vazio texto="Nenhum usuário aprovado encontrado." />
      ) : (
        <ul className="flex flex-col divide-y overflow-hidden rounded-lg border bg-card">
          {aprovados.map((perfil) => (
            <li key={perfil.userId} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <Pessoa perfil={perfil} voce={false} />
              <Button size="sm" variant="outline" type="button" disabled={enviando !== null} onClick={() => void enviar(perfil)}>
                {enviando === perfil.email ? <Loader2 className="animate-spin" aria-hidden="true" /> : <KeyRound aria-hidden="true" />}
                Enviar link de nova senha
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- Convidar ---------- */

function DialogoConvite({
  aberto,
  perfis,
  onFechar,
  onConvidado,
}: {
  aberto: boolean;
  perfis: Perfil[];
  onFechar: () => void;
  onConvidado: (c: Convite) => void;
}) {
  const emailId = useId();
  const papelId = useId();
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState<PapelPerfil>("usuario");
  const [erro, setErro] = useState("");
  const [busy, setBusy] = useState(false);
  const [feito, setFeito] = useState<Convite | null>(null);

  function fechar() {
    if (busy) return;
    setEmail("");
    setPapel("usuario");
    setErro("");
    setFeito(null);
    onFechar();
  }

  async function convidar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!emailValido(email)) return setErro("Digite um e-mail válido, como nome@exemplo.com.");
    if (perfis.some((p) => normalizarEmail(p.email) === normalizarEmail(email))) {
      return setErro("Já existe um usuário com este e-mail. Altere o acesso dele na aba Usuários.");
    }
    setBusy(true);
    setErro("");
    try {
      const convite = await convidarUsuario(getSupabase(), email, papel);
      setFeito(convite);
      onConvidado(convite);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível enviar o convite.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(open) => !open && fechar()}>
      <DialogContent>
        {feito ? (
          <>
            <DialogHeader>
              <DialogTitle>Convite enviado</DialogTitle>
              <DialogDescription>
                O Supabase enviou um e-mail para <strong className="font-medium text-foreground">{feito.email}</strong>. Ao abrir o link e criar a senha, a pessoa
                entra já aprovada como {PAPEL[feito.papel].toLowerCase()}. Se o e-mail não chegar, peça para conferir a caixa de spam.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button type="button" onClick={fechar}>Concluir</Button>
            </DialogFooter>
          </>
        ) : (
          <form className="grid gap-4" onSubmit={convidar} noValidate>
            <DialogHeader>
              <DialogTitle>Convidar usuário</DialogTitle>
              <DialogDescription>O sistema envia um e-mail de convite. A pessoa cria a própria senha pelo link e entra sem precisar de aprovação.</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor={emailId}>E-mail</label>
              <Input id={emailId} type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor={papelId}>Perfil</label>
              <NativeSelect id={papelId} value={papel} onChange={(e) => setPapel(e.target.value as PapelPerfil)}>
                <option value="usuario">Usuário: consulta os dados</option>
                <option value="admin">Administrador: também importa dados e gerencia acessos</option>
              </NativeSelect>
            </div>
            {erro && (
              <Alert variant="destructive" role="alert">
                <CircleAlert aria-hidden="true" />
                <AlertDescription className="text-foreground">{erro}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button variant="outline" type="button" onClick={fechar} disabled={busy}>Cancelar</Button>
              <Button type="submit" disabled={busy || email.trim() === ""}>
                {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <MailPlus aria-hidden="true" />}
                Enviar convite
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Tela ---------- */

export default function GestaoUsuarios() {
  const { userId, isAdmin } = useAuth();
  const [perfis, setPerfis] = useState<Perfil[] | null>(null);
  const [convites, setConvites] = useState<Convite[]>([]);
  const [aba, setAba] = useState("usuarios");
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [confirmar, setConfirmar] = useState<Confirmacao | null>(null);
  const [convidando, setConvidando] = useState(false);

  const buscar = useCallback(async () => {
    const supabase = getSupabase();
    const [listaPerfis, listaConvites] = await Promise.all([listarPerfis(supabase), listarConvites(supabase)]);
    return { listaPerfis, listaConvites };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured() || !isAdmin) return;
    let active = true;
    buscar()
      .then(({ listaPerfis, listaConvites }) => {
        if (!active) return;
        setPerfis(listaPerfis);
        setConvites(listaConvites);
      })
      .catch((e) => active && setErro(e instanceof Error ? e.message : "Não foi possível carregar os usuários."));
    return () => {
      active = false;
    };
  }, [isAdmin, buscar]);

  async function atualizarLista() {
    setErro("");
    try {
      const { listaPerfis, listaConvites } = await buscar();
      setPerfis(listaPerfis);
      setConvites(listaConvites);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível carregar os usuários.");
    }
  }

  async function alterar(perfil: Perfil, mudanca: Partial<Pick<Perfil, "status" | "papel">>, feito: string) {
    setOcupado(true);
    setErro("");
    setAviso("");
    try {
      const atualizado = await atualizarPerfil(getSupabase(), perfil.userId, mudanca);
      setPerfis((lista) => (lista ?? []).map((p) => (p.userId === atualizado.userId ? atualizado : p)));
      setAviso(`${atualizado.nome || atualizado.email}: ${feito}.`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar a alteração.");
    } finally {
      setOcupado(false);
      setConfirmar(null);
    }
  }

  async function confirmarAcao() {
    if (!confirmar) return;
    if (confirmar.tipo === "bloquear") {
      await alterar(confirmar.perfil, { status: "bloqueado" }, confirmar.perfil.status === "pendente" ? "pedido recusado" : "acesso bloqueado");
    } else if (confirmar.tipo === "papel") {
      await alterar(confirmar.perfil, { papel: confirmar.papel }, `perfil alterado para ${PAPEL[confirmar.papel].toLowerCase()}`);
    } else {
      setOcupado(true);
      try {
        await cancelarConvite(getSupabase(), confirmar.convite.email);
        setConvites((lista) => lista.filter((c) => c.email !== confirmar.convite.email));
        setAviso(`Convite de ${confirmar.convite.email} cancelado.`);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Não foi possível cancelar o convite.");
      } finally {
        setOcupado(false);
        setConfirmar(null);
      }
    }
  }

  const pendentes = perfis?.filter((p) => p.status === "pendente").length ?? 0;

  const cabecalhoSecao = (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold">Gestão de usuários</h2>
        <p className="text-sm text-muted-foreground">Aprove pedidos, defina perfis, convide pessoas e envie links de nova senha.</p>
      </div>
      {isAdmin && isSupabaseConfigured() && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" type="button" onClick={() => void atualizarLista()} disabled={ocupado}>
            <RefreshCw aria-hidden="true" />
            Atualizar
          </Button>
          <Button type="button" onClick={() => setConvidando(true)}>
            <UserPlus aria-hidden="true" />
            Convidar usuário
          </Button>
        </div>
      )}
    </div>
  );

  if (!isSupabaseConfigured()) {
    return (
      <section className="flex flex-col gap-5">
        {cabecalhoSecao}
        <Alert variant="info">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>Disponível só com o Supabase</AlertTitle>
          <AlertDescription>Sem as variáveis do Supabase, o sistema funciona só neste navegador e não tem usuários.</AlertDescription>
        </Alert>
      </section>
    );
  }
  if (!isAdmin) {
    return (
      <section className="flex flex-col gap-5">
        {cabecalhoSecao}
        <Alert variant="warning">
          <ShieldCheck aria-hidden="true" />
          <AlertTitle>Apenas administradores</AlertTitle>
          <AlertDescription>Peça a um administrador para liberar ou alterar acessos.</AlertDescription>
        </Alert>
      </section>
    );
  }

  const textoConfirmacao = (() => {
    if (!confirmar) return { titulo: "", descricao: "", botao: "", destrutiva: false };
    if (confirmar.tipo === "bloquear") {
      const nome = confirmar.perfil.nome || confirmar.perfil.email;
      return confirmar.perfil.status === "pendente"
        ? { titulo: "Recusar pedido?", descricao: `${nome} continua sem acesso aos dados. Você pode desbloquear depois.`, botao: "Recusar", destrutiva: true }
        : { titulo: "Bloquear acesso?", descricao: `${nome} perde o acesso aos dados imediatamente. Você pode desbloquear depois.`, botao: "Bloquear", destrutiva: true };
    }
    if (confirmar.tipo === "papel") {
      const nome = confirmar.perfil.nome || confirmar.perfil.email;
      return confirmar.papel === "admin"
        ? { titulo: "Tornar administrador?", descricao: `${nome} poderá aprovar, bloquear e convidar usuários, inclusive outros administradores.`, botao: "Tornar administrador", destrutiva: false }
        : { titulo: "Mudar para usuário?", descricao: `${nome} continua com acesso aos dados, mas não gerencia mais usuários.`, botao: "Mudar para usuário", destrutiva: false };
    }
    return { titulo: "Cancelar convite?", descricao: `O e-mail ${confirmar.convite.email} deixa de ter acesso pré-aprovado. Se a pessoa abrir o e-mail de convite, o acesso fica pendente de aprovação.`, botao: "Cancelar convite", destrutiva: true };
  })();

  return (
    <section className="flex flex-col gap-5" aria-labelledby="gestao-usuarios">
      {cabecalhoSecao}

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
          <Skeleton className="h-11 w-80" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <Tabs value={aba} onValueChange={setAba}>
          <TabsList aria-label="Gestão de usuários">
            <TabsTrigger value="usuarios">
              Usuários
              {pendentes > 0 && (
                <Badge variant="warning" className="px-1.5 py-0 tabular-nums" aria-label={`${pendentes} pendentes`}>
                  {pendentes}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="convites">
              <span className="sm:hidden">Convites</span>
              <span className="hidden sm:inline">Convites pendentes</span>
              {convites.length > 0 && (
                <Badge variant="secondary" className="px-1.5 py-0 tabular-nums">
                  {convites.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="senha">
              <span className="sm:hidden">Senhas</span>
              <span className="hidden sm:inline">Reset de senha</span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="usuarios">
            <AbaUsuarios
              perfis={perfis ?? []}
              meuId={userId ?? ""}
              ocupado={ocupado}
              onStatus={(perfil, status) => void alterar(perfil, { status }, status === "aprovado" ? (perfil.status === "bloqueado" ? "acesso desbloqueado" : "acesso aprovado") : "atualizado")}
              onPedirConfirmacao={setConfirmar}
            />
          </TabsContent>
          <TabsContent value="convites">
            <AbaConvites convites={convites} ocupado={ocupado} onCancelar={(convite) => setConfirmar({ tipo: "cancelar-convite", convite })} />
          </TabsContent>
          <TabsContent value="senha">
            <AbaSenha perfis={perfis ?? []} />
          </TabsContent>
        </Tabs>
      )}

      <DialogoConvite
        aberto={convidando}
        perfis={perfis ?? []}
        onFechar={() => setConvidando(false)}
        onConvidado={(convite) => {
          setConvites((lista) => [convite, ...lista]);
          setAba("convites");
        }}
      />

      <Dialog open={confirmar !== null} onOpenChange={(open) => { if (!open && !ocupado) setConfirmar(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{textoConfirmacao.titulo}</DialogTitle>
            <DialogDescription>{textoConfirmacao.descricao}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => setConfirmar(null)} disabled={ocupado} autoFocus>Voltar</Button>
            <Button variant={textoConfirmacao.destrutiva ? "destructive" : "default"} type="button" disabled={ocupado} onClick={() => void confirmarAcao()}>
              {ocupado && <Loader2 className="animate-spin" aria-hidden="true" />}
              {textoConfirmacao.botao}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
