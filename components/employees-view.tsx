"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { CircleAlert, FileSpreadsheet, TriangleAlert, Upload } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import DataTable, { formatMoney, type Column } from "@/components/data-table";
import { getDataStore, storageMode } from "@/lib/storage";
import type { ColaboradorPlanilha, ImportKind, ServidorECidade, StoredDataset } from "@/lib/import";

type TabKey = Exclude<ImportKind, "salarial">;

const TABS: { key: TabKey; label: string; short: string }[] = [
  { key: "ecidade", label: "Servidores Comissionados (e-Cidade)", short: "e-Cidade" },
  { key: "planilha", label: "Terceirizados e Comissionados (Planilha)", short: "Planilha" },
];

export const ECIDADE_COLUMNS: Column<ServidorECidade>[] = [
  { key: "matricula", header: "Matrícula", value: (row) => row.matricula },
  { key: "nome", header: "Nome", value: (row) => row.nome },
  { key: "descricaoCargo", header: "Descrição do cargo", value: (row) => row.descricaoCargo },
  { key: "lotacao", header: "Lotação", value: (row) => row.lotacao },
  { key: "admissao", header: "Admissão", kind: "date", value: (row) => row.admissao },
  { key: "rescisao", header: "Rescisão", kind: "date", value: (row) => row.rescisao },
];

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
  { key: "indicacao", header: "Indicação", value: (row) => row.indicacao },
  { key: "origem", header: "Origem", value: (row) => row.origem },
];

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.trim() !== ""))].sort((a, b) => a.localeCompare(b, "pt-BR", { sensitivity: "base" }));
}

function hashToTab(hash: string): TabKey {
  return hash.replace("#", "") === "planilha" ? "planilha" : "ecidade";
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

function ECidadePanel({ dataset }: { dataset: StoredDataset<ServidorECidade> }) {
  const [onlyComissionados, setOnlyComissionados] = useState(false);
  const [lotacao, setLotacao] = useState("");
  const [cargo, setCargo] = useState("");

  const lotacoes = useMemo(() => unique(dataset.records.map((row) => row.lotacao)), [dataset]);
  const cargos = useMemo(() => unique(dataset.records.map((row) => row.descricaoCargo)), [dataset]);
  const rows = useMemo(
    () =>
      dataset.records.filter(
        (row) => (!onlyComissionados || row.comissionado) && (!lotacao || row.lotacao === lotacao) && (!cargo || row.descricaoCargo === cargo),
      ),
    [dataset, onlyComissionados, lotacao, cargo],
  );

  return (
    <>
      <ImportInfo dataset={dataset} />
      <FilterBar>
        <FilterSelect label="Lotação" value={lotacao} options={lotacoes} onChange={setLotacao} />
        <FilterSelect label="Cargo" value={cargo} options={cargos} onChange={setCargo} />
        <div className="flex items-end">
          <Label className="min-h-10 cursor-pointer font-normal">
            <Checkbox checked={onlyComissionados} onCheckedChange={(checked) => setOnlyComissionados(checked === true)} />
            Somente comissionados (282/16)
          </Label>
        </div>
      </FilterBar>
      <DataTable
        caption="Servidores Comissionados (e-Cidade)"
        columns={ECIDADE_COLUMNS}
        rows={rows}
        rowKey={(row, index) => `${row.matricula}-${index}`}
        exportFileName="servidores-ecidade.csv"
      />
    </>
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
        caption="Terceirizados e Comissionados (Planilha)"
        columns={PLANILHA_COLUMNS}
        rows={rows}
        rowKey={(row) => `${row.origem}-${row.linha}-${row.matricula}`}
        exportFileName="terceirizados-comissionados.csv"
        footer={(visible) => {
          const remuneracao = visible.reduce((sum, row) => sum + (row.remuneracao ?? 0), 0);
          const alimentacao = visible.reduce((sum, row) => sum + (row.alimentacao ?? 0), 0);
          return (
            <dl className="flex flex-wrap justify-end gap-x-8 gap-y-2 text-sm">
              <div className="flex items-baseline gap-2">
                <dt className="text-muted-foreground">Soma de remuneração</dt>
                <dd className="font-semibold tabular-nums">{formatMoney(remuneracao)}</dd>
              </div>
              <div className="flex items-baseline gap-2">
                <dt className="text-muted-foreground">Soma de alimentação</dt>
                <dd className="font-semibold tabular-nums">{formatMoney(alimentacao)}</dd>
              </div>
            </dl>
          );
        }}
      />
    </>
  );
}

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; ecidade: StoredDataset<ServidorECidade> | null; planilha: StoredDataset<ColaboradorPlanilha> | null };

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

function KpiStrip({ state }: { state: LoadState }) {
  if (state.status === "loading") {
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
  if (state.status === "error") return null;
  const { ecidade, planilha } = state;
  const servidores = ecidade?.records ?? [];
  const comissionadosEcidade = servidores.filter((row) => row.comissionado).length;
  const registros = planilha?.records ?? [];
  const comissionadosPlanilha = registros.filter((row) => row.origem === "Comissionado").length;
  const terceirizados = registros.filter((row) => row.origem === "Terceirizado").length;
  const remuneracao = registros.reduce((sum, row) => sum + (row.remuneracao ?? 0), 0);
  const dash = "—";
  return (
    <dl className={KPI_GRID} aria-label="Indicadores dos dados importados">
      <Kpi label="Servidores no e-Cidade" value={ecidade ? formatInt(servidores.length) : dash} />
      <Kpi label="Comissionados (282/16)" value={ecidade ? formatInt(comissionadosEcidade) : dash} />
      <Kpi
        wide
        label="Registros da planilha"
        value={planilha ? formatInt(registros.length) : dash}
        note={planilha ? `${formatInt(comissionadosPlanilha)} comissionados, ${formatInt(terceirizados)} terceirizados` : undefined}
      />
      <Kpi wide money label="Soma de remuneração" value={planilha ? formatMoney(remuneracao) : dash} />
    </dl>
  );
}

function formatInt(value: number): string {
  return value.toLocaleString("pt-BR");
}

export default function EmployeesView() {
  const [tab, setTab] = useState<TabKey>("ecidade");
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    const syncHash = () => setTab(hashToTab(window.location.hash));
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const store = getDataStore();
        const [ecidade, planilha] = await Promise.all([store.load("ecidade"), store.load("planilha")]);
        if (active) setState({ status: "ready", ecidade, planilha });
      } catch {
        if (active) setState({ status: "error" });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  function selectTab(value: string) {
    const key = hashToTab(value);
    setTab(key);
    window.history.replaceState(null, "", `#${key}`);
  }

  function panelBody(key: TabKey) {
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
    const dataset = state[key];
    if (!dataset) {
      return (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed bg-card px-6 py-14 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-secondary text-secondary-foreground">
            <Upload className="size-5" aria-hidden="true" />
          </span>
          <div className="flex max-w-sm flex-col gap-1">
            <p className="font-medium">Nenhum dado importado nesta aba</p>
            <p className="text-sm text-muted-foreground">Importe o arquivo correspondente para consultar os registros aqui.</p>
          </div>
          <Button asChild>
            <Link href="/import">Importar arquivos</Link>
          </Button>
        </div>
      );
    }
    return key === "ecidade" ? (
      <ECidadePanel dataset={dataset as StoredDataset<ServidorECidade>} />
    ) : (
      <PlanilhaPanel dataset={dataset as StoredDataset<ColaboradorPlanilha>} />
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Funcionários</h1>
        <p className="max-w-prose text-muted-foreground">Consulte os servidores e colaboradores importados.{storageMode() === "local" ? " Os dados ficam só neste navegador." : ""}</p>
      </header>

      <KpiStrip state={state} />

      <Tabs value={tab} onValueChange={selectTab}>
        <TabsList aria-label="Fontes de dados">
          {TABS.map((item) => (
            <TabsTrigger key={item.key} value={item.key}>
              <span className="sm:hidden">{item.short}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((item) => (
          <TabsContent key={item.key} value={item.key}>
            {panelBody(item.key)}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
