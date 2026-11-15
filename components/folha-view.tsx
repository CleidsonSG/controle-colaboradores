"use client";

import { useId, useMemo, useState } from "react";
import { ArrowRight, CircleAlert, FlaskConical, Minus, Plus, RotateCcw, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Progress } from "@/components/ui/progress";
import {
  FOLHA_SIMULADA,
  alterarVagas,
  aplicarTroca,
  custoCargo,
  resumir,
  simularTroca,
  situacaoCargo,
  vagasQueCabem,
  type Cargo,
  type Folha,
} from "@/lib/folha/simulacao";
import { cn } from "@/lib/utils";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const reais = (centavos: number) => moeda.format(centavos / 100);
const pct = (parte: number, todo: number) => (todo > 0 ? Math.round((parte / todo) * 100) : 0);
const plural = (n: number, um: string, varios: string) => `${n.toLocaleString("pt-BR")} ${n === 1 ? um : varios}`;

/** Tons do azul-petróleo: do salário maior (mais escuro) ao menor (mais claro). */
const TONS = ["bg-primary", "bg-primary/85", "bg-primary/70", "bg-primary/55", "bg-primary/40", "bg-primary/25"];

const TOM_BADGE = { success: "success", warning: "warning", neutral: "secondary" } as const;
const TOM_BARRA = { success: "bg-success", warning: "bg-warning", neutral: "bg-primary" } as const;

function BarraFolha({ folha }: { folha: Folha }) {
  const resumo = resumir(folha);
  const base = Math.max(folha.teto, resumo.comprometido);
  const ordenados = [...folha.cargos].sort((a, b) => b.salario - a.salario);
  return (
    <div className="flex flex-col gap-4">
      <div
        className="flex h-10 w-full overflow-hidden rounded-md border bg-muted"
        role="img"
        aria-label={`Distribuição da folha: ${ordenados.map((c) => `${c.nome} ${pct(custoCargo(c), folha.teto)}%`).join(", ")}; saldo ${reais(resumo.saldo)}.`}
      >
        {ordenados.map((cargo, index) => {
          const largura = base > 0 ? (custoCargo(cargo) / base) * 100 : 0;
          if (largura <= 0) return null;
          return (
            <div
              key={cargo.id}
              className={cn("h-full border-r border-card transition-[width] duration-300 last:border-r-0", TONS[index % TONS.length])}
              style={{ width: `${largura}%` }}
            />
          );
        })}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
        {ordenados.map((cargo, index) => (
          <li key={cargo.id} className="flex items-center gap-2">
            <span className={cn("size-3 shrink-0 rounded-sm", TONS[index % TONS.length])} aria-hidden="true" />
            <span>{cargo.id.replace("AS", "AS ")}</span>
            <span className="text-muted-foreground tabular-nums">{pct(custoCargo(cargo), folha.teto)}%</span>
          </li>
        ))}
        <li className="flex items-center gap-2">
          <span className="size-3 shrink-0 rounded-sm border bg-muted" aria-hidden="true" />
          <span>Saldo</span>
          <span className={cn("tabular-nums", resumo.saldo < 0 ? "text-destructive" : "text-muted-foreground")}>
            {pct(resumo.saldo, folha.teto)}%
          </span>
        </li>
      </ul>
    </div>
  );
}

function PainelFolha({ folha, onTeto }: { folha: Folha; onTeto: (centavos: number) => void }) {
  const tetoId = useId();
  const resumo = resumir(folha);
  const [rascunho, setRascunho] = useState(String(folha.teto / 100));
  const [tetoAnterior, setTetoAnterior] = useState(folha.teto);
  if (tetoAnterior !== folha.teto) {
    setTetoAnterior(folha.teto);
    setRascunho(String(folha.teto / 100));
  }

  function confirmar(valor: string) {
    const numero = Number(valor.replace(",", "."));
    if (Number.isFinite(numero) && numero >= 0) onTeto(Math.round(numero * 100));
    else setRascunho(String(folha.teto / 100));
  }

  return (
    <Card className="gap-6">
      <CardContent className="flex flex-col gap-6">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,16rem)_1fr] lg:items-end">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor={tetoId}>Teto mensal da folha (R$)</label>
            <Input
              id={tetoId}
              inputMode="decimal"
              className="h-11 text-lg font-semibold tabular-nums"
              value={rascunho}
              onChange={(event) => setRascunho(event.target.value)}
              onBlur={(event) => confirmar(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") confirmar(event.currentTarget.value);
              }}
            />
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            <div className="flex flex-col gap-0.5">
              <dt className="text-sm text-muted-foreground">Vagas criadas</dt>
              <dd className="text-xl font-semibold tabular-nums">{reais(resumo.comprometido)}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-sm text-muted-foreground">Pago hoje (ocupadas)</dt>
              <dd className="text-xl font-semibold tabular-nums">{reais(resumo.emUso)}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-sm text-muted-foreground">Saldo</dt>
              <dd className={cn("text-xl font-semibold tabular-nums", resumo.saldo < 0 && "text-destructive")}>{reais(resumo.saldo)}</dd>
            </div>
            <div className="flex flex-col gap-0.5">
              <dt className="text-sm text-muted-foreground">Vagas</dt>
              <dd className="text-xl font-semibold tabular-nums">
                {resumo.ocupadas}/{resumo.vagas}
                <span className="ml-1.5 text-sm font-normal text-muted-foreground">{plural(resumo.livres, "livre", "livres")}</span>
              </dd>
            </div>
          </dl>
        </div>
        <BarraFolha folha={folha} />
        {resumo.saldo < 0 && (
          <Alert variant="destructive" role="alert">
            <CircleAlert aria-hidden="true" />
            <AlertTitle>Folha acima do teto em {reais(-resumo.saldo)}</AlertTitle>
            <AlertDescription>Reduza vagas, de preferência dos cargos com salário maior, até o saldo voltar a zero ou mais.</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function SimuladorTroca({ folha, onAplicar }: { folha: Folha; onAplicar: (origem: string, destino: string, reduzir: number) => void }) {
  const ids = { origem: useId(), destino: useId(), qtd: useId() };
  const porSalario = useMemo(() => [...folha.cargos].sort((a, b) => b.salario - a.salario), [folha.cargos]);
  const [origem, setOrigem] = useState(porSalario[0]?.id ?? "");
  const [destino, setDestino] = useState(porSalario[porSalario.length - 1]?.id ?? "");
  const [qtd, setQtd] = useState("1");
  const reduzir = Number(qtd);
  const resultado = simularTroca(folha, { origem, destino, reduzir });
  const cargoOrigem = folha.cargos.find((c) => c.id === origem);
  const cargoDestino = folha.cargos.find((c) => c.id === destino);
  const destinoMaisCaro = cargoOrigem && cargoDestino && cargoDestino.salario > cargoOrigem.salario;

  return (
    <Card>
      <CardHeader>
        <CardTitle role="heading" aria-level={2}>Simular troca de vagas</CardTitle>
        <CardDescription>Reduza vagas de um cargo para abrir vagas em outro sem passar do teto.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid items-end gap-4 sm:grid-cols-[1fr_6rem] lg:grid-cols-[1fr_6rem_auto_1fr]">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor={ids.origem}>Reduzir vagas de</label>
            <NativeSelect id={ids.origem} value={origem} onChange={(event) => setOrigem(event.target.value)}>
              {porSalario.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}, {reais(c.salario)}</option>
              ))}
            </NativeSelect>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor={ids.qtd}>Quantas</label>
            <Input id={ids.qtd} type="number" min={1} max={cargoOrigem?.vagas} step={1} className="tabular-nums" value={qtd} onChange={(event) => setQtd(event.target.value)} />
          </div>
          <ArrowRight className="mb-3 hidden size-5 text-muted-foreground lg:block" aria-hidden="true" />
          <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
            <label className="text-sm font-medium" htmlFor={ids.destino}>Para abrir vagas de</label>
            <NativeSelect id={ids.destino} value={destino} onChange={(event) => setDestino(event.target.value)}>
              {porSalario.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}, {reais(c.salario)}</option>
              ))}
            </NativeSelect>
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-lg bg-muted/60 p-4 sm:flex-row sm:items-center sm:justify-between" aria-live="polite">
          {resultado.ok ? (
            <div className="flex flex-col gap-1.5 text-sm">
              <p className="text-base">
                Abre <strong className="text-2xl font-semibold tabular-nums">{resultado.ganho}</strong>{" "}
                {resultado.ganho === 1 ? "vaga" : "vagas"} de {cargoDestino?.nome}
              </p>
              <p className="text-muted-foreground">
                Libera {reais(resultado.liberado)}. Depois da troca, o saldo da folha fica em {reais(resultado.saldoDepois)}.
              </p>
              {resultado.exoneracoes > 0 && (
                <p className="flex items-center gap-1.5 font-medium text-warning">
                  <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />
                  Exige exonerar {plural(resultado.exoneracoes, "pessoa", "pessoas")} de {cargoOrigem?.nome}.
                </p>
              )}
              {destinoMaisCaro && <p className="text-muted-foreground">O cargo de destino tem salário maior, então a troca rende menos vagas.</p>}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{resultado.motivo}</p>
          )}
          <Button type="button" disabled={!resultado.ok || resultado.ganho === 0} onClick={() => onAplicar(origem, destino, reduzir)}>
            Aplicar troca
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function CartaoCargo({ folha, cargo, onVagas }: { folha: Folha; cargo: Cargo; onVagas: (delta: number) => void }) {
  const situacao = situacaoCargo(cargo);
  const livres = cargo.vagas - cargo.ocupadas;
  const cabem = vagasQueCabem(folha, cargo.id);
  const podeReduzir = cargo.vagas > cargo.ocupadas;
  const tituloId = useId();

  return (
    <Card className="gap-4" role="group" aria-labelledby={tituloId}>
      <CardHeader>
        <CardTitle id={tituloId}>{cargo.nome}</CardTitle>
        <CardDescription className="tabular-nums">{reais(cargo.salario)} por mês</CardDescription>
        <CardAction>
          <Badge variant={TOM_BADGE[situacao.tom]}>{situacao.rotulo}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="flex items-baseline gap-2">
          <span className="text-3xl font-semibold tracking-tight tabular-nums">{cargo.ocupadas}</span>
          <span className="text-sm text-muted-foreground">ocupadas de {cargo.vagas}</span>
        </p>
        <Progress
          value={cargo.vagas > 0 ? (cargo.ocupadas / cargo.vagas) * 100 : 0}
          indicatorClassName={TOM_BARRA[situacao.tom]}
          aria-label={`${cargo.ocupadas} de ${cargo.vagas} vagas ocupadas`}
        />
        <p className="text-sm">{plural(livres, "vaga livre", "vagas livres")}</p>
        <div className="mt-1 flex items-center justify-between gap-3 border-t pt-4">
          <div className="flex flex-col text-sm">
            <span className="text-muted-foreground">Custo das vagas</span>
            <span className="font-medium tabular-nums">
              {reais(custoCargo(cargo))} <span className="font-normal text-muted-foreground">({pct(custoCargo(cargo), folha.teto)}%)</span>
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon"
              type="button"
              aria-label={`Remover uma vaga de ${cargo.nome}`}
              disabled={!podeReduzir}
              onClick={() => onVagas(-1)}
            >
              <Minus aria-hidden="true" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              type="button"
              aria-label={`Criar uma vaga de ${cargo.nome}`}
              disabled={cabem < 1}
              onClick={() => onVagas(1)}
            >
              <Plus aria-hidden="true" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function FolhaView() {
  const [folha, setFolha] = useState<Folha>(FOLHA_SIMULADA);
  const [aviso, setAviso] = useState("");
  const porSalario = [...folha.cargos].sort((a, b) => b.salario - a.salario);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex max-w-2xl flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Orçamento da folha</h1>
          <p className="text-muted-foreground">
            Distribua as vagas dos cargos comissionados dentro do teto da folha. Para abrir vagas de salário menor, reduza vagas de salário maior.
          </p>
        </div>
        <Button
          variant="outline"
          type="button"
          onClick={() => {
            setFolha(FOLHA_SIMULADA);
            setAviso("Valores simulados restaurados.");
          }}
        >
          <RotateCcw aria-hidden="true" />
          Restaurar simulação
        </Button>
      </header>

      <Alert variant="info">
        <FlaskConical aria-hidden="true" />
        <AlertTitle>Valores simulados</AlertTitle>
        <AlertDescription>
          Teto, salários e vagas são fictícios até você informar os reais. As alterações valem só enquanto esta tela estiver aberta.
        </AlertDescription>
      </Alert>

      <PainelFolha
        folha={folha}
        onTeto={(teto) => {
          setFolha((atual) => ({ ...atual, teto }));
          setAviso("");
        }}
      />

      <SimuladorTroca
        folha={folha}
        onAplicar={(origem, destino, reduzir) => {
          const resultado = simularTroca(folha, { origem, destino, reduzir });
          if (!resultado.ok) return;
          const nomeOrigem = folha.cargos.find((c) => c.id === origem)?.nome;
          const nomeDestino = folha.cargos.find((c) => c.id === destino)?.nome;
          setFolha(aplicarTroca(folha, { origem, destino, reduzir }));
          setAviso(
            `Troca aplicada: ${plural(reduzir, "vaga", "vagas")} a menos de ${nomeOrigem} e ${plural(resultado.ganho, "vaga", "vagas")} a mais de ${nomeDestino}.`,
          );
        }}
      />

      <p className="sr-only" role="status" aria-live="polite">{aviso}</p>
      {aviso && <p className="-mt-4 text-sm text-success" aria-hidden="true">{aviso}</p>}

      <section className="flex flex-col gap-4" aria-labelledby="cargos-titulo">
        <div className="flex flex-col gap-1">
          <h2 id="cargos-titulo" className="text-lg font-semibold">Vagas por cargo</h2>
          <p className="max-w-prose text-sm text-muted-foreground">
            Use + e − para ajustar vagas. O + fica desativado quando falta saldo; o − fica desativado quando todas as vagas estão ocupadas, porque reduzir exigiria exoneração. Nesses casos, use a troca de vagas.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {porSalario.map((cargo) => (
            <CartaoCargo
              key={cargo.id}
              folha={folha}
              cargo={cargo}
              onVagas={(delta) => {
                setFolha((atual) => alterarVagas(atual, cargo.id, delta));
                setAviso("");
              }}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
