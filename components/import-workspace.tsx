"use client";

import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { formatCell, type Column } from "@/components/data-table";
import { ECIDADE_COLUMNS, PLANILHA_COLUMNS } from "@/components/employees-view";
import { detectKind, importFile, ImportFileError } from "@/lib/import";
import type { ColaboradorPlanilha, ImportKind, ImportResult, ServidorECidade, StoredDataset } from "@/lib/import";
import { getDataStore } from "@/lib/storage";

const PREVIEW_LIMIT = 20;
const WORKFLOW_STEPS = ["Arquivo", "Prévia", "Confirmação"] as const;
const KIND_LABEL: Record<ImportKind, string> = {
  ecidade: "Servidores Comissionados (e-Cidade)",
  planilha: "Terceirizados e Comissionados (Planilha)",
};
const WARNING_LABEL: Record<string, string> = {
  "linha-ignorada": "Linhas ignoradas",
  "data-invalida": "Datas inválidas",
  duplicidade: "Duplicidades",
  "valor-invalido": "Valores inválidos",
  "formula-sem-valor": "Fórmulas sem valor calculado",
};

type AnyResult = ImportResult<ServidorECidade> | ImportResult<ColaboradorPlanilha>;

function formatCount(value: number): string {
  return value.toLocaleString("pt-BR");
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ImportFileError) {
    if (error.code === "vazio") return "O arquivo está vazio ou não contém registros para importar.";
    if (error.code === "cabecalho") {
      const missing = error.missingColumns?.length ? ` Colunas não encontradas: ${error.missingColumns.join(", ")}.` : "";
      return `Não encontramos o cabeçalho esperado neste arquivo.${missing}`;
    }
    return error.message;
  }
  return "Não foi possível ler este arquivo. Confira o formato e tente novamente.";
}

function ConfirmDialog({
  open,
  title,
  confirmLabel,
  busy,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean;
  title: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className="confirm-dialog" aria-labelledby="confirm-title" onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}>
      <h2 id="confirm-title">{title}</h2>
      <div className="confirm-body">{children}</div>
      <div className="confirm-actions">
        <button className="button button-outline" type="button" onClick={onCancel} disabled={busy} autoFocus>Cancelar</button>
        <button className="button button-primary" type="button" onClick={onConfirm} disabled={busy}>
          {busy && <span className="spinner spinner-light" aria-hidden="true" />}
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}

function PreviewTable<T>({ columns, rows }: { columns: Column<T>[]; rows: T[] }) {
  return (
    <div className="table-scroll" tabIndex={0} role="region" aria-label="Prévia das primeiras linhas">
      <table className="data-grid">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={column.kind === "money" ? "cell-number" : undefined}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => {
                const text = formatCell(column.kind, column.value(row));
                return (
                  <td key={column.key} className={column.kind === "money" ? "cell-number" : undefined}>
                    {column.render ? column.render(row) : text || <span className="empty-cell">—</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ImportWorkspace() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const summaryRef = useRef<HTMLHeadingElement>(null);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnyResult | null>(null);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [notice, setNotice] = useState("");

  const step = replaceOpen || saving ? 3 : result ? 2 : 1;

  useEffect(() => {
    if (result) summaryRef.current?.focus();
  }, [result]);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setNotice("");
    setResult(null);
    if (!detectKind(file.name)) {
      setError(getErrorMessage(new ImportFileError("formato", "Formato não suportado. Envie um arquivo CSV, XLSX ou XLSM de até 25 MB.")));
      return;
    }
    setLoading(true);
    try {
      setResult(await importFile(file));
    } catch (caught) {
      setError(getErrorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    void handleFile(file);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (loading) return;
    void handleFile(event.dataTransfer.files?.[0]);
  }

  async function save(data: AnyResult) {
    setSaving(true);
    try {
      const stored = { ...data, schemaVersion: 1 as const, importedAt: new Date().toISOString() };
      await getDataStore().replace(data.kind, stored as StoredDataset<ServidorECidade> | StoredDataset<ColaboradorPlanilha>);
      router.push(data.kind === "ecidade" ? "/employees/#ecidade" : "/employees/#planilha");
    } catch {
      setReplaceOpen(false);
      setSaving(false);
      setError("Não foi possível gravar os dados neste navegador. Verifique se o armazenamento local está liberado e tente novamente.");
    }
  }

  async function onConfirmImport() {
    if (!result) return;
    setError("");
    try {
      const existing = result.kind === "ecidade" ? await getDataStore().load("ecidade") : await getDataStore().load("planilha");
      if (existing) {
        setReplaceOpen(true);
        return;
      }
    } catch {
      setError("Não foi possível acessar o armazenamento deste navegador.");
      return;
    }
    await save(result);
  }

  async function onClear() {
    setClearing(true);
    try {
      await getDataStore().clear();
      setNotice("Os dados importados foram removidos deste navegador.");
      setClearOpen(false);
    } catch {
      setClearOpen(false);
      setError("Não foi possível limpar os dados deste navegador.");
    } finally {
      setClearing(false);
    }
  }

  const totalRecords = result?.records.length ?? 0;

  return (
    <div className="import-page">
      <header className="page-intro">
        <div className="page-intro-copy">
          <p className="eyebrow"><span className="eyebrow-index">01</span> Importar Dados</p>
          <h1>Importar <span>dados</span></h1>
          <p className="intro-description">
            Envie o CSV do e-Cidade ou a planilha Excel (XLSX/XLSM). O tipo é reconhecido pela extensão do arquivo.
          </p>
        </div>
        <aside className="privacy-note" aria-label="Privacidade">
          <span className="privacy-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><path d="M12 3.5 5 6v5.5c0 4 2.7 7 7 9 4.3-2 7-5 7-9V6z" /><path d="m9 12 2 2 4-4" /></svg>
          </span>
          <div>
            <strong>Privacidade</strong>
            <p>Os dados ficam apenas neste navegador e não são enviados a nenhum servidor.</p>
          </div>
        </aside>
      </header>

      <div className="workflow-panel">
        <ol className="workflow-steps" aria-label="Etapas da importação">
          {WORKFLOW_STEPS.map((label, index) => (
            <li
              key={label}
              className={`workflow-step${step === index + 1 ? " workflow-step-active" : ""}`}
              aria-current={step === index + 1 ? "step" : undefined}
            >
              <span aria-hidden="true">{index + 1}</span> {label}
            </li>
          ))}
        </ol>

        <div
          className={`drop-zone${dragging ? " drop-zone-active" : ""}${result ? " drop-zone-loaded" : ""}`}
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <span className="file-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><path d="M7 3.5h7l4 4v13H7zM14 3.5v4h4M9.5 13h5M9.5 16.5h5" /></svg>
          </span>
          <div className="drop-copy">
            <strong>{result ? result.fileName : "Arraste o arquivo para cá"}</strong>
            <p>{result ? "Arraste outro arquivo para substituir a prévia." : "ou use o botão ao lado. Aceitamos .csv, .xlsx e .xlsm de até 25 MB."}</p>
          </div>
          <div className="file-select">
            <input ref={inputRef} className="file-input" id="arquivo" type="file" accept=".csv,.xlsx,.xlsm" onChange={onInputChange} disabled={loading} />
            <button className="button button-primary" type="button" onClick={() => inputRef.current?.click()} disabled={loading}>
              Selecionar arquivo
            </button>
          </div>
        </div>

        {loading && (
          <p className="status-message" role="status">
            <span className="spinner" aria-hidden="true" /> Lendo o arquivo… arquivos grandes podem levar alguns segundos.
          </p>
        )}
        {error && (
          <div className="inline-alert" role="alert">
            <span aria-hidden="true">!</span>
            <p>{error}</p>
          </div>
        )}
        {notice && <p className="status-message notice-message" role="status">{notice}</p>}

        {result && (
          <section className="results-section" aria-labelledby="resumo-titulo">
            <div className="result-banner">
              <span className="result-check" aria-hidden="true">✓</span>
              <div>
                <h2 id="resumo-titulo" tabIndex={-1} ref={summaryRef}>Resumo da leitura</h2>
                <p>Confira os dados antes de confirmar. Nada foi gravado ainda.</p>
              </div>
            </div>
            <dl className="summary-grid">
              <div><dt>Tipo detectado</dt><dd>{KIND_LABEL[result.kind]}</dd></div>
              <div><dt>Arquivo</dt><dd className="summary-file">{result.fileName}</dd></div>
              <div><dt>Registros</dt><dd>{formatCount(totalRecords)}</dd></div>
            </dl>
            {result.countsBySheet.length > 1 || result.kind === "planilha" ? (
              <ul className="sheet-counts" aria-label="Registros por aba">
                {result.countsBySheet.map((item) => (
                  <li key={item.sheet}><strong>{item.sheet}</strong>: {formatCount(item.count)} registros</li>
                ))}
              </ul>
            ) : null}

            {result.warnings.length > 0 ? (
              <div className="errors-block">
                <h3>Avisos <span>{result.warnings.length}</span></h3>
                <ul className="record-errors">
                  {result.warnings.map((warning) => (
                    <li key={warning.code + warning.message}>
                      <strong>{WARNING_LABEL[warning.code] ?? "Aviso"}</strong>
                      <span>{warning.message} ({formatCount(warning.rows.length)} {warning.rows.length === 1 ? "linha" : "linhas"})</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="no-warnings">Nenhum aviso: todas as linhas foram lidas sem problemas.</p>
            )}

            <div className="preview-block">
              <div className="preview-heading">
                <h3>Prévia</h3>
                <span>Primeiras {Math.min(PREVIEW_LIMIT, totalRecords)} de {formatCount(totalRecords)} linhas</span>
              </div>
              {totalRecords === 0 ? (
                <p className="empty-result">Nenhum registro encontrado neste arquivo.</p>
              ) : result.kind === "ecidade" ? (
                <PreviewTable columns={ECIDADE_COLUMNS} rows={(result as ImportResult<ServidorECidade>).records.slice(0, PREVIEW_LIMIT)} />
              ) : (
                <PreviewTable columns={PLANILHA_COLUMNS} rows={(result as ImportResult<ColaboradorPlanilha>).records.slice(0, PREVIEW_LIMIT)} />
              )}
            </div>

            <div className="action-row">
              <p>Ao confirmar, os registros deste tipo são gravados neste navegador.</p>
              <button className="button button-primary" type="button" onClick={onConfirmImport} disabled={saving || totalRecords === 0}>
                Confirmar importação
              </button>
            </div>
          </section>
        )}

        <div className="panel-footer">
          <p>Os dados ficam apenas neste navegador e não são enviados a nenhum servidor.</p>
          <button className="text-button" type="button" onClick={() => setClearOpen(true)}>Limpar dados importados</button>
        </div>
      </div>

      <ConfirmDialog
        open={replaceOpen}
        title="Substituir dados existentes?"
        confirmLabel="Substituir e importar"
        busy={saving}
        onCancel={() => setReplaceOpen(false)}
        onConfirm={() => result && void save(result)}
      >
        <p>
          Já existem dados importados de <strong>{result ? KIND_LABEL[result.kind] : ""}</strong> neste navegador. Eles serão substituídos pelo conteúdo de{" "}
          <strong>{result?.fileName}</strong>. O outro tipo de dado não é alterado.
        </p>
      </ConfirmDialog>

      <ConfirmDialog
        open={clearOpen}
        title="Limpar dados importados?"
        confirmLabel="Limpar tudo"
        busy={clearing}
        onCancel={() => setClearOpen(false)}
        onConfirm={() => void onClear()}
      >
        <p>Os dois tipos de dados (e-Cidade e Planilha) serão apagados deste navegador. Essa ação não pode ser desfeita.</p>
      </ConfirmDialog>
    </div>
  );
}
