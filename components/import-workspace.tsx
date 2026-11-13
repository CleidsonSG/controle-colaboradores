"use client";

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import {
  analyzeRows,
  IMPORT_FIELDS,
  ImportFileError,
  parseLocalFile,
  suggestMapping,
  type ImportAnalysis,
  type ImportField,
  type LoadType,
  type ParsedFile,
} from "@/lib/import-data";

const PREVIEW_LIMIT = 6;

const WORKFLOW_STEPS = ["Tipo e arquivo", "Mapeamento", "Prévia"] as const;

function formatBytes(bytes: number): string {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCount(value: number): string {
  return value.toLocaleString("pt-BR");
}

function getSafeError(error: unknown): string {
  if (error instanceof ImportFileError) return error.message;
  return "Não foi possível preparar este arquivo. Confira o formato e tente novamente.";
}

/** Mirrors the configuration checks of analyzeRows so each mapping select can expose its own error. */
function getMappingErrors(fields: ImportField[], mapping: Record<string, string>, columnCount: number): Record<string, string> {
  const errors: Record<string, string> = {};
  const fieldsByColumn = new Map<string, string[]>();

  for (const field of fields) {
    const selected = mapping[field.key]?.trim() ?? "";
    if (!selected) {
      if (field.required) errors[field.key] = `Selecione uma coluna para ${field.label}.`;
      continue;
    }
    const columnIndex = Number(selected);
    if (!Number.isInteger(columnIndex) || columnIndex < 0 || columnIndex >= columnCount) {
      errors[field.key] = `Selecione uma coluna válida para ${field.label}.`;
      continue;
    }
    fieldsByColumn.set(selected, [...(fieldsByColumn.get(selected) ?? []), field.key]);
  }

  for (const keys of fieldsByColumn.values()) {
    if (keys.length < 2) continue;
    for (const key of keys) errors[key] = "Cada campo deve usar uma coluna diferente do arquivo.";
  }
  return errors;
}

function focusIfLost(target: HTMLElement | null) {
  if (document.activeElement === document.body || document.activeElement === null) target?.focus();
}

export default function ImportWorkspace() {
  const fileInput = useRef<HTMLInputElement>(null);
  const loadTypeSelect = useRef<HTMLSelectElement>(null);
  const sheetSelect = useRef<HTMLSelectElement>(null);
  const configurationAlert = useRef<HTMLDivElement>(null);
  const shouldFocusInvalidField = useRef(false);
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
  const [announcement, setAnnouncement] = useState("");

  const fields = loadType ? IMPORT_FIELDS[loadType] : [];
  const busy = reading || analyzing;

  useEffect(() => {
    if (!shouldFocusInvalidField.current || !analysis) return;
    shouldFocusInvalidField.current = false;
    const firstInvalid = document.querySelector<HTMLSelectElement>('.mapping-grid select[aria-invalid="true"]');
    (firstInvalid ?? configurationAlert.current)?.focus();
  }, [analysis]);

  async function loadSelectedFile(nextFile: File, sheetName?: string) {
    const request = ++parseSequence.current;
    const isSheetChange = sheetName !== undefined;
    setError("");
    setAnalysis(null);
    if (!isSheetChange) setSource(null);
    setFile(nextFile);
    setMapping({});
    setReading(true);
    setAnnouncement("Lendo arquivo neste navegador…");
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    try {
      const parsed = await parseLocalFile(nextFile, sheetName);
      if (request !== parseSequence.current) return;
      setFile(nextFile);
      setSource(parsed);
      setMapping(loadType ? suggestMapping(parsed.headers, loadType) : {});
      setShowSensitive(false);
      setAnnouncement(`Leitura concluída: ${parsed.headers.length} colunas, ${formatCount(parsed.rows.length)} registros.`);
    } catch (caught) {
      if (request !== parseSequence.current) return;
      setSource(null);
      setFile(null);
      setMapping({});
      setAnnouncement("");
      setError(getSafeError(caught));
    } finally {
      if (request === parseSequence.current) {
        setReading(false);
        if (isSheetChange) window.setTimeout(() => focusIfLost(sheetSelect.current ?? fileInput.current), 0);
      }
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
    if (busy) return;
    setMapping((current) => ({ ...current, [fieldKey]: column }));
    setAnalysis(null);
  }

  async function runAnalysis() {
    if (busy || !source || !loadType) return;
    setAnalyzing(true);
    setError("");
    setAnnouncement("Analisando…");
    await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
    try {
      const result = analyzeRows(source, loadType, mapping);
      shouldFocusInvalidField.current = result.configurationIssues.length > 0;
      setAnalysis(result);
      setAnnouncement(result.configurationIssues.length > 0
        ? ""
        : `Prévia pronta: ${formatCount(result.validCount)} válidos, ${formatCount(result.invalidCount)} com erros, ${formatCount(result.rows.length)} no total. Nenhum dado foi salvo.`);
    } catch {
      setAnnouncement("");
      setError("Não foi possível concluir a análise local. Revise as colunas e tente novamente.");
    } finally {
      setAnalyzing(false);
    }
  }

  function resetImport() {
    if (busy) return;
    loadTypeSelect.current?.focus();
    setFile(null);
    setSource(null);
    setMapping({});
    setAnalysis(null);
    setError("");
    setAnnouncement("");
    setShowSensitive(false);
    if (fileInput.current) fileInput.current.value = "";
  }

  const analysisReady = analysis !== null && analysis.configurationIssues.length === 0;
  const mappingErrors = source && analysis?.configurationIssues.length ? getMappingErrors(fields, mapping, source.headers.length) : {};
  const hasSensitiveMapped = fields.some((field) => field.sensitive && Boolean(mapping[field.key]));
  const visibleFields = fields.filter((field) => !field.sensitive || showSensitive);
  const previewRows = analysis?.rows.filter((row) => row.issues.length === 0).slice(0, PREVIEW_LIMIT) ?? [];
  const errorRows = analysis?.rows.filter((row) => row.issues.length > 0).slice(0, PREVIEW_LIMIT) ?? [];
  const currentStep = analysisReady ? 3 : source && loadType ? 2 : 1;
  const activeSteps = [true, Boolean(source), analysisReady];

  return (
    <div className="import-page">
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
          <span className="section-index">Etapa 01 — revisão</span>
          <h2 id="workflow-title">Preparar prévia</h2>
        </div>
        <span className="workflow-meta">3 passos <span aria-hidden="true">·</span> nenhum dado será salvo</span>
      </div>

      <section className="workflow-panel" aria-labelledby="workflow-title">
        <ol className="workflow-steps" aria-label="Etapas da importação">
          {WORKFLOW_STEPS.map((label, index) => {
            const step = index + 1;
            const status = step < currentStep ? "concluída" : step === currentStep ? "etapa atual" : "pendente";
            return (
              <li
                key={label}
                className={`workflow-step${activeSteps[index] ? " workflow-step-active" : ""}`}
                aria-current={step === currentStep ? "step" : undefined}
              >
                <span>{step}</span> {label}<span className="visually-hidden"> ({status})</span>
              </li>
            );
          })}
        </ol>

        <div className="form-section">
          <label className="field-label" htmlFor="load-type">Tipo de carga <span>obrigatório</span></label>
          <p className="field-help" id="load-type-help">Define os campos e as validações desta análise.</p>
          <select
            ref={loadTypeSelect}
            id="load-type"
            className="form-select load-type-select"
            value={loadType}
            onChange={onLoadTypeChange}
            aria-describedby="load-type-help"
            required
            aria-required="true"
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

        {reading && <p className="status-message"><span className="spinner" aria-hidden="true" /> Lendo arquivo neste navegador…</p>}
        {error && <p className="inline-alert" role="alert"><span aria-hidden="true">!</span>{error}</p>}

        {source && (
          <div className="source-details">
            <div className="source-overview">
              <span className="source-icon" aria-hidden="true">✓</span>
              <div><strong>Leitura concluída</strong><span>{source.headers.length} colunas reconhecíveis · {formatCount(source.rows.length)} registros</span></div>
            </div>
            {source.sheetNames.length > 1 && (
              <div className="sheet-picker" aria-busy={reading}>
                <label className="field-label" htmlFor="sheet-select">Planilha</label>
                <select ref={sheetSelect} id="sheet-select" className="form-select" value={source.sheetName} onChange={(event) => void onSheetChange(event)}>
                  {source.sheetNames.map((name, index) => <option value={name} key={`${name}-${index}`}>{name}</option>)}
                </select>
              </div>
            )}
          </div>
        )}

        {source && loadType && (
          <section className="mapping-section" aria-labelledby="mapping-heading">
            <div className="subsection-heading">
              <div><span className="section-index">Etapa 02</span><h3 id="mapping-heading">Associe os campos</h3></div>
              <p>Colunas encontradas podem ser sugeridas automaticamente. Confira cada seleção.</p>
            </div>
            <div className="mapping-grid">
              {fields.map((field) => {
                const fieldError = mappingErrors[field.key];
                const errorId = `map-${field.key}-error`;
                return (
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
                      aria-disabled={busy || undefined}
                      required={field.required}
                      aria-required={field.required || undefined}
                      aria-invalid={fieldError ? true : undefined}
                      aria-describedby={fieldError ? errorId : undefined}
                    >
                      <option value="">Não mapeado</option>
                      {source.headers.map((header, index) => (
                        <option value={String(index)} key={`${index}-${header}`}>{header || `Coluna ${index + 1}`}</option>
                      ))}
                    </select>
                    {fieldError && <p className="field-error" id={errorId}>{fieldError}</p>}
                  </div>
                );
              })}
            </div>
            <div className="action-row">
              <p>Valores são conferidos apenas nesta tela. Nada será gravado.</p>
              <button className="button button-primary" type="button" onClick={() => void runAnalysis()} aria-disabled={busy || undefined}>
                {analyzing ? <><span className="spinner spinner-light" aria-hidden="true" /> Analisando…</> : <>Analisar prévia <span aria-hidden="true">→</span></>}
              </button>
            </div>
          </section>
        )}

        {analysis?.configurationIssues.length ? (
          <div className="configuration-alert" role="alert" ref={configurationAlert} tabIndex={-1}>
            <strong>Revise o mapeamento antes de analisar:</strong>
            <ul>{analysis.configurationIssues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
          </div>
        ) : null}

        {analysisReady && analysis && (
          <section className="results-section" aria-labelledby="results-heading">
            <div className="result-banner">
              <span className="result-check" aria-hidden="true">✓</span>
              <div><h3 id="results-heading">Prévia pronta</h3><p>Análise concluída neste navegador. Os dados não foram salvos.</p></div>
            </div>
            <dl className="result-counts">
              <div><dt>Registros válidos</dt><dd>{formatCount(analysis.validCount)}</dd></div>
              <div><dt>Registros com erros</dt><dd>{formatCount(analysis.invalidCount)}</dd></div>
              <div><dt>Total analisado</dt><dd>{formatCount(analysis.rows.length)}</dd></div>
            </dl>

            {analysis.rows.length === 0 ? (
              <div className="empty-result"><strong>Nenhum registro para analisar.</strong><p>O arquivo contém cabeçalhos, mas não há linhas preenchidas abaixo deles.</p></div>
            ) : (
              <>
                {analysis.validCount > 0 && (
                  <div className="preview-block">
                    <div className="preview-heading">
                      <div><h4>Registros válidos</h4><span>Exibindo até {PREVIEW_LIMIT} linhas para conferência.</span></div>
                      {hasSensitiveMapped && (
                        <label className="sensitive-toggle">
                          <input type="checkbox" checked={showSensitive} onChange={(event) => setShowSensitive(event.currentTarget.checked)} />
                          Mostrar dados sensíveis
                        </label>
                      )}
                    </div>
                    <div className="table-scroll" tabIndex={0} role="region" aria-label="Prévia de registros válidos; tabela rolável horizontalmente">
                      <table>
                        <caption className="visually-hidden">
                          Registros válidos — primeiras {previewRows.length} linhas{hasSensitiveMapped && !showSensitive ? "; dados sensíveis ocultos" : ""}
                        </caption>
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
                    <h4>Registros para corrigir <span>{formatCount(analysis.invalidCount)}</span></h4>
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
          {source && <button className="text-button" type="button" onClick={resetImport} aria-disabled={busy || undefined}>Limpar e começar novamente</button>}
        </div>
      </section>

      <div className="page-footnote">
        <span className="footnote-line" aria-hidden="true" />
        <p>Importação com conferência antes de qualquer decisão.</p>
        <span className="footnote-mark" aria-hidden="true">CC / 01</span>
      </div>
      <p className="visually-hidden" role="status" aria-live="polite">{announcement}</p>
    </div>
  );
}
