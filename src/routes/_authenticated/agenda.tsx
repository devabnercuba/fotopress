import { createFileRoute, Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, CalendarPlus, Check, Download, List, Star, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { AgendaMatchSheet } from "@/components/agenda-match-sheet";
import { EventDetailSheet } from "@/components/event-detail-sheet";
import { EmptyState } from "@/components/empty-state";
import { exportAgendaToIcs } from "@/lib/calendar-export";
import {
  DateRangeFilter,
  EMPTY_RANGE,
  inDateRange,
  type DateRange,
} from "@/components/date-range-filter";
import { MatchActions } from "@/components/match-actions";
import { MonthCalendar } from "@/components/month-calendar";
import { TeamCrest } from "@/components/team-crest";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { compStyle } from "@/lib/competitions";
import { useCoverageMutations, useCoverages, type Coverage } from "@/lib/coverages";
import { RADAR_DOT, RADAR_LABEL, radarState, useRadars } from "@/lib/radar";
import { stripAccents } from "@/lib/teams";
import { useEventCoverages, type EventCoverage, type SportEvent } from "@/lib/events";
import { formatSportLabel } from "@/lib/sports";

const ALL = "todos";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({
    meta: [
      { title: "Minha Agenda — Cobertura esportiva" },
      {
        name: "description",
        content:
          "Coberturas aprovadas, com estádio, cidade, estado do radar e última sincronização.",
      },
      { property: "og:title", content: "Minha Agenda — Cobertura esportiva" },
      {
        property: "og:description",
        content: "As coberturas aprovadas, com radar operacional por partida.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AgendaPage,
});

function AgendaPage() {
  const { data: coverages = [], isLoading } = useCoverages();
  const { remove, complete } = useCoverageMutations();
  const { data: radars = {} } = useRadars();
  const { data: eventCoverages = [] } = useEventCoverages();
  const [selected, setSelected] = useState<Coverage | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<SportEvent | null>(null);
  const [view, setView] = useState<"lista" | "calendario">("lista");
  const [month, setMonth] = useState(() => new Date());
  const [day, setDay] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [competition, setCompetition] = useState(ALL);
  const [state, setState] = useState(ALL);
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_RANGE);

  const approved = coverages.filter(
    (c) => c.credential_status === "approved" && !c.completed_at && c.match,
  );

  const competitionOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of approved) {
      const comp = c.match!.competition;
      if (comp) map.set(comp.id, comp.name);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [approved]);

  const stateOptions = useMemo(
    () => [...new Set(approved.map((c) => c.match!.state).filter(Boolean) as string[])].sort(),
    [approved],
  );

  const items = useMemo(() => {
    const term = stripAccents(search.trim().toLowerCase());
    return approved.filter((c) => {
      const m = c.match!;
      if (competition !== ALL && m.competition_id !== competition) return false;
      if (state !== ALL && m.state !== state) return false;
      if (!inDateRange(m.date, dateRange)) return false;
      if (term) {
        const haystack = stripAccents(
          `${m.home_team} ${m.away_team} ${m.venue ?? ""} ${m.city ?? ""}`.toLowerCase(),
        );
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [approved, search, competition, state, dateRange]);

  /** Eventos esportivos aprovados entram na mesma agenda das partidas. */
  const eventItems = useMemo(() => {
    const term = stripAccents(search.trim().toLowerCase());
    return eventCoverages.filter((c) => {
      const e = c.event;
      if (!e || c.completed_at) return false;
      if (c.credential_status !== "approved") return false;
      // O filtro de campeonato não se aplica a eventos.
      if (competition !== ALL) return false;
      if (state !== ALL && e.state !== state) return false;
      if (!inDateRange(e.start_date, dateRange)) return false;
      if (term) {
        const haystack = stripAccents(
          `${e.name} ${e.venue ?? ""} ${e.city ?? ""} ${e.sport}`.toLowerCase(),
        );
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [eventCoverages, search, competition, state, dateRange]);

  /** Lista unificada (partidas + eventos) ordenada cronologicamente. */
  const timeline = useMemo(() => {
    const rows = [
      ...items.map((c) => ({
        kind: "match" as const,
        key: `m-${c.id}`,
        sort: `${c.match!.date}${c.match!.time}`,
        coverage: c,
      })),
      ...eventItems.map((c) => ({
        kind: "event" as const,
        key: `e-${c.id}`,
        sort: `${c.event!.start_date}${c.event!.start_time ?? "99:99"}`,
        coverage: c,
      })),
    ];
    return rows.sort((a, b) => a.sort.localeCompare(b.sort));
  }, [items, eventItems]);

  /** No calendário aparecem apenas as partidas com cobertura aprovada. */
  const approvedMatches = useMemo(() => items.map((c) => c.match!), [items]);
  const byMatchId = useMemo(() => new Map(items.map((c) => [c.match_id, c])), [items]);
  const dayItems = useMemo(
    () => (day ? items.filter((c) => c.match!.date === day) : []),
    [items, day],
  );

  return (
    <div className="space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">Minha Agenda</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {timeline.length}{" "}
            {timeline.length === 1 ? "cobertura aprovada" : "coberturas aprovadas"}.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {timeline.length > 0 && (
            <Button
              id="export-agenda-ics-btn"
              size="sm"
              variant="outline"
              onClick={() =>
                exportAgendaToIcs(
                  timeline.map((item) => ({
                    type: item.kind,
                    match: item.kind === "match" ? item.coverage.match : null,
                    event: item.kind === "event" ? item.coverage.event : null,
                  })),
                  "Minha Agenda — FotoPress",
                )
              }
              className="gap-1.5 text-xs"
              title="Baixar arquivo .ics com todos os eventos aprovados da agenda"
            >
              <Download className="size-4 text-primary" />
              <span className="hidden sm:inline">Exportar .ics</span>
            </Button>
          )}
          <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
            <Button
              size="sm"
              variant={view === "lista" ? "secondary" : "ghost"}
              onClick={() => setView("lista")}
            >
              <List className="size-4" /> Lista
            </Button>
            <Button
              size="sm"
              variant={view === "calendario" ? "secondary" : "ghost"}
              onClick={() => setView("calendario")}
            >
              <CalendarDays className="size-4" /> Calendário
            </Button>
          </div>
        </div>
      </header>

      {view === "calendario" && (
        <div className="space-y-4">
          <MonthCalendar
            month={month}
            onMonthChange={setMonth}
            matches={approvedMatches}
            onSelect={(match) => setSelected(byMatchId.get(match.id) ?? null)}
            onDaySelect={(value) => setDay((current) => (current === value ? null : value))}
            selectedDay={day}
          />
          {day && (
            <div className="space-y-2">
              <h2 className="text-sm font-medium capitalize">
                {format(parseISO(day), "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </h2>
              {dayItems.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma cobertura neste dia.</p>
              ) : (
                <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                  {dayItems.map((item) => (
                    <li key={item.id}>
                      <button
                        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface"
                        onClick={() => setSelected(item)}
                      >
                        <span className="w-12 shrink-0 text-xs text-muted-foreground">
                          {item.match!.time.slice(0, 5)}
                        </span>
                        <TeamCrest name={item.match!.home_team} size="sm" />
                        <span className="min-w-0 flex-1 truncate text-sm">
                          {item.match!.home_team} <span className="text-muted-foreground">×</span>{" "}
                          {item.match!.away_team}
                        </span>
                        <TeamCrest name={item.match!.away_team} size="sm" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {view === "lista" && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Buscar time, estádio ou cidade"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-[260px]"
          />
          <Select value={competition} onValueChange={setCompetition}>
            <SelectTrigger className="w-[210px]">
              <SelectValue placeholder="Campeonato" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os campeonatos</SelectItem>
              {competitionOptions.map(([id, name]) => (
                <SelectItem key={id} value={id}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={state} onValueChange={setState}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os estados</SelectItem>
              {stateOptions.map((uf) => (
                <SelectItem key={uf} value={uf}>
                  {uf}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="w-full">
            <DateRangeFilter value={dateRange} onChange={setDateRange} />
          </div>
        </div>
      )}

      {view === "calendario" ? null : isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : timeline.length === 0 ? (
        <EmptyState
          icon={Star}
          title="Sua agenda ainda está vazia"
          description="Quando uma cobertura for selecionada/aprovada, ela aparecerá aqui."
          action={
            <Button asChild size="sm">
              <Link to="/jogos">Ver jogos</Link>
            </Button>
          }
          learnLabel="Entender o fluxo"
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {timeline.map((row) => {
            if (row.kind === "event") {
              const item = row.coverage as EventCoverage;
              const ev = item.event!;
              return (
                <li key={row.key} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <div className="w-20 shrink-0">
                    <div className="text-lg font-semibold capitalize">
                      {format(parseISO(ev.start_date), "dd MMM", { locale: ptBR })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {ev.start_time ? ev.start_time.slice(0, 5) : "—"}
                    </div>
                  </div>

                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setSelectedEvent(ev)}
                    title="Abrir detalhes do evento"
                  >
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-surface px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                        Evento
                      </span>
                      <span className="truncate text-sm font-medium">{ev.name}</span>
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {formatSportLabel(ev.sport)}
                      {ev.venue ? ` · ${ev.venue}` : ""}
                      {ev.city ? ` · ${ev.city}` : ""}
                    </div>
                  </button>
                </li>
              );
            }

            const item = row.coverage as Coverage;
            const match = item.match!;
            const style = compStyle(match.competition?.color);
            const radar = radars[match.id];
            const state = radarState(radar);
            return (
              <li key={row.key} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="w-20 shrink-0">
                  <div className="text-lg font-semibold capitalize">
                    {format(parseISO(match.date), "dd MMM", { locale: ptBR })}
                  </div>
                  <div className="text-xs text-muted-foreground">{match.time.slice(0, 5)}</div>
                </div>

                <TeamCrest name={match.home_team} />

                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => setSelected(item)}
                  title="Abrir detalhes e radar"
                >
                  <div className="truncate text-sm font-medium">
                    {match.home_team} <span className="text-muted-foreground">×</span>{" "}
                    {match.away_team}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className={`size-1.5 rounded-full ${style.dot}`} />
                    {match.competition?.name}
                    {match.venue ? ` · ${match.venue}` : ""}
                    {match.city ? ` · ${match.city}` : ""}
                  </div>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className={`size-1.5 rounded-full ${RADAR_DOT[state]}`} />
                    {RADAR_LABEL[state]}
                    {radar?.last_synced_at
                      ? ` · sincronizado em ${format(parseISO(radar.last_synced_at), "dd/MM HH:mm", { locale: ptBR })}`
                      : " · nunca sincronizado"}
                  </div>
                </button>

                <TeamCrest name={match.away_team} />

                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => complete.mutate(item.id)}
                    disabled={complete.isPending}
                  >
                    <Check className="size-4" /> Concluído
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remover cobertura"
                    onClick={() => remove.mutate(item.id)}
                    disabled={remove.isPending}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                  <MatchActions match={match} />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <EventDetailSheet
        event={selectedEvent}
        onOpenChange={(open) => !open && setSelectedEvent(null)}
      />

      <AgendaMatchSheet
        coverage={selected}
        radar={selected ? radars[selected.match_id] : null}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </div>
  );
}
