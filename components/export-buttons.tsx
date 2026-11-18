"use client";

import { useId, useState } from "react";
import { Download, FileSpreadsheet, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
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

/** Botões "Excel (.xlsx)" e "PDF". Desabilitados sem linhas; erro e geração anunciados. */
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
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={bloqueado} aria-describedby={disabled ? dicaId : undefined} onClick={() => void exportar("xlsx")}>
          {gerando === "xlsx" ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <FileSpreadsheet aria-hidden="true" />}
          Excel (.xlsx)
        </Button>
        <Button type="button" variant="outline" disabled={bloqueado} aria-describedby={disabled ? dicaId : undefined} onClick={() => void exportar("pdf")}>
          {gerando === "pdf" ? <LoaderCircle className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
          PDF
        </Button>
      </div>
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
