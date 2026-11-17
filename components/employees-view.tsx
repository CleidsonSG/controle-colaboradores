"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { CircleAlert, FileSpreadsheet, TriangleAlert, Upload } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import DataTable, { formatMoney, type Column } from "@/components/data-table";
import { getDataStore, storageMode } from "@/lib/storage";
import { conferirTerceirizados, custoMensal, subtotais, type Soma } from "@/lib/folha/funcionarios";
import type { CargoSalario, ColaboradorPlanilha, StoredDataset } from "@/lib/import";

export const PLANILHA_COLUMNS: Column<ColaboradorPlanilha>[] = [
  {
    key: "matricula",
    header: "Matrícula",
    value: (row) => row.matricula,
    render: (row) => (
      <span className="flex flex-wrap items-center gap-2 tabular-nums">
        {row.matricula || <span className="text-muted-foreground">—</span>}
        {row.possivelDuplicidade && (
          <Badge variant="warning">
            <TriangleAlert aria-hidden="true" />
            Possível duplicidade
          </Badge>
        )}
      </span>
    ),
  },
  { key: "servidor", header: "Servidor", value: (row) => row.servidor },
  { key: "empresa", header: "Empresa/Secretaria", value: (row) => row.empresaSecretaria },
  { key: "lotacao", header: "Lotação", value: (row) => row.lotacao },
  { key: "funcao", header: "Função", value: (row) => row.funcao },
  { key: "remuneracao", header: "Remuneração (R$)", kind: "money", value: (row) => row.remuneracao },
  { key: "alimentacao", header: "Alimentação (R$)", kind: "money", value: (row) => row.alimentacao },
  { key: "custo", header: "Custo mensal (R$)", kind: "money", value: (row) => custoMensal(row) },
  { key: "indicacao", header: "Indicação", value: (row) => row.indicacao },
  { key: "origem", header: "Origem", value: (row) => row.origem },
];

const reais = (centavos: number) => formatMoney(centavos / 100);

function formatInt(value: number): string {
  return value.toLocaleString("pt-BR");
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim() !== ""))].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
}

function formatImportedAt(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label className="text-sm font-medium" htmlFor={id}>{label}</label>
      <NativeSelect id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Todos</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </NativeSelect>
    </div>
  );
}

function ImportInfo({ dataset }: { dataset: StoredDataset<unknown> }) {
  const when = formatImportedAt(dataset.importedAt);
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <FileSpreadsheet className="size-4 shrink-0" aria-hidden="true" />
      <span>
        <span className="font-medium text-foreground">{dataset.fileName}</span>
        {when ? <>, importado em {when}</> : null}
      </span>
    </p>
  );
}

function FilterBar({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

function SomaRow({ label, soma, strong }: { label: string; soma: Soma; strong?: boolean }) {
  return (
    <TableRow className={cn(strong && "font-semibold")}>
      <TableCell>{label}</TableCell>
      <TableCell className="text-right tabular-nums">{formatInt(soma.quantidade)}</TableCell>
      <TableCell className="text-right whitespace-nowrap tabular-nums">{reais(soma.remuneracao)}</TableCell>
      <TableCell className="text-right whitespace-nowrap tabular-nums">{reais(soma.alimentacao)}</TableCell>
      <TableCell className="text-right whitespace-nowrap tabular-nums">{reais(soma.custo)}</TableCell>
    </TableRow>
  );
}

function SomaHead({ first }: { first: string }) {
  return (
    <TableHeader>
      <TableRow className="hover:bg-transparent">
        <TableHead scope="col">{first}</TableHead>
        <TableHead scope="col" className="text-right">Quantidade</TableHead>
        <TableHead scope="col" className="text-right">Remuneração</TableHead>
        <TableHead scope="col" className="text-right">Alimentação</TableHead>
        <TableHead scope="col" className="text-right">Custo mensal</TableHead>
      </TableRow>
    </TableHeader>
  );
}

/** Subtotais das linhas visíveis (respeitam busca e filtros): comissionados, terceirizados, total e terceirizados por empresa. */
function SubtotaisPanel({ rows }: { rows: ColaboradorPlanilha[] }) {
  const totais = useMemo(() => subtotais(rows), [rows]);
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <caption className="sr-only">Subtotais dos registros exibidos</caption>
          <SomaHead first="Subtotal" />
          <TableBody>
            <SomaRow label="Comissionados" soma={totais.comissionados} />
            <SomaRow label="Terceirizados" soma={totais.terceirizados} />
            <SomaRow label="Total" soma={totais.total} strong />
          </TableBody>
        </Table>
      </div>
      {totais.porEmpresa.length > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <caption className="sr-only">Subtotais dos terceirizados por empresa</caption>
            <SomaHead first="Terceirizados por empresa" />
            <TableBody>
              {totais.porEmpresa.map((item) => (
                <SomaRow key={item.empresa} label={item.empresa} soma={item} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <p className="text-sm text-muted-foreground">Custo mensal = remuneração + alimentação. Linhas com R$ 0,00 contam na quantidade.</p>
    </div>
  );
}

function PlanilhaPanel({ dataset }: { dataset: StoredDataset<ColaboradorPlanilha> }) {
  const [empresa, setEmpresa] = useState("");
  const [funcao, setFuncao] = useState("");
  const [origem, setOrigem] = useState("");

  const empresas = useMemo(() => unique(dataset.records.map((row) => row.empresaSecretaria)), [dataset]);
  const funcoes = useMemo(() => unique(dataset.records.map((row) => row.funcao)), [dataset]);
  const origens = useMemo(() => unique(dataset.records.map((row) => row.origem)), [dataset]);
  const rows = useMemo(
    () =>
      dataset.records.filter(
        (row) => (!empresa || row.empresaSecretaria === empresa) && (!funcao || row.funcao === funcao) && (!origem || row.origem === origem),
      ),
    [dataset, empresa, funcao, origem],
  );

  return (
    <>
      <ImportInfo dataset={dataset} />
      <FilterBar>
        <FilterSelect label="Empresa/Secretaria" value={empresa} options={empresas} onChange={setEmpresa} />
        <FilterSelect label="Função" value={funcao} options={funcoes} onChange={setFuncao} />
        <FilterSelect label="Origem" value={origem} options={origens} onChange={setOrigem} />
      </FilterBar>
      <DataTable
        caption="Funcionários: comissionados e terceirizados"
        columns={PLANILHA_COLUMNS}
        rows={rows}
        rowKey={(row) => `${row.origem}-${row.linha}-${row.matricula}`}
        exportFileName="funcionarios.csv"
        footer={(visible) => <SubtotaisPanel rows={visible} />}
      />
    </>
  );
}

function Kpi({ label, value, note, wide, money }: { label: string; value: string; note?: string; wide?: boolean; money?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-1 p-4 sm:px-6 sm:py-5", wide && "col-span-2 lg:col-span-1")}>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="flex flex-col gap-1">
        <span className={cn("font-semibold tracking-tight tabular-nums", money ? "text-2xl" : "text-2xl sm:text-3xl")}>{value}</span>
        {note && <span className="text-sm text-muted-foreground tabular-nums">{note}</span>}
      </dd>
    </div>
  );
}

const KPI_GRID = "grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border lg:grid-cols-4 [&>*]:bg-card";

function KpiLoading() {
  return (
    <div className={KPI_GRID} aria-busy="true" aria-label="Carregando indicadores">
      {["a", "b", "c", "d"].map((key) => (
        <div className="flex flex-col gap-3 px-6 py-5" key={key}>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-8 w-24" />
        </div>
      ))}
    </div>
  );
}

function KpiStrip({ planilha }: { planilha: StoredDataset<ColaboradorPlanilha> | null }) {
  const dash = "—";
  const totais = planilha ? subtotais(planilha.records) : null;
  return (
    <dl className={KPI_GRID} aria-label="Indicadores do cadastro funcional">
      <Kpi label="Comissionados" value={totais ? formatInt(totais.comissionados.quantidade) : dash} />
      <Kpi label="Terceirizados" value={totais ? formatInt(totais.terceirizados.quantidade) : dash} />
      <Kpi wide money label="Soma de remuneração" value={totais ? reais(totais.total.remuneracao) : dash} />
      <Kpi wide money label="Custo mensal total" value={totais ? reais(totais.total.custo) : dash} note={totais ? "Remuneração + alimentação" : undefined} />
    </dl>
  );
}

/** Remuneração dos terceirizados x aba Terceirizado da tabela salarial. Só contagens e funções; nunca nomes de pessoas. */
function ConferenciaTerceirizados({ planilha, salarial }: { planilha: StoredDataset<ColaboradorPlanilha>; salarial: StoredDataset<CargoSalario> | null }) {
  const conferencia = useMemo(() => (salarial ? conferirTerceirizados(planilha.records, salarial.records) : null), [planilha, salarial]);
  if (!conferencia) {
    return (
      <Alert variant="info">
        <FileSpreadsheet aria-hidden="true" />
        <AlertTitle>Conferência com a tabela salarial</AlertTitle>
        <AlertDescription>
          <p>Importe a tabela salarial (aba Terceirizado) para conferir a remuneração dos terceirizados.</p>
          <div className="pt-1">
            <Button asChild size="sm" variant="outline">
              <Link href="/import">Importar tabela salarial</Link>
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }
  if (conferencia.terceirizados === 0) return null;
  const detalhe = conferencia.funcoes.filter((item) => item.divergentes > 0 || item.valorTabela === null);
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Conferência com a tabela salarial</CardTitle>
        <CardDescription>
          Remuneração dos terceirizados comparada à aba Terceirizado da tabela. Esta conferência não entra no teto dos comissionados.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-3 [&>*]:bg-card">
          <Kpi label="Terceirizados conferidos" value={formatInt(conferencia.terceirizados)} />
          <Kpi label="Com remuneração diferente da tabela" value={formatInt(conferencia.divergentes)} />
          <Kpi label="Funções sem valor na tabela" value={formatInt(conferencia.funcoesSemValor)} />
        </dl>
        {detalhe.length > 0 ? (
          <div className="max-h-80 overflow-auto rounded-lg border" tabIndex={0} role="region" aria-label="Funções com diferença ou sem valor na tabela">
            <Table>
              <caption className="sr-only">Funções de terceirizados com diferença ou sem valor na tabela salarial</caption>
              <TableHeader className="sticky top-0 bg-muted/95">
                <TableRow className="hover:bg-transparent">
                  <TableHead scope="col">Função</TableHead>
                  <TableHead scope="col" className="text-right">Pessoas</TableHead>
                  <TableHead scope="col" className="text-right">Valor na tabela</TableHead>
                  <TableHead scope="col">Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detalhe.map((item) => (
                  <TableRow key={item.funcao}>
                    <TableCell>{item.funcao}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatInt(item.pessoas)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap tabular-nums">{item.valorTabela === null ? "—" : reais(item.valorTabela)}</TableCell>
                    <TableCell>
                      {item.valorTabela === null ? (
                        <Badge variant="warning">
                          <TriangleAlert aria-hidden="true" />
                          Sem valor na tabela
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          {formatInt(item.divergentes)} {item.divergentes === 1 ? "pessoa diferente" : "pessoas diferentes"}
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Todas as remunerações conferem com a tabela.</p>
        )}
      </CardContent>
    </Card>
  );
}

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; planilha: StoredDataset<ColaboradorPlanilha> | null; salarial: StoredDataset<CargoSalario> | null };

export default function EmployeesView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const store = getDataStore();
        const [planilha, salarial] = await Promise.all([store.load("planilha"), store.load("salarial")]);
        if (active) setState({ status: "ready", planilha, salarial });
      } catch {
        if (active) setState({ status: "error" });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  function body() {
    if (state.status === "loading") {
      return (
        <div className="flex flex-col gap-3" role="status" aria-label="Carregando dados importados">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      );
    }
    if (state.status === "error") {
      return (
        <Alert variant="destructive" role="alert">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>Não foi possível ler os dados importados</AlertTitle>
          <AlertDescription>Recarregue a página ou importe o arquivo novamente.</AlertDescription>
        </Alert>
      );
    }
    if (!state.planilha) {
      return (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed bg-card px-6 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-secondary text-secondary-foreground">
            <Upload className="size-5" aria-hidden="true" />
          </span>
          <div className="flex max-w-sm flex-col gap-1">
            <p className="font-medium">Nenhum cadastro funcional importado</p>
            <p className="text-sm text-muted-foreground">Importe o Cadastro funcional (planilha Excel) para consultar comissionados e terceirizados aqui.</p>
          </div>
          <Button asChild>
            <Link href="/import">Importar arquivos</Link>
          </Button>
        </div>
      );
    }
    return (
      <>
        <ConferenciaTerceirizados planilha={state.planilha} salarial={state.salarial} />
        <PlanilhaPanel dataset={state.planilha} />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Funcionários</h1>
        <p className="max-w-prose text-muted-foreground">
          Comissionados e terceirizados do Cadastro funcional (planilha Excel).{storageMode() === "local" ? " Os dados ficam só neste navegador." : ""}
        </p>
      </header>

      {state.status === "loading" ? <KpiLoading /> : state.status === "ready" ? <KpiStrip planilha={state.planilha} /> : null}

      <div className="flex flex-col gap-6">{body()}</div>
    </div>
  );
}
