"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { CircleAlert, Download, FileSpreadsheet, LoaderCircle, Lock, ShieldAlert, Upload } from "lucide-react";
import { useAuth } from "@/components/auth-gate";
import { useDadosImportados } from "@/components/use-dados-importados";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ColaboradorPlanilha } from "@/lib/import";
import { montarRelatorioIndicacoes, type FiltroIndicacoes, type RelatorioIndicacoes as Relatorio } from "@/lib/folha/indicacoes";
import { isSupabaseConfigured } from "@/lib/supabase/client";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const reais = (centavos: number) => moeda.format(centavos / 100);
const inteiro = (n: number) => n.toLocaleString("pt-BR");
const PAGINA = 50;
const FILTRO_VAZIO: FiltroIndicacoes = { indicacao: "", origem: "", empresa: "", lotacao: "", funcao: "" };

function Campo({ rotulo, valor, opcoes, onChange }: { rotulo: string; valor: string; opcoes: string[]; onChange: (valor: string) => void }) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label className="text-sm font-medium" htmlFor={id}>{rotulo}</label>
      <NativeSelect id={id} value={valor} onChange={(event) => onChange(event.target.value)}>
        <option value="">Todos</option>
        {opcoes.map((opcao) => (
          <option key={opcao} value={opcao}>{opcao}</option>
        ))}
      </NativeSelect>
    </div>
  );
}

function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function Resultado({ relatorio, filtro }: { relatorio: Relatorio; filtro: FiltroIndicacoes }) {
  const [limite, setLimite] = useState(PAGINA);
  const [exportando, setExportando] = useState<"xlsx" | "pdf" | null>(null);
  const [erro, setErro] = useState(false);

  async function exportar(tipo: "xlsx" | "pdf") {
    setExportando(tipo);
    setErro(false);
    try {
      const { gerarXlsxIndicacoes, gerarPdfIndicacoes } = await import("@/lib/export-indicacoes");
      const hoje = new Date().toISOString().slice(0, 10);
      const blob = tipo === "xlsx" ? await gerarXlsxIndicacoes(relatorio, { filtro }) : await gerarPdfIndicacoes(relatorio, { filtro });
      baixar(blob, `relatorio-indicacoes-${hoje}.${tipo}`);
    } catch {
      setErro(true);
    } finally {
      setExportando(null);
    }
  }

  if (relatorio.detalhe.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground" role="status">
        Nenhum registro encontrado com esses filtros.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3" role="status">
        <p className="text-sm text-muted-foreground tabular-nums">
          {inteiro(relatorio.detalhe.length)} {relatorio.detalhe.length === 1 ? "registro" : "registros"} em {inteiro(relatorio.resumo.length)} {relatorio.resumo.length === 1 ? "indicação" : "indicações"}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={exportando !== null} onClick={() => void exportar("xlsx")}>
            {exportando === "xlsx" ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <FileSpreadsheet aria-hidden="true" />}
            Baixar Excel (.xlsx)
          </Button>
          <Button type="button" variant="outline" disabled={exportando !== null} onClick={() => void exportar("pdf")}>
            {exportando === "pdf" ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
            Baixar PDF
          </Button>
        </div>
      </div>
      {erro && (
        <Alert variant="destructive" role="alert">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>Não foi possível gerar o arquivo</AlertTitle>
          <AlertDescription>Tente novamente. Se continuar, gere o relatório com menos registros.</AlertDescription>
        </Alert>
      )}

      <section className="flex flex-col gap-3" aria-labelledby="resumo-titulo">
        <h2 id="resumo-titulo" className="text-lg font-semibold">Resumo por indicação</h2>
        <div className="overflow-x-auto rounded-lg border bg-card">
          <Table>
            <caption className="sr-only">Quantidade, remuneração, alimentação e custo por indicação</caption>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col">Indicação</TableHead>
                <TableHead scope="col" className="text-right">Quantidade</TableHead>
                <TableHead scope="col" className="text-right">Remuneração</TableHead>
                <TableHead scope="col" className="text-right">Alimentação</TableHead>
                <TableHead scope="col" className="text-right">Custo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {relatorio.resumo.map((item) => (
                <TableRow key={item.indicacao}>
                  <TableCell className="whitespace-normal">{item.indicacao}</TableCell>
                  <TableCell className="text-right tabular-nums">{inteiro(item.quantidade)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">{reais(item.remuneracao)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">{reais(item.alimentacao)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">{reais(item.custo)}</TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/50 font-semibold hover:bg-muted/50">
                <TableCell>Total</TableCell>
                <TableCell className="text-right tabular-nums">{inteiro(relatorio.total.quantidade)}</TableCell>
                <TableCell className="text-right whitespace-nowrap tabular-nums">{reais(relatorio.total.remuneracao)}</TableCell>
                <TableCell className="text-right whitespace-nowrap tabular-nums">{reais(relatorio.total.alimentacao)}</TableCell>
                <TableCell className="text-right whitespace-nowrap tabular-nums">{reais(relatorio.total.custo)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="detalhe-titulo">
        <h2 id="detalhe-titulo" className="text-lg font-semibold">Detalhe por servidor</h2>

        <div className="hidden overflow-x-auto rounded-lg border bg-card md:block" tabIndex={0} role="region" aria-label="Detalhe por servidor, role para ver todas as colunas">
          <Table>
            <caption className="sr-only">Servidores por indicação</caption>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead scope="col">Indicação</TableHead>
                <TableHead scope="col">Servidor</TableHead>
                <TableHead scope="col">Matrícula</TableHead>
                <TableHead scope="col">Origem</TableHead>
                <TableHead scope="col">Empresa/Secretaria</TableHead>
                <TableHead scope="col">Lotação</TableHead>
                <TableHead scope="col">Função</TableHead>
                <TableHead scope="col" className="text-right">Remuneração</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {relatorio.detalhe.slice(0, limite).map((linha, indice) => (
                <TableRow key={`${linha.matricula}-${indice}`}>
                  <TableCell className="whitespace-normal">{linha.indicacao}</TableCell>
                  <TableCell className="whitespace-normal font-medium">{linha.servidor}</TableCell>
                  <TableCell className="tabular-nums">{linha.matricula || "—"}</TableCell>
                  <TableCell>{linha.origem}</TableCell>
                  <TableCell className="whitespace-normal">{linha.empresa || "—"}</TableCell>
                  <TableCell className="whitespace-normal">{linha.lotacao || "—"}</TableCell>
                  <TableCell className="whitespace-normal">{linha.funcao || "—"}</TableCell>
                  <TableCell className="text-right whitespace-nowrap tabular-nums">{reais(linha.remuneracao)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <ul className="flex flex-col gap-3 md:hidden" aria-label="Servidores por indicação">
          {relatorio.detalhe.slice(0, limite).map((linha, indice) => (
            <li key={`${linha.matricula}-${indice}`} className="flex flex-col gap-3 rounded-lg border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="font-medium break-words">{linha.servidor}</p>
                <Badge variant="secondary" className="shrink-0">{linha.origem}</Badge>
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                <div className="col-span-2 flex flex-col gap-0.5">
                  <dt className="text-muted-foreground">Indicação</dt>
                  <dd className="break-words">{linha.indicacao}</dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-muted-foreground">Matrícula</dt>
                  <dd className="tabular-nums">{linha.matricula || "—"}</dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-muted-foreground">Remuneração</dt>
                  <dd className="font-medium tabular-nums">{reais(linha.remuneracao)}</dd>
                </div>
                <div className="col-span-2 flex flex-col gap-0.5">
                  <dt className="text-muted-foreground">Empresa/Secretaria</dt>
                  <dd className="break-words">{linha.empresa || "—"}</dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-muted-foreground">Lotação</dt>
                  <dd className="break-words">{linha.lotacao || "—"}</dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-muted-foreground">Função</dt>
                  <dd className="break-words">{linha.funcao || "—"}</dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>

        {relatorio.detalhe.length > limite && (
          <div className="flex justify-center pt-2">
            <Button variant="outline" type="button" onClick={() => setLimite((l) => l + PAGINA)}>
              Mostrar mais {inteiro(Math.min(PAGINA, relatorio.detalhe.length - limite))} de {inteiro(relatorio.detalhe.length - limite)} restantes
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}

function Conteudo({ rows }: { rows: ColaboradorPlanilha[] }) {
  const [rascunho, setRascunho] = useState<FiltroIndicacoes>(FILTRO_VAZIO);
  const [aplicado, setAplicado] = useState<FiltroIndicacoes | null>(null);
  const opcoes = useMemo(() => montarRelatorioIndicacoes(rows).opcoes, [rows]);
  const relatorio = useMemo(() => (aplicado ? montarRelatorioIndicacoes(rows, aplicado) : null), [rows, aplicado]);
  const alterar = (campo: keyof FiltroIndicacoes) => (valor: string) => setRascunho((atual) => ({ ...atual, [campo]: valor }));

  return (
    <>
      <form
        className="flex flex-col gap-4 rounded-lg border bg-card p-4 sm:p-5"
        onSubmit={(event) => {
          event.preventDefault();
          setAplicado({ ...rascunho });
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Campo rotulo="Indicação" valor={rascunho.indicacao ?? ""} opcoes={opcoes.indicacoes} onChange={alterar("indicacao")} />
          <Campo rotulo="Origem" valor={rascunho.origem ?? ""} opcoes={opcoes.origens} onChange={alterar("origem")} />
          <Campo rotulo="Empresa/Secretaria" valor={rascunho.empresa ?? ""} opcoes={opcoes.empresas} onChange={alterar("empresa")} />
          <Campo rotulo="Lotação" valor={rascunho.lotacao ?? ""} opcoes={opcoes.lotacoes} onChange={alterar("lotacao")} />
          <Campo rotulo="Função" valor={rascunho.funcao ?? ""} opcoes={opcoes.funcoes} onChange={alterar("funcao")} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit">Gerar relatório</Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setRascunho(FILTRO_VAZIO);
              setAplicado(null);
            }}
          >
            Limpar filtros
          </Button>
        </div>
      </form>

      {relatorio && aplicado ? (
        <Resultado key={JSON.stringify(aplicado)} relatorio={relatorio} filtro={aplicado} />
      ) : (
        <div className="rounded-lg border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">
          Escolha os filtros (ou deixe todos em &quot;Todos&quot;) e clique em Gerar relatório.
        </div>
      )}
    </>
  );
}

function DadosRelatorio() {
  const { dados } = useDadosImportados();

  if (dados.status === "loading") {
    return (
      <div className="flex flex-col gap-3" role="status" aria-label="Carregando dados importados">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  if (dados.status === "error") {
    return (
      <Alert variant="destructive" role="alert">
        <CircleAlert aria-hidden="true" />
        <AlertTitle>Não foi possível ler os dados importados</AlertTitle>
        <AlertDescription>Recarregue a página ou importe o arquivo novamente.</AlertDescription>
      </Alert>
    );
  }
  if (!dados.planilha) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed bg-card px-6 py-14 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-secondary text-secondary-foreground">
          <Upload className="size-5" aria-hidden="true" />
        </span>
        <div className="flex max-w-sm flex-col gap-1">
          <p className="font-medium">Nenhum cadastro funcional importado</p>
          <p className="text-sm text-muted-foreground">Importe o Cadastro funcional (planilha Excel) para gerar o relatório de indicações.</p>
        </div>
        <Button asChild>
          <Link href="/import">Importar Cadastro funcional</Link>
        </Button>
      </div>
    );
  }
  return <Conteudo rows={dados.planilha.records} />;
}

export default function RelatorioIndicacoes() {
  const { isAdmin } = useAuth();
  // Com Supabase, só administradores veem o relatório; sem Supabase (modo local) fica liberado.
  const restrito = isSupabaseConfigured() && !isAdmin;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Relatório de indicações</h1>
        <p className="max-w-prose text-muted-foreground">Servidores e custo mensal agrupados por indicação, a partir do Cadastro funcional.</p>
      </header>

      {restrito ? (
        <Alert variant="warning" role="alert">
          <Lock aria-hidden="true" />
          <AlertTitle>Acesso restrito a administradores</AlertTitle>
          <AlertDescription>Este relatório lista pessoas e indicações. Peça acesso a um administrador do sistema.</AlertDescription>
        </Alert>
      ) : (
        <>
          <Alert variant="warning">
            <ShieldAlert aria-hidden="true" />
            <AlertTitle>Relatório restrito</AlertTitle>
            <AlertDescription>Relatório restrito — contém dados pessoais. Não compartilhe fora da Prefeitura.</AlertDescription>
          </Alert>
          <DadosRelatorio />
        </>
      )}
    </div>
  );
}
