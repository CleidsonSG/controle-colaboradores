"use client";

import { useRef } from "react";
import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { calcularHistorico, iniciais, type LinhaHistorico, type RegistroHistorico } from "@/lib/folha/historico";
import type { ColaboradorPlanilha } from "@/lib/import";

type Props = {
  /** Pessoa aberta; null mantém o painel fechado. */
  pessoa: ColaboradorPlanilha | null;
  /** Competência do retrato atual ("aaaa-mm"). */
  competencia: string;
  /** Elemento (o nome clicado) que recebe o foco ao fechar. */
  retorno: HTMLElement | null;
  onClose: () => void;
};

function MudancaTexto({ linha }: { linha: LinhaHistorico }) {
  if (linha.tipo === "inicio" || linha.tipo === "nenhuma") {
    return <span className="text-muted-foreground">{linha.mudanca}</span>;
  }
  return (
    <span className="flex flex-col items-start gap-1">
      <Badge variant="secondary" title={linha.detalhe}>
        {linha.mudanca}
      </Badge>
      <span className="sr-only">{linha.detalhe}</span>
      {linha.nota && <span className="text-xs text-muted-foreground">{linha.nota}</span>}
    </span>
  );
}

function Contador({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1 p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-semibold tracking-tight tabular-nums">{value.toLocaleString("pt-BR")}</dd>
    </div>
  );
}

function Selo({ label, value }: { label: string; value: string }) {
  return (
    <Badge variant="secondary" className="max-w-full rounded-md whitespace-normal">
      <span className="font-normal text-muted-foreground">{label}</span>
      <span>{value}</span>
    </Badge>
  );
}

export default function EmployeeHistoryDialog({ pessoa, competencia, retorno, onClose }: Props) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  // Nesta fatia ainda não há banco de histórico: o retrato atual é o único registro.
  const registros: RegistroHistorico[] = pessoa ? [{ competencia, cargo: pessoa.funcao, lotacao: pessoa.lotacao }] : [];
  const historico = calcularHistorico(registros);
  const { resumo, atual, linhas } = historico;

  return (
    <Dialog open={pessoa !== null} onOpenChange={(open) => !open && onClose()}>
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
        {pessoa && atual && (
          <>
            <DialogHeader className="gap-4">
              <div className="flex items-start gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-full bg-secondary font-semibold text-secondary-foreground" aria-hidden="true">
                  {iniciais(pessoa.servidor)}
                </span>
                <div className="flex min-w-0 flex-col gap-1">
                  <DialogTitle ref={titleRef} tabIndex={-1} className="text-xl break-words outline-none">
                    Histórico do Funcionário: {pessoa.servidor}
                  </DialogTitle>
                  <DialogDescription className="tabular-nums">
                    {pessoa.matricula ? `Matrícula ${pessoa.matricula}` : "Sem matrícula"}
                    {pessoa.empresaSecretaria ? ` · ${pessoa.empresaSecretaria}` : ""}
                    {pessoa.origem ? ` · ${pessoa.origem}` : ""}
                  </DialogDescription>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Selo label="Cargo atual" value={atual.cargo || "—"} />
                <Selo label="Lotação" value={atual.lotacao || "—"} />
                <Selo label="Período atual" value={atual.periodo} />
              </div>
            </DialogHeader>

            <section className="flex flex-col gap-2" aria-labelledby="historico-resumo">
              <h3 id="historico-resumo" className="text-sm font-semibold">Resumo do histórico</h3>
              <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-4 [&>*]:bg-card">
                <Contador label="Meses registrados" value={resumo.mesesRegistrados} />
                <Contador label="Cargos ocupados" value={resumo.cargosOcupados} />
                <Contador label="Mudanças de cargo" value={resumo.mudancasCargo} />
                <Contador label="Mudanças de lotação" value={resumo.mudancasLotacao} />
              </dl>
            </section>

            <section className="flex flex-col gap-2" aria-labelledby="historico-detalhe">
              <h3 id="historico-detalhe" className="text-sm font-semibold">Histórico detalhado</h3>
              <div className="hidden max-h-72 overflow-auto rounded-lg border md:block" tabIndex={0} role="region" aria-label="Histórico detalhado por competência">
                <Table>
                  <caption className="sr-only">Cargo e lotação por competência, da mais recente para a mais antiga</caption>
                  <TableHeader className="sticky top-0 bg-muted/95">
                    <TableRow className="hover:bg-transparent">
                      <TableHead scope="col">Período</TableHead>
                      <TableHead scope="col">Cargo</TableHead>
                      <TableHead scope="col">Lotação</TableHead>
                      <TableHead scope="col">Mudança</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {linhas.map((linha) => (
                      <TableRow key={linha.competencia}>
                        <TableCell className="tabular-nums">{linha.periodo}</TableCell>
                        <TableCell className="whitespace-normal">{linha.cargo || "—"}</TableCell>
                        <TableCell className="whitespace-normal">{linha.lotacao || "—"}</TableCell>
                        <TableCell>
                          <MudancaTexto linha={linha} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <ul className="flex flex-col gap-2 md:hidden" aria-label="Histórico detalhado por competência">
                {linhas.map((linha) => (
                  <li key={linha.competencia} className="flex flex-col gap-1 rounded-lg border bg-card p-3 text-sm">
                    <span className="font-medium tabular-nums">{linha.periodo}</span>
                    <span>{linha.cargo || "—"}</span>
                    <span className="text-muted-foreground">{linha.lotacao || "—"}</span>
                    <MudancaTexto linha={linha} />
                  </li>
                ))}
              </ul>
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>O histórico começa a ser acumulado a partir das próximas importações mensais.</span>
              </p>
            </section>

            <DialogFooter>
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
