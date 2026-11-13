"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import { detectKind, importFile, ImportFileError } from "@/lib/import";
import type { ColaboradorPlanilha, ImportKind, ImportResult, ServidorECidade, StoredDataset } from "@/lib/import";
import { getDataStore } from "@/lib/storage";

type AnyResult = ImportResult<ServidorECidade> | ImportResult<ColaboradorPlanilha>;

type Slot =
  | { status: "empty" }
  | { status: "reading"; fileName: string }
  | { status: "ready"; result: AnyResult }
  | { status: "error"; fileName: string; message: string };

type ExistingInfo = { importedAt: string; count: number } | null;

const KINDS: ImportKind[] = ["ecidade", "planilha"];
const CARD: Record<ImportKind, { title: string; hint: string; accept: string; types: string }> = {
  ecidade: {
    title: "Servidores Comissionados (e-Cidade)",
    hint: "Relatório exportado do e-Cidade.",
    accept: ".csv",
    types: ".csv",
  },
  planilha: {
    title: "Terceirizados e Comissionados (Planilha)",
    hint: "Planilha Excel com as abas de terceirizados e comissionados.",
    accept: ".xlsx,.xlsm",
    types: ".xlsx ou .xlsm",
  },
};
const STEPS = ["Selecionar arquivos", "Conferir resumo", "Importar"] as const;
const WARNING_LABEL: Record<string, string> = {
  "linha-ignorada": "Linhas ignoradas",
  "data-invalida": "Datas inválidas",
  duplicidade: "Duplicidades",
  "valor-invalido": "Valores inválidos",
  "formula-sem-valor": "Fórmulas sem valor calculado",
};

const EMPTY_SLOTS: Record<ImportKind, Slot> = { ecidade: { status: "empty" }, planilha: { status: "empty" } };

function formatCount(value: number): string {
  return value.toLocaleString("pt-BR");
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
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
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className="confirm-dialog" aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}>
      <h2 id={titleId}>{title}</h2>
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

function CardIcon({ kind }: { kind: ImportKind }) {
  return (
    <span className="import-card-icon" aria-hidden="true">
      {kind === "ecidade" ? (
        <svg viewBox="0 0 24 24"><path d="M7 3.5h7l4 4v13H7zM14 3.5v4h4M9.5 13h5M9.5 16.5h5" /></svg>
      ) : (
        <svg viewBox="0 0 24 24"><rect x="4" y="4.5" width="16" height="15" rx="2" /><path d="M4 9.5h16M4 14.5h16M10 4.5v15" /></svg>
      )}
    </span>
  );
}

function ReadySummary({ result }: { result: AnyResult }) {
  const total = result.records.length;
  const grouped = result.warnings.map((warning) => ({
    key: warning.code,
    label: WARNING_LABEL[warning.code] ?? "Aviso",
    count: warning.rows.length,
    message: warning.message,
  }));
  return (
    <div className="result-summary">
      <p className="result-total">
        <strong>{formatCount(total)}</strong>
        <span>{total === 1 ? "registro encontrado" : "registros encontrados"}</span>
      </p>
      {result.countsBySheet.length > 0 && (
        <ul className="chip-list" aria-label="Registros por aba">
          {result.countsBySheet.map((item) => (
            <li key={item.sheet}>
              <strong>{item.sheet}</strong>
              {item.origem ? ` (${item.origem})` : ""}: {formatCount(item.count)}
            </li>
          ))}
        </ul>
      )}
      {grouped.length > 0 ? (
        <>
          <p className="warnings-title">Avisos ({formatCount(grouped.length)})</p>
          <ul className="warning-list">
            {grouped.map((item) => (
              <li key={item.key}>
                <strong>{item.label}:</strong>
                <span>{item.message} ({formatCount(item.count)} {item.count === 1 ? "linha" : "linhas"})</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="no-warnings">Nenhum aviso: todas as linhas foram lidas sem problemas.</p>
      )}
    </div>
  );
}

function ImportCard({
  kind,
  slot,
  existing,
  dragging,
  disabled,
  onFiles,
}: {
  kind: ImportKind;
  slot: Slot;
  existing: ExistingInfo;
  dragging: boolean;
  disabled: boolean;
  onFiles: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const info = CARD[kind];
  const reading = slot.status === "reading";

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length) onFiles(files);
  }

  const zoneClass = `drop-zone${dragging ? " drop-zone-active" : ""}${slot.status === "ready" ? " drop-zone-ready" : ""}${slot.status === "error" ? " drop-zone-error" : ""}`;
  const when = existing ? formatWhen(existing.importedAt) : "";

  return (
    <section className="import-card" aria-labelledby={`card-${kind}`}>
      <div className="import-card-head">
        <CardIcon kind={kind} />
        <div>
          <h2 id={`card-${kind}`}>{info.title}</h2>
          <p>{info.hint} Aceita {info.types}.</p>
        </div>
      </div>

      {existing && (
        <p className="already-imported">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
          <span>Já importado{when ? ` em ${when}` : ""} — {formatCount(existing.count)} registros</span>
        </p>
      )}

      <div className={zoneClass}>
        {reading ? (
          <p className="status-message" role="status">
            <span className="spinner" aria-hidden="true" /> Lendo {slot.fileName}…
          </p>
        ) : (
          <div className="drop-copy">
            <strong>{slot.status === "ready" ? slot.result.fileName : "Arraste o arquivo para cá"}</strong>
            <p>{slot.status === "ready" ? "Pronto para importar. Arraste outro arquivo para trocar." : "ou selecione no computador (até 25 MB)"}</p>
          </div>
        )}
        <div className="file-select">
          <input
            ref={inputRef}
            className="file-input"
            id={`arquivo-${kind}`}
            type="file"
            accept={info.accept}
            multiple
            onChange={onChange}
            disabled={disabled || reading}
            aria-label={`Selecionar arquivo: ${info.title}`}
          />
          <button className="button button-outline" type="button" onClick={() => inputRef.current?.click()} disabled={disabled || reading}>
            {slot.status === "ready" ? "Trocar arquivo" : "Selecionar arquivo"}
          </button>
        </div>
      </div>

      {slot.status === "error" && (
        <div className="inline-alert" role="alert">
          <span aria-hidden="true">!</span>
          <p><strong>{slot.fileName}</strong>: {slot.message}</p>
        </div>
      )}
      {slot.status === "ready" && <ReadySummary result={slot.result} />}
    </section>
  );
}

export default function ImportWorkspace() {
  const [slots, setSlots] = useState<Record<ImportKind, Slot>>(EMPTY_SLOTS);
  const [existing, setExisting] = useState<Record<ImportKind, ExistingInfo>>({ ecidade: null, planilha: null });
  const [storageError, setStorageError] = useState("");
  const [routeNote, setRouteNote] = useState("");
  const [globalError, setGlobalError] = useState("");
  const [dragging, setDragging] = useState(false);
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState<{ kinds: ImportKind[]; counts: Record<ImportKind, number> } | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [notice, setNotice] = useState("");
  const tokens = useRef<Record<ImportKind, number>>({ ecidade: 0, planilha: 0 });
  const successRef = useRef<HTMLHeadingElement>(null);

  const readyKinds = KINDS.filter((kind) => slots[kind].status === "ready");
  const anyReading = KINDS.some((kind) => slots[kind].status === "reading");
  const replaceKinds = readyKinds.filter((kind) => existing[kind]);
  const step = done || saving || replaceOpen ? 3 : readyKinds.length > 0 ? 2 : 1;

  async function refreshExisting() {
    try {
      const store = getDataStore();
      const [ecidade, planilha] = await Promise.all([store.load("ecidade"), store.load("planilha")]);
      setExisting({
        ecidade: ecidade ? { importedAt: ecidade.importedAt, count: ecidade.records.length } : null,
        planilha: planilha ? { importedAt: planilha.importedAt, count: planilha.records.length } : null,
      });
      setStorageError("");
    } catch {
      setStorageError("Não foi possível acessar o armazenamento deste navegador. A importação pode não funcionar.");
    }
  }

  useEffect(() => {
    void refreshExisting();
  }, []);

  useEffect(() => {
    if (done) successRef.current?.focus();
  }, [done]);

  async function readInto(kind: ImportKind, file: File) {
    const token = ++tokens.current[kind];
    setSlots((current) => ({ ...current, [kind]: { status: "reading", fileName: file.name } }));
    try {
      const result = await importFile(file);
      if (tokens.current[kind] !== token) return;
      setSlots((current) => ({ ...current, [kind]: { status: "ready", result } }));
    } catch (caught) {
      if (tokens.current[kind] !== token) return;
      setSlots((current) => ({ ...current, [kind]: { status: "error", fileName: file.name, message: getErrorMessage(caught) } }));
    }
  }

  function handleFiles(files: File[]) {
    if (files.length === 0) return;
    setDone(null);
    setNotice("");
    setGlobalError("");
    setRouteNote("");
    const byKind: Partial<Record<ImportKind, File[]>> = {};
    const invalid: string[] = [];
    for (const file of files) {
      const kind = detectKind(file.name);
      if (!kind) invalid.push(file.name);
      else (byKind[kind] ??= []).push(file);
    }
    if (invalid.length > 0) {
      setGlobalError(
        `${invalid.length === 1 ? `O arquivo “${invalid[0]}” não foi aceito` : `Estes arquivos não foram aceitos: ${invalid.join(", ")}`}. Envie um arquivo .csv (e-Cidade) ou .xlsx/.xlsm (Planilha) de até 25 MB.`,
      );
    }
    const notes: string[] = [];
    for (const kind of KINDS) {
      const list = byKind[kind];
      if (!list) continue;
      if (list.length > 1) notes.push(`Foram enviados ${list.length} arquivos de ${CARD[kind].title}; foi usado o último.`);
      void readInto(kind, list[list.length - 1]);
    }
    if (notes.length) setRouteNote(notes.join(" "));
  }

  // Seleção pelo botão de um cartão: se o arquivo for do outro tipo, ele segue para o cartão certo.
  function onCardFiles(origin: ImportKind, files: File[]) {
    const misrouted = files.filter((file) => {
      const kind = detectKind(file.name);
      return kind && kind !== origin;
    });
    handleFiles(files);
    if (misrouted.length > 0) {
      setRouteNote((current) => `${current ? `${current} ` : ""}${misrouted.length === 1 ? `“${misrouted[0].name}” foi` : "Alguns arquivos foram"} encaminhado${misrouted.length === 1 ? "" : "s"} ao cartão do tipo correto.`);
    }
  }

  function onDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(true);
  }

  function onDragLeave(event: DragEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    if (saving) return;
    handleFiles(Array.from(event.dataTransfer.files ?? []));
  }

  async function save() {
    setSaving(true);
    setGlobalError("");
    try {
      const store = getDataStore();
      const counts: Record<ImportKind, number> = { ecidade: 0, planilha: 0 };
      const saved: ImportKind[] = [];
      for (const kind of readyKinds) {
        const slot = slots[kind];
        if (slot.status !== "ready") continue;
        const stored = { ...slot.result, schemaVersion: 1 as const, importedAt: new Date().toISOString() };
        await store.replace(kind, stored as StoredDataset<ServidorECidade> | StoredDataset<ColaboradorPlanilha>);
        counts[kind] = slot.result.records.length;
        saved.push(kind);
      }
      tokens.current = { ecidade: tokens.current.ecidade + 1, planilha: tokens.current.planilha + 1 };
      setSlots(EMPTY_SLOTS);
      setRouteNote("");
      setReplaceOpen(false);
      setDone({ kinds: saved, counts });
      await refreshExisting();
    } catch {
      setReplaceOpen(false);
      setGlobalError("Não foi possível gravar os dados neste navegador. Verifique se o armazenamento local está liberado e tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  function onImportClick() {
    if (replaceKinds.length > 0) setReplaceOpen(true);
    else void save();
  }

  async function onClear() {
    setClearing(true);
    try {
      await getDataStore().clear();
      setNotice("Os dados importados foram removidos deste navegador.");
      setDone(null);
      setExisting({ ecidade: null, planilha: null });
      setClearOpen(false);
    } catch {
      setClearOpen(false);
      setGlobalError("Não foi possível limpar os dados deste navegador.");
    } finally {
      setClearing(false);
    }
  }

  // Destino do botão "Ver em Funcionários": e-Cidade tem prioridade quando os dois foram importados.
  const target = done?.kinds.includes("ecidade") ? "/employees/#ecidade" : "/employees/#planilha";

  return (
    <div className="import-page">
      <header className="page-header">
        <div className="page-header-copy">
          <p className="eyebrow">Importar Dados</p>
          <h1>Importar arquivos</h1>
          <p className="intro-description">
            Envie o CSV do e-Cidade e a planilha Excel. Você pode soltar os dois arquivos de uma vez: o tipo é reconhecido pela extensão.
            Os registros importados são consultados na tela Funcionários.
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

      <ol className="workflow-steps" aria-label="Etapas da importação">
        {STEPS.map((label, index) => {
          const number = index + 1;
          const state = step === number ? " workflow-step-active" : step > number ? " workflow-step-done" : "";
          return (
            <li key={label} className={`workflow-step${state}`} aria-current={step === number ? "step" : undefined}>
              <span aria-hidden="true">{step > number ? "✓" : number}</span> {label}
            </li>
          );
        })}
      </ol>

      <div className="import-grid" onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
        {KINDS.map((kind) => (
          <ImportCard
            key={kind}
            kind={kind}
            slot={slots[kind]}
            existing={existing[kind]}
            dragging={dragging}
            disabled={saving}
            onFiles={(files) => onCardFiles(kind, files)}
          />
        ))}
      </div>

      <div className="import-feedback">
        {routeNote && <p className="status-message" role="status">{routeNote}</p>}
        {globalError && (
          <div className="inline-alert" role="alert">
            <span aria-hidden="true">!</span>
            <p>{globalError}</p>
          </div>
        )}
        {storageError && (
          <div className="inline-alert" role="alert">
            <span aria-hidden="true">!</span>
            <p>{storageError}</p>
          </div>
        )}
        {notice && <p className="status-message notice-message" role="status">{notice}</p>}
        {done && (
          <div className="inline-alert inline-alert-success" role="status">
            <span aria-hidden="true">✓</span>
            <div>
              <h2 className="alert-title" tabIndex={-1} ref={successRef}>Importação concluída</h2>
              <p>
                {done.kinds.map((kind) => `${CARD[kind].title}: ${formatCount(done.counts[kind])} registros`).join(" · ")}.
              </p>
              <div className="success-actions">
                <Link className="button button-primary button-sm" href={target}>Ver em Funcionários</Link>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="import-actions">
        <p>
          {readyKinds.length === 0
            ? "Selecione ao menos um arquivo para habilitar a importação."
            : `${readyKinds.length === 1 ? "1 arquivo pronto" : "2 arquivos prontos"}. Ao importar, os registros são gravados neste navegador.`}
        </p>
        <button className="button button-primary" type="button" onClick={onImportClick} disabled={readyKinds.length === 0 || saving || anyReading}>
          {saving && <span className="spinner spinner-light" aria-hidden="true" />}
          Importar arquivos
        </button>
      </div>

      <div className="panel-footer">
        <p>Nenhum dado de pessoa é exibido nesta tela.</p>
        <button className="text-button" type="button" onClick={() => setClearOpen(true)}>Limpar dados importados</button>
      </div>

      <ConfirmDialog
        open={replaceOpen}
        title="Substituir dados existentes?"
        confirmLabel="Substituir e importar"
        busy={saving}
        onCancel={() => setReplaceOpen(false)}
        onConfirm={() => void save()}
      >
        <p>Já existem dados importados destes tipos neste navegador. Eles serão substituídos pelo conteúdo dos novos arquivos:</p>
        <ul>
          {replaceKinds.map((kind) => (
            <li key={kind}>{CARD[kind].title}</li>
          ))}
        </ul>
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
