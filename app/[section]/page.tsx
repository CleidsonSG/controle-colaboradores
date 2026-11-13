import type { Metadata } from "next";
import { notFound } from "next/navigation";

const sections: Record<string, string> = {
  dashboard: "Dashboard",
  employees: "Funcionários",
  budget: "Orçamento",
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
    <section className="prepared-page" aria-labelledby="prepared-title">
      <p className="eyebrow">Próxima etapa do MVP</p>
      <h1 id="prepared-title">{title}</h1>
      <div className="prepared-rule" aria-hidden="true" />
      <p className="prepared-copy">Esta área está em preparação. Nenhum dado ou indicador é exibido nesta versão.</p>
    </section>
  );
}
