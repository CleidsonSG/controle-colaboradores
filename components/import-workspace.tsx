"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from "react";
import { BadgeDollarSign, Check, CircleAlert, CircleCheck, FileSpreadsheet, FileText, Info, Loader2, ShieldCheck, Trash2, TriangleAlert, Upload } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/components/auth-gate";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { detectKind, importFile, ImportFileError } from "@/lib/import";
import type { AnyImportResult, AnyStoredDataset, CargoSalario, ColaboradorPlanilha, ImportKind } from "@/lib/import";
import { garantirConciliacao } from "@/lib/folha/conciliacao";
import { getDataStore, storageMode } from "@/lib/storage";

type AnyResult = AnyImportResult;

type Slot =
  | { status: "empty" }
  | { status: "reading"; fileName: string }
  | { status: "ready"; result: AnyResult }
  | { status: "error"; fileName: string; message: string };

type ExistingInfo = { importedAt: string; count: number } | null;

const KINDS: ImportKind[] = ["ecidade", "planilha", "salarial"];
const CARD: Record<ImportKind, { title: string; hint: string; accept: string; types: string }> = {
  ecidade: {
    title: "Relatório do e-Cidade",
    hint: "Relatório de funcionários admitidos (ou geral) exportado do e-Cidade. Vai para o Painel de Cargos, que conta só os comissionados (marca 282/16): Descrição do cargo = função e Nome = servidor.",
    accept: ".csv",
    types: ".csv",
  },
  planilha: {
    title: "Cadastro funcional",
    hint: "Planilha Excel com as abas CADASTRO_COM (comissionados) e CADASTRO_TER (terceirizados); a aba DADOS é ignorada. Vai para a tela Funcionários.",
    accept: ".xlsx,.xlsm",
    types: ".xlsx ou .xlsm",
  },
  salarial: {
    title: "Tabela salarial",
    hint: "Excel com as abas Comissionado (Cargo e Salário) e Terceirizado (Função e Remuneração). A aba Comissionado vai para o Painel de Cargos e o Orçamento; a aba Terceirizado serve à conferência na tela Funcionários.",
    accept: ".csv,.xlsx,.xlsm",
    types: ".csv, .xlsx ou .xlsm",
  },
};
const STEPS = ["Selecionar arquivos", "Conferir resumo", "Importar"] as const;
const WARNING_LABEL: Record<string, string> = {
  "linha-ignorada": "Linhas ignoradas",
  "data-invalida": "Datas inválidas",
  duplicidade: "Duplicidades",
  "valor-invalido": "Valores inválidos",
  "formula-sem-valor": "Fórmulas sem valor calculado",
  relatorio: "Relatório inesperado",
  "nao-comissionado": "Fora da contagem do Painel",
  "valores-divergentes": "Valores diferentes",
  "sem-valor": "Funções sem valor",
};

/** Mensagens que falam do arquivo todo (ou de registros) não mostram "N linhas". */
function warningCount(code: string, count: number): string {
  if (code === "relatorio") return "";
  const unit = code === "nao-comissionado" ? ["registro", "registros"] : code === "sem-valor" ? ["função", "funções"] : ["linha", "linhas"];
  return `(${formatCount(count)} ${count === 1 ? unit[0] : unit[1]})`;
}

const EMPTY_SLOTS: Record<ImportKind, Slot> = { ecidade: { status: "empty" }, planilha: { status: "empty" }, salarial: { status: "empty" } };
const NO_EXISTING: Record<ImportKind, ExistingInfo> = { ecidade: null, planilha: null, salarial: null };

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
  description,
  confirmLabel,
  destructive,
  busy,
  onConfirm,
  onCancel,
  children,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  children?: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next && !busy) onCancel(); }}>
      <DialogContent onEscapeKeyDown={(event) => { if (busy) event.preventDefault(); }} onInteractOutside={(event) => { if (busy) event.preventDefault(); }}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children && <div className="text-sm">{children}</div>}
        <DialogFooter>
          <Button variant="outline" type="button" onClick={onCancel} disabled={busy} autoFocus>Cancelar</Button>
          <Button variant={destructive ? "destructive" : "default"} type="button" onClick={onConfirm} disabled={busy}>
            {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReadySummary({ result }: { result: AnyResult }) {
  const total = result.records.length;
  const grouped = result.warnings.map((warning, index) => ({
    key: `${warning.code}-${index}`,
    code: warning.code,
    label: WARNING_LABEL[warning.code] ?? "Aviso",
    count: warning.rows.length,
    message: warning.message,
  }));
  return (
    <div className="flex flex-col gap-4 border-t pt-4">
      <p className="flex items-baseline gap-2">
        <strong className="text-3xl font-semibold tracking-tight tabular-nums">{formatCount(total)}</strong>
        <span className="text-sm text-muted-foreground">{total === 1 ? "registro encontrado" : "registros encontrados"}</span>
      </p>
      {result.countsBySheet.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Registros por aba">
          {result.countsBySheet.map((item) => (
            <li key={item.sheet}>
              <Badge variant="secondary" className="py-1 text-[0.8rem]">
                <span className="font-semibold">{item.sheet}</span>
                {item.origem ? ` (${item.origem})` : ""}: <span className="tabular-nums">{formatCount(item.count)}</span>
              </Badge>
            </li>
          ))}
        </ul>
      )}
      {grouped.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium">Avisos ({formatCount(grouped.length)})</p>
          <ul className="flex flex-col gap-2">
            {grouped.map((item) => (
              <li key={item.key} className="flex gap-2.5 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm">
                <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
                <span>
                  <strong className="font-medium">{item.label}:</strong> {item.message}{" "}
                  <span className="text-muted-foreground tabular-nums">{warningCount(item.code, item.count)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-success">
          <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
          <span>Todas as linhas foram lidas sem avisos.</span>
        </p>
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
  const Icon = kind === "ecidade" ? FileText : kind === "salarial" ? BadgeDollarSign : FileSpreadsheet;

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length) onFiles(files);
  }

  const when = existing ? formatWhen(existing.importedAt) : "";

  return (
    <Card aria-labelledby={`card-${kind}`} role="region">
      <CardHeader className="grid-cols-[auto_1fr] gap-x-4">
        <span className="row-span-2 grid size-11 place-items-center rounded-md bg-secondary text-secondary-foreground" aria-hidden="true">
          <Icon className="size-5" />
        </span>
        <CardTitle id={`card-${kind}`} role="heading" aria-level={2}>{info.title}</CardTitle>
        <CardDescription>{info.hint} Aceita {info.types}.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {existing && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Check className="size-4 shrink-0 text-success" aria-hidden="true" />
            <span>
              Já importado{when ? ` em ${when}` : ""}: <span className="font-medium text-foreground tabular-nums">{formatCount(existing.count)}</span> registros
            </span>
          </p>
        )}

        <div
          className={cn(
            "flex flex-col items-center gap-4 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors",
            dragging ? "border-primary bg-secondary" : "border-input bg-muted/40",
            slot.status === "ready" && !dragging && "border-solid border-success/40 bg-success/5",
            slot.status === "error" && !dragging && "border-destructive/50 bg-destructive/5",
          )}
        >
          {reading ? (
            <p className="flex items-center gap-2 text-sm" role="status">
              <Loader2 className="size-4 animate-spin text-primary" aria-hidden="true" />
              Lendo {slot.fileName}…
            </p>
          ) : (
            <div className="flex flex-col items-center gap-1">
              {slot.status === "ready" ? (
                <CircleCheck className="mb-1 size-6 text-success" aria-hidden="true" />
              ) : (
                <Upload className="mb-1 size-6 text-muted-foreground" aria-hidden="true" />
              )}
              <strong className="font-medium break-all">{slot.status === "ready" ? slot.result.fileName : "Arraste o arquivo para cá"}</strong>
              <p className="text-sm text-muted-foreground">
                {slot.status === "ready" ? "Pronto para importar. Arraste outro arquivo para trocar." : "ou selecione no computador (até 25 MB)"}
              </p>
            </div>
          )}
          <input
            ref={inputRef}
            className="sr-only"
            id={`arquivo-${kind}`}
            type="file"
            accept={info.accept}
            multiple
            onChange={onChange}
            disabled={disabled || reading}
            aria-label={`Selecionar arquivo: ${info.title}`}
            tabIndex={-1}
          />
          <Button variant="outline" type="button" onClick={() => inputRef.current?.click()} disabled={disabled || reading}>
            {slot.status === "ready" ? "Trocar arquivo" : "Selecionar arquivo"}
          </Button>
        </div>

        {slot.status === "error" && (
          <Alert variant="destructive" role="alert">
            <CircleAlert aria-hidden="true" />
            <AlertTitle className="break-all">{slot.fileName}</AlertTitle>
            <AlertDescription>{slot.message}</AlertDescription>
          </Alert>
        )}
        {slot.status === "ready" && <ReadySummary result={slot.result} />}
      </CardContent>
    </Card>
  );
}

export default function ImportWorkspace() {
  const { isAdmin } = useAuth();
  // Com Supabase, só administradores importam/limpam (o banco também bloqueia). Sem Supabase, tudo liberado.
  const somenteLeitura = isSupabaseConfigured() && !isAdmin;
  const [slots, setSlots] = useState<Record<ImportKind, Slot>>(EMPTY_SLOTS);
  const [existing, setExisting] = useState<Record<ImportKind, ExistingInfo>>(NO_EXISTING);
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
  const tokens = useRef<Record<ImportKind, number>>({ ecidade: 0, planilha: 0, salarial: 0 });
  const successRef = useRef<HTMLHeadingElement>(null);

  const readyKinds = KINDS.filter((kind) => slots[kind].status === "ready");
  const anyReading = KINDS.some((kind) => slots[kind].status === "reading");
  const replaceKinds = readyKinds.filter((kind) => existing[kind]);
  // 1ª importação (nada gravado, inclusive depois de "Limpar dados importados"): os três tipos são obrigatórios.
  // Depois, cada tipo pode ser reimportado sozinho. Vale por tipo: o que não está gravado precisa vir agora.
  const firstImport = KINDS.every((kind) => !existing[kind]);
  const missingKinds = KINDS.filter((kind) => !existing[kind] && slots[kind].status !== "ready");
  const canImport = readyKinds.length > 0 && missingKinds.length === 0;
  const step = done || saving || replaceOpen ? 3 : readyKinds.length > 0 ? 2 : 1;

  async function refreshExisting() {
    try {
      const store = getDataStore();
      const [ecidade, planilha, salarial] = await Promise.all([store.load("ecidade"), store.load("planilha"), store.load("salarial")]);
      const info = (dataset: AnyStoredDataset | null): ExistingInfo => (dataset ? { importedAt: dataset.importedAt, count: dataset.records.length } : null);
      setExisting({ ecidade: info(ecidade), planilha: info(planilha), salarial: info(salarial) });
      setStorageError("");
    } catch {
      setStorageError(storageMode() === "supabase" ? "Não foi possível acessar o Supabase. Verifique a conexão e o script supabase/schema.sql." : "Não foi possível acessar o armazenamento deste navegador. A importação pode não funcionar.");
    }
  }

  useEffect(() => {
    void refreshExisting();
  }, []);

  useEffect(() => {
    if (done) successRef.current?.focus();
  }, [done]);

  // Lê o arquivo mostrando o progresso no cartão provável; o resultado vai para o cartão do tipo reconhecido
  // (um .csv com Cargo e Salário, por exemplo, é tabela salarial, não relatório do e-Cidade).
  async function readFile(file: File, guess: ImportKind, forced?: ImportKind) {
    const token = ++tokens.current[guess];
    setSlots((current) => ({ ...current, [guess]: { status: "reading", fileName: file.name } }));
    try {
      const result = await importFile(file, forced);
      if (tokens.current[guess] !== token) return;
      if (result.kind === guess) {
        setSlots((current) => ({ ...current, [guess]: { status: "ready", result } }));
        return;
      }
      tokens.current[result.kind] += 1;
      setSlots((current) => ({ ...current, [guess]: { status: "empty" }, [result.kind]: { status: "ready", result } }));
      setRouteNote((current) => `${current ? `${current} ` : ""}“${file.name}” foi reconhecido como ${CARD[result.kind].title} e enviado para esse cartão.`);
    } catch (caught) {
      if (tokens.current[guess] !== token) return;
      setSlots((current) => ({ ...current, [guess]: { status: "error", fileName: file.name, message: getErrorMessage(caught) } }));
    }
  }

  /** origin = cartão de onde veio a seleção; o cartão da tabela salarial força esse tipo. */
  function handleFiles(files: File[], origin?: ImportKind) {
    if (files.length === 0 || somenteLeitura) return;
    setDone(null);
    setNotice("");
    setGlobalError("");
    setRouteNote("");
    const invalid: string[] = [];
    for (const file of files) {
      const byExtension = detectKind(file.name);
      if (!byExtension) {
        invalid.push(file.name);
        continue;
      }
      if (origin === "salarial") void readFile(file, "salarial", "salarial");
      else void readFile(file, byExtension);
    }
    if (invalid.length > 0) {
      setGlobalError(
        `${invalid.length === 1 ? `O arquivo “${invalid[0]}” não foi aceito` : `Estes arquivos não foram aceitos: ${invalid.join(", ")}`}. Envie arquivos .csv, .xlsx ou .xlsm de até 25 MB.`,
      );
    }
  }

  function onCardFiles(origin: ImportKind, files: File[]) {
    handleFiles(files, origin);
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
      const counts: Record<ImportKind, number> = { ecidade: 0, planilha: 0, salarial: 0 };
      const saved: ImportKind[] = [];
      const novaTabela = slots.salarial.status === "ready" ? (slots.salarial.result.records as CargoSalario[]) : null;
      for (const kind of readyKinds) {
        const slot = slots[kind];
        if (slot.status !== "ready") continue;
        let result = slot.result;
        if (kind === "planilha") {
          // A conferência com a tabela salarial é feita aqui, na importação (a planilha da empresa prevalece; só se acrescentam campos).
          const tabela = novaTabela ?? (await store.load("salarial"))?.records ?? null;
          result = { ...slot.result, records: garantirConciliacao(slot.result.records as ColaboradorPlanilha[], tabela) } as AnyImportResult;
        }
        const stored = { ...result, schemaVersion: 1 as const, importedAt: new Date().toISOString() };
        await store.replace(kind, stored as AnyStoredDataset);
        counts[kind] = slot.result.records.length;
        saved.push(kind);
      }
      if (novaTabela && !saved.includes("planilha")) {
        const planilha = await store.load("planilha");
        if (planilha) await store.replace("planilha", { ...planilha, records: garantirConciliacao(planilha.records, novaTabela) });
      }
      tokens.current = { ecidade: tokens.current.ecidade + 1, planilha: tokens.current.planilha + 1, salarial: tokens.current.salarial + 1 };
      setSlots(EMPTY_SLOTS);
      setRouteNote("");
      setReplaceOpen(false);
      setDone({ kinds: saved, counts });
      await refreshExisting();
    } catch {
      setReplaceOpen(false);
      setGlobalError(storageMode() === "supabase" ? "Não foi possível gravar os dados no Supabase. Verifique a conexão e tente novamente." : "Não foi possível gravar os dados neste navegador. Verifique se o armazenamento local está liberado e tente novamente.");
    } finally {
      setSaving(false);
    }
  }

  function onImportClick() {
    if (!canImport) return;
    if (replaceKinds.length > 0) setReplaceOpen(true);
    else void save();
  }

  async function onClear() {
    setClearing(true);
    try {
      await getDataStore().clear();
      setNotice("Os dados importados foram removidos.");
      setDone(null);
      setExisting(NO_EXISTING);
      setClearOpen(false);
    } catch {
      setClearOpen(false);
      setGlobalError("Não foi possível limpar os dados importados.");
    } finally {
      setClearing(false);
    }
  }

  // Destino do botão: só o Cadastro funcional vai para Funcionários; e-Cidade e Tabela salarial alimentam o Painel de Cargos.
  const target = done?.kinds.includes("planilha") && !done.kinds.includes("ecidade") && !done.kinds.includes("salarial") ? "/employees/" : "/";
  const targetLabel = target === "/" ? "Ver painel de cargos" : "Ver em Funcionários";

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex max-w-2xl flex-col gap-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Importar arquivos</h1>
          <p className="text-muted-foreground">
            Cada arquivo alimenta uma parte do sistema: o relatório do e-Cidade (CSV) vai para o Painel de Cargos; o Cadastro funcional (planilha Excel) vai para Funcionários; a Tabela salarial vai para o Painel de Cargos e o Orçamento (aba Comissionado) e para a conferência dos terceirizados (aba Terceirizado).
            Pode soltar todos de uma vez: o tipo é reconhecido pelo conteúdo.
            Na primeira importação os três são obrigatórios; depois, cada um pode ser reimportado sozinho.
            Depois da importação, o painel de cargos é calculado automaticamente.
          </p>
        </div>
        <div className="flex max-w-sm items-start gap-3 rounded-lg border bg-card px-4 py-3 text-sm" role="note" aria-label="Privacidade">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <p className="text-muted-foreground">
            <strong className="font-medium text-foreground">Privacidade.</strong>{" "}
            {storageMode() === "supabase"
              ? "Os dados são gravados no Supabase e só usuários com login conseguem ver."
              : "Os dados ficam apenas neste navegador e não são enviados a nenhum servidor."}
          </p>
        </div>
      </header>

      {somenteLeitura && (
        <Alert variant="info" role="status">
          <Info aria-hidden="true" />
          <AlertDescription className="text-foreground">Somente administradores podem importar ou alterar dados.</AlertDescription>
        </Alert>
      )}

      <ol className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-0" aria-label="Etapas da importação">
        {STEPS.map((label, index) => {
          const number = index + 1;
          const isActive = step === number;
          const isDone = step > number;
          return (
            <li
              key={label}
              className={cn("flex items-center gap-2.5 text-sm sm:flex-1", isActive ? "font-medium text-foreground" : "text-muted-foreground")}
              aria-current={isActive ? "step" : undefined}
            >
              <span
                className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold tabular-nums",
                  isActive && "border-primary bg-primary text-primary-foreground",
                  isDone && "border-success bg-success/10 text-success",
                )}
                aria-hidden="true"
              >
                {isDone ? <Check className="size-3.5" strokeWidth={3} /> : number}
              </span>
              <span>{label}{isDone && <span className="sr-only"> (concluída)</span>}</span>
              {index < STEPS.length - 1 && <span className="mx-4 hidden h-px flex-1 bg-border sm:block" aria-hidden="true" />}
            </li>
          );
        })}
      </ol>

      <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3" onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
        {KINDS.map((kind) => (
          <ImportCard
            key={kind}
            kind={kind}
            slot={slots[kind]}
            existing={existing[kind]}
            dragging={dragging}
            disabled={saving || somenteLeitura}
            onFiles={(files) => onCardFiles(kind, files)}
          />
        ))}
      </div>

      <div className="flex flex-col gap-3 empty:hidden">
        {routeNote && (
          <Alert variant="info" role="status">
            <Info aria-hidden="true" />
            <AlertDescription className="text-foreground">{routeNote}</AlertDescription>
          </Alert>
        )}
        {globalError && (
          <Alert variant="destructive" role="alert">
            <CircleAlert aria-hidden="true" />
            <AlertDescription className="text-foreground">{globalError}</AlertDescription>
          </Alert>
        )}
        {storageError && (
          <Alert variant="destructive" role="alert">
            <CircleAlert aria-hidden="true" />
            <AlertDescription className="text-foreground">{storageError}</AlertDescription>
          </Alert>
        )}
        {notice && (
          <Alert role="status">
            <Info aria-hidden="true" />
            <AlertDescription className="text-foreground">{notice}</AlertDescription>
          </Alert>
        )}
        {done && (
          <Alert variant="success" role="status">
            <CircleCheck aria-hidden="true" />
            <AlertTitle>
              <h2 className="outline-none" tabIndex={-1} ref={successRef}>Importação concluída</h2>
            </AlertTitle>
            <AlertDescription>
              <p>{done.kinds.map((kind) => `${CARD[kind].title}: ${formatCount(done.counts[kind])} registros`).join("; ")}.</p>
              <div className="pt-2">
                <Button asChild size="sm">
                  <Link href={target}>{targetLabel}</Link>
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <p className="text-sm text-muted-foreground">
          {missingKinds.length > 0
            ? `${firstImport ? "Primeira importação: envie os três arquivos." : "Ainda não há dados de todos os tipos."} Falta${missingKinds.length > 1 ? "m" : ""}: ${missingKinds.map((kind) => CARD[kind].title).join(", ")}.`
            : readyKinds.length === 0
              ? "Selecione um ou mais arquivos para reimportar. Cada tipo pode ser importado sozinho."
              : `${readyKinds.length === 1 ? "1 arquivo pronto" : `${readyKinds.length} arquivos prontos`}. Ao importar, os registros são gravados${storageMode() === "supabase" ? " no Supabase" : " neste navegador"}.`}
        </p>
        <Button size="lg" type="button" onClick={onImportClick} disabled={somenteLeitura || !canImport || saving || anyReading}>
          {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
          Importar arquivos
        </Button>
      </div>

      <div className="flex flex-col gap-2 border-t pt-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>Esta tela mostra só o resumo da importação, sem dados de pessoas.</p>
        <Button variant="ghost" className="self-start text-destructive hover:bg-destructive/10 hover:text-destructive sm:self-auto" type="button" disabled={somenteLeitura} onClick={() => setClearOpen(true)}>
          <Trash2 aria-hidden="true" />
          Limpar dados importados
        </Button>
      </div>

      <ConfirmDialog
        open={replaceOpen}
        title="Substituir dados existentes?"
        description="Já existem dados importados destes tipos. Eles serão substituídos pelo conteúdo dos novos arquivos."
        confirmLabel="Substituir e importar"
        busy={saving}
        onCancel={() => setReplaceOpen(false)}
        onConfirm={() => void save()}
      >
        <ul className="list-disc pl-5">
          {replaceKinds.map((kind) => (
            <li key={kind}>{CARD[kind].title}</li>
          ))}
        </ul>
      </ConfirmDialog>

      <ConfirmDialog
        open={clearOpen}
        title="Limpar dados importados?"
        description="Os três tipos de dados (relatório do e-Cidade, Cadastro funcional e Tabela salarial) serão apagados. O teto da folha informado é mantido. Essa ação não pode ser desfeita."
        confirmLabel="Limpar tudo"
        destructive
        busy={clearing}
        onCancel={() => setClearOpen(false)}
        onConfirm={() => void onClear()}
      />
    </div>
  );
}
