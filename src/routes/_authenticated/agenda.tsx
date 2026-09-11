import { createFileRoute, Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Bell,
  CalendarDays,
  CalendarPlus,
  Check,
  Download,
  List,
  MapPin,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";

import { AgendaMatchSheet } from "@/components/agenda-match-sheet";
import { EventDetailSheet } from "@/components/event-detail-sheet";
import { EmptyState } from "@/components/empty-state";
import {
  agendaSportEventToExport,
  exportAgendaToIcs,
  getGoogleCalendarUrl,
  matchToSportEvent,
} from "@/lib/calendar-export";
import { CoverageReminderToggle } from "@/components/coverage-reminder-toggle";
import { CoverageRemindersDialog } from "@/components/coverage-reminders-dialog";
import {
  CoverageStatusBadge,
  toCoverageStatus,
  toCredentialStatus,
  type SimpleCoverageStatus,
} from "@/components/coverage-status-badge";
import { CoverageNotesEditor } from "@/components/coverage-notes-editor";
import {
  DateRangeFilter,
  EMPTY_RANGE,
  getNext7DaysRange,
  getThisWeekRange,
  getTodayRange,
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
import { isRadarEnabled } from "@/lib/features";
import { RADAR_DOT, RADAR_LABEL, radarState, useRadars } from "@/lib/radar";
import { stripAccents } from "@/lib/teams";
import {
  useEventCoverageMutations,
  useEventCoverages,
  type EventCoverage,
  type SportEvent,
} from "@/lib/events";
import { formatSportLabel } from "@/lib/sports";

const ALL = "todos";

export const Route = createFileRoute("/_authenticated/agenda")({
  head: () => ({
    meta: [
      { title: "Minha Agenda — Cobertura esportiva" },
      {
        name: "description",
        content:
          "Coberturas com status, notas livres, lembretes push, estádio e exportação de calendário .ics.",
      },
      { property: "og:title", content: "Minha Agenda — Cobertura esportiva" },
      {
        property: "og:description",
        content: "Acompanhe coberturas esportivas com status, notas e alertas no calendário.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AgendaPage,
});

function AgendaPage() {
  const { data: coverages = [], isLoading: loadingCoverages } = useCoverages();
  const {
    remove,
    complete,
    setStatus: setMatchStatus,
    setNotes: setMatchNotes,
  } = useCoverageMutations();
  const { data: radars = {} } = useRadars();
  const { data: eventCoverages = [], isLoading: loadingEvents } = useEventCoverages();
  const { setStatus: setEventStatus, setNotes: setEventNotes } = useEventCoverageMutations();

  const [selected, setSelected] = useState<Coverage | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<SportEvent | null>(null);
  const [remindersOpen, setRemindersOpen] = useState(false);
  const [view, setView] = useState<"lista" | "calendario">("lista");
  const [month, setMonth] = useState(() => new Date());
  const [day, setDay] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [venueSearch, setVenueSearch] = useState("");
  const [competition, setCompetition] = useState(ALL);
  const [state, setState] = useState(ALL);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_RANGE);

  // Coberturas ativas (não concluídas) de partidas e eventos
  const activeCoverages = useMemo(
    () => coverages.filter((c) => !c.completed_at && c.match),
    [coverages],
  );
  const activeEventCoverages = useMemo(
    () => eventCoverages.filter((c) => !c.completed_at && c.event),
    [eventCoverages],
  );

  // Extrai estádios e locais únicos disponíveis nas coberturas agendadas
  const availableVenues = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    for (const c of activeCoverages) {
      const v = c.match?.venue?.trim();
      if (v) {
        const norm = stripAccents(v.toLowerCase());
        const existing = map.get(norm);
        if (existing) {
          existing.count += 1;
        } else {
          map.set(norm, { name: v, count: 1 });
        }
      }
    }
    for (const c of activeEventCoverages) {
      const v = c.event?.venue?.trim();
      if (v) {
        const norm = stripAccents(v.toLowerCase());
        const existing = map.get(norm);
        if (existing) {
          existing.count += 1;
        } else {
          map.set(norm, { name: v, count: 1 });
        }
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => b.count - a.count || a.name.localeCompare(b.name),
    );
  }, [activeCoverages, activeEventCoverages]);

  // Identifica qual filtro rápido de data está ativo
  const activePreset = useMemo(() => {
    const today = getTodayRange();
    const thisWeek = getThisWeekRange();
    const next7Days = getNext7DaysRange();
    if (!dateRange.from && !dateRange.to) return "todos";
    if (dateRange.from === today.from && dateRange.to === today.to) return "hoje";
    if (dateRange.from === thisWeek.from && dateRange.to === thisWeek.to) return "semana";
    if (dateRange.from === next7Days.from && dateRange.to === next7Days.to) return "7dias";
    return "custom";
  }, [dateRange]);

  const setPreset = (preset: "todos" | "hoje" | "semana" | "7dias") => {
    switch (preset) {
      case "todos":
        setDateRange(EMPTY_RANGE);
        break;
      case "hoje":
        setDateRange(getTodayRange());
        break;
      case "semana":
        setDateRange(getThisWeekRange());
        break;
      case "7dias":
        setDateRange(getNext7DaysRange());
        break;
    }
  };

  // Contadores por status para exibição rápida no cabeçalho e filtro
  const statusCounts = useMemo(() => {
    let confirmed = 0;
    let pending = 0;
    let cancelled = 0;
    for (const c of activeCoverages) {
      const s = toCoverageStatus(c.credential_status);
      if (s === "confirmed") confirmed++;
      else if (s === "pending") pending++;
      else if (s === "cancelled") cancelled++;
    }
    for (const c of activeEventCoverages) {
      const s = toCoverageStatus(c.credential_status);
      if (s === "confirmed") confirmed++;
      else if (s === "pending") pending++;
      else if (s === "cancelled") cancelled++;
    }
    return { confirmed, pending, cancelled, total: confirmed + pending + cancelled };
  }, [activeCoverages, activeEventCoverages]);

  const competitionOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of activeCoverages) {
      const comp = c.match!.competition;
      if (comp) map.set(comp.id, comp.name);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [activeCoverages]);

  const stateOptions = useMemo(
    () =>
      [...new Set(activeCoverages.map((c) => c.match!.state).filter(Boolean) as string[])].sort(),
    [activeCoverages],
  );

  const items = useMemo(() => {
    const term = stripAccents(search.trim().toLowerCase());
    const venueTerm = stripAccents(venueSearch.trim().toLowerCase());
    return activeCoverages.filter((c) => {
      const m = c.match!;
      const currentStatus = toCoverageStatus(c.credential_status);
      if (statusFilter !== ALL && currentStatus !== statusFilter) return false;
      if (competition !== ALL && m.competition_id !== competition) return false;
      if (state !== ALL && m.state !== state) return false;
      if (!inDateRange(m.date, dateRange)) return false;
      if (venueTerm) {
        const venueHaystack = stripAccents(`${m.venue ?? ""} ${m.city ?? ""}`.toLowerCase());
        if (!venueHaystack.includes(venueTerm)) return false;
      }
      if (term) {
        const haystack = stripAccents(
          `${m.home_team} ${m.away_team} ${m.venue ?? ""} ${m.city ?? ""} ${c.notes ?? ""}`.toLowerCase(),
        );
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [activeCoverages, search, venueSearch, competition, state, dateRange, statusFilter]);

  const eventItems = useMemo(() => {
    const term = stripAccents(search.trim().toLowerCase());
    const venueTerm = stripAccents(venueSearch.trim().toLowerCase());
    return activeEventCoverages.filter((c) => {
      const e = c.event!;
      const currentStatus = toCoverageStatus(c.credential_status);
      if (statusFilter !== ALL && currentStatus !== statusFilter) return false;
      if (competition !== ALL) return false;
      if (state !== ALL && e.state !== state) return false;
      if (!inDateRange(e.start_date, dateRange)) return false;
      if (venueTerm) {
        const venueHaystack = stripAccents(`${e.venue ?? ""} ${e.city ?? ""}`.toLowerCase());
        if (!venueHaystack.includes(venueTerm)) return false;
      }
      if (term) {
        const haystack = stripAccents(
          `${e.name} ${e.venue ?? ""} ${e.city ?? ""} ${e.sport} ${c.notes ?? ""}`.toLowerCase(),
        );
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [activeEventCoverages, search, venueSearch, competition, state, dateRange, statusFilter]);

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

  /** No calendário aparecem apenas as partidas ativas da agenda. */
  const approvedMatches = useMemo(() => items.map((c) => c.match!), [items]);
  const byMatchId = useMemo(() => new Map(items.map((c) => [c.match_id, c])), [items]);
  const dayItems = useMemo(
    () => (day ? items.filter((c) => c.match!.date === day) : []),
    [items, day],
  );

  const isLoading = loadingCoverages || loadingEvents;

  return (
    <div className="space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">Minha Agenda</h1>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>
              {timeline.length} {timeline.length === 1 ? "cobertura" : "coberturas"}
            </span>
            <span className="text-border">·</span>
            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              {statusCounts.confirmed} confirmados
            </span>
            <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-medium">
              <span className="size-1.5 rounded-full bg-amber-500" />
              {statusCounts.pending} pendentes
            </span>
            {statusCounts.cancelled > 0 && (
              <span className="inline-flex items-center gap-1 text-rose-700 dark:text-rose-400 font-medium">
                <span className="size-1.5 rounded-full bg-rose-500" />
                {statusCounts.cancelled} cancelados
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            id="agenda-open-reminders-btn"
            size="sm"
            variant="outline"
            onClick={() => setRemindersOpen(true)}
            className="gap-1.5 text-xs"
            title="Configurar lembretes e notificações push de coberturas"
          >
            <Bell className="size-4 text-primary" />
            <span className="hidden sm:inline">Lembretes</span>
          </Button>

          {timeline.length > 0 && (
            <Button
              id="export-agenda-ics-btn"
              size="sm"
              variant="outline"
              onClick={() =>
                exportAgendaToIcs(
                  timeline.map((item) => ({
                    type: item.kind,
                    match: item.kind === "match" ? (item.coverage as Coverage).match : null,
                    event: item.kind === "event" ? (item.coverage as EventCoverage).event : null,
                    notes: item.coverage.notes,
                    status: toCoverageStatus(item.coverage.credential_status),
                  })),
                  "Minha Agenda — FotoPress",
                )
              }
              className="gap-1.5 text-xs"
              title="Baixar arquivo .ics com alertas e notas para Google Calendar, Outlook e Apple Calendar"
            >
              <Download className="size-4 text-primary" />
              <span className="hidden sm:inline">Exportar (.ics)</span>
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
                      <div className="flex w-full items-center justify-between gap-3 px-4 py-3 hover:bg-surface">
                        <button
                          className="flex min-w-0 flex-1 items-center gap-3 text-left"
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
                        <div className="flex items-center gap-2">
                          <CoverageStatusBadge
                            status={toCoverageStatus(item.credential_status)}
                            onChange={(newStatus) =>
                              setMatchStatus.mutate({
                                id: item.id,
                                status: toCredentialStatus(newStatus),
                              })
                            }
                          />
                          <CoverageNotesEditor
                            coverageId={item.id}
                            initialNotes={item.notes}
                            onSave={async (notes) => {
                              await setMatchNotes.mutateAsync({ id: item.id, notes });
                            }}
                            variant="card"
                          />
                          <CoverageReminderToggle
                            coverageId={item.id}
                            reminderEnabled={item.reminder_enabled}
                            kind="match"
                            variant="icon"
                          />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}

      {view === "lista" && (
        <div className="space-y-3">
          {/* Filtros rápidos de data ('Hoje', 'Esta semana', 'Próximos 7 dias') e Seletor de Status */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-lg border border-border/80 bg-card/60 p-2.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground mr-1">Período:</span>
              <Button
                id="filter-date-all"
                type="button"
                size="sm"
                variant={activePreset === "todos" ? "default" : "outline"}
                onClick={() => setPreset("todos")}
                className="h-7 text-xs px-2.5"
              >
                Todos
              </Button>
              <Button
                id="filter-date-today"
                type="button"
                size="sm"
                variant={activePreset === "hoje" ? "default" : "outline"}
                onClick={() => setPreset("hoje")}
                className="h-7 text-xs px-2.5"
              >
                Hoje
              </Button>
              <Button
                id="filter-date-this-week"
                type="button"
                size="sm"
                variant={activePreset === "semana" ? "default" : "outline"}
                onClick={() => setPreset("semana")}
                className="h-7 text-xs px-2.5"
              >
                Esta semana
              </Button>
              <Button
                id="filter-date-next-7-days"
                type="button"
                size="sm"
                variant={activePreset === "7dias" ? "default" : "outline"}
                onClick={() => setPreset("7dias")}
                className="h-7 text-xs px-2.5"
              >
                Próximos 7 dias
              </Button>
              {activePreset === "custom" && (
                <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  Personalizado
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-muted-foreground mr-1">Status:</span>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="filter-status-select" className="h-7 w-[160px] text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL} className="text-xs">
                    Todos os status ({statusCounts.total})
                  </SelectItem>
                  <SelectItem value="confirmed" className="text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-emerald-500" />
                      <span>Confirmados ({statusCounts.confirmed})</span>
                    </span>
                  </SelectItem>
                  <SelectItem value="pending" className="text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-amber-500" />
                      <span>Pendentes ({statusCounts.pending})</span>
                    </span>
                  </SelectItem>
                  <SelectItem value="cancelled" className="text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-rose-500" />
                      <span>Cancelados ({statusCounts.cancelled})</span>
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Busca por texto e selects de campeonato, estado e intervalo */}
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Buscar time, estádio, cidade ou notas..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-[260px] h-9 text-xs"
            />
            <Select value={competition} onValueChange={setCompetition}>
              <SelectTrigger className="w-[210px] h-9 text-xs">
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
              <SelectTrigger className="w-[140px] h-9 text-xs">
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

          {/* Barra de busca rápida por local ou estádio e chips dos locais mais frequentes */}
          <div className="space-y-2 pt-2 border-t border-border/60">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[260px]">
                <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-primary" />
                <Input
                  id="agenda-venue-quick-search"
                  placeholder="Busca rápida por estádio ou local (ex: Maracanã, Allianz, Morumbi, Arena)..."
                  value={venueSearch}
                  onChange={(e) => setVenueSearch(e.target.value)}
                  className="pl-8 pr-7 h-9 text-xs"
                />
                {venueSearch && (
                  <button
                    type="button"
                    onClick={() => setVenueSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
                    title="Limpar busca de estádio"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {venueSearch && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setVenueSearch("")}
                  className="h-9 text-xs text-muted-foreground hover:text-foreground gap-1"
                >
                  <X className="size-3.5" /> Limpar filtro de local
                </Button>
              )}
            </div>

            {/* Chips de estádios / locais mais frequentes */}
            {availableVenues.length > 0 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                <span className="text-muted-foreground mr-1 flex items-center gap-1 text-[11px] shrink-0 font-medium">
                  <MapPin className="size-3 text-primary" /> Estádios na agenda:
                </span>
                {availableVenues.slice(0, 8).map((v) => {
                  const isSelected =
                    stripAccents(venueSearch.toLowerCase()) === stripAccents(v.name.toLowerCase());
                  return (
                    <button
                      key={v.name}
                      type="button"
                      onClick={() => setVenueSearch(isSelected ? "" : v.name)}
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors shrink-0 cursor-pointer border flex items-center gap-1.5",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary shadow-xs"
                          : "bg-surface border-border text-muted-foreground hover:text-foreground hover:bg-accent",
                      )}
                      title={`Filtrar por ${v.name} (${v.count} ${v.count === 1 ? "evento" : "eventos"})`}
                    >
                      <span>{v.name}</span>
                      <span
                        className={cn(
                          "rounded-full px-1 text-[9px] font-bold",
                          isSelected ? "bg-white/20 text-white" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {v.count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {view === "calendario" ? null : isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : timeline.length === 0 ? (
        <EmptyState
          icon={Star}
          title="Nenhuma cobertura encontrada"
          description={
            statusFilter !== ALL || activePreset !== "todos" || search
              ? "Tente ajustar os filtros de período ou status da agenda."
              : "Quando uma cobertura for adicionada ou solicitada, ela aparecerá aqui."
          }
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
                <li
                  key={row.key}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-surface/50"
                >
                  <div className="flex items-center gap-4 min-w-0 flex-1">
                    <div className="w-20 shrink-0">
                      <div className="text-lg font-semibold capitalize">
                        {format(parseISO(ev.start_date), "dd MMM", { locale: ptBR })}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {ev.start_time ? ev.start_time.slice(0, 5) : "—"}
                      </div>
                    </div>

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          className="truncate text-left text-sm font-medium hover:underline"
                          onClick={() => setSelectedEvent(ev)}
                          title="Abrir detalhes do evento"
                        >
                          {ev.name}
                        </button>

                        <CoverageStatusBadge
                          status={toCoverageStatus(item.credential_status)}
                          onChange={(newStatus) =>
                            setEventStatus.mutate({
                              id: item.id,
                              status: toCredentialStatus(newStatus),
                            })
                          }
                        />

                        <CoverageReminderToggle
                          coverageId={item.id}
                          reminderEnabled={item.reminder_enabled}
                          kind="event"
                          variant="badge"
                        />
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          Evento
                        </span>
                        <span>{formatSportLabel(ev.sport)}</span>
                        {ev.venue ? <span>· {ev.venue}</span> : null}
                        {ev.city ? <span>· {ev.city}</span> : null}
                      </div>

                      {/* Editor de notas / lembretes livres */}
                      <div className="pt-0.5">
                        <CoverageNotesEditor
                          coverageId={item.id}
                          initialNotes={item.notes}
                          onSave={async (notes) => {
                            await setEventNotes.mutateAsync({ id: item.id, notes });
                          }}
                          variant="card"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="h-8 text-xs gap-1 hover:border-primary hover:text-primary"
                      title="Adicionar ao Google Calendar"
                    >
                      <a
                        href={getGoogleCalendarUrl(agendaSportEventToExport(ev))}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <CalendarPlus className="size-3.5 text-primary" />
                        <span className="hidden sm:inline">Google Calendar</span>
                      </a>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedEvent(ev)}
                      className="h-8 text-xs"
                    >
                      Detalhes
                    </Button>
                  </div>
                </li>
              );
            }

            const item = row.coverage as Coverage;
            const match = item.match!;
            const style = compStyle(match.competition?.color);
            const radar = isRadarEnabled() ? radars[match.id] : undefined;
            const state = isRadarEnabled() ? radarState(radar) : "none";
            return (
              <li
                key={row.key}
                className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-surface/50"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-20 shrink-0">
                    <div className="text-lg font-semibold capitalize">
                      {format(parseISO(match.date), "dd MMM", { locale: ptBR })}
                    </div>
                    <div className="text-xs text-muted-foreground">{match.time.slice(0, 5)}</div>
                  </div>

                  <TeamCrest name={match.home_team} teamId={match.home_team_id} />

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        className="truncate text-left text-sm font-medium hover:underline"
                        onClick={() => setSelected(item)}
                        title={
                          isRadarEnabled() ? "Abrir detalhes e radar" : "Abrir detalhes da partida"
                        }
                      >
                        <span>
                          {match.home_team}{" "}
                          <span className="font-normal text-muted-foreground">×</span>{" "}
                          {match.away_team}
                        </span>
                      </button>

                      <CoverageStatusBadge
                        status={toCoverageStatus(item.credential_status)}
                        onChange={(newStatus) =>
                          setMatchStatus.mutate({
                            id: item.id,
                            status: toCredentialStatus(newStatus),
                          })
                        }
                      />

                      <CoverageReminderToggle
                        coverageId={item.id}
                        reminderEnabled={item.reminder_enabled}
                        kind="match"
                        variant="badge"
                      />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className={`size-1.5 rounded-full ${style.dot}`} />
                      <span>{match.competition?.name}</span>
                      {match.venue ? <span>· {match.venue}</span> : null}
                      {match.city ? <span>· {match.city}</span> : null}
                    </div>

                    {isRadarEnabled() && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span className={`size-1.5 rounded-full ${RADAR_DOT[state]}`} />
                        <span>{RADAR_LABEL[state]}</span>
                        {radar?.last_synced_at ? (
                          <span>
                            · sinc.{" "}
                            {format(parseISO(radar.last_synced_at), "dd/MM HH:mm", {
                              locale: ptBR,
                            })}
                          </span>
                        ) : null}
                      </div>
                    )}

                    {/* Editor de notas / lembretes livres */}
                    <div className="pt-0.5">
                      <CoverageNotesEditor
                        coverageId={item.id}
                        initialNotes={item.notes}
                        onSave={async (notes) => {
                          await setMatchNotes.mutateAsync({ id: item.id, notes });
                        }}
                        variant="card"
                      />
                    </div>
                  </div>

                  <TeamCrest name={match.away_team} teamId={match.away_team_id} />
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="h-8 text-xs gap-1 hover:border-primary hover:text-primary hidden sm:inline-flex"
                    title="Adicionar ao Google Calendar"
                  >
                    <a
                      href={getGoogleCalendarUrl(matchToSportEvent(match))}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <CalendarPlus className="size-3.5 text-primary" />
                      <span className="hidden md:inline">Google Calendar</span>
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => complete.mutate(item.id)}
                    disabled={complete.isPending}
                    className="h-8 text-xs"
                  >
                    <Check className="size-3.5 mr-1 text-emerald-600" /> Concluído
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remover cobertura"
                    onClick={() => remove.mutate(item.id)}
                    disabled={remove.isPending}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
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
        radar={isRadarEnabled() && selected ? radars[selected.match_id] : null}
        onOpenChange={(open) => !open && setSelected(null)}
      />

      <CoverageRemindersDialog open={remindersOpen} onOpenChange={setRemindersOpen} />
    </div>
  );
}
