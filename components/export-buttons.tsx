"use client";

import { useId, useState } from "react";
import { ChevronDown, Download, FileSpreadsheet, FileText, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { TabelaExportacao, TipoExportacao } from "@/lib/export-funcionarios";

type Props = {
  /** Monta a tabela no clique, com o que estiver visível naquele momento. */
  montar: () => TabelaExportacao;
  /** Nome do arquivo sem extensão. */
  nomeArquivo: string;
  disabled?: boolean;
};

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

/** Menu "Exportar" com "Excel (.xlsx)" e "PDF". Desabilitados sem linhas; erro e geração anunciados. */
export default function ExportButtons({ montar, nomeArquivo, disabled }: Props) {
  const dicaId = useId();
  const [gerando, setGerando] = useState<TipoExportacao | null>(null);
  const [erro, setErro] = useState(false);

  async function exportar(tipo: TipoExportacao) {
    setGerando(tipo);
    setErro(false);
    try {
      const { gerarArquivo } = await import("@/lib/export-funcionarios");
      baixar(await gerarArquivo(tipo, montar()), `${nomeArquivo}.${tipo}`);
    } catch {
      setErro(true);
    } finally {
      setGerando(null);
    }
  }

  const bloqueado = disabled || gerando !== null;
  return (
    <div className="flex flex-col gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" className="w-fit" disabled={bloqueado} aria-describedby={disabled ? dicaId : undefined}>
            {gerando ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
            Exportar
            <ChevronDown aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onSelect={() => void exportar("xlsx")}>
            <FileSpreadsheet aria-hidden="true" />
            Excel (.xlsx)
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void exportar("pdf")}>
            <FileText aria-hidden="true" />
            PDF
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <p className="text-sm text-muted-foreground empty:hidden" role="status">
        {gerando ? "Gerando arquivo…" : disabled ? <span id={dicaId}>Nada para exportar com os filtros atuais.</span> : null}
      </p>
      {erro && (
        <p className="text-sm text-destructive" role="alert">
          Não foi possível gerar o arquivo.
        </p>
      )}
    </div>
  );
}
