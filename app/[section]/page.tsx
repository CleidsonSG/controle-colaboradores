import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Construction } from "lucide-react";

const sections: Record<string, string> = {
  statistics: "Estatísticas de Cargo",
  positions: "Manutenção de Cargos",
  settings: "Configurações",
  help: "Ajuda",
};

export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(sections).map((section) => ({ section }));
}

type SectionPageProps = {
  params: Promise<{ section: string }>;
};

export async function generateMetadata({ params }: SectionPageProps): Promise<Metadata> {
  const { section } = await params;
  return { title: sections[section] };
}

export default async function PreparedSectionPage({ params }: SectionPageProps) {
  const { section } = await params;
  const title = sections[section];
  if (!title) notFound();

  return (
    <section aria-labelledby="prepared-title" className="flex flex-col gap-6">
      <h1 id="prepared-title" className="text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="flex max-w-xl items-start gap-4 rounded-lg border border-dashed bg-card p-6">
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-secondary text-secondary-foreground">
          <Construction className="size-5" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1">
          <p className="font-medium">Área em preparação</p>
          <p className="text-sm text-muted-foreground">Nenhum dado ou indicador é exibido nesta versão.</p>
        </div>
      </div>
    </section>
  );
}
