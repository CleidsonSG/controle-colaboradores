"use client";

import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { movimentacaoMensal, ocupacaoPorLotacao } from "@/lib/folha/indicadores";
import type { CargoSalario, ServidorECidade } from "@/lib/import";
import { cn } from "@/lib/utils";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const reais = (centavos: number) => moeda.format(centavos / 100);
const inteiro = (n: number) => n.toLocaleString("pt-BR");
const plural = (n: number, um: string, varios: string) => `${inteiro(n)} ${n === 1 ? um : varios}`;
const sinal = (n: number) => (n > 0 ? `+${inteiro(n)}` : inteiro(n));

/** Lotações visíveis de cada vez no ranking; as demais aparecem pela barra de rolagem. */
const VISIVEIS_LOTACAO = 5;
const MESES_VISIVEIS = 12;

/** AAAA-MM-DD ou AAAA-MM → MM/AAAA. */
function mesAno(iso: string): string {
  const [ano, mes] = iso.split("-");
  return `${mes}/${ano}`;
}

/* ---------- Ocupação e custo por lotação ---------- */

function OcupacaoLotacao({ servidores, tabela }: { servidores: ServidorECidade[]; tabela: CargoSalario[] | null }) {
  const listaId = useId();
  const listaRef = useRef<HTMLOListElement>(null);
  const [alturaVisivel, setAlturaVisivel] = useState<number | null>(null);
  const ocupacao = useMemo(() => ocupacaoPorLotacao(servidores, tabela), [servidores, tabela]);
  const porCusto = ocupacao.custo > 0;
  const lista = ocupacao.lotacoes;
  const rolagem = lista.length > VISIVEIS_LOTACAO;

  // Altura da lista = exatamente as 5 primeiras lotações (nomes longos quebram linha); o resto aparece rolando.
  useLayoutEffect(() => {
    const ol = listaRef.current;
    if (!ol || !rolagem) {
      setAlturaVisivel(null);
      return;
    }
    const medir = () => {
      const itens = ol.children;
      const ultimo = itens[VISIVEIS_LOTACAO - 1] as HTMLElement | undefined;
      if (ultimo) setAlturaVisivel(ultimo.offsetTop + ultimo.offsetHeight + 4);
    };
    medir();
    const observador = new ResizeObserver(medir);
    observador.observe(ol);
    return () => observador.disconnect();
  }, [rolagem, lista]);
  const maximo = Math.max(1, ...ocupacao.lotacoes.map((l) => (porCusto ? l.custo : l.servidores)));

  return (
    <Card className="min-w-0 gap-5">
      <CardHeader>
        <CardTitle>Ocupação e custo por lotação</CardTitle>
        <CardDescription>
          {porCusto ? "Ranking por custo mensal dos comissionados ativos" : "Ranking por comissionados ativos (importe a tabela salarial para ver o custo)"}
          {" · "}
          {plural(ocupacao.lotacoes.length, "lotação", "lotações")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {ocupacao.lotacoes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum comissionado ativo para agrupar por lotação.</p>
        ) : (
          <ol
            id={listaId}
            ref={listaRef}
            className={cn("relative flex flex-col gap-3.5", rolagem && "overflow-y-auto overscroll-contain pr-3 [scrollbar-gutter:stable]")}
            style={rolagem && alturaVisivel ? { maxHeight: alturaVisivel } : undefined}
            aria-label={`Lotações por ${porCusto ? "custo" : "ocupação"}${rolagem ? `: ${VISIVEIS_LOTACAO} por vez, role para ver as demais` : ""}`}
            tabIndex={rolagem ? 0 : undefined}
          >
            {lista.map((lotacao, indice) => {
              const parte = ((porCusto ? lotacao.custo : lotacao.servidores) / maximo) * 100;
              return (
                <li key={lotacao.lotacao} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 break-words">
                      <span className="mr-2 text-muted-foreground tabular-nums">{indice + 1}.</span>
                      {lotacao.lotacao}
                    </span>
                    <span className="shrink-0 text-right font-medium tabular-nums">{porCusto ? reais(lotacao.custo) : plural(lotacao.servidores, "servidor", "servidores")}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(parte, 1)}%` }} />
                  </div>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {porCusto && <>{plural(lotacao.servidores, "servidor", "servidores")}</>}
                    {lotacao.semSalario > 0 && <>{porCusto ? " · " : ""}{plural(lotacao.semSalario, "sem salário na tabela", "sem salário na tabela")}</>}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
        {rolagem && (
          <p className="text-xs text-muted-foreground">
            Mostrando {VISIVEIS_LOTACAO} por vez · role a lista para ver as {inteiro(ocupacao.lotacoes.length)} lotações
          </p>
        )}
        {ocupacao.lotacoes.length > 0 && (
          <p className="border-t pt-3 text-sm text-muted-foreground tabular-nums">
            Total: {plural(ocupacao.servidores, "servidor", "servidores")}
            {porCusto && <> · {reais(ocupacao.custo)}</>}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- Movimentação mensal ---------- */

function MovimentacaoMensal({ servidores }: { servidores: ServidorECidade[] }) {
  const [todos, setTodos] = useState(false);
  const [tabela, setTabela] = useState(false);
  const tabelaId = useId();
  const mov = useMemo(() => movimentacaoMensal(servidores, { somenteComissionados: true }), [servidores]);
  const meses = todos ? mov.meses : mov.meses.slice(-MESES_VISIVEIS);
  const maximo = Math.max(1, ...meses.flatMap((m) => [m.admissoes, m.rescisoes]));
  const SaldoIcone = mov.saldo > 0 ? ArrowUpRight : mov.saldo < 0 ? ArrowDownRight : Minus;

  return (
    <Card className="min-w-0 gap-5">
      <CardHeader>
        <CardTitle>Movimentação mensal</CardTitle>
        <CardDescription>
          {mov.periodo
            ? `Comissionados admitidos de ${mesAno(mov.periodo.inicio)} a ${mesAno(mov.periodo.fim)}`
            : "Comissionados: admissões e rescisões por mês"}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {!mov.periodo ? (
          <p className="text-sm text-muted-foreground">O arquivo importado não traz datas de admissão ou rescisão.</p>
        ) : (
          <>
            <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border bg-border [&>*]:bg-card">
              <div className="flex flex-col gap-1 p-3 sm:p-4">
                <dt className="text-sm text-muted-foreground">Admissões</dt>
                <dd className="text-xl font-semibold tabular-nums">{inteiro(mov.totalAdmissoes)}</dd>
              </div>
              <div className="flex flex-col gap-1 p-3 sm:p-4">
                <dt className="text-sm text-muted-foreground">Rescisões</dt>
                <dd className="text-xl font-semibold tabular-nums">{inteiro(mov.totalRescisoes)}</dd>
              </div>
              <div className="flex flex-col gap-1 p-3 sm:p-4">
                <dt className="text-sm text-muted-foreground">Saldo</dt>
                <dd className={cn("flex items-center gap-1 text-xl font-semibold tabular-nums", mov.saldo > 0 && "text-success", mov.saldo < 0 && "text-destructive")}>
                  <SaldoIcone className="size-5" aria-hidden="true" />
                  {sinal(mov.saldo)}
                </dd>
              </div>
            </dl>

            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-sm">
              <ul className="flex items-center gap-4 text-muted-foreground" aria-label="Legenda">
                <li className="flex items-center gap-1.5">
                  <span className="size-3 rounded-sm bg-primary" aria-hidden="true" />
                  Admissões
                </li>
                <li className="flex items-center gap-1.5">
                  <span className="size-3 rounded-sm bg-warning" aria-hidden="true" />
                  Rescisões
                </li>
              </ul>
              <Button variant="ghost" size="sm" type="button" aria-pressed={tabela} aria-controls={tabelaId} onClick={() => setTabela((v) => !v)}>
                {tabela ? "Ver gráfico" : "Ver como tabela"}
              </Button>
            </div>

            <div id={tabelaId}>
              {tabela ? (
                <div className="max-h-80 overflow-auto rounded-lg border" tabIndex={0} role="region" aria-label="Movimentação mensal em tabela">
                  <Table>
                    <caption className="sr-only">Admissões, rescisões e saldo por mês</caption>
                    <TableHeader className="sticky top-0 bg-muted/95">
                      <TableRow className="hover:bg-transparent">
                        <TableHead scope="col">Mês</TableHead>
                        <TableHead scope="col" className="text-right">Admissões</TableHead>
                        <TableHead scope="col" className="text-right">Rescisões</TableHead>
                        <TableHead scope="col" className="text-right">Saldo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...meses].reverse().map((m) => (
                        <TableRow key={m.mes}>
                          <TableCell className="tabular-nums">{mesAno(m.mes)}</TableCell>
                          <TableCell className="text-right tabular-nums">{inteiro(m.admissoes)}</TableCell>
                          <TableCell className="text-right tabular-nums">{inteiro(m.rescisoes)}</TableCell>
                          <TableCell className="text-right tabular-nums">{sinal(m.saldo)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="overflow-x-auto pb-1" tabIndex={0} role="region" aria-label="Gráfico de admissões e rescisões por mês. A tabela equivalente está disponível no botão Ver como tabela.">
                  <ul className="flex min-w-max items-end gap-3 border-b pt-5">
                    {meses.map((m) => (
                      <li key={m.mes} className="flex w-14 flex-col items-center gap-1.5" aria-label={`${mesAno(m.mes)}: ${m.admissoes} admissões e ${m.rescisoes} rescisões`}>
                        <div className="flex h-40 items-end gap-1" aria-hidden="true">
                          {([["admissoes", "bg-primary"], ["rescisoes", "bg-warning"]] as const).map(([campo, cor]) => (
                            <div key={campo} className="flex h-full w-6 flex-col items-center justify-end gap-0.5">
                              <span className="text-xs leading-none text-muted-foreground tabular-nums">{m[campo] > 0 ? m[campo] : ""}</span>
                              <div className={cn("w-full rounded-t-sm", cor)} style={{ height: m[campo] > 0 ? `${Math.max((m[campo] / maximo) * 85, 3)}%` : "0%" }} />
                            </div>
                          ))}
                        </div>
                        <span className="pb-1.5 text-xs text-muted-foreground tabular-nums" aria-hidden="true">{`${m.mes.slice(5)}/${m.mes.slice(2, 4)}`}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {mov.meses.length > MESES_VISIVEIS && (
              <Button className="self-start" variant="outline" size="sm" type="button" onClick={() => setTodos((v) => !v)}>
                {todos ? `Mostrar só os últimos ${MESES_VISIVEIS} meses` : `Ver todos os ${inteiro(mov.meses.length)} meses`}
              </Button>
            )}
            <p className="text-xs text-muted-foreground">
              Totais de todo o período
              {!todos && mov.meses.length > MESES_VISIVEIS ? `; o gráfico mostra os últimos ${MESES_VISIVEIS} meses` : ""}. Saldo = admissões − rescisões.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function PainelIndicadores({ servidores, tabela }: { servidores: ServidorECidade[]; tabela: CargoSalario[] | null }) {
  return (
    <section className="flex flex-col gap-4" aria-labelledby="indicadores-titulo">
      <h2 id="indicadores-titulo" className="text-lg font-semibold">Indicadores de pessoal</h2>
      <div className="grid gap-4 xl:grid-cols-2">
        <OcupacaoLotacao servidores={servidores} tabela={tabela} />
        <MovimentacaoMensal servidores={servidores} />
      </div>
    </section>
  );
}
