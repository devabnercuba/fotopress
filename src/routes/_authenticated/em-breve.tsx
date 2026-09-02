import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BarChart3,
  Bell,
  CalendarSync,
  FileSignature,
  Package,
  Receipt,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/em-breve")({
  head: () => ({
    meta: [
      { title: "Em breve — FotoPress" },
      {
        name: "description",
        content:
          "Roadmap do FotoPress: alertas, calendário externo, relatórios, orçamentos, produtos e contratos.",
      },
      { property: "og:title", content: "Em breve — FotoPress" },
      {
        property: "og:description",
        content: "Novas ferramentas em preparação para ampliar sua organização.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ComingSoonHub,
});

const ITEMS: { icon: LucideIcon; title: string; text: string; to: string }[] = [
  {
    icon: Bell,
    title: "Alertas",
    text: "Receba lembretes sobre jogos, credenciamentos e acontecimentos importantes da sua rotina.",
    to: "/alertas",
  },
  {
    icon: CalendarSync,
    title: "Calendário Externo",
    text: "Leve suas coberturas para calendários como Google Calendar e Apple Calendar.",
    to: "/calendario-externo",
  },
  {
    icon: BarChart3,
    title: "Relatórios",
    text: "Visualize indicadores e históricos das suas coberturas.",
    to: "/relatorios",
  },
  {
    icon: Receipt,
    title: "Orçamentos",
    text: "Organize propostas e valores enviados aos seus clientes.",
    to: "/orcamentos",
  },
  {
    icon: Package,
    title: "Produtos e Serviços",
    text: "Cadastre serviços e entregáveis para montar orçamentos rapidamente.",
    to: "/produtos",
  },
  {
    icon: FileSignature,
    title: "Contratos",
    text: "Centralize informações comerciais relacionadas aos trabalhos contratados.",
    to: "/contratos",
  },
];

function ComingSoonHub() {
  return (
    <div className="space-y-6 pb-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Em breve no FotoPress</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Estamos preparando novas ferramentas para ampliar sua organização dentro e fora das
          coberturas.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map((item) => (
          <article
            key={item.title}
            className="flex flex-col rounded-xl border border-dashed border-border bg-card p-5"
          >
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface text-foreground">
                <item.icon className="size-4" />
              </span>
              <span className="ml-auto inline-flex items-center gap-1 rounded-md border border-border bg-surface px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                <Sparkles className="size-3" />
                Em breve
              </span>
            </div>
            <h2 className="mt-4 text-sm font-medium">{item.title}</h2>
            <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">{item.text}</p>
            <Button asChild variant="ghost" size="sm" className="mt-4 w-fit px-2">
              <Link to={item.to}>
                Saiba mais
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </article>
        ))}
      </div>
    </div>
  );
}
