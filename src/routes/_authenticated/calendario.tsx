import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, LayoutGrid, Sparkles } from "lucide-react";

import { MonthCalendar } from "@/components/month-calendar";
import { MatchCard } from "@/components/match-card";
import { MatchDetailDialog } from "@/components/match-detail-dialog";
import { SportsEventCalendar } from "@/components/sports-event-calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEvents } from "@/lib/events";
import { useCompetitions, useMatches, type Match } from "@/lib/queries";
import type { SportEvent, SportEventStatus } from "@/schemas/sport-event";

export const Route = createFileRoute("/_authenticated/calendario")({
  head: () => ({
    meta: [
      { title: "Calendário de jogos — Cobertura esportiva" },
      {
        name: "description",
        content: "Visualize todos os jogos do mês por campeonato, categoria, cidade e período.",
      },
      { property: "og:title", content: "Calendário de jogos — Cobertura esportiva" },
      {
        name: "og:description",
        content: "Todos os jogos disponíveis em uma visão mensal.",
      },
    ],
  }),
  component: CalendarPage,
});

const ALL = "todos";

function CalendarPage() {
  const [viewMode, setViewMode] = useState<"upcoming" | "monthly">("upcoming");
  const [month, setMonth] = useState(() => new Date());
  const [selected, setSelected] = useState<Match | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [competition, setCompetition] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [city, setCity] = useState(ALL);
  const [period, setPeriod] = useState(ALL);

  const { data: matches = [], isLoading: loadingMatches } = useMatches();
  const { data: competitions = [] } = useCompetitions();
  const { data: genericEvents = [], isLoading: loadingEvents } = useEvents();
  const isEventsLoading = loadingMatches || loadingEvents;

  const categories = useMemo(
    () => Array.from(new Set(competitions.map((c) => c.category))).sort(),
    [competitions],
  );
  const cities = useMemo(
    () => Array.from(new Set(matches.map((m) => m.city).filter(Boolean) as string[])).sort(),
    [matches],
  );

  // Mapeia todas as partidas e eventos cadastrados para o formato SportEvent padronizado
  const normalizedSportsEvents = useMemo<SportEvent[]>(() => {
    const list: SportEvent[] = [];
    const todayStr = format(new Date(), "yyyy-MM-dd");

    // Adiciona partidas (matches)
    for (const m of matches) {
      let status: SportEventStatus = "scheduled";
      if (m.date < todayStr) {
        status = "completed";
      } else if (m.date === todayStr) {
        status = "in_progress";
      }

      const homeName = m.home_team?.name ?? "Time da Casa";
      const awayName = m.away_team?.name ?? "Time Visitante";

      list.push({
        id: m.id,
        title: `${homeName} × ${awayName}`,
        sportType: "Futebol",
        date: m.date,
        time: m.time ? m.time.slice(0, 5) : null,
        venue: m.venue ?? null,
        status,
        homeTeam: homeName,
        awayTeam: awayName,
        competition: m.competition?.name ?? null,
        city: m.city ?? null,
        state: m.state ?? null,
        createdAt: m.created_at,
      });
    }

    // Adiciona outros eventos esportivos (corridas, beach tennis, etc.)
    for (const e of genericEvents) {
      let status: SportEventStatus = "scheduled";
      if (e.status === "completed") status = "completed";
      else if (e.start_date === todayStr) status = "in_progress";

      list.push({
        id: e.id,
        title: e.name,
        sportType: e.sport || "Esportes Gerais",
        date: e.start_date,
        time: e.start_time ? e.start_time.slice(0, 5) : null,
        venue: e.venue ?? null,
        status,
        competition: e.organizer ?? null,
        city: e.city ?? null,
        state: e.state ?? null,
        notes: e.notes ?? null,
        createdAt: e.created_at,
      });
    }

    return list;
  }, [matches, genericEvents]);

  const filtered = useMemo(() => {
    const now = new Date();
    return matches.filter((m) => {
      if (competition !== ALL && m.competition_id !== competition) return false;
      if (category !== ALL && m.competition?.category !== category) return false;
      if (city !== ALL && m.city !== city) return false;
      if (period !== ALL) {
        const d = parseISO(m.date);
        if (
          period === "semana" &&
          !(d >= startOfWeek(now, { weekStartsOn: 1 }) && d <= endOfWeek(now, { weekStartsOn: 1 }))
        )
          return false;
        if (period === "mes" && !(d >= startOfMonth(now) && d <= endOfMonth(now))) return false;
        if (period === "futuros" && d < new Date(now.toDateString())) return false;
      }
      return true;
    });
  }, [matches, competition, category, city, period]);

  const dayMatches = useMemo(
    () => (day ? filtered.filter((m) => m.date === day) : []),
    [filtered, day],
  );

  const hasFilters = [competition, category, city, period].some((v) => v !== ALL);

  const handleSelectSportsEvent = (event: SportEvent) => {
    const match = matches.find((m) => m.id === event.id);
    if (match) {
      setSelected(match);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendário de Jogos e Eventos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Visualize os próximos eventos esportivos, filtre por time e campeonato ou navegue pelo
            calendário mensal.
          </p>
        </div>

        {/* Alternador de visualização */}
        <Tabs
          value={viewMode}
          onValueChange={(v) => setViewMode(v as "upcoming" | "monthly")}
          className="w-auto"
        >
          <TabsList className="h-9">
            <TabsTrigger value="upcoming" id="tab-upcoming-calendar" className="text-xs gap-1.5">
              <Sparkles className="size-3.5 text-primary" /> Próximos Eventos
            </TabsTrigger>
            <TabsTrigger value="monthly" id="tab-monthly-calendar" className="text-xs gap-1.5">
              <LayoutGrid className="size-3.5" /> Grade Mensal
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      {/* Visualização de Próximos Eventos Esportivos com Calendário Interativo e Busca */}
      {viewMode === "upcoming" ? (
        <SportsEventCalendar
          events={normalizedSportsEvents}
          onEventSelect={handleSelectSportsEvent}
          isLoading={isEventsLoading}
          id="calendar-upcoming-view"
        />
      ) : (
        /* Visualização da Grade Mensal Completa com Filtros */
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={competition} onValueChange={setCompetition}>
              <SelectTrigger className="w-[190px]">
                <SelectValue placeholder="Campeonato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os campeonatos</SelectItem>
                {competitions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas as categorias</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={city} onValueChange={setCity}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Cidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas as cidades</SelectItem>
                {cities.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Qualquer período</SelectItem>
                <SelectItem value="semana">Esta semana</SelectItem>
                <SelectItem value="mes">Este mês</SelectItem>
                <SelectItem value="futuros">A partir de hoje</SelectItem>
              </SelectContent>
            </Select>

            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCompetition(ALL);
                  setCategory(ALL);
                  setCity(ALL);
                  setPeriod(ALL);
                }}
              >
                Limpar filtros
              </Button>
            )}
          </div>

          <MonthCalendar
            month={month}
            onMonthChange={setMonth}
            matches={filtered}
            onSelect={setSelected}
            onDaySelect={(day) => setDay((current) => (current === day ? null : day))}
            selectedDay={day}
          />

          {day && (
            <section className="space-y-3">
              <h2 className="text-sm font-medium">
                Jogos de {format(parseISO(day), "dd 'de' MMMM", { locale: ptBR })}
              </h2>
              {dayMatches.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum jogo nesta data.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {dayMatches.map((m) => (
                    <MatchCard key={m.id} match={m} onClick={() => setSelected(m)} />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      )}

      <MatchDetailDialog match={selected} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  );
}
