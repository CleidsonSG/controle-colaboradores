"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import DataTable, { formatMoney, type Column } from "@/components/data-table";
import { getDataStore } from "@/lib/storage";
import type { ColaboradorPlanilha, ImportKind, ServidorECidade, StoredDataset } from "@/lib/import";

type TabKey = ImportKind;

const TABS: { key: TabKey; label: string }[] = [
  { key: "ecidade", label: "Servidores Comissionados (e-Cidade)" },
  { key: "planilha", label: "Terceirizados e Comissionados (Planilha)" },
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
      <span className="matricula-cell">
        {row.matricula || <span className="empty-cell">—</span>}
        {row.possivelDuplicidade && <span className="badge badge-warning">Possível duplicidade</span>}
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
  return (
    <label className="filter-field">
      <span>{label}</span>
      <select className="form-select" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Todos</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

function ImportInfo({ dataset }: { dataset: StoredDataset<unknown> }) {
  const when = formatImportedAt(dataset.importedAt);
  return (
    <p className="import-info">
      Arquivo <strong>{dataset.fileName}</strong>{when ? <> importado em {when}</> : null}. Os dados ficam apenas neste navegador.
    </p>
  );
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
      <div className="filter-bar">
        <label className="filter-check">
          <input type="checkbox" checked={onlyComissionados} onChange={(event) => setOnlyComissionados(event.target.checked)} />
          <span>Somente comissionados (282/16)</span>
        </label>
        <FilterSelect label="Lotação" value={lotacao} options={lotacoes} onChange={setLotacao} />
        <FilterSelect label="Cargo" value={cargo} options={cargos} onChange={setCargo} />
      </div>
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
      <div className="filter-bar">
        <FilterSelect label="Empresa/Secretaria" value={empresa} options={empresas} onChange={setEmpresa} />
        <FilterSelect label="Função" value={funcao} options={funcoes} onChange={setFuncao} />
        <FilterSelect label="Origem" value={origem} options={origens} onChange={setOrigem} />
      </div>
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
            <dl className="sum-list">
              <div><dt>Soma de Remuneração</dt><dd>{formatMoney(remuneracao)}</dd></div>
              <div><dt>Soma de Alimentação</dt><dd>{formatMoney(alimentacao)}</dd></div>
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

function KpiStrip({ state }: { state: LoadState }) {
  if (state.status === "loading") {
    return (
      <dl className="kpi-strip" aria-busy="true" aria-label="Indicadores">
        {["a", "b", "c", "d"].map((key) => (
          <div className="kpi kpi-skeleton" key={key}><dt>Carregando…</dt><dd aria-hidden="true" /></div>
        ))}
      </dl>
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
    <dl className="kpi-strip" aria-label="Indicadores dos dados importados">
      <div className="kpi">
        <dt>Servidores e-Cidade</dt>
        <dd>{ecidade ? formatInt(servidores.length) : dash}</dd>
      </div>
      <div className="kpi">
        <dt>Comissionados (282/16)</dt>
        <dd>{ecidade ? formatInt(comissionadosEcidade) : dash}</dd>
      </div>
      <div className="kpi">
        <dt>Registros da planilha</dt>
        <dd>
          {planilha ? formatInt(registros.length) : dash}
          {planilha && <span className="kpi-note">{formatInt(comissionadosPlanilha)} comissionados · {formatInt(terceirizados)} terceirizados</span>}
        </dd>
      </div>
      <div className="kpi">
        <dt>Soma de remuneração</dt>
        <dd>{planilha ? formatMoney(remuneracao) : dash}</dd>
      </div>
    </dl>
  );
}

function formatInt(value: number): string {
  return value.toLocaleString("pt-BR");
}

export default function EmployeesView() {
  const [tab, setTab] = useState<TabKey>("ecidade");
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const tabRefs = useRef<Record<TabKey, HTMLButtonElement | null>>({ ecidade: null, planilha: null });

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

  function selectTab(key: TabKey, focus = false) {
    setTab(key);
    window.history.replaceState(null, "", `#${key}`);
    if (focus) tabRefs.current[key]?.focus();
  }

  function onTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const index = TABS.findIndex((item) => item.key === tab);
    let next = -1;
    if (event.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    if (next < 0) return;
    event.preventDefault();
    selectTab(TABS[next].key, true);
  }

  const dataset = state.status === "ready" ? state[tab] : null;

  return (
    <div className="employees-page">
      <header className="page-header">
        <div className="page-header-copy">
          <p className="eyebrow">Gestão de pessoas</p>
          <h1>Funcionários</h1>
          <p className="intro-description">Consulte os dados importados. Tudo fica apenas neste navegador.</p>
        </div>
      </header>

      <KpiStrip state={state} />

      <div className="tab-list" role="tablist" aria-label="Fontes de dados">
        {TABS.map((item) => (
          <button
            key={item.key}
            ref={(element) => {
              tabRefs.current[item.key] = element;
            }}
            id={`tab-${item.key}`}
            className={`tab-button${tab === item.key ? " tab-button-active" : ""}`}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            aria-controls={`panel-${item.key}`}
            tabIndex={tab === item.key ? 0 : -1}
            onClick={() => selectTab(item.key)}
            onKeyDown={onTabKeyDown}
          >
            {item.label}
          </button>
        ))}
      </div>

      <section className="tab-panel" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {state.status === "loading" && (
          <p className="status-message tab-status" role="status">
            <span className="spinner" aria-hidden="true" /> Carregando dados deste navegador…
          </p>
        )}
        {state.status === "error" && (
          <div className="inline-alert tab-status" role="alert">
            <span aria-hidden="true">!</span>
            <p>Não foi possível ler os dados armazenados neste navegador. Recarregue a página ou importe o arquivo novamente.</p>
          </div>
        )}
        {state.status === "ready" && !dataset && (
          <div className="empty-state">
            <strong>Nenhum dado importado nesta aba.</strong>
            <p>Importe o arquivo correspondente para consultar os registros aqui.</p>
            <Link className="button button-primary" href="/">Importar Dados</Link>
          </div>
        )}
        {state.status === "ready" && dataset && tab === "ecidade" && <ECidadePanel dataset={dataset as StoredDataset<ServidorECidade>} />}
        {state.status === "ready" && dataset && tab === "planilha" && <PlanilhaPanel dataset={dataset as StoredDataset<ColaboradorPlanilha>} />}
      </section>
    </div>
  );
}
