"use client";

import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { custoAlimentacao, type CustoAlimentacaoLinha } from "@/lib/folha/indicadores";
import type { ColaboradorPlanilha } from "@/lib/import";
import { cn } from "@/lib/utils";

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const reais = (centavos: number) => moeda.format(centavos / 100);

const VISOES = [
  { value: "total", label: "Total", chave: "total" },
  { value: "comissionados", label: "Comissionados", chave: "comissionados" },
  { value: "terceirizados", label: "Terceirizados", chave: "terceirizados" },
] as const;

function Cartao({ rotulo, valor, media, destaque }: { rotulo: string; valor: number; media: number; destaque?: boolean }) {
  return (
    <div className={cn("flex flex-col gap-2 rounded-lg border p-4 sm:p-5", destaque ? "border-primary/40 bg-secondary" : "bg-card")}>
      <dt className="text-sm text-muted-foreground">{rotulo}</dt>
      <dd className="flex flex-col gap-1">
        <span className="text-2xl font-semibold tracking-tight tabular-nums">{reais(valor)}</span>
        <span className="text-sm text-muted-foreground tabular-nums">Média por pessoa: {reais(media)}</span>
      </dd>
    </div>
  );
}

function Cartoes({ linha, rotulo }: { linha: CustoAlimentacaoLinha; rotulo: string }) {
  return (
    <>
      <p className="text-sm text-muted-foreground tabular-nums">
        {linha.quantidade.toLocaleString("pt-BR")} {linha.quantidade === 1 ? "pessoa" : "pessoas"} · {rotulo}
      </p>
      <dl className="grid gap-4 md:grid-cols-3">
        <Cartao rotulo="Remuneração" valor={linha.remuneracao} media={linha.mediaRemuneracao} />
        <Cartao rotulo="Alimentação" valor={linha.alimentacao} media={linha.mediaAlimentacao} />
        <Cartao destaque rotulo="Custo total" valor={linha.custo} media={linha.mediaCusto} />
      </dl>
    </>
  );
}

/** Remuneração + alimentação por origem, com média por pessoa. Não exibe a indicação. */
export default function CustoAlimentacao({ rows }: { rows: ColaboradorPlanilha[] }) {
  const custo = useMemo(() => custoAlimentacao(rows), [rows]);
  return (
    <Card className="gap-5">
      <CardHeader>
        <CardTitle>Custo com alimentação</CardTitle>
        <CardDescription>Remuneração mais alimentação por mês, a partir do Cadastro funcional.</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="total">
          <TabsList aria-label="Grupo de servidores">
            {VISOES.map((visao) => (
              <TabsTrigger key={visao.value} value={visao.value}>{visao.label}</TabsTrigger>
            ))}
          </TabsList>
          {VISOES.map((visao) => (
            <TabsContent key={visao.value} value={visao.value}>
              <Cartoes linha={custo[visao.chave]} rotulo={visao.label} />
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
