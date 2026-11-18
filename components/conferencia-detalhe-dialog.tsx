"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ExportButtons from "@/components/export-buttons";
import { formatMoney } from "@/components/data-table";
import { tabelaDetalheFuncao } from "@/lib/export-funcionarios";
import type { FuncaoConferida } from "@/lib/folha/conciliacao";

type Props = {
  /** Função aberta; null mantém o diálogo fechado. */
  funcao: FuncaoConferida | null;
  /** Elemento (o selo clicado) que recebe o foco ao fechar. */
  retorno: HTMLElement | null;
  onClose: () => void;
};

const reais = (centavos: number | null) => (centavos === null ? "—" : formatMoney(centavos / 100));

/** Detalhe somente leitura: pessoas da função com divergência ou sem remuneração informada. */
export default function ConferenciaDetalheDialog({ funcao, retorno, onClose }: Props) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const pendentes = funcao?.pendentes ?? [];

  return (
    <Dialog open={funcao !== null} onOpenChange={(open) => !open && onClose()}>
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
                {pendentes.length === 1 ? "1 pessoa precisa de atenção" : `${pendentes.length.toLocaleString("pt-BR")} pessoas precisam de atenção`} · {funcao.origem}
              </DialogDescription>
            </DialogHeader>

            {pendentes.length === 0 ? (
              <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma pessoa com ajuste pendente nesta função.</p>
            ) : (
              <>
                <div className="hidden max-h-96 overflow-auto rounded-lg border md:block" tabIndex={0} role="region" aria-label={`Pessoas da função ${funcao.funcao} com atenção pendente`}>
                  <Table>
                    <caption className="sr-only">Pessoas com valor diferente da referência ou sem remuneração informada</caption>
                    <TableHeader className="sticky top-0 bg-muted/95">
                      <TableRow className="hover:bg-transparent">
                        <TableHead scope="col">Servidor</TableHead>
                        <TableHead scope="col">Empresa/Secretaria</TableHead>
                        <TableHead scope="col" className="text-right">Valor de referência</TableHead>
                        <TableHead scope="col" className="text-right">Valor informado</TableHead>
                        <TableHead scope="col">Motivo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pendentes.map((pessoa, index) => (
                        <TableRow key={`${pessoa.matricula}-${pessoa.servidor}-${index}`}>
                          <TableCell className="whitespace-normal">{pessoa.servidor}</TableCell>
                          <TableCell className="whitespace-normal">{pessoa.empresa}</TableCell>
                          <TableCell className="text-right whitespace-nowrap tabular-nums">{reais(pessoa.valorReferencia)}</TableCell>
                          <TableCell className="text-right whitespace-nowrap tabular-nums">{reais(pessoa.valorInformado)}</TableCell>
                          <TableCell className="whitespace-normal">{pessoa.motivo}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <ul className="flex flex-col gap-2 md:hidden" aria-label={`Pessoas da função ${funcao.funcao} com atenção pendente`}>
                  {pendentes.map((pessoa, index) => (
                    <li key={`${pessoa.matricula}-${pessoa.servidor}-${index}`} className="flex flex-col gap-1 rounded-lg border bg-card p-3 text-sm">
                      <span className="font-medium">{pessoa.servidor}</span>
                      <span className="text-muted-foreground">{pessoa.empresa}</span>
                      <span className="tabular-nums">Referência: {reais(pessoa.valorReferencia)}</span>
                      <span className="tabular-nums">Informado: {reais(pessoa.valorInformado)}</span>
                      <span className="font-medium">{pessoa.motivo}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <DialogFooter className="items-start sm:items-center sm:justify-between">
              <ExportButtons montar={() => tabelaDetalheFuncao(funcao)} nomeArquivo="detalhe-funcao" disabled={pendentes.length === 0} />
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
