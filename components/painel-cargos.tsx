"use client";

import Link from "next/link";
import { useId, useMemo, useState, type FormEvent } from "react";
import { BadgeDollarSign, CircleAlert, Info, Loader2, Search, TriangleAlert, Upload } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/components/auth-gate";
import PainelIndicadores from "@/components/painel-indicadores";
import { useDadosImportados } from "@/components/use-dados-importados";
import { apurar, type Apuracao, type CargoApurado } from "@/lib/folha/apuracao";
import { parseMoney } from "@/lib/import/text";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const reais = (centavos: number) => moeda.format(centavos / 100);
const inteiro = (n: number) => n.toLocaleString("pt-BR");
const plural = (n: number, um: string, varios: string) => `${inteiro(n)} ${n === 1 ? um : varios}`;
const PAGINA = 24;

type Ordem = "servidores" | "nome" | "salario" | "custo" | "livres";
type Filtro = "todos" | "ocupados" | "sem-salario" | "sem-servidores";

const ORDENS: { value: Ordem; label: string }[] = [
  { value: "servidores", label: "Mais servidores" },
  { value: "custo", label: "Maior custo" },
  { value: "salario", label: "Maior salário" },
  { value: "livres", label: "Mais vagas livres" },
  { value: "nome", label: "Nome (A–Z)" },
];
const FILTROS: { value: Filtro; label: string }[] = [
  { value: "todos", label: "Todas as funções" },
  { value: "ocupados", label: "Com servidores" },
  { value: "sem-salario", label: "Fora da tabela salarial" },
  { value: "sem-servidores", label: "Na tabela, sem servidores" },
];

function ordenar(cargos: CargoApurado[], ordem: Ordem): CargoApurado[] {
  const nulo = (v: number | null) => v ?? -1;
  const lista = [...cargos];
  const porNome = (a: CargoApurado, b: CargoApurado) => a.nome.localeCompare(b.nome, "pt-BR", { numeric: true, sensitivity: "base" });
  if (ordem === "nome") return lista.sort(porNome);
  const chave: Record<Exclude<Ordem, "nome">, (c: CargoApurado) => number> = {
    servidores: (c) => c.servidores,
    custo: (c) => nulo(c.custo),
    salario: (c) => nulo(c.salario),
    livres: (c) => nulo(c.livres),
  };
  return lista.sort((a, b) => chave[ordem](b) - chave[ordem](a) || porNome(a, b));
}

function filtrar(cargos: CargoApurado[], filtro: Filtro, busca: string): CargoApurado[] {
  const termo = busca.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  return cargos.filter((c) => {
    if (filtro === "ocupados" && c.servidores === 0) return false;
    if (filtro === "sem-salario" && !(c.salario === null && c.servidores > 0)) return false;
    if (filtro === "sem-servidores" && !(c.naTabela && c.servidores === 0)) return false;
    return termo === "" || c.chave.includes(termo);
  });
}

/* ---------- Teto da folha ---------- */

function TetoFolha({ teto, onSalvar }: { teto: number | null; onSalvar: (centavos: number | null) => Promise<void> }) {
  const id = useId();
  const { isAdmin } = useAuth();
  // Com Supabase, só administradores alteram o teto (o banco também bloqueia). Sem Supabase, tudo liberado.
  const somenteLeitura = isSupabaseConfigured() && !isAdmin;
  const [valor, setValor] = useState(teto === null ? "" : (teto / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2 }));
  const [estado, setEstado] = useState<{ tipo: "ok" | "erro" | "salvando"; texto: string } | null>(null);

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (somenteLeitura) return;
    const texto = valor.trim();
    const lido = texto === "" ? { value: null, invalid: false } : parseMoney(texto);
    if (lido.invalid || (lido.value !== null && lido.value < 0)) {
      setEstado({ tipo: "erro", texto: "Digite um valor em reais, como 100.000,00." });
      return;
    }
    setEstado({ tipo: "salvando", texto: "Salvando…" });
    try {
      await onSalvar(lido.value === null ? null : Math.round(lido.value * 100));
      setEstado({ tipo: "ok", texto: lido.value === null ? "Teto removido." : "Teto salvo." });
    } catch {
      setEstado({ tipo: "erro", texto: "Não foi possível salvar o teto. Tente novamente." });
    }
  }

  return (
    <form className="flex flex-col gap-1.5" onSubmit={salvar}>
      <label className="text-sm font-medium" htmlFor={id}>Teto mensal da folha</label>
      <div className="flex gap-2">
        <div className="relative w-full sm:w-56">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground" aria-hidden="true">R$</span>
          <Input
            id={id}
            inputMode="decimal"
            className="pl-9 font-semibold tabular-nums"
            placeholder="100.000,00"
            value={valor}
            readOnly={somenteLeitura}
            aria-describedby={`${id}-estado`}
            onChange={(event) => {
              setValor(event.target.value);
              setEstado(null);
            }}
          />
        </div>
        <Button type="submit" variant="outline" disabled={somenteLeitura || estado?.tipo === "salvando"}>
          {estado?.tipo === "salvando" && <Loader2 className="animate-spin" aria-hidden="true" />}
          Salvar
        </Button>
      </div>
      <p id={`${id}-estado`} className={cn("min-h-5 text-sm", estado?.tipo === "erro" ? "text-destructive" : "text-muted-foreground")} role="status">
        {somenteLeitura ? "Somente administradores podem importar ou alterar dados." : (estado?.texto ?? (teto === null ? "Informe o valor liberado para a folha." : ""))}
      </p>
    </form>
  );
}

/* ---------- Indicadores ---------- */

function Indicador({ rotulo, valor, nota, destaque, largo }: { rotulo: string; valor: string; nota?: string; destaque?: "negativo" | "positivo"; largo?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-1 p-4 sm:px-6 sm:py-5", largo && "max-sm:col-span-2")}>
      <dt className="text-sm text-muted-foreground">{rotulo}</dt>
      <dd className="flex flex-col gap-1">
        <span className={cn("text-2xl font-semibold tracking-tight tabular-nums", destaque === "negativo" && "text-destructive")}>{valor}</span>
        {nota && <span className="text-sm text-muted-foreground">{nota}</span>}
      </dd>
    </div>
  );
}

function Indicadores({ apuracao, temTabela }: { apuracao: Apuracao; temTabela: boolean }) {
  const comServidores = apuracao.cargos.filter((c) => c.servidores > 0).length;
  const naTabela = apuracao.cargos.filter((c) => c.naTabela).length;
  const usoTeto = apuracao.teto ? Math.round((apuracao.custoTotal / apuracao.teto) * 100) : null;
  return (
    <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border lg:grid-cols-4 [&>*]:bg-card" aria-label="Indicadores da folha">
      <Indicador
        rotulo="Comissionados ativos"
        valor={inteiro(apuracao.servidoresAtivos)}
        nota={apuracao.desligados > 0 ? `${plural(apuracao.desligados, "com rescisão não contado", "com rescisão não contados")}` : "Vagas ocupadas"}
      />
      <Indicador rotulo="Funções ocupadas" valor={inteiro(comServidores)} nota={temTabela ? `${plural(naTabela, "função", "funções")} na tabela salarial` : "Tabela salarial não importada"} />
      <Indicador
        largo
        rotulo="Custo da folha"
        valor={temTabela ? reais(apuracao.custoTotal) : "—"}
        nota={temTabela ? (usoTeto !== null ? `${usoTeto}% do teto` : "Salário × servidores") : "Importe a tabela salarial"}
      />
      <Indicador
        largo
        rotulo="Saldo do teto"
        valor={apuracao.saldo === null || !temTabela ? "—" : reais(apuracao.saldo)}
        nota={apuracao.teto === null ? "Informe o teto da folha" : `De ${reais(apuracao.teto)}`}
        destaque={apuracao.saldo !== null && apuracao.saldo < 0 ? "negativo" : undefined}
      />
    </dl>
  );
}

/* ---------- Cartão de cargo ---------- */

function CartaoCargo({ cargo, teto }: { cargo: CargoApurado; teto: number | null }) {
  const titulo = useId();
  const parteTeto = teto && cargo.custo !== null ? Math.min(100, (cargo.custo / teto) * 100) : null;
  const motivoSemLivres = cargo.salario === null ? "Sem salário na tabela" : teto === null ? "Informe o teto da folha" : null;

  return (
    <Card className="gap-4" role="group" aria-labelledby={titulo}>
      <CardHeader className="gap-2">
        <CardTitle id={titulo} className="line-clamp-2 leading-snug" title={cargo.nome}>{cargo.nome}</CardTitle>
        {(!cargo.naTabela || cargo.servidores === 0) && (
          <CardAction>
            {!cargo.naTabela ? (
              <Badge variant="warning">
                <TriangleAlert aria-hidden="true" />
                Fora da tabela
              </Badge>
            ) : (
              <Badge variant="secondary">Sem servidores</Badge>
            )}
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="flex flex-col gap-0.5">
          <p className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold tracking-tight tabular-nums">{inteiro(cargo.servidores)}</span>
            <span className="text-sm text-muted-foreground">{cargo.servidores === 1 ? "servidor comissionado (vaga ocupada)" : "servidores comissionados (vagas ocupadas)"}</span>
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">Salário</dt>
            <dd className="font-medium tabular-nums">{cargo.salario === null ? "—" : reais(cargo.salario)}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-muted-foreground">Custo mensal</dt>
            <dd className="font-medium tabular-nums">{cargo.custo === null ? "—" : reais(cargo.custo)}</dd>
          </div>
        </dl>
        {parteTeto !== null && (
          <div className="flex flex-col gap-1.5">
            <Progress value={parteTeto} aria-label={`${Math.round(parteTeto)}% do teto da folha`} />
            <span className="text-xs text-muted-foreground tabular-nums">{parteTeto < 1 && parteTeto > 0 ? "menos de 1" : Math.round(parteTeto)}% do teto</span>
          </div>
        )}

        <div className="mt-auto flex items-baseline justify-between gap-3 border-t pt-4">
          <span className="text-sm text-muted-foreground">Vagas livres</span>
          {cargo.livres === null ? (
            <span className="text-sm text-muted-foreground">{motivoSemLivres}</span>
          ) : (
            <span className={cn("text-xl font-semibold tabular-nums", cargo.livres > 0 ? "text-success" : "text-muted-foreground")}>
              {cargo.livres > 0 ? `até ${inteiro(cargo.livres)}` : "0"}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- Tela ---------- */

function Carregando() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Carregando o painel">
      <Skeleton className="h-28 w-full" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-64" />
        ))}
      </div>
    </div>
  );
}

export default function PainelCargos() {
  const { dados, salvarTeto } = useDadosImportados();
  const buscaId = useId();
  const ordemId = useId();
  const filtroId = useId();
  const [busca, setBusca] = useState("");
  const [ordem, setOrdem] = useState<Ordem>("servidores");
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const [limite, setLimite] = useState(PAGINA);

  const pronto = dados.status === "ready" ? dados : null;
  const apuracao = useMemo(
    () => (pronto?.ecidade ? apurar(pronto.ecidade.records, pronto.salarial?.records ?? null, pronto.settings.tetoFolha) : null),
    [pronto],
  );
  const visiveis = useMemo(() => (apuracao ? ordenar(filtrar(apuracao.cargos, filtro, busca), ordem) : []), [apuracao, filtro, busca, ordem]);

  const cabecalho = (
    <header className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex max-w-2xl flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Painel de cargos</h1>
        <p className="text-muted-foreground">Servidores comissionados por função, custo da folha e vagas livres, apurados a partir do relatório do e-Cidade (Descrição do cargo = função; Nome = servidor) e da tabela salarial.</p>
      </div>
      {pronto && <TetoFolha key={pronto.settings.tetoFolha ?? "vazio"} teto={pronto.settings.tetoFolha} onSalvar={salvarTeto} />}
    </header>
  );

  if (dados.status === "loading") {
    return (
      <div className="flex flex-col gap-8">
        {cabecalho}
        <Carregando />
      </div>
    );
  }
  if (dados.status === "error") {
    return (
      <div className="flex flex-col gap-8">
        {cabecalho}
        <Alert variant="destructive" role="alert">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>Não foi possível ler os dados importados</AlertTitle>
          <AlertDescription>Recarregue a página. Se continuar, importe os arquivos novamente.</AlertDescription>
        </Alert>
      </div>
    );
  }
  if (!apuracao) {
    return (
      <div className="flex flex-col gap-8">
        {cabecalho}
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed bg-card px-6 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-secondary text-secondary-foreground">
            <Upload className="size-5" aria-hidden="true" />
          </span>
          <div className="flex max-w-md flex-col gap-1">
            <p className="font-medium">Importe o relatório do e-Cidade para montar o painel</p>
            <p className="text-sm text-muted-foreground">Só os servidores comissionados (marca 282/16) são contados, pela coluna Descrição do cargo (função). Importe também a tabela salarial para calcular custos e vagas livres.</p>
          </div>
          <Button asChild>
            <Link href="/import">Importar arquivos</Link>
          </Button>
        </div>
      </div>
    );
  }

  const temTabela = Boolean(dados.salarial);
  const relatorioAviso = dados.ecidade?.warnings.find((aviso) => aviso.code === "relatorio")?.message ?? null;
  const visiveisAgora = visiveis.slice(0, limite);

  return (
    <div className="flex flex-col gap-8">
      {cabecalho}
      <Indicadores apuracao={apuracao} temTabela={temTabela} />

      <div className="flex flex-col gap-3 empty:hidden">
        {!temTabela && (
          <Alert variant="info">
            <BadgeDollarSign aria-hidden="true" />
            <AlertTitle>Falta a tabela salarial</AlertTitle>
            <AlertDescription>
              <p>Sem ela, o painel só conta servidores. Importe a tabela salarial (colunas Função e Remuneração) para calcular custos e vagas livres.</p>
              <div className="pt-1">
                <Button asChild size="sm" variant="outline">
                  <Link href="/import">Importar tabela salarial</Link>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
        {relatorioAviso && (
          <Alert variant="warning">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>Confira o relatório do e-Cidade importado</AlertTitle>
            <AlertDescription>{relatorioAviso}</AlertDescription>
          </Alert>
        )}
        {apuracao.foraDaContagem > 0 && (
          <Alert variant="info">
            <Info aria-hidden="true" />
            <AlertTitle>{plural(apuracao.foraDaContagem, "servidor ativo fora da contagem", "servidores ativos fora da contagem")}</AlertTitle>
            <AlertDescription>O Painel conta só os comissionados (marca 282/16). Estagiários, contratos e outros vínculos do arquivo não entram nos números.</AlertDescription>
          </Alert>
        )}
        {apuracao.saldo !== null && apuracao.saldo < 0 && temTabela && (
          <Alert variant="destructive" role="alert">
            <CircleAlert aria-hidden="true" />
            <AlertTitle>Folha acima do teto em {reais(-apuracao.saldo)}</AlertTitle>
            <AlertDescription>Não há vagas livres. Para abrir vagas, reduza cargos de salário maior na tela Orçamento.</AlertDescription>
          </Alert>
        )}
        {temTabela && apuracao.cargosSemSalario > 0 && (
          <Alert variant="warning">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>
              {plural(apuracao.cargosSemSalario, "função não está", "funções não estão")} na tabela salarial ({plural(apuracao.servidoresSemSalario, "servidor", "servidores")})
            </AlertTitle>
            <AlertDescription>
              <p>Essas funções ficam fora do custo da folha. Confira se o nome da função está escrito igual nos dois arquivos.</p>
              <div className="pt-1">
                <Button size="sm" variant="outline" type="button" onClick={() => { setFiltro("sem-salario"); setLimite(PAGINA); }}>
                  Ver essas funções
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </div>

      {dados.ecidade && <PainelIndicadores servidores={dados.ecidade.records} tabela={dados.salarial?.records ?? null} />}

      <section className="flex flex-col gap-4" aria-labelledby="cargos-titulo">
        <div className="flex flex-col gap-1">
          <h2 id="cargos-titulo" className="text-lg font-semibold">Funções</h2>
          {temTabela && apuracao.teto !== null && (
            <p className="flex max-w-prose items-start gap-1.5 text-sm text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              As vagas livres de todos os cargos saem do mesmo saldo: abrir vagas em um cargo diminui as dos outros.
            </p>
          )}
        </div>

        <div className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-[1fr_auto_auto]">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor={buscaId}>Buscar função</label>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input
                id={buscaId}
                type="search"
                className="pl-9"
                placeholder="Ex.: assessor"
                value={busca}
                onChange={(event) => {
                  setBusca(event.target.value);
                  setLimite(PAGINA);
                }}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5 sm:w-52">
            <label className="text-sm font-medium" htmlFor={filtroId}>Mostrar</label>
            <NativeSelect id={filtroId} value={filtro} onChange={(event) => { setFiltro(event.target.value as Filtro); setLimite(PAGINA); }}>
              {FILTROS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5 sm:w-48">
            <label className="text-sm font-medium" htmlFor={ordemId}>Ordenar por</label>
            <NativeSelect id={ordemId} value={ordem} onChange={(event) => setOrdem(event.target.value as Ordem)}>
              {ORDENS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </NativeSelect>
          </div>
        </div>

        <p className="text-sm text-muted-foreground" role="status" aria-live="polite">
          {plural(visiveis.length, "função", "funções")}
          {visiveis.length !== apuracao.cargos.length && ` de ${inteiro(apuracao.cargos.length)}`}
        </p>

        {visiveis.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">
            Nenhuma função encontrada com esses filtros.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {visiveisAgora.map((cargo) => (
              <CartaoCargo key={cargo.chave} cargo={cargo} teto={apuracao.teto} />
            ))}
          </div>
        )}

        {visiveis.length > limite && (
          <div className="flex justify-center pt-2">
            <Button variant="outline" type="button" onClick={() => setLimite((l) => l + PAGINA)}>
              Mostrar mais {Math.min(PAGINA, visiveis.length - limite)} de {inteiro(visiveis.length - limite)} restantes
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
