import type { ReactElement } from "react";
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  ClipboardList,
  Download,
  GraduationCap,
  LayoutList,
  Lightbulb,
  Newspaper,
  Star,
  Trophy,
  UserRound,
  Users,
  Volleyball,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { HelpSectionsDialog } from "@/components/help-sections-dialog";
import { OnboardingChecklist } from "@/components/onboarding-checklist";
import { TutorialVideosSection } from "@/components/tutorial-videos-section";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useHelpSections } from "@/lib/help-sections";
import { useOnboarding } from "@/lib/onboarding";
import { useIsTutorialAdmin } from "@/lib/tutorials";

export const Route = createFileRoute("/_authenticated/primeiros-passos")({
  head: () => ({
    meta: [
      { title: "Primeiros passos — FotoPress" },
      {
        name: "description",
        content:
          "Aprenda a configurar campeonatos, fontes, jogos, credenciamentos e clientes no FotoPress.",
      },
      { property: "og:title", content: "Primeiros passos — FotoPress" },
      {
        property: "og:description",
        content: "Central de aprendizado para configurar e usar o FotoPress no dia a dia.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FirstSteps,
});

type Guide = {
  icon: LucideIcon;
  title: string;
  text: string;
  time?: string;
  to: string;
  action: string;
  tags?: string[];
};

const START_HERE: Guide[] = [
  {
    icon: UserRound,
    title: "Configure seu perfil",
    text: "Informe nome, cidade e dados de contato usados nas suas coberturas.",
    time: "1 min",
    to: "/configuracoes",
    action: "Abrir configurações",
  },
  {
    icon: Trophy,
    title: "Campeonatos",
    text: "Organize as competições que você acompanha. Os jogos importados ou cadastrados serão vinculados aos seus campeonatos.",
    time: "2 min",
    to: "/campeonatos",
    action: "Gerenciar campeonatos",
  },
  {
    icon: Download,
    title: "Fontes de Jogos",
    text: "Conecte fontes oficiais ou importe sua própria tabela.",
    time: "3 min",
    to: "/fontes",
    action: "Adicionar fonte",
    tags: ["CBF", "FCF", "FPF", "LNF", "PDF/XLSX"],
  },
  {
    icon: Volleyball,
    title: "Jogos",
    text: "Consulte partidas na aba Partidas ou cadastre manualmente corridas, torneios e outros eventos esportivos na aba Eventos.",
    to: "/jogos",
    action: "Abrir Jogos",
  },
  {
    icon: ClipboardList,
    title: "Credenciamento",
    text: "Acompanhe quais jogos ainda precisam de solicitação, quais estão aguardando e quais já foram aprovados.",
    to: "/credenciamento",
    action: "Ver credenciamentos",
  },
  {
    icon: Star,
    title: "Minha Agenda",
    text: "Centralize as coberturas que realmente fazem parte da sua programação.",
    to: "/agenda",
    action: "Abrir minha agenda",
  },
];

const MORE: Guide[] = [
  {
    icon: Lightbulb,
    title: "Sugestões",
    text: "Envie ideias, melhorias e sugestões de novas funcionalidades para ajudar na evolução do FotoPress.",
    to: "/sugestoes",
    action: "Enviar sugestão",
  },
  {
    icon: Newspaper,
    title: "Fontes de Notícias",
    text: "Cadastre os sites que você acompanha e utilize fontes integradas para reunir informações úteis para suas coberturas. Você também pode ativar o oGol como fonte integrada via RSS.",
    to: "/fontes-conteudo",
    action: "Gerenciar fontes",
  },
];

const KANBAN = ["Não contatado", "Contato realizado", "Respondeu", "Pacote oferecido", "Fechado"];

function GuideCard({ guide }: { guide: Guide }) {
  return (
    <article className="flex flex-col rounded-xl border border-border bg-card p-5">
      <span className="flex size-9 items-center justify-center rounded-lg bg-surface text-foreground">
        <guide.icon className="size-4" />
      </span>
      <div className="mt-4 flex items-center gap-2">
        <h3 className="text-sm font-medium">{guide.title}</h3>
        {guide.time && (
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            {guide.time}
          </span>
        )}
      </div>
      <p className="mt-1 flex-1 text-xs leading-relaxed text-muted-foreground">{guide.text}</p>
      {guide.tags && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {guide.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[10px]">
              {tag}
            </Badge>
          ))}
        </div>
      )}
      <Button asChild variant="outline" size="sm" className="mt-4 w-fit">
        <Link to={guide.to}>
          {guide.action}
          <ArrowRight className="size-3.5" />
        </Link>
      </Button>
    </article>
  );
}

function FirstSteps() {
  const { reopen, dismissed } = useOnboarding();
  const { data: isAdmin = false } = useIsTutorialAdmin();
  const { data: sections = [] } = useHelpSections();
  const [organizing, setOrganizing] = useState(false);

  const blocks: Record<string, ReactElement> = {
    videos: <TutorialVideosSection key="videos" />,
    setup_checklist: (
      <div key="setup_checklist" className="space-y-4">
        <OnboardingChecklist variant="plain" />
        {dismissed && (
          <Button variant="outline" size="sm" onClick={reopen}>
            Rever checklist inicial no Dashboard
          </Button>
        )}
      </div>
    ),
    guides: (
      <section key="guides" className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Comece aqui
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {START_HERE.map((g) => (
            <GuideCard key={g.title} guide={g} />
          ))}
        </div>
      </section>
    ),
    additional_content: <AdditionalContent key="additional_content" />,
  };

  const visible = sections.filter((s) => s.is_visible || s.section_key === "setup_checklist");

  return (
    <div className="space-y-8 pb-10">
      <header className="flex flex-wrap items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <GraduationCap className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">Primeiros passos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Aprenda a configurar e aproveitar o FotoPress no seu dia a dia.
          </p>
        </div>
        {isAdmin && (
          <Button variant="ghost" size="sm" onClick={() => setOrganizing(true)}>
            <LayoutList className="size-3.5" />
            Organizar página
          </Button>
        )}
      </header>

      {visible.map((s) => blocks[s.section_key])}

      {isAdmin && (
        <HelpSectionsDialog open={organizing} sections={sections} onOpenChange={setOrganizing} />
      )}
    </div>
  );
}

function AdditionalContent() {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Organização comercial
        </h2>
        <article className="rounded-xl border border-border bg-card p-5">
          <span className="flex size-9 items-center justify-center rounded-lg bg-surface text-foreground">
            <Users className="size-4" />
          </span>
          <h3 className="mt-4 text-sm font-medium">Atletas/Clientes</h3>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Crie sua base de contatos, organize prospects e clientes e acompanhe as oportunidades
            comerciais de cada cobertura.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            {KANBAN.map((stage, i) => (
              <span key={stage} className="flex items-center gap-1.5">
                <span className="rounded-md border border-border bg-surface px-2 py-1 text-[11px]">
                  {stage}
                </span>
                {i < KANBAN.length - 1 && (
                  <ArrowRight className="size-3 text-muted-foreground/60" />
                )}
              </span>
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            O status comercial pertence a cada jogo. Um cliente pode fechar pacote em uma partida e
            não fechar na seguinte.
          </p>
          <Button asChild variant="outline" size="sm" className="mt-4">
            <Link to="/atletas">
              Gerenciar contatos
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </article>
      </section>

      <section className="space-y-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Preparação da cobertura
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MORE.map((g) => (
            <GuideCard key={g.title} guide={g} />
          ))}
        </div>
      </section>
    </div>
  );
}
