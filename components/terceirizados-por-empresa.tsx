"use client";

import { useId, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/components/data-table";
import { cn } from "@/lib/utils";
import { empresasSelecionadas, kpisDaSelecao, proporcaoDoMaior, rankingEmpresas, type EmpresaSoma } from "@/lib/folha/empresas";
import { SEM_EMPRESA } from "@/lib/folha/funcionarios";
import type { ColaboradorPlanilha } from "@/lib/import";

const reais = (centavos: number) => formatMoney(centavos / 100);
const formatInt = (value: number) => value.toLocaleString("pt-BR");

function Indicador({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-xl font-semibold tracking-tight tabular-nums">{value}</dd>
    </div>
  );
}

type Props = {
  /** Todas as linhas do cadastro (o componente considera só os terceirizados). */
  rows: ColaboradorPlanilha[];
  /** Empresa atualmente aplicada como filtro da tabela de funcionários. */
  empresaFiltrada: string;
  /** R13: aplica o filtro Empresa/Secretaria da tabela e rola até ela. */
  onAbrirEmpresa: (empresa: string) => void;
};

/** R12: seletor de empresas, KPIs da seleção, ranking de custo e tabela. R13: empresa clicável leva à lista de pessoas. */
export default function TerceirizadosPorEmpresa({ rows, empresaFiltrada, onAbrirEmpresa }: Props) {
  const buscaId = useId();
  const [busca, setBusca] = useState("");
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const ranking = useMemo(() => rankingEmpresas(rows), [rows]);
  const escolhidas = useMemo(() => empresasSelecionadas(ranking, selecionadas), [ranking, selecionadas]);
  const kpis = useMemo(() => kpisDaSelecao(escolhidas), [escolhidas]);
  const nomesEscolhidos = useMemo(() => new Set(escolhidas.map((item) => item.empresa)), [escolhidas]);
  const todas = escolhidas.length === ranking.length;
  const visiveis = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return termo ? ranking.filter((item) => item.empresa.toLocaleLowerCase("pt-BR").includes(termo)) : ranking;
  }, [ranking, busca]);

  if (ranking.length === 0) return null;

  function alternar(empresa: string, marcada: boolean) {
    const base = todas ? [] : selecionadas.filter((nome) => nomesEscolhidos.has(nome));
    setSelecionadas(marcada ? [...base, empresa] : base.filter((nome) => nome !== empresa));
  }

  function abrir(item: EmpresaSoma) {
    if (item.empresa !== SEM_EMPRESA) onAbrirEmpresa(item.empresa);
  }

  const resumoSelecao = todas ? `Todas as ${formatInt(ranking.length)} empresas` : `${formatInt(escolhidas.length)} de ${formatInt(ranking.length)} empresas`;

  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Terceirizados por empresa</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
          <fieldset className="flex min-w-0 flex-col gap-2">
            <legend className="text-sm font-medium">Empresas ({resumoSelecao})</legend>
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <Input id={buscaId} type="search" className="pl-9" placeholder="Buscar empresa" aria-label="Buscar empresa na lista" value={busca} onChange={(event) => setBusca(event.target.value)} />
            </div>
            <ul className="max-h-56 overflow-auto rounded-lg border" aria-label="Empresas terceirizadas">
              {visiveis.map((item) => {
                const id = `${buscaId}-${item.empresa}`;
                return (
                  <li key={item.empresa} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/60">
                    <Checkbox id={id} checked={!todas && nomesEscolhidos.has(item.empresa)} onCheckedChange={(valor) => alternar(item.empresa, valor === true)} />
                    <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer text-sm break-words">
                      {item.empresa}
                    </label>
                    <span className="text-sm text-muted-foreground tabular-nums">{formatInt(item.quantidade)}</span>
                  </li>
                );
              })}
              {visiveis.length === 0 && <li className="px-3 py-4 text-sm text-muted-foreground">Nenhuma empresa encontrada.</li>}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" disabled={todas} onClick={() => setSelecionadas([])}>
                Selecionar todas
              </Button>
              <span className="self-center text-sm text-muted-foreground">Sem marcação, todas entram.</span>
            </div>
          </fieldset>

          <div className="flex min-w-0 flex-col gap-4">
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3 xl:grid-cols-5 [&>*]:bg-card" aria-label={`Indicadores da seleção: ${resumoSelecao}`}>
              <Indicador label="Pessoas" value={formatInt(kpis.quantidade)} />
              <Indicador label="Remuneração" value={reais(kpis.remuneracao)} />
              <Indicador label="Alimentação" value={reais(kpis.alimentacao)} />
              <Indicador label="Custo mensal" value={reais(kpis.custo)} />
              <Indicador label="Custo médio por pessoa" value={reais(kpis.custoMedio)} />
            </dl>

            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-medium">Custo mensal por empresa</h3>
              <ul className="max-h-72 overflow-auto rounded-lg border p-2" aria-label="Ranking de custo mensal por empresa">
                {ranking.map((item) => {
                  const destaque = nomesEscolhidos.has(item.empresa);
                  const ligavel = item.empresa !== SEM_EMPRESA;
                  const conteudo = (
                    <>
                      <span className="flex items-baseline justify-between gap-3 text-sm">
                        <span className={cn("min-w-0 break-words", destaque ? "font-medium" : "text-muted-foreground")}>{item.empresa}</span>
                        <span className="shrink-0 tabular-nums">{reais(item.custo)}</span>
                      </span>
                      <span aria-hidden="true" className="block">
                        <Progress value={proporcaoDoMaior(item.custo, ranking) * 100} className="h-1.5" indicatorClassName={destaque ? "bg-primary" : "bg-muted-foreground/40"} />
                      </span>
                    </>
                  );
                  return (
                    <li key={item.empresa}>
                      {ligavel ? (
                        <button
                          type="button"
                          className={cn("flex w-full flex-col gap-1.5 rounded-md px-2 py-1.5 text-left hover:bg-muted/60", empresaFiltrada === item.empresa && "bg-muted")}
                          aria-label={`${item.empresa}: custo mensal ${reais(item.custo)}, ${formatInt(item.quantidade)} pessoas. Filtrar a tabela de funcionários por esta empresa`}
                          onClick={() => abrir(item)}
                        >
                          {conteudo}
                        </button>
                      ) : (
                        <div className="flex w-full flex-col gap-1.5 px-2 py-1.5">{conteudo}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
              <p className="text-sm text-muted-foreground">Barras escuras: empresas da seleção. Os mesmos valores estão na tabela abaixo.</p>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <caption className="sr-only">Terceirizados por empresa: quantidade, remuneração, alimentação e custo mensal das empresas selecionadas</caption>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col">Empresa</TableHead>
                <TableHead scope="col" className="text-right">Quantidade</TableHead>
                <TableHead scope="col" className="text-right">Remuneração</TableHead>
                <TableHead scope="col" className="text-right">Alimentação</TableHead>
                <TableHead scope="col" className="text-right">Custo mensal</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...escolhidas]
                .sort((a, b) => a.empresa.localeCompare(b.empresa, "pt-BR", { sensitivity: "base" }))
                .map((item) => (
                  <TableRow key={item.empresa} className={cn(empresaFiltrada === item.empresa && "bg-muted/60")}>
                    <TableCell className="whitespace-normal">
                      {item.empresa === SEM_EMPRESA ? (
                        item.empresa
                      ) : (
                        <button
                          type="button"
                          className="rounded-sm text-left font-medium text-primary underline-offset-4 hover:underline"
                          aria-label={`${item.empresa}: ver as pessoas na tabela de funcionários`}
                          onClick={() => abrir(item)}
                        >
                          {item.empresa}
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatInt(item.quantidade)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap tabular-nums">{reais(item.remuneracao)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap tabular-nums">{reais(item.alimentacao)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap tabular-nums">{reais(item.custo)}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-sm text-muted-foreground">Custo mensal = remuneração + alimentação. Clique numa empresa para filtrar a tabela de funcionários.</p>
      </CardContent>
    </Card>
  );
}
