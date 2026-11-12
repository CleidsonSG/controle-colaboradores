"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import {
  analyzeRows,
  IMPORT_FIELDS,
  ImportFileError,
  MAX_FILE_SIZE,
  parseLocalFile,
  suggestMapping,
  type ImportAnalysis,
  type LoadType,
  type ParsedFile,
} from "@/lib/import-data";

const PREVIEW_LIMIT = 6;

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getSafeError(error: unknown): string {
  if (error instanceof ImportFileError) return error.message;
  return "Não foi possível preparar este arquivo. Confira o formato e tente novamente.";
}

export default function ImportWorkspace() {
  const fileInput = useRef<HTMLInputElement>(null);
  const parseSequence = useRef(0);
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<ParsedFile | null>(null);
  const [loadType, setLoadType] = useState<LoadType | "">("");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null);
  const [error, setError] = useState("");
  const [reading, setReading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [showSensitive, setShowSensitive] = useState(false);

  const fields = loadType ? IMPORT_FIELDS[loadType] : [];
  const busy = reading || analyzing;

  async function loadSelectedFile(nextFile: File, sheetName?: string) {
    const request = ++parseSequence.current;
    setError("");
    setAnalysis(null);
    setSource(null);
    setFile(nextFile);
    setMapping({});
    setReading(true);
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    try {
      const parsed = await parseLocalFile(nextFile, sheetName);
      if (request !== parseSequence.current) return;
      setFile(nextFile);
      setSource(parsed);
      setMapping(loadType ? suggestMapping(parsed.headers, loadType) : {});
      setShowSensitive(false);
    } catch (caught) {
      if (request !== parseSequence.current) return;
      setSource(null);
      setFile(null);
      setMapping({});
      setError(getSafeError(caught));
    } finally {
      if (request === parseSequence.current) setReading(false);
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.currentTarget.files?.[0];
    if (selected) void loadSelectedFile(selected);
    event.currentTarget.value = "";
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const selected = event.dataTransfer.files[0];
    if (selected) void loadSelectedFile(selected);
  }

  async function onSheetChange(event: ChangeEvent<HTMLSelectElement>) {
    if (file) await loadSelectedFile(file, event.currentTarget.value);
  }

  function onLoadTypeChange(event: ChangeEvent<HTMLSelectElement>) {
    const selected = event.currentTarget.value as LoadType | "";
    setLoadType(selected);
    setAnalysis(null);
    setMapping(source && selected ? suggestMapping(source.headers, selected) : {});
  }

  function onMappingChange(fieldKey: string, column: string) {
    setMapping((current) => ({ ...current, [fieldKey]: column }));
    setAnalysis(null);
  }

  async function runAnalysis() {
    if (!source || !loadType) return;
    setAnalyzing(true);
    setError("");
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    try {
      setAnalysis(analyzeRows(source, loadType, mapping));
    } catch {
      setError("Não foi possível concluir a análise local. Revise as colunas e tente novamente.");
    } finally {
      setAnalyzing(false);
    }
  }

  function resetImport() {
    setFile(null);
    setSource(null);
    setMapping({});
    setAnalysis(null);
    setError("");
    setShowSensitive(false);
    if (fileInput.current) fileInput.current.value = "";
  }

  const analysisReady = analysis !== null && analysis.configurationIssues.length === 0;
  const visibleFields = fields.filter((field) => !field.sensitive || showSensitive);
  const previewRows = analysis?.rows.filter((row) => row.issues.length === 0).slice(0, PREVIEW_LIMIT) ?? [];
  const errorRows = analysis?.rows.filter((row) => row.issues.length > 0).slice(0, PREVIEW_LIMIT) ?? [];

  return (
    <div className="import-page" aria-busy={busy}>
      <div className="page-intro">
        <div className="page-intro-copy">
          <p className="eyebrow"><span className="eyebrow-index">01</span> Importação assistida</p>
          <h1>Importar<br /><span>Dados</span></h1>
          <p className="intro-description">Traga uma planilha para uma conferência local. Revise o mapeamento e a prévia antes de qualquer próxima etapa.</p>
        </div>
        <aside className="privacy-note" aria-label="Privacidade do processamento">
          <span className="privacy-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 3.5 19 6v5.6c0 4.1-2.8 7.1-7 9-4.2-1.9-7-4.9-7-9V6l7-2.5Z" /><path d="m9 12 2 2 4-4" /></svg>
          </span>
          <div>
            <strong>O arquivo fica aqui.</strong>
            <p>Leitura somente neste navegador. Não enviamos nem armazenamos os dados.</p>
          </div>
        </aside>
      </div>

      <div className="workflow-heading">
        <div>
          <span className="section-index">ETAPA 01 — REVISÃO</span>
          <h2>Preparar prévia</h2>
        </div>
        <span className="workflow-meta">3 passos <span aria-hidden="true">·</span> nenhum dado será salvo</span>
      </div>

      <section className="workflow-panel" aria-labelledby="workflow-title">
        <h2 id="workflow-title" className="visually-hidden">Preparar importação e revisar prévia</h2>
        <div className="workflow-steps" aria-label="Etapas da importação">
          <span className="workflow-step workflow-step-active"><span>1</span> Tipo e arquivo</span>
          <span className={`workflow-step${source ? " workflow-step-active" : ""}`}><span>2</span> Mapeamento</span>
          <span className={`workflow-step${analysisReady ? " workflow-step-active" : ""}`}><span>3</span> Prévia</span>
        </div>

        <div className="form-section">
          <label className="field-label" htmlFor="load-type">Tipo de carga <span>obrigatório</span></label>
          <p className="field-help" id="load-type-help">Define os campos e as validações desta análise.</p>
          <select
            id="load-type"
            className="form-select load-type-select"
            value={loadType}
            onChange={onLoadTypeChange}
            aria-describedby="load-type-help"
          >
            <option value="">Selecione o tipo de dados</option>
            <option value="employees">Funcionários</option>
            <option value="position-statistics">Estatística de cargo</option>
          </select>
        </div>

        <div className={`drop-zone${dragging ? " drop-zone-active" : ""}${source ? " drop-zone-loaded" : ""}`}
          onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
          }}
          onDrop={onDrop}
        >
          <span className="file-mark" aria-hidden="true">
            <svg viewBox="0 0 28 28" fill="none"><path d="M14 18V5m0 0L9.5 9.5M14 5l4.5 4.5M5 17v6h18v-6" /></svg>
          </span>
          <div className="drop-copy">
            <strong>{source ? "Arquivo pronto para revisar" : "Solte seu arquivo aqui"}</strong>
            <p>{source ? `${source.kind === "csv" ? "CSV" : "Planilha"} · ${file ? formatBytes(file.size) : ""} · conteúdo mantido no navegador` : "ou selecione no seu dispositivo"}</p>
          </div>
          <label className="button button-outline file-select" htmlFor="file-input">Selecionar arquivo
            <input
              ref={fileInput}
              id="file-input"
              className="file-input"
              type="file"
              accept=".csv,.xlsx,.xlsm,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel.sheet.macroEnabled.12"
              onChange={onFileChange}
              aria-describedby="file-types"
            />
          </label>
          <span id="file-types" className="file-types">CSV, XLSX ou XLSM <span aria-hidden="true">·</span> até 25 MB</span>
        </div>

        {reading && <p className="status-message" role="status"><span className="spinner" aria-hidden="true" /> Lendo arquivo neste navegador…</p>}
        {error && <p className="inline-alert" role="alert"><span aria-hidden="true">!</span>{error}</p>}

        {source && (
          <div className="source-details">
            <div className="source-overview">
              <span className="source-icon" aria-hidden="true">✓</span>
              <div><strong>Leitura concluída</strong><span>{source.headers.length} colunas reconhecíveis · {source.rows.length.toLocaleString("pt-BR")} registros</span></div>
            </div>
            {source.sheetNames.length > 1 && (
              <div className="sheet-picker">
                <label className="field-label" htmlFor="sheet-select">Planilha</label>
                <select id="sheet-select" className="form-select" value={source.sheetName} onChange={(event) => void onSheetChange(event)} disabled={busy}>
                  {source.sheetNames.map((name, index) => <option value={name} key={`${name}-${index}`}>{name}</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        {source && loadType && (
          <div className="mapping-section" aria-labelledby="mapping-heading">
            <div className="subsection-heading">
              <div><span className="section-index">ETAPA 02</span><h3 id="mapping-heading">Associe os campos</h3></div>
              <p>Colunas encontradas podem ser sugeridas automaticamente. Confira cada seleção.</p>
            </div>
            <div className="mapping-grid">
              {fields.map((field) => (
                <div className="mapping-item" key={field.key}>
                  <label className="field-label" htmlFor={`map-${field.key}`}>
                    {field.label}{field.required && <span className="required-tag">Obrigatório</span>}
                    {field.sensitive && <span className="sensitive-tag">Sensível</span>}
                  </label>
                  <select
                    className="form-select"
                    id={`map-${field.key}`}
                    value={mapping[field.key] ?? ""}
                    onChange={(event) => onMappingChange(field.key, event.currentTarget.value)}
                    disabled={busy}
                  >
                    <option value="">Não mapeado</option>
                    {source.headers.map((header, index) => (
                      <option value={String(index)} key={`${index}-${header}`}>{header || `Coluna ${index + 1}`}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="action-row">
              <p>Valores são conferidos apenas nesta tela. Nada será gravado.</p>
              <button className="button button-primary" type="button" onClick={() => void runAnalysis()} disabled={busy || !loadType}>
                {analyzing ? <><span className="spinner spinner-light" aria-hidden="true" /> Analisando…</> : <>Analisar prévia <span aria-hidden="true">→</span></>}
              </button>
            </div>
          </div>
        )}

        {analysis?.configurationIssues.length ? (
          <div className="configuration-alert" role="alert">
            <strong>Revise o mapeamento antes de analisar:</strong>
            <ul>{analysis.configurationIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
          </div>
        ) : null}

        {analysisReady && analysis && (
          <section className="results-section" aria-labelledby="results-heading" aria-live="polite">
            <div className="result-banner">
              <span className="result-check" aria-hidden="true">✓</span>
              <div><strong id="results-heading">Prévia pronta</strong><p>Análise concluída neste navegador. Os dados não foram salvos.</p></div>
            </div>
            <div className="result-counts">
              <div><span>REGISTROS VÁLIDOS</span><strong>{analysis.validCount.toLocaleString("pt-BR")}</strong></div>
              <div><span>REGISTROS COM ERROS</span><strong>{analysis.invalidCount.toLocaleString("pt-BR")}</strong></div>
              <div><span>TOTAL ANALISADO</span><strong>{analysis.rows.length.toLocaleString("pt-BR")}</strong></div>
            </div>

            {analysis.rows.length === 0 ? (
              <div className="empty-result"><strong>Nenhum registro para analisar.</strong><p>O arquivo contém cabeçalhos, mas não há linhas preenchidas abaixo deles.</p></div>
            ) : (
              <>
                {analysis.validCount > 0 && (
                  <div className="preview-block">
                    <div className="preview-heading">
                      <div><h3>Registros válidos</h3><span>Exibindo até {PREVIEW_LIMIT} linhas para conferência.</span></div>
                      {fields.some((field) => field.sensitive && mapping[field.key] !== "") && (
                        <label className="sensitive-toggle">
                          <input type="checkbox" checked={showSensitive} onChange={(event) => setShowSensitive(event.currentTarget.checked)} />
                          Mostrar dados sensíveis
                        </label>
                      )}
                    </div>
                    <div className="table-scroll" tabIndex={0} role="region" aria-label="Prévia de registros válidos; tabela rolável horizontalmente">
                      <table>
                        <thead><tr><th scope="col">Registro</th>{visibleFields.map((field) => <th scope="col" key={field.key}>{field.label}</th>)}</tr></thead>
                        <tbody>{previewRows.map((row) => (
                          <tr key={row.record}><th scope="row">{row.record}</th>{visibleFields.map((field) => <td key={field.key}>{row.values[field.key] || <span className="empty-cell">—</span>}</td>)}</tr>
                        ))}</tbody>
                      </table>
                    </div>
                  </div>
                )}
                {analysis.invalidCount > 0 && (
                  <div className="errors-block">
                    <h3>Registros para corrigir <span>{analysis.invalidCount.toLocaleString("pt-BR")}</span></h3>
                    <p className="errors-intro">Os valores importados não são repetidos aqui. Confira o número do registro e os campos indicados.</p>
                    <ul className="record-errors">
                      {errorRows.map((row) => <li key={row.record}><strong>Registro {row.record}</strong><span>{row.issues.join(" · ")}</span></li>)}
                    </ul>
                    {analysis.invalidCount > PREVIEW_LIMIT && <p className="more-errors">Mais {analysis.invalidCount - PREVIEW_LIMIT} registros com erro não exibidos.</p>}
                  </div>
                )}
              </>
            )}
          </section>
        )}

        <div className="panel-footer">
          <span className="footer-lock" aria-hidden="true">◈</span>
          <p>Esta versão não grava dados e não envia arquivos para nenhum serviço.</p>
          {source && <button className="text-button" type="button" onClick={resetImport} disabled={busy}>Limpar e começar novamente</button>}
        </div>
      </section>

      <div className="page-footnote">
        <span className="footnote-line" aria-hidden="true" />
        <p>Importação com conferência antes de qualquer decisão.</p>
        <span className="footnote-mark" aria-hidden="true">CC / 01</span>
      </div>
      <span className="visually-hidden" role="status" aria-live="polite">{analysisReady ? "Prévia pronta. Nenhum dado foi salvo." : ""}</span>
      <span className="visually-hidden" aria-hidden="true">Limite do arquivo: {formatBytes(MAX_FILE_SIZE)}.</span>
    </div>
  );
}
