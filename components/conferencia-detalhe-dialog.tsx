"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { CircleCheck, Loader2, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ExportButtons from "@/components/export-buttons";
import { formatMoney } from "@/components/data-table";
import { tabelaDetalheFuncao } from "@/lib/export-funcionarios";
import { MSG_FALHA_SALVAR, validarValor } from "@/lib/folha/ajustes";
import type { FuncaoConferida, PendenciaFuncao } from "@/lib/folha/conciliacao";

type Props = {
  /** Função aberta; null mantém o diálogo fechado. */
  funcao: FuncaoConferida | null;
  /** Elemento (o selo clicado) que recebe o foco ao fechar. */
  retorno: HTMLElement | null;
  onClose: () => void;
  /** Administrador (ou modo local): mostra "Alterar valor". */
  podeAlterar: boolean;
  /** Grava o novo valor (centavos) para uma ou várias pessoas, tudo ou nada; rejeita com Error de mensagem pt-BR. */
  onSalvarValor: (pessoas: PendenciaFuncao[], centavos: number) => Promise<void>;
};

const reais = (centavos: number | null) => (centavos === null ? "—" : formatMoney(centavos / 100));
const valorEditavel = (centavos: number | null) =>
  centavos === null ? "" : (centavos / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dataBr = (iso: string) => {
  const data = new Date(iso);
  return Number.isNaN(data.getTime()) ? "" : data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};

function SeloAjuste({ pessoa }: { pessoa: PendenciaFuncao }) {
  if (!pessoa.ajuste) return null;
  const quando = dataBr(pessoa.ajuste.alteradoEm);
  const quem = pessoa.ajuste.alteradoPorNome;
  return (
    <span className="flex flex-col items-start gap-1">
      <Badge variant="secondary">Ajustado no sistema</Badge>
      <span className="text-xs text-muted-foreground">
        {quem ? `Por ${quem}` : "Alterado"}
        {quando ? ` em ${quando}` : ""}
      </span>
    </span>
  );
}

function AlterarValorBotao({ pessoa, onAbrir }: { pessoa: PendenciaFuncao; onAbrir: (pessoa: PendenciaFuncao, gatilho: HTMLElement) => void }) {
  return (
    <Button type="button" size="sm" variant="outline" aria-label={`Alterar valor de ${pessoa.servidor}`} onClick={(event) => onAbrir(pessoa, event.currentTarget)}>
      <Pencil aria-hidden="true" />
      Alterar valor
    </Button>
  );
}

type Alcance = "uma" | "todas";

type FormProps = {
  pessoa: PendenciaFuncao;
  /** Total de pessoas da função (alcance "todas"). */
  total: number;
  onSalvar: (centavos: number, alcance: Alcance) => Promise<void>;
  onCancelar: () => void;
};

/** Formulário de um valor (V1–V3): erro ligado ao campo; acima de R$ 100.000,00 pede para salvar de novo o mesmo valor. */
function AlterarValorForm({ pessoa, total, onSalvar, onCancelar }: FormProps) {
  const campoId = useId();
  const erroId = useId();
  const tituloId = useId();
  const campoRef = useRef<HTMLInputElement>(null);
  const [texto, setTexto] = useState(() => valorEditavel(pessoa.valorInformado));
  const [erro, setErro] = useState("");
  const [confirmar, setConfirmar] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [alcance, setAlcance] = useState<Alcance>("uma");
  const alcanceNome = useId();

  useEffect(() => {
    campoRef.current?.focus();
    campoRef.current?.scrollIntoView({ block: "nearest" });
  }, []);

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (salvando) return;
    const resultado = validarValor(texto, confirmar);
    if (!resultado.ok) {
      setErro(resultado.mensagem);
      setConfirmar(resultado.confirmar ?? null);
      campoRef.current?.focus();
      return;
    }
    setSalvando(true);
    setErro("");
    try {
      await onSalvar(resultado.centavos, alcance);
    } catch (caught) {
      setErro(caught instanceof Error && caught.message ? caught.message : MSG_FALHA_SALVAR);
      setSalvando(false);
      campoRef.current?.focus();
    }
  }

  return (
    <form noValidate onSubmit={(event) => void enviar(event)} aria-labelledby={tituloId} className="flex flex-col gap-3 rounded-lg border bg-muted/40 p-4">
      <h3 id={tituloId} className="text-sm font-semibold break-words">Alterar valor: {pessoa.servidor}</h3>
      <p className="text-sm text-muted-foreground tabular-nums">
        Referência: {reais(pessoa.valorReferencia)} · Informado: {reais(pessoa.valorInformado)}. Vale até a próxima importação do Cadastro funcional.
      </p>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={campoId} className="text-sm font-medium">Remuneração (R$)</label>
        <Input
          ref={campoRef}
          id={campoId}
          inputMode="decimal"
          autoComplete="off"
          placeholder="1.850,00"
          className="sm:max-w-60"
          value={texto}
          onChange={(event) => {
            setTexto(event.target.value);
            setConfirmar(null);
          }}
          aria-invalid={erro ? true : undefined}
          aria-describedby={erro ? erroId : undefined}
          disabled={salvando}
        />
        {erro && (
          <p id={erroId} className="text-sm text-destructive" role="alert">
            {erro}
          </p>
        )}
      </div>
      {total > 1 && (
        <fieldset className="flex flex-col gap-2" disabled={salvando}>
          <legend className="mb-1 text-sm font-medium">Aplicar a</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name={alcanceNome} className="size-4 accent-primary" checked={alcance === "uma"} onChange={() => setAlcance("uma")} />
            Somente esta pessoa
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name={alcanceNome} className="size-4 accent-primary" checked={alcance === "todas"} onChange={() => setAlcance("todas")} />
            Todas as {total.toLocaleString("pt-BR")} pessoas da função
          </label>
        </fieldset>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={salvando}>
          {salvando && <Loader2 className="animate-spin" aria-hidden="true" />}
          {salvando ? "Salvando…" : "Salvar"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancelar} disabled={salvando}>Cancelar</Button>
      </div>
    </form>
  );
}

/** Detalhe da função: todas as pessoas (pendentes primeiro) com o motivo; administradores alteram o valor de uma ou de todas (R7). */
export default function ConferenciaDetalheDialog({ funcao, retorno, onClose, podeAlterar, onSalvarValor }: Props) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const pessoas = funcao?.todas ?? [];
  const atencao = funcao?.pendentes.length ?? 0;
  const [editando, setEditando] = useState<number | null>(null);
  // Mantido depois de fechar o formulário: o foco volta para o botão "Alterar valor" que o abriu.
  const [gatilhoEdicao, setGatilhoEdicao] = useState<HTMLElement | null>(null);
  const [mensagem, setMensagem] = useState("");
  const pessoaEditada = pessoas.find((pessoa) => pessoa.posicao === editando) ?? null;

  function abrirEdicao(pessoa: PendenciaFuncao, gatilho: HTMLElement) {
    setGatilhoEdicao(gatilho);
    setEditando(pessoa.posicao);
    setMensagem("");
  }

  function devolverFoco() {
    requestAnimationFrame(() => {
      if (gatilhoEdicao?.isConnected) gatilhoEdicao.focus();
      else titleRef.current?.focus();
    });
  }

  async function salvar(pessoa: PendenciaFuncao, centavos: number, alcance: Alcance) {
    const alvo = alcance === "todas" ? pessoas : [pessoa];
    await onSalvarValor(alvo, centavos);
    setEditando(null);
    setMensagem(alvo.length > 1 ? `Remuneração atualizada para ${alvo.length.toLocaleString("pt-BR")} pessoas.` : "Remuneração atualizada.");
    devolverFoco();
  }

  return (
    <Dialog
      open={funcao !== null}
      onOpenChange={(open) => {
        if (open) return;
        setEditando(null);
        setMensagem("");
        onClose();
      }}
    >
      <DialogContent
        className="max-h-dvh overflow-y-auto max-md:top-0 max-md:left-0 max-md:h-dvh max-md:w-full max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none md:max-w-240"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          titleRef.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          retorno?.focus();
        }}
      >
        {funcao && (
          <>
            <DialogHeader>
              <DialogTitle ref={titleRef} tabIndex={-1} className="text-xl break-words outline-none">
                {funcao.funcao}
              </DialogTitle>
              <DialogDescription>
                {pessoas.length === 1 ? "1 pessoa" : `${pessoas.length.toLocaleString("pt-BR")} pessoas`} · {atencao === 1 ? "1 precisa de atenção" : `${atencao.toLocaleString("pt-BR")} precisam de atenção`} · {funcao.origem}
              </DialogDescription>
            </DialogHeader>

            <p className="flex items-center gap-2 text-sm font-medium text-success empty:hidden" role="status">
              {mensagem && (
                <>
                  <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
                  {mensagem}
                </>
              )}
            </p>

            {pessoas.length === 0 ? (
              <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma pessoa nesta função.</p>
            ) : (
              <>
                <div className="hidden max-h-96 overflow-auto rounded-lg border md:block" tabIndex={0} role="region" aria-label={`Pessoas da função ${funcao.funcao}`}>
                  <Table>
                    <caption className="sr-only">Pessoas da função, com o motivo da situação</caption>
                    <TableHeader className="sticky top-0 bg-muted/95">
                      <TableRow className="hover:bg-transparent">
                        <TableHead scope="col">Servidor</TableHead>
                        <TableHead scope="col">Empresa/Secretaria</TableHead>
                        <TableHead scope="col" className="text-right">Valor de referência</TableHead>
                        <TableHead scope="col" className="text-right">Valor informado</TableHead>
                        <TableHead scope="col">Motivo</TableHead>
                        {podeAlterar && <TableHead scope="col"><span className="sr-only">Ações</span></TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pessoas.map((pessoa) => (
                        <TableRow key={pessoa.posicao}>
                          <TableCell className="whitespace-normal">{pessoa.servidor}</TableCell>
                          <TableCell className="whitespace-normal">{pessoa.empresa}</TableCell>
                          <TableCell className="text-right whitespace-nowrap tabular-nums">{reais(pessoa.valorReferencia)}</TableCell>
                          <TableCell className="text-right whitespace-nowrap tabular-nums">{reais(pessoa.valorInformado)}</TableCell>
                          <TableCell className="whitespace-normal">
                            <span className="flex flex-col items-start gap-1">
                              {pessoa.motivo}
                              <SeloAjuste pessoa={pessoa} />
                            </span>
                          </TableCell>
                          {podeAlterar && (
                            <TableCell>
                              <AlterarValorBotao pessoa={pessoa} onAbrir={abrirEdicao} />
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <ul className="flex flex-col gap-2 md:hidden" aria-label={`Pessoas da função ${funcao.funcao}`}>
                  {pessoas.map((pessoa) => (
                    <li key={pessoa.posicao} className="flex flex-col gap-1 rounded-lg border bg-card p-3 text-sm">
                      <span className="font-medium">{pessoa.servidor}</span>
                      <span className="text-muted-foreground">{pessoa.empresa}</span>
                      <span className="tabular-nums">Referência: {reais(pessoa.valorReferencia)}</span>
                      <span className="tabular-nums">Informado: {reais(pessoa.valorInformado)}</span>
                      <span className="font-medium">{pessoa.motivo}</span>
                      <SeloAjuste pessoa={pessoa} />
                      {podeAlterar && (
                        <span className="pt-1">
                          <AlterarValorBotao pessoa={pessoa} onAbrir={abrirEdicao} />
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {podeAlterar && pessoaEditada && (
              <AlterarValorForm
                key={pessoaEditada.posicao}
                pessoa={pessoaEditada}
                total={pessoas.length}
                onSalvar={(centavos, alcance) => salvar(pessoaEditada, centavos, alcance)}
                onCancelar={() => {
                  setEditando(null);
                  devolverFoco();
                }}
              />
            )}

            <DialogFooter className="items-start sm:items-center sm:justify-between">
              <ExportButtons montar={() => tabelaDetalheFuncao(funcao)} nomeArquivo="detalhe-funcao" disabled={pessoas.length === 0} />
              <DialogClose asChild>
                <Button type="button" variant="outline">Fechar</Button>
              </DialogClose>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
