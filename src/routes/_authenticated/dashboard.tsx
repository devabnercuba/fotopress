import { createFileRoute, Link } from "@tanstack/react-router";
import { format, isSameMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { CalendarClock, ClipboardList, MapPin, Newspaper, Users, Wallet } from "lucide-react";

import { AccessBanner } from "@/components/access-status";
import { DashboardAdminSection } from "@/components/dashboard-admin-section";
import { NewsReaderSheet } from "@/components/news-reader-sheet";
import { FirstStepsHint, OnboardingCard } from "@/components/onboarding-checklist";
import { QuickCreate } from "@/components/quick-create";
import { TeamCrest } from "@/components/team-crest";
import { UpdatesBanner } from "@/components/updates-banner";

import { compStyle } from "@/lib/competitions";
import { useContentSources } from "@/lib/content-sources";
import { useCoverages } from "@/lib/coverages";
import { engagementStage, useAllEngagements } from "@/lib/engagements";
import { useEventCoverages } from "@/lib/events";
import { formatMoney, useFinancialEntries } from "@/lib/finance";
import { newsTitle, useNewsItems, type NewsItem } from "@/lib/news";
import { useOnboarding } from "@/lib/onboarding";
import { firstNameOf, useAuthUser, useProfile } from "@/lib/profile";
import { formatSportLabel } from "@/lib/sports";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — FotoPress" },
      {
        name: "description",
        content:
          "Centro de decisão da rotina: próxima cobertura, pendências, agenda, comercial e resultado financeiro do mês.",
      },
      { property: "og:title", content: "Dashboard — FotoPress" },
      {
        property: "og:description",
        content: "Veja o que precisa da sua atenção hoje nas suas coberturas esportivas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function greeting(date: Date) {
  const hour = date.getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function Stat({
  label,
  value,
  hint,
  to,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  to: string;
  icon: typeof Users;
}) {
  return (
    <Link
      to={to}
      className="block h-full rounded-xl border border-border bg-card p-4 transition-colors hover:bg-accent/40"
    >
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
    </Link>
  );
}

type AgendaRow = {
  key: string;
  kind: "PARTIDA" | "EVENTO";
  title: string;
  when: string;
  place: string;
  home?: string;
};

function Dashboard() {
  const { data: coverages = [] } = useCoverages();
  const { data: eventCoverages = [] } = useEventCoverages();
  const { data: engagements = [] } = useAllEngagements();
  const { data: entries = [] } = useFinancialEntries();
  const { data: news = [] } = useNewsItems(20);
  const { data: sources = [] } = useContentSources();
  const { data: profile } = useProfile();
  const { data: user } = useAuthUser();
  const onboarding = useOnboarding();
  const [readingNews, setReadingNews] = useState<NewsItem | null>(null);

  const today = new Date();
  const todayKey = format(today, "yyyy-MM-dd");
  const name = firstNameOf(profile, user?.email);

  /* ---------- coberturas aprovadas (partidas + eventos) ---------- */
  const approvedMatches = coverages.filter(
    (c) => c.credential_status === "approved" && !c.completed_at && c.match,
  );
  const upcomingMatches = approvedMatches
    .filter((c) => c.match!.date >= todayKey)
    .sort((a, b) =>
      `${a.match!.date}${a.match!.time}`.localeCompare(`${b.match!.date}${b.match!.time}`),
    );

  const upcomingEvents = eventCoverages
    .filter(
      (c) =>
        c.event &&
        !c.completed_at &&
        c.credential_status === "approved" &&
        c.event.start_date >= todayKey,
    )
    .sort((a, b) => a.event!.start_date.localeCompare(b.event!.start_date));

  const nextMatch = upcomingMatches[0]?.match ?? null;
  const nextEvent = upcomingEvents[0]?.event ?? null;
  const eventIsNext =
    !!nextEvent &&
    (!nextMatch ||
      `${nextEvent.start_date}${nextEvent.start_time ?? "99:99"}` <
        `${nextMatch.date}${nextMatch.time}`);

  const agenda: AgendaRow[] = [
    ...upcomingMatches.map((c) => ({
      key: `m-${c.id}`,
      kind: "PARTIDA" as const,
      title: `${c.match!.home_team} × ${c.match!.away_team}`,
      when: `${c.match!.date}T${c.match!.time}`,
      place: [c.match!.venue, c.match!.city].filter(Boolean).join(" · "),
      home: c.match!.home_team,
    })),
    ...upcomingEvents.map((c) => ({
      key: `e-${c.id}`,
      kind: "EVENTO" as const,
      title: c.event!.name,
      when: `${c.event!.start_date}T${c.event!.start_time ?? "00:00"}`,
      place: [c.event!.venue, c.event!.city].filter(Boolean).join(" · "),
    })),
  ]
    .sort((a, b) => a.when.localeCompare(b.when))
    .slice(0, 6);

  /* ---------- pendências ---------- */
  const pendingCredentials = coverages.filter(
    (c) => c.credential_status === "requested" && (c.match || c.match_id),
  ).length;

  const upcomingMatchIds = new Set(upcomingMatches.map((c) => c.match_id));
  const upcomingEngagements = engagements.filter((e) => upcomingMatchIds.has(e.match_id));
  const commercial = {
    total: upcomingEngagements.length,
    notContacted: upcomingEngagements.filter((e) => engagementStage(e) === "not_contacted").length,
    responded: upcomingEngagements.filter((e) => engagementStage(e) === "responded").length,
    offered: upcomingEngagements.filter((e) => engagementStage(e) === "offered").length,
    closed: upcomingEngagements.filter((e) => engagementStage(e) === "closed").length,
  };
  const brokenSources = sources.filter((s) => s.last_error || s.status === "error").length;

  /* ---------- financeiro do mês ---------- */
  const monthEntries = entries.filter((e) => isSameMonth(parseISO(e.occurred_at), today));
  const income = monthEntries
    .filter((e) => e.type === "income")
    .reduce((sum, e) => sum + e.amount, 0);
  const expense = monthEntries
    .filter((e) => e.type === "expense")
    .reduce((sum, e) => sum + e.amount, 0);
  const balance = income - expense;

  const attention = [
    pendingCredentials > 0 && {
      key: "cred",
      text: `${pendingCredentials} ${pendingCredentials === 1 ? "credenciamento aguardando" : "credenciamentos aguardando"} atualização`,
      to: "/credenciamento",
    },
    commercial.notContacted > 0 && {
      key: "clients",
      text: `${commercial.notContacted} ${commercial.notContacted === 1 ? "cliente ainda não contatado" : "clientes ainda não contatados"} nas próximas coberturas`,
      to: "/atletas",
    },
    brokenSources > 0 && {
      key: "sources",
      text: `${brokenSources} ${brokenSources === 1 ? "fonte com erro" : "fontes com erro"} de sincronização`,
      to: "/fontes-conteudo",
    },
  ].filter(Boolean) as { key: string; text: string; to: string }[];

  const style = compStyle(nextMatch?.competition?.color);
  const recentNews = news.slice(0, 3);

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">
            {greeting(today)}
            {name ? `, ${name}` : ""} 👋
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Veja o que precisa da sua atenção hoje.
          </p>
        </div>
        <QuickCreate />
      </header>

      <AccessBanner />
      <UpdatesBanner />
      <OnboardingCard />

      {/* 1. Próxima cobertura */}
      <section className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-5 py-3">
          <CalendarClock className="size-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Próxima cobertura</span>
          <Link to="/agenda" className="ml-auto text-xs text-muted-foreground hover:underline">
            Minha Agenda
          </Link>
        </div>

        {eventIsNext && nextEvent ? (
          <div className="space-y-3 p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                Evento
              </span>
              <span className="min-w-0 text-lg font-semibold sm:text-xl">{nextEvent.name}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="rounded-md bg-surface px-2 py-0.5 font-medium">
                {formatSportLabel(nextEvent.sport)}
              </span>
              <span>
                {format(parseISO(nextEvent.start_date), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                {nextEvent.start_time ? ` · ${nextEvent.start_time.slice(0, 5)}` : ""}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="size-3" />
                {[nextEvent.venue, nextEvent.city, nextEvent.state].filter(Boolean).join(" · ") ||
                  "Local a definir"}
              </span>
            </div>
            <Link
              to="/agenda"
              className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Ver cobertura
            </Link>
          </div>
        ) : nextMatch ? (
          <div className="space-y-3 p-5">
            <div className="flex min-w-0 items-center gap-3">
              <TeamCrest name={nextMatch.home_team} size="lg" />
              <div className="min-w-0">
                <div className="text-lg font-semibold sm:text-xl">
                  {nextMatch.home_team} <span className="text-muted-foreground">×</span>{" "}
                  {nextMatch.away_team}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className={`rounded-md px-2 py-0.5 font-medium ${style.chip}`}>
                    {nextMatch.competition?.name ?? "Sem campeonato"}
                  </span>
                  <span>
                    {format(parseISO(nextMatch.date), "EEEE, dd 'de' MMMM", { locale: ptBR })} ·{" "}
                    {nextMatch.time.slice(0, 5)}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3" />
                    {[nextMatch.venue, nextMatch.city, nextMatch.state]
                      .filter(Boolean)
                      .join(" · ") || "Local a definir"}
                  </span>
                </div>
              </div>
              <TeamCrest name={nextMatch.away_team} size="lg" />
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>Credenciamento: aprovado</span>
              <span>
                {engagements.filter((e) => e.match_id === upcomingMatches[0]?.match_id).length}{" "}
                clientes relacionados
              </span>
            </div>
            <Link
              to="/agenda"
              className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Ver cobertura
            </Link>
          </div>
        ) : (
          <div className="space-y-3 p-5">
            <p className="text-sm text-muted-foreground">Nenhuma cobertura agendada.</p>
            <Link
              to="/jogos"
              className="inline-flex items-center rounded-md border border-input px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
            >
              Ver jogos/eventos
            </Link>
          </div>
        )}
      </section>

      {/* 2. Métricas principais */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Próximas coberturas"
          value={String(upcomingMatches.length + upcomingEvents.length)}
          hint="Partidas e eventos aprovados"
          to="/agenda"
          icon={CalendarClock}
        />
        <Stat
          label="Credenciamentos pendentes"
          value={String(pendingCredentials)}
          hint="Aguardando resposta"
          to="/credenciamento"
          icon={ClipboardList}
        />
        <Stat
          label="Clientes a contatar"
          value={String(commercial.notContacted)}
          hint="Nas próximas coberturas"
          to="/atletas"
          icon={Users}
        />
        <Stat
          label="Saldo do mês"
          value={formatMoney(balance)}
          hint={format(today, "MMMM 'de' yyyy", { locale: ptBR })}
          to="/financeiro"
          icon={Wallet}
        />
      </section>

      {/* 3. Precisa da sua atenção */}
      {attention.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Precisa da sua atenção</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {attention.map((item) => (
              <li key={item.key} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
                <span className="min-w-0 flex-1">{item.text}</span>
                <Link
                  to={item.to}
                  className="shrink-0 text-xs font-medium text-primary hover:underline"
                >
                  Resolver
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        {/* 4. Agenda */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold">Próximas coberturas</h2>
            <Link to="/agenda" className="ml-auto text-xs text-muted-foreground hover:underline">
              Ver agenda
            </Link>
          </div>
          {agenda.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">
              Nada aprovado para os próximos dias.
            </p>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {agenda.map((row) => (
                <li key={row.key} className="flex items-center gap-3 px-4 py-3 text-sm">
                  {row.home ? (
                    <TeamCrest name={row.home} size="sm" />
                  ) : (
                    <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      EVT
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{row.title}</span>
                    {row.place && (
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {row.place}
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {format(parseISO(row.when), "dd/MM · HH:mm")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-6">
          {/* 5. Comercial */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">Comercial das próximas coberturas</h2>
              <Link to="/atletas" className="ml-auto text-xs text-muted-foreground hover:underline">
                Ver clientes
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-card p-4 sm:grid-cols-4">
              {[
                { label: "Relacionados", value: commercial.total },
                { label: "Não contatados", value: commercial.notContacted },
                { label: "Responderam", value: commercial.responded },
                { label: "Fechados", value: commercial.closed },
              ].map((item) => (
                <div key={item.label}>
                  <div className="text-lg font-semibold">{item.value}</div>
                  <div className="text-[11px] text-muted-foreground">{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* 6. Financeiro */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">Resultado deste mês</h2>
              <Link
                to="/financeiro"
                className="ml-auto text-xs text-muted-foreground hover:underline"
              >
                Ver financeiro
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-3 rounded-xl border border-border bg-card p-4 text-sm">
              <div>
                <div className="text-[11px] text-muted-foreground">Receitas</div>
                <div className="mt-1 font-semibold">{formatMoney(income)}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">Despesas</div>
                <div className="mt-1 font-semibold">{formatMoney(expense)}</div>
              </div>
              <div>
                <div className="text-[11px] text-muted-foreground">Saldo</div>
                <div className="mt-1 font-semibold">{formatMoney(balance)}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Informação */}
      {recentNews.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Newspaper className="size-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Informações recentes</h2>
            <Link
              to="/fontes-conteudo"
              className="ml-auto text-xs text-muted-foreground hover:underline"
            >
              Ver notícias
            </Link>
          </div>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {recentNews.map((item) => (
              <li key={item.id} className="text-sm">
                <button
                  type="button"
                  onClick={() => setReadingNews(item)}
                  className="block w-full px-4 py-3 text-left transition-colors hover:bg-surface"
                >
                  <span className="line-clamp-2">{newsTitle(item)}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {item.source?.name ?? item.entities?.source_name ?? "Fonte"}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <NewsReaderSheet
            item={readingNews}
            open={!!readingNews}
            onOpenChange={(open) => !open && setReadingNews(null)}
          />
        </section>
      )}

      <DashboardAdminSection />

      {onboarding.allDone && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <FirstStepsHint />
        </div>
      )}
    </div>
  );
}
