"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { CircleAlert, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ExportButtons from "@/components/export-buttons";
import { calcularHistorico, iniciais, registrosDeRetratos, type Historico, type LinhaHistorico } from "@/lib/folha/historico";
import { tabelaHistoricoPessoa } from "@/lib/export-funcionarios";
import { getDataStore } from "@/lib/storage";
import type { ColaboradorPlanilha } from "@/lib/import";

type Props = {
  /** Pessoa aberta; null mantém o painel fechado. */
  pessoa: ColaboradorPlanilha | null;
  /** Identidade da pessoa no histórico (`buildRetratos`). */
  chaveIdentidade: string;
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

type Carga = { status: "loading" } | { status: "error" } | { status: "ready"; historico: Historico };

function HistoricoCarregando() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      <span className="sr-only" role="status">Carregando histórico</span>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-4 [&>*]:bg-card">
        {["a", "b", "c", "d"].map((key) => (
          <div key={key} className="flex flex-col gap-2 p-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-10" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {[1, 2, 3, 4, 5].map((key) => (
          <Skeleton key={key} className="h-9 w-full" />
        ))}
      </div>
    </div>
  );
}

function HistoricoTabela({ linhas }: { linhas: LinhaHistorico[] }) {
  return (
    <>
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
    </>
  );
}

type ConteudoProps = { pessoa: ColaboradorPlanilha; chaveIdentidade: string; titleRef: RefObject<HTMLHeadingElement | null> };

/** Conteúdo do painel; remontado (key) a cada pessoa, então começa sempre carregando. */
function HistoricoConteudo({ pessoa, chaveIdentidade, titleRef }: ConteudoProps) {
  const [carga, setCarga] = useState<Carga>({ status: "loading" });
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const retratos = await getDataStore().loadHistoricoPessoa(chaveIdentidade);
        if (ativo) setCarga({ status: "ready", historico: calcularHistorico(registrosDeRetratos(retratos)) });
      } catch {
        if (ativo) setCarga({ status: "error" });
      }
    })();
    return () => {
      ativo = false;
    };
  }, [chaveIdentidade, tentativa]);

  function tentarDeNovo() {
    setCarga({ status: "loading" });
    setTentativa((valor) => valor + 1);
  }

  const historico = carga.status === "ready" ? carga.historico : null;
  const atual = historico?.atual ?? null;
  const linhas = historico?.linhas ?? [];

  return (
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
          <Selo label="Cargo atual" value={(atual?.cargo ?? pessoa.funcao) || "—"} />
          <Selo label="Lotação" value={(atual?.lotacao ?? pessoa.lotacao) || "—"} />
          {atual && <Selo label="Período atual" value={atual.periodo} />}
        </div>
      </DialogHeader>

      {carga.status === "loading" && <HistoricoCarregando />}

      {carga.status === "error" && (
        <Alert variant="destructive" role="alert">
          <CircleAlert aria-hidden="true" />
          <AlertDescription className="flex flex-col items-start gap-3 text-foreground">
            <p>Não foi possível carregar o histórico. Verifique a conexão e tente de novo.</p>
            <Button type="button" size="sm" variant="outline" onClick={tentarDeNovo}>Tentar novamente</Button>
          </AlertDescription>
        </Alert>
      )}

      {historico && linhas.length === 0 && (
        <p className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
          Ainda não há histórico para esta pessoa. O histórico começa a ser registrado a cada importação mensal do Cadastro funcional.
        </p>
      )}

      {historico && linhas.length > 0 && (
        <>
          <section className="flex flex-col gap-2" aria-labelledby="historico-resumo">
            <h3 id="historico-resumo" className="text-sm font-semibold">Resumo do histórico</h3>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-4 [&>*]:bg-card">
              <Contador label="Meses registrados" value={historico.resumo.mesesRegistrados} />
              <Contador label="Cargos ocupados" value={historico.resumo.cargosOcupados} />
              <Contador label="Mudanças de cargo" value={historico.resumo.mudancasCargo} />
              <Contador label="Mudanças de lotação" value={historico.resumo.mudancasLotacao} />
            </dl>
          </section>

          <section className="flex flex-col gap-2" aria-labelledby="historico-detalhe">
            <h3 id="historico-detalhe" className="text-sm font-semibold">Histórico detalhado</h3>
            <HistoricoTabela linhas={linhas} />
            {linhas.length === 1 && (
              <p className="flex items-start gap-2 text-sm text-muted-foreground">
                <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>O histórico começa a ser acumulado a partir das próximas importações mensais.</span>
              </p>
            )}
          </section>
        </>
      )}

      <DialogFooter className="items-start sm:items-center sm:justify-between">
        <ExportButtons montar={() => tabelaHistoricoPessoa(pessoa.servidor, linhas)} nomeArquivo="historico-funcionario" disabled={linhas.length === 0} />
        <DialogClose asChild>
          <Button type="button" variant="outline">Fechar</Button>
        </DialogClose>
      </DialogFooter>
    </>
  );
}

export default function EmployeeHistoryDialog({ pessoa, chaveIdentidade, retorno, onClose }: Props) {
  const titleRef = useRef<HTMLHeadingElement>(null);

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
        {pessoa && <HistoricoConteudo key={chaveIdentidade} pessoa={pessoa} chaveIdentidade={chaveIdentidade} titleRef={titleRef} />}
      </DialogContent>
    </Dialog>
  );
}
