"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { CircleAlert, FileSpreadsheet, TriangleAlert, Upload } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import CustoAlimentacao from "@/components/custo-alimentacao";
import EmployeeHistoryDialog from "@/components/employee-history-dialog";
import DataTable, { formatMoney, type Column } from "@/components/data-table";
import { getDataStore, storageMode } from "@/lib/storage";
import { useAuth } from "@/components/auth-gate";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { aplicarAjustes } from "@/lib/folha/ajustes";
import { buildRetratos } from "@/lib/folha/historico";
import { agregarPorFuncao, conciliarRemuneracao, precisaAtencao, type Conciliacao, type FuncaoConferida, type PendenciaFuncao, type SituacaoFuncao } from "@/lib/folha/conciliacao";
import { custoMensal, subtotais, type Soma } from "@/lib/folha/funcionarios";
import ConferenciaDetalheDialog from "@/components/conferencia-detalhe-dialog";
import TerceirizadosPorEmpresa from "@/components/terceirizados-por-empresa";
import ExportButtons from "@/components/export-buttons";
import { tabelaDivergencias } from "@/lib/export-funcionarios";
import type { AjusteRemuneracao, CargoSalario, ColaboradorPlanilha, SituacaoRemuneracao, StoredDataset } from "@/lib/import";

type SalvarValor = (pessoas: PendenciaFuncao[], centavos: number) => Promise<void>;

const SITUACAO: Record<SituacaoRemuneracao, { label: string; variant: "success" | "warning" | "secondary" }> = {
  confere: { label: "Ok", variant: "success" },
  diverge: { label: "Diverge", variant: "warning" },
  "sem-valor": { label: "Sem valor na tabela", variant: "secondary" },
  "fora-da-tabela": { label: "Fora da tabela", variant: "secondary" },
  "nao-informada": { label: "Não informada", variant: "secondary" },
};

function SituacaoBadge({ situacao }: { situacao: SituacaoRemuneracao }) {
  const { label, variant } = SITUACAO[situacao];
  return (
    <Badge variant={variant}>
      {situacao === "diverge" && <TriangleAlert aria-hidden="true" />}
      {label}
    </Badge>
  );
}

/** informado - tabela (reais), calculado em centavos; null quando falta um dos dois valores. */
function diferencaDaLinha(row: ColaboradorPlanilha): number | null {
  if (row.remuneracao === null || row.remuneracaoTabela === null || row.remuneracaoTabela === undefined) return null;
  return (Math.round(row.remuneracao * 100) - Math.round(row.remuneracaoTabela * 100)) / 100;
}

function criarColunas(abrirHistorico: (row: ColaboradorPlanilha, gatilho: HTMLElement) => void): Column<ColaboradorPlanilha>[] {
  return [
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
  {
    key: "servidor",
    header: "Servidor",
    value: (row) => row.servidor,
    render: (row) => (
      <span className="block min-w-64 whitespace-normal break-normal">
        <button
          type="button"
          className="rounded-sm text-left font-medium text-primary underline-offset-4 hover:underline"
          onClick={(event) => abrirHistorico(row, event.currentTarget)}
        >
          {row.servidor}
        </button>
      </span>
    ),
  },
  { key: "empresa", header: "Empresa/Secretaria", value: (row) => row.empresaSecretaria },
  { key: "lotacao", header: "Lotação", value: (row) => row.lotacao },
  {
    key: "funcao",
    header: "Função",
    value: (row) => row.funcao,
    render: (row) => <span className="block min-w-56 whitespace-normal break-normal">{row.funcao}</span>,
  },
  {
    key: "remuneracao",
    header: "Remuneração informada (R$)",
    kind: "money",
    value: (row) => row.remuneracao,
    render: (row) => (
      <span className="flex flex-col items-end gap-1">
        {row.remuneracao === null ? <span className="text-muted-foreground">—</span> : formatMoney(row.remuneracao)}
        {row.ajuste && <Badge variant="secondary">Ajustado no sistema</Badge>}
      </span>
    ),
  },
  { key: "remuneracaoTabela", header: "Remuneração (tabela) (R$)", kind: "money", value: (row) => row.remuneracaoTabela ?? null },
  { key: "diferenca", header: "Diferença (R$)", kind: "money", value: (row) => diferencaDaLinha(row) },
  {
    key: "situacao",
    header: "Situação",
    value: (row) => (row.situacaoRemuneracao ? SITUACAO[row.situacaoRemuneracao].label : ""),
    render: (row) => (row.situacaoRemuneracao ? <SituacaoBadge situacao={row.situacaoRemuneracao} /> : <span className="text-muted-foreground">—</span>),
  },
  { key: "alimentacao", header: "Alimentação (R$)", kind: "money", value: (row) => row.alimentacao },
  { key: "custo", header: "Custo mensal (R$)", kind: "money", value: (row) => custoMensal(row) },
  { key: "origem", header: "Origem", value: (row) => row.origem },
  ];
}

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
        <span className="font-medium text-foreground">{dataset.fileName.replace(/\.[^./\\]+$/, "")}</span>
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

/** Subtotais das linhas visíveis (respeitam busca e filtros): comissionados, terceirizados e total. Por empresa: ver TerceirizadosPorEmpresa. */
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
      <p className="text-sm text-muted-foreground">Custo mensal = remuneração + alimentação. Linhas com R$ 0,00 contam na quantidade.</p>
    </div>
  );
}

function PlanilhaPanel({ dataset }: { dataset: StoredDataset<ColaboradorPlanilha> }) {
  const [empresa, setEmpresa] = useState("");
  const [funcao, setFuncao] = useState("");
  const [origem, setOrigem] = useState("");
  const [aberto, setAberto] = useState<{ row: ColaboradorPlanilha; gatilho: HTMLElement } | null>(null);
  const [gatilho, setGatilho] = useState<HTMLElement | null>(null);
  const tabelaRef = useRef<HTMLDivElement>(null);
  // R13: empresa clicada (gráfico ou tabela) vira o filtro da tabela de funcionários e a tela rola até ela.
  function abrirEmpresa(nome: string) {
    setEmpresa(nome);
    requestAnimationFrame(() => {
      tabelaRef.current?.scrollIntoView({ block: "start" });
      tabelaRef.current?.focus({ preventScroll: true });
    });
  }
  // Identidade de cada registro no histórico (homônimos dependem da ordem do arquivo inteiro).
  const chavePorRegistro = useMemo(() => {
    const retratos = buildRetratos(dataset.records);
    return new Map(dataset.records.map((row, index) => [row, retratos[index]?.chaveIdentidade ?? ""]));
  }, [dataset]);
  const colunas = useMemo(
    () =>
      criarColunas((row, alvo) => {
        setGatilho(alvo);
        setAberto({ row, gatilho: alvo });
      }),
    [],
  );
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
      <TerceirizadosPorEmpresa rows={dataset.records} empresaFiltrada={empresa} onAbrirEmpresa={abrirEmpresa} />
      <div ref={tabelaRef} tabIndex={-1} className="flex scroll-mt-4 flex-col gap-6 outline-none">
      <FilterBar>
        <FilterSelect label="Empresa/Secretaria" value={empresa} options={empresas} onChange={setEmpresa} />
        <FilterSelect label="Função" value={funcao} options={funcoes} onChange={setFuncao} />
        <FilterSelect label="Origem" value={origem} options={origens} onChange={setOrigem} />
      </FilterBar>
      <EmployeeHistoryDialog
        pessoa={aberto?.row ?? null}
        chaveIdentidade={aberto ? chavePorRegistro.get(aberto.row) ?? "" : ""}
        retorno={gatilho}
        onClose={() => setAberto(null)}
      />
      <DataTable
        caption="Funcionários: comissionados e terceirizados"
        columns={colunas}
        rows={rows}
        rowKey={(row) => `${row.origem}-${row.linha}-${row.matricula}`}
        exportFileName="funcionarios"
        exportTitle="Funcionários: comissionados e terceirizados"
        footer={(visible) => <SubtotaisPanel rows={visible} />}
      />
      </div>
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
      <Kpi wide money label="Soma de remuneração" value={totais ? reais(totais.total.remuneracao) : dash} note={totais ? "Valor informado pela empresa" : undefined} />
      <Kpi wide money label="Custo mensal total" value={totais ? reais(totais.total.custo) : dash} note={totais ? "Remuneração informada + alimentação" : undefined} />
    </dl>
  );
}

const SITUACAO_FUNCAO: Record<SituacaoFuncao, { label: string; variant: "success" | "warning" | "secondary" }> = {
  confere: { label: "Ok", variant: "success" },
  diverge: { label: "Diverge", variant: "warning" },
  "nao-informada": { label: "Não informada", variant: "secondary" },
  "sem-referencia": { label: "Sem referência", variant: "secondary" },
};

function ValorInformado({ funcao }: { funcao: FuncaoConferida }) {
  if (funcao.valoresInformados.length === 0) return <>—</>;
  if (funcao.valoresInformados.length > 1) return <>Vários valores</>;
  return <>{reais(funcao.valoresInformados[0] ?? 0)}</>;
}

/** Selo de situação da função: sempre um botão que abre o detalhe (todas as situações). */
function SituacaoFuncaoSelo({ funcao, onAbrir }: { funcao: FuncaoConferida; onAbrir: (funcao: FuncaoConferida, gatilho: HTMLElement) => void }) {
  const { label, variant } = SITUACAO_FUNCAO[funcao.situacao];
  const selo = (
    <Badge variant={variant}>
      {funcao.situacao === "diverge" && <TriangleAlert aria-hidden="true" />}
      {label}
    </Badge>
  );
  return (
    <button
      type="button"
      className="inline-flex min-h-8 items-center rounded-full"
      aria-haspopup="dialog"
      aria-label={`${label}: ver pessoas da função ${funcao.funcao}`}
      onClick={(event) => onAbrir(funcao, event.currentTarget)}
    >
      {selo}
    </button>
  );
}

/** Remuneração informada (comissionados e terceirizados) x tabela salarial da Prefeitura. Só agregados; nunca nomes, matrículas ou CPF. */
function ConferenciaRemuneracao({ conciliacao, onSalvarValor }: { conciliacao: Conciliacao | null; onSalvarValor: SalvarValor }) {
  if (!conciliacao) {
    return (
      <Alert variant="info">
        <FileSpreadsheet aria-hidden="true" />
        <AlertTitle>Conferência de remuneração</AlertTitle>
        <AlertDescription>
          <p>Importe a tabela salarial para conferir a remuneração informada pelas empresas.</p>
          <div className="pt-1">
            <Button asChild size="sm" variant="outline">
              <Link href="/import">Importar tabela salarial</Link>
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }
  if (conciliacao.resumo.pessoas === 0) return null;
  return <ConferenciaCard conciliacao={conciliacao} onSalvarValor={onSalvarValor} />;
}

const chaveDaFuncao = (funcao: FuncaoConferida) => `${funcao.origem}|${funcao.funcao}`;

function ConferenciaCard({ conciliacao, onSalvarValor }: { conciliacao: Conciliacao; onSalvarValor: SalvarValor }) {
  const { porSituacao } = conciliacao.resumo;
  const { isAdmin } = useAuth();
  // Com Supabase, só administradores alteram (o banco também bloqueia). No modo local, o usuário do navegador pode.
  const podeAlterar = !isSupabaseConfigured() || isAdmin;
  // Guarda a chave, não o objeto: depois de um ajuste, o detalhe mostra a função recalculada.
  const [abertaChave, setAbertaChave] = useState<string | null>(null);
  const [gatilho, setGatilho] = useState<HTMLElement | null>(null);
  const funcoes = useMemo(() => agregarPorFuncao(conciliacao.rows), [conciliacao]);
  const aberta = abertaChave === null ? null : funcoes.find((funcao) => chaveDaFuncao(funcao) === abertaChave) ?? null;
  const nomesRepetidos = useMemo(() => {
    const vistos = new Set<string>();
    return new Set(funcoes.flatMap((f) => (vistos.has(f.funcao) ? [f.funcao] : (vistos.add(f.funcao), []))));
  }, [funcoes]);
  const pendentes = funcoes.filter(precisaAtencao);
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle>Conferência de remuneração</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border lg:grid-cols-4 [&>*]:bg-card">
          <Kpi label="Conferem com a tabela" value={formatInt(porSituacao.confere)} />
          <Kpi label="Divergem da tabela" value={formatInt(porSituacao.diverge)} />
          <Kpi label="Sem valor ou fora da tabela" value={formatInt(porSituacao["sem-valor"] + porSituacao["fora-da-tabela"])} />
          <Kpi label="Remuneração não informada" value={formatInt(porSituacao["nao-informada"])} />
        </dl>
        <div className="max-h-96 overflow-auto rounded-lg border" tabIndex={0} role="region" aria-label="Conferência de remuneração por função">
          <Table>
            <caption className="sr-only">Funções com o valor de referência da tabela salarial, o valor informado pelas empresas e a situação</caption>
            <TableHeader className="sticky top-0 bg-muted/95">
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col">Função</TableHead>
                <TableHead scope="col" className="text-right">Valor de referência</TableHead>
                <TableHead scope="col" className="text-right">Valor informado</TableHead>
                <TableHead scope="col">Situação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {funcoes.map((funcao) => (
                <TableRow key={chaveDaFuncao(funcao)}>
                  <TableCell className="whitespace-normal">
                    {funcao.funcao}
                    {nomesRepetidos.has(funcao.funcao) && <span className="text-muted-foreground"> ({funcao.origem})</span>}
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">{funcao.valorReferencia === null ? "—" : reais(funcao.valorReferencia)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">
                    <ValorInformado funcao={funcao} />
                  </TableCell>
                  <TableCell>
                    <SituacaoFuncaoSelo
                      funcao={funcao}
                      onAbrir={(alvo, botao) => {
                        setGatilho(botao);
                        setAbertaChave(chaveDaFuncao(alvo));
                      }}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-sm text-muted-foreground">
          A planilha da empresa prevalece: o custo usa a remuneração informada. A tabela salarial da Prefeitura é só referência de conferência.
        </p>
        {pendentes.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todas as funções conferem com a tabela de referência.</p>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">Exportar divergências</p>
            <ExportButtons montar={() => tabelaDivergencias(pendentes)} nomeArquivo="divergencias-remuneracao" />
          </div>
        )}
      </CardContent>
      <ConferenciaDetalheDialog funcao={aberta} retorno={gatilho} onClose={() => setAbertaChave(null)} podeAlterar={podeAlterar} onSalvarValor={onSalvarValor} />
    </Card>
  );
}

type LoadState =
  | { status: "loading" }
  | { status: "error" }
  | {
      status: "ready";
      planilha: StoredDataset<ColaboradorPlanilha> | null;
      salarial: StoredDataset<CargoSalario> | null;
      /** Ajustes de remuneração da importação atual (P2): aplicados na leitura, nunca gravados no dataset. */
      ajustes: AjusteRemuneracao[];
    };

export default function EmployeesView() {
  const [state, setState] = useState<LoadState>({ status: "loading" });

  // Reconcilia na leitura (idempotente): cobre dados salvos antes da conciliação e tabela importada depois.
  const conciliado = useMemo(() => {
    if (state.status !== "ready" || !state.planilha) return null;
    const records = aplicarAjustes(state.planilha.records, state.planilha.importedAt, state.ajustes);
    if (!state.salarial) return { planilha: { ...state.planilha, records }, conciliacao: null };
    const conciliacao = conciliarRemuneracao(records, state.salarial.records);
    return { planilha: { ...state.planilha, records: conciliacao.rows }, conciliacao };
  }, [state]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const store = getDataStore();
        const [planilha, salarial] = await Promise.all([store.load("planilha"), store.load("salarial")]);
        // Sem a tabela de ajustes (ex.: banco ainda sem a migração), a tela segue com os valores da planilha.
        const ajustes = planilha ? await store.loadAjustes(planilha.importedAt).catch((): AjusteRemuneracao[] => []) : [];
        if (active) setState({ status: "ready", planilha, salarial, ajustes });
      } catch {
        if (active) setState({ status: "error" });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function salvarValor(pessoas: PendenciaFuncao[], centavos: number) {
    if (state.status !== "ready" || !state.planilha) return;
    const { importedAt } = state.planilha;
    // Uma única gravação em lote: se falhar, nada é aplicado na tela.
    const novos = await getDataStore().saveAjustes(
      pessoas.map((pessoa) => ({ importedAt, posicao: pessoa.posicao, origem: pessoa.origem, linha: pessoa.linha, valorCentavos: centavos })),
    );
    setState((atual) => (atual.status === "ready" ? { ...atual, ajustes: [...atual.ajustes, ...novos] } : atual));
  }

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
    if (!conciliado) {
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
        <ConferenciaRemuneracao conciliacao={conciliado.conciliacao} onSalvarValor={salvarValor} />
        <PlanilhaPanel dataset={conciliado.planilha} />
      </>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Funcionários</h1>
        <p className="max-w-prose text-muted-foreground">
          Comissionados e terceirizados.{storageMode() === "local" ? " Os dados ficam só neste navegador." : ""}
        </p>
      </header>

      {state.status === "loading" ? <KpiLoading /> : state.status === "ready" ? <KpiStrip planilha={conciliado?.planilha ?? null} /> : null}

      {conciliado && <CustoAlimentacao rows={conciliado.planilha.records} />}

      <div className="flex flex-col gap-6">{body()}</div>
    </div>
  );
}
