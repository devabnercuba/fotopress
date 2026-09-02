import React, { useMemo, useState } from "react";
import {
  addDays,
  format,
  isAfter,
  isBefore,
  isSameDay,
  isToday,
  parseISO,
  startOfDay,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Clock, Filter, Heart, MapPin, Sparkles, Trophy } from "lucide-react";

import { EventSearchInput, type SearchScope } from "@/components/event-search-input";
import { EventStatusBadge } from "@/components/event-status-badge";
import {
  NoDayEventsEmptyState,
  NoFavoritesEmptyState,
  NoSearchResultsEmptyState,
} from "@/components/sports-empty-states";
import { SportsEventDetailsDialog } from "@/components/sports-event-details-dialog";
import { SportsCalendarSkeleton } from "@/components/sports-event-skeletons";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useEventFavorites } from "@/lib/favorites";
import { cn } from "@/lib/utils";
import type { ISportEvent, SportEvent, SportEventStatus } from "@/schemas/sport-event";

export interface SportsEventCalendarProps {
  events: (SportEvent | ISportEvent)[];
  onEventSelect?: (event: SportEvent | ISportEvent) => void;
  isLoading?: boolean;
  className?: string;
  id?: string;
}

type DateFilterMode = "all_upcoming" | "today" | "next_7_days" | "selected_date";

/**
 * Componente de Calendário para visualização de datas de eventos esportivos futuros.
 * Utiliza os componentes de UI nativos (Calendar, Card, Button, Badge) com destaque
 * para datas com eventos, status temático, favoritos e filtro integrado por time ou competição.
 */
export function SportsEventCalendar({
  events,
  onEventSelect,
  isLoading = false,
  className,
  id = "sports-event-calendar",
}: SportsEventCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchScope, setSearchScope] = useState<SearchScope>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [filterMode, setFilterMode] = useState<DateFilterMode>("all_upcoming");
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  // Estado para o modal de detalhes reutilizável
  const [selectedDetailEvent, setSelectedDetailEvent] = useState<SportEvent | ISportEvent | null>(
    null,
  );
  const [detailsOpen, setDetailsOpen] = useState(false);

  const { isFavorite, toggleFavorite, favoriteCount } = useEventFavorites();

  const today = useMemo(() => startOfDay(new Date()), []);

  // Mapeamento de datas com eventos e eventos futuros
  const { eventDates, upcomingDates, eventsByDate } = useMemo(() => {
    const dates: Date[] = [];
    const upcoming: Date[] = [];
    const byDate = new Map<string, (SportEvent | ISportEvent)[]>();

    for (const ev of events) {
      if (!ev.date) continue;
      const parsedDate = parseISO(ev.date);
      if (isNaN(parsedDate.getTime())) continue;

      dates.push(parsedDate);
      if (isToday(parsedDate) || isAfter(parsedDate, today)) {
        upcoming.push(parsedDate);
      }

      const key = ev.date;
      const existing = byDate.get(key) ?? [];
      existing.push(ev);
      byDate.set(key, existing);
    }

    return { eventDates: dates, upcomingDates: upcoming, eventsByDate: byDate };
  }, [events, today]);

  // Filtragem dos eventos de acordo com a busca, status, favoritos e modo de data
  const filteredEvents = useMemo(() => {
    const term = searchQuery.trim().toLowerCase();

    return events.filter((ev) => {
      // Filtro de Meus Favoritos
      if (onlyFavorites && !isFavorite(ev.id)) {
        return false;
      }

      // Filtro por texto (Time ou Competição)
      if (term) {
        const homeMatch = ev.homeTeam?.toLowerCase().includes(term);
        const awayMatch = ev.awayTeam?.toLowerCase().includes(term);
        const titleMatch = ev.title?.toLowerCase().includes(term);
        const compMatch = ev.competition?.toLowerCase().includes(term);

        if (searchScope === "team") {
          if (!homeMatch && !awayMatch && !titleMatch) return false;
        } else if (searchScope === "competition") {
          if (!compMatch) return false;
        } else {
          // Escopo 'all': checa time, título ou competição
          if (!homeMatch && !awayMatch && !titleMatch && !compMatch) return false;
        }
      }

      // Filtro por status
      if (statusFilter !== "all" && ev.status !== statusFilter) {
        return false;
      }

      // Filtro por período de data
      if (!ev.date) return false;
      const evDate = parseISO(ev.date);
      if (isNaN(evDate.getTime())) return false;

      if (filterMode === "selected_date") {
        if (!selectedDate) return true;
        return isSameDay(evDate, selectedDate);
      }

      if (filterMode === "today") {
        return isToday(evDate);
      }

      if (filterMode === "next_7_days") {
        const in7Days = addDays(today, 7);
        return (
          (isToday(evDate) || isAfter(evDate, today)) &&
          (isSameDay(evDate, in7Days) || isBefore(evDate, in7Days))
        );
      }

      if (filterMode === "all_upcoming") {
        return isToday(evDate) || isAfter(evDate, today);
      }

      return true;
    });
  }, [
    events,
    onlyFavorites,
    isFavorite,
    searchQuery,
    searchScope,
    statusFilter,
    filterMode,
    selectedDate,
    today,
  ]);

  // Ordenação cronológica: datas mais próximas primeiro
  const sortedEvents = useMemo(() => {
    return [...filteredEvents].sort((a, b) => {
      const dateDiff = a.date.localeCompare(b.date);
      if (dateDiff !== 0) return dateDiff;
      return (a.time ?? "00:00").localeCompare(b.time ?? "00:00");
    });
  }, [filteredEvents]);

  // Eventos na data selecionada no calendário
  const selectedDateEvents = useMemo(() => {
    if (!selectedDate) return [];
    const dateKey = format(selectedDate, "yyyy-MM-dd");
    return eventsByDate.get(dateKey) ?? [];
  }, [selectedDate, eventsByDate]);

  // Contadores para métricas do topo
  const upcomingCount = upcomingDates.length;
  const inProgressCount = events.filter((e) => e.status === "in_progress").length;

  const handleSelectDay = (day: Date | undefined) => {
    setSelectedDate(day);
    if (day) {
      setFilterMode("selected_date");
    }
  };

  const handleOpenEventModal = (event: SportEvent | ISportEvent) => {
    setSelectedDetailEvent(event);
    setDetailsOpen(true);
    onEventSelect?.(event);
  };

  if (isLoading) {
    return <SportsCalendarSkeleton className={className} />;
  }

  return (
    <div id={id} className={cn("space-y-6 w-full", className)}>
      {/* Barra de Filtros, Busca e Favoritos */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-xs">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="w-full md:max-w-md">
            <EventSearchInput
              value={searchQuery}
              onChange={setSearchQuery}
              scope={searchScope}
              onScopeChange={setSearchScope}
              resultsCount={filteredEvents.length}
              totalCount={events.length}
              id={`${id}-search-input`}
            />
          </div>

          {/* Atalhos rápidos de período e Favoritos */}
          <div className="flex flex-wrap items-center gap-1.5 self-stretch md:self-auto">
            {/* Botão de filtro Meus Favoritos */}
            <Button
              id={`${id}-filter-favorites`}
              variant={onlyFavorites ? "default" : "outline"}
              size="sm"
              onClick={() => setOnlyFavorites(!onlyFavorites)}
              className={cn(
                "text-xs gap-1.5 transition-colors",
                onlyFavorites && "bg-rose-600 hover:bg-rose-700 text-white",
              )}
            >
              <Heart className={cn("size-3.5", onlyFavorites ? "fill-current" : "text-rose-500")} />
              <span>Favoritos</span>
              {favoriteCount > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                    onlyFavorites ? "bg-white/20 text-white" : "bg-rose-500/15 text-rose-600",
                  )}
                >
                  {favoriteCount}
                </span>
              )}
            </Button>

            <Button
              id={`${id}-filter-all-upcoming`}
              variant={filterMode === "all_upcoming" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterMode("all_upcoming")}
              className="text-xs"
            >
              <Sparkles className="size-3.5" /> Próximos
            </Button>
            <Button
              id={`${id}-filter-today`}
              variant={filterMode === "today" ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setFilterMode("today");
                setSelectedDate(new Date());
              }}
              className="text-xs"
            >
              Hoje
            </Button>
            <Button
              id={`${id}-filter-next-7-days`}
              variant={filterMode === "next_7_days" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterMode("next_7_days")}
              className="text-xs"
            >
              Próximos 7 dias
            </Button>
          </div>
        </div>

        {/* Filtro por Status do Evento */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border text-xs text-muted-foreground">
          <span className="flex items-center gap-1 text-[11px] font-medium">
            <Filter className="size-3" /> Status:
          </span>
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={cn(
              "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer",
              statusFilter === "all"
                ? "bg-foreground text-background"
                : "bg-surface text-muted-foreground hover:text-foreground",
            )}
          >
            Todos ({events.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("scheduled")}
            className={cn(
              "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer",
              statusFilter === "scheduled"
                ? "bg-comp-blue text-white"
                : "bg-comp-blue/10 text-comp-blue hover:bg-comp-blue/20",
            )}
          >
            Agendados ({events.filter((e) => e.status === "scheduled").length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("in_progress")}
            className={cn(
              "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer",
              statusFilter === "in_progress"
                ? "bg-amber-500 text-white"
                : "bg-amber-500/10 text-amber-700 dark:text-amber-400 hover:bg-amber-500/20",
            )}
          >
            Em Andamento ({inProgressCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("completed")}
            className={cn(
              "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors cursor-pointer",
              statusFilter === "completed"
                ? "bg-comp-green text-white"
                : "bg-comp-green/10 text-comp-green hover:bg-comp-green/20",
            )}
          >
            Concluídos ({events.filter((e) => e.status === "completed").length})
          </button>
        </div>
      </div>

      {/* Grid Principal: Calendário Interativo + Lista de Próximos Eventos */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Painel Esquerdo: Calendário */}
        <Card className="lg:col-span-5 shadow-xs border-border">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <CalendarDays className="size-4 text-primary" /> Calendário Esportivo
              </CardTitle>
              {upcomingCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  {upcomingCount} {upcomingCount === 1 ? "data futura" : "datas futuras"}
                </span>
              )}
            </div>
            <CardDescription className="text-xs">
              Selecione uma data marcada para ver os eventos correspondentes.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center p-2 sm:p-4">
            <Calendar
              id={`${id}-day-picker`}
              mode="single"
              selected={selectedDate}
              onSelect={handleSelectDay}
              locale={ptBR}
              modifiers={{
                hasEvents: eventDates,
                hasUpcoming: upcomingDates,
              }}
              modifiersClassNames={{
                hasEvents:
                  "font-bold relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:size-1 after:rounded-full after:bg-primary",
                hasUpcoming: "bg-primary/5 hover:bg-primary/15 text-foreground font-semibold",
              }}
              className="rounded-lg border border-border"
            />
          </CardContent>

          {/* Rodapé do Card do Calendário com Legenda */}
          <div className="border-t border-border px-4 py-3 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-primary inline-block" />
              <span>Dias com eventos esportivos</span>
            </div>
            {selectedDate && (
              <span className="text-[11px] font-medium text-foreground">
                Data: {format(selectedDate, "dd/MM/yyyy")} ({selectedDateEvents.length}{" "}
                {selectedDateEvents.length === 1 ? "evento" : "eventos"})
              </span>
            )}
          </div>
        </Card>

        {/* Painel Direito: Lista de Próximos Eventos */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-2">
                {onlyFavorites ? (
                  <>Eventos Favoritos ({sortedEvents.length})</>
                ) : filterMode === "selected_date" && selectedDate ? (
                  <>Jogos em {format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}</>
                ) : filterMode === "today" ? (
                  <>Jogos de Hoje ({sortedEvents.length})</>
                ) : filterMode === "next_7_days" ? (
                  <>Jogos dos Próximos 7 Dias ({sortedEvents.length})</>
                ) : (
                  <>Próximos Eventos Esportivos ({sortedEvents.length})</>
                )}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {searchQuery
                  ? `Filtrando por "${searchQuery}"`
                  : onlyFavorites
                    ? "Exibindo apenas eventos que você marcou com estrela/coração"
                    : "Visualização cronológica com status temático"}
              </p>
            </div>

            {filterMode === "selected_date" && !onlyFavorites && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilterMode("all_upcoming")}
                className="text-xs text-primary"
              >
                Ver todos os próximos
              </Button>
            )}
          </div>

          {/* Cards de Eventos ou Empty States Visuais */}
          {sortedEvents.length === 0 ? (
            onlyFavorites ? (
              <NoFavoritesEmptyState
                id={`${id}-empty-favorites`}
                onExploreAll={() => setOnlyFavorites(false)}
              />
            ) : searchQuery ? (
              <NoSearchResultsEmptyState
                id={`${id}-empty-search`}
                query={searchQuery}
                onClear={() => setSearchQuery("")}
              />
            ) : filterMode === "selected_date" && selectedDate ? (
              <NoDayEventsEmptyState
                id={`${id}-empty-day`}
                dateLabel={format(selectedDate, "dd 'de' MMMM", { locale: ptBR })}
                onViewUpcoming={() => setFilterMode("all_upcoming")}
              />
            ) : (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-8 text-center bg-card">
                <CalendarDays className="size-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-foreground">
                  Nenhum evento esportivo encontrado
                </p>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  Não há eventos marcados para o período ou critérios selecionados.
                </p>
              </div>
            )
          ) : (
            <div className="space-y-3">
              {sortedEvents.map((event) => {
                const eventDate = parseISO(event.date);
                const isUpcoming = isToday(eventDate) || isAfter(eventDate, today);
                const isFav = isFavorite(event.id);

                return (
                  <article
                    key={event.id}
                    id={`sports-event-card-${event.id}`}
                    onClick={() => handleOpenEventModal(event)}
                    className={cn(
                      "group relative flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-xs cursor-pointer",
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {/* Modalidade esportiva e competição */}
                        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                          <span className="inline-flex items-center gap-1 rounded-md bg-surface px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            <Trophy className="size-3 opacity-70" />
                            {event.sportType}
                          </span>
                          {event.competition && (
                            <span className="text-[11px] text-muted-foreground">
                              · {event.competition}
                            </span>
                          )}
                        </div>

                        {/* Título ou Confronto de Times */}
                        <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                          {event.homeTeam && event.awayTeam ? (
                            <span>
                              {event.homeTeam}{" "}
                              <span className="text-muted-foreground font-normal">×</span>{" "}
                              {event.awayTeam}
                            </span>
                          ) : (
                            event.title
                          )}
                        </h4>
                      </div>

                      {/* Status Badge Reutilizável + Botão de Favorito com Coração */}
                      <div className="flex items-center gap-1.5">
                        <EventStatusBadge
                          status={event.status as SportEventStatus}
                          size="md"
                          showIcon={true}
                          id={`badge-${event.id}`}
                        />

                        {/* Botão de Favorito no Card */}
                        <button
                          type="button"
                          id={`card-favorite-btn-${event.id}`}
                          aria-label={isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                          onClick={(e) => toggleFavorite(event.id, e)}
                          className={cn(
                            "flex size-7 items-center justify-center rounded-full transition-all",
                            isFav
                              ? "text-rose-500 bg-rose-500/10 hover:bg-rose-500/20"
                              : "text-muted-foreground/40 hover:text-rose-500 hover:bg-muted",
                          )}
                          title={
                            isFav ? "Favorito (clique para remover)" : "Adicionar aos favoritos"
                          }
                        >
                          <Heart className={cn("size-3.5", isFav && "fill-current")} />
                        </button>
                      </div>
                    </div>

                    {/* Detalhes: Data, Horário e Local */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-1 border-t border-border/60">
                      <span className="flex items-center gap-1.5">
                        <CalendarDays className="size-3.5 text-primary/70 shrink-0" />
                        <span className={cn(isUpcoming && "font-medium text-foreground")}>
                          {format(eventDate, "EEE, dd 'de' MMM", { locale: ptBR })}
                        </span>
                      </span>

                      {event.time && (
                        <span className="flex items-center gap-1">
                          <Clock className="size-3.5 opacity-60 shrink-0" />
                          <span>{event.time}</span>
                        </span>
                      )}

                      {(event.venue || event.city) && (
                        <span className="flex items-center gap-1 truncate max-w-xs">
                          <MapPin className="size-3.5 opacity-60 shrink-0" />
                          <span className="truncate">
                            {[event.venue, [event.city, event.state].filter(Boolean).join(" - ")]
                              .filter(Boolean)
                              .join(", ")}
                          </span>
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal Reutilizável de Detalhes do Evento com Exportação .ics e Compartilhar */}
      <SportsEventDetailsDialog
        event={selectedDetailEvent}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </div>
  );
}
