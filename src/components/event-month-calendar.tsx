import { useMemo, useState } from "react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Heart,
  MapPin,
  Trophy,
} from "lucide-react";

import { EventStatusBadge } from "@/components/event-status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { agendaSportEventToExport, getGoogleCalendarUrl } from "@/lib/calendar-export";
import type { SportEvent } from "@/lib/events";
import { useEventFavorites } from "@/lib/favorites";
import { formatSportLabel } from "@/lib/sports";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export interface EventMonthCalendarProps {
  events: SportEvent[];
  onSelectEvent: (event: SportEvent) => void;
  byEvent?: Record<string, { id: string; completed_at?: string | null }>;
}

export function EventMonthCalendar({
  events,
  onSelectEvent,
  byEvent = {},
}: EventMonthCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date());
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(() =>
    format(new Date(), "yyyy-MM-dd"),
  );

  const { isFavorite, toggleFavorite } = useEventFavorites();

  const days = useMemo(() => {
    return eachDayOfInterval({
      start: startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 }),
    });
  }, [currentMonth]);

  // Indexa eventos por dia (inclusive eventos multi-dia com start_date e end_date)
  const eventsByDay = useMemo(() => {
    const map = new Map<string, SportEvent[]>();

    for (const ev of events) {
      if (!ev.start_date) continue;
      const startKey = ev.start_date;
      const endKey = ev.end_date || ev.start_date;

      // Se for evento no mesmo dia
      if (startKey === endKey) {
        const list = map.get(startKey) ?? [];
        if (!list.some((item) => item.id === ev.id)) {
          list.push(ev);
        }
        map.set(startKey, list);
      } else {
        // Se for evento de múltiplos dias
        try {
          const startDate = parseISO(startKey);
          const endDate = parseISO(endKey);
          if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
            const intervalDays = eachDayOfInterval({ start: startDate, end: endDate });
            for (const d of intervalDays) {
              const key = format(d, "yyyy-MM-dd");
              const list = map.get(key) ?? [];
              if (!list.some((item) => item.id === ev.id)) {
                list.push(ev);
              }
              map.set(key, list);
            }
          }
        } catch {
          const list = map.get(startKey) ?? [];
          list.push(ev);
          map.set(startKey, list);
        }
      }
    }

    return map;
  }, [events]);

  // Contagem de eventos no mês atual
  const currentMonthEventsCount = useMemo(() => {
    let count = 0;
    const seen = new Set<string>();
    for (const d of days) {
      if (!isSameMonth(d, currentMonth)) continue;
      const key = format(d, "yyyy-MM-dd");
      const list = eventsByDay.get(key) ?? [];
      for (const ev of list) {
        if (!seen.has(ev.id)) {
          seen.add(ev.id);
          count += 1;
        }
      }
    }
    return count;
  }, [days, currentMonth, eventsByDay]);

  const selectedDayEvents = useMemo(() => {
    if (!selectedDayKey) return [];
    return eventsByDay.get(selectedDayKey) ?? [];
  }, [selectedDayKey, eventsByDay]);

  const selectedDateObject = useMemo(() => {
    if (!selectedDayKey) return new Date();
    try {
      const d = parseISO(selectedDayKey);
      return isNaN(d.getTime()) ? new Date() : d;
    } catch {
      return new Date();
    }
  }, [selectedDayKey]);

  return (
    <div className="space-y-4">
      {/* Controles de navegação do calendário */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-3.5 rounded-xl border border-border">
        <div className="flex items-center gap-3">
          <h2 className="text-base sm:text-lg font-semibold capitalize text-foreground flex items-center gap-2">
            <CalendarDays className="size-5 text-primary" />
            <span>{format(currentMonth, "MMMM 'de' yyyy", { locale: ptBR })}</span>
          </h2>
          <Badge variant="secondary" className="text-xs">
            {currentMonthEventsCount}{" "}
            {currentMonthEventsCount === 1 ? "evento no mês" : "eventos no mês"}
          </Badge>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const now = new Date();
              setCurrentMonth(now);
              setSelectedDayKey(format(now, "yyyy-MM-dd"));
            }}
            className="text-xs h-8"
          >
            Hoje
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentMonth((prev) => addMonths(prev, -1))}
            className="size-8"
            title="Mês anterior"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCurrentMonth((prev) => addMonths(prev, 1))}
            className="size-8"
            title="Próximo mês"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Grade Mensal */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        {/* Cabeçalho dos dias da semana */}
        <div className="grid grid-cols-7 border-b border-border bg-surface/50">
          {WEEKDAYS.map((d) => (
            <div
              key={d}
              className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Células de dias */}
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayEvents = eventsByDay.get(key) ?? [];
            const outside = !isSameMonth(day, currentMonth);
            const isDaySelected = selectedDayKey === key;
            const isCurrentDay = isToday(day);

            return (
              <div
                key={key}
                onClick={() => setSelectedDayKey(key)}
                className={cn(
                  "min-h-24 sm:min-h-28 border-r border-b border-border p-1.5 last:border-r-0 transition-colors cursor-pointer flex flex-col justify-between",
                  outside ? "bg-surface/30 opacity-60" : "hover:bg-accent/40",
                  isDaySelected && "bg-primary/5 ring-2 ring-primary ring-inset",
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full text-xs font-medium transition-colors",
                        isCurrentDay
                          ? "bg-primary text-primary-foreground font-bold"
                          : isDaySelected
                            ? "bg-primary/20 text-primary font-semibold"
                            : outside
                              ? "text-muted-foreground/50"
                              : "text-foreground",
                      )}
                    >
                      {format(day, "d")}
                    </span>

                    {dayEvents.length > 0 && (
                      <span className="text-[10px] font-semibold text-primary/80">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>

                  {/* Chips compactos dos eventos */}
                  <div className="space-y-1">
                    {dayEvents.slice(0, 2).map((ev) => (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDayKey(key);
                          onSelectEvent(ev);
                        }}
                        className="w-full text-left truncate rounded px-1.5 py-0.5 text-[10px] font-medium bg-surface hover:bg-accent border border-border/60 transition-colors flex items-center gap-1 group"
                        title={`${ev.name} (${formatSportLabel(ev.sport)})`}
                      >
                        <span className="size-1.5 rounded-full bg-primary shrink-0" />
                        <span className="truncate group-hover:text-primary">{ev.name}</span>
                      </button>
                    ))}

                    {dayEvents.length > 2 && (
                      <span className="block text-[9px] text-muted-foreground font-medium pl-1">
                        +{dayEvents.length - 2} mais
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Painel inferior: Detalhamento do Dia Selecionado */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              Eventos em {format(selectedDateObject, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </span>
            {isToday(selectedDateObject) && (
              <Badge variant="outline" className="text-[10px] py-0 border-primary text-primary">
                Hoje
              </Badge>
            )}
          </div>
          <span className="text-xs text-muted-foreground">
            {selectedDayEvents.length}{" "}
            {selectedDayEvents.length === 1 ? "evento agendado" : "eventos agendados"}
          </span>
        </div>

        {selectedDayEvents.length === 0 ? (
          <div className="py-6 text-center text-xs text-muted-foreground">
            Nenhum evento agendado para esta data. Clique em outro dia da grade para visualizar as
            coberturas.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {selectedDayEvents.map((ev) => {
              const googleCalUrl = getGoogleCalendarUrl(agendaSportEventToExport(ev));
              const isFav = isFavorite(ev.id);

              return (
                <div
                  key={ev.id}
                  className="flex flex-col justify-between gap-2.5 rounded-lg border border-border/80 bg-surface/50 p-3 hover:border-primary/40 transition-colors"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={() => onSelectEvent(ev)}
                          className="font-semibold text-sm text-foreground hover:text-primary transition-colors text-left truncate block w-full"
                        >
                          {ev.name}
                        </button>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 rounded bg-surface px-1.5 py-0.2 text-[10px] font-medium border border-border/50 text-muted-foreground">
                            <Trophy className="size-2.5 text-primary" />
                            <span>{formatSportLabel(ev.sport)}</span>
                          </span>
                          <EventStatusBadge status={ev.status} size="sm" showDot={true} />
                          {byEvent[ev.id] && (
                            <span className="rounded bg-emerald-500/10 px-1.5 py-0.2 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                              Na Minha Agenda
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        aria-label={isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                        onClick={(e) => toggleFavorite(ev.id, e)}
                        className={cn(
                          "size-7 flex items-center justify-center rounded-full transition-colors cursor-pointer shrink-0",
                          isFav
                            ? "text-rose-500 bg-rose-500/10"
                            : "text-muted-foreground/40 hover:text-rose-500",
                        )}
                      >
                        <Heart className={cn("size-3.5", isFav && "fill-current")} />
                      </button>
                    </div>

                    <div className="space-y-1 text-xs text-muted-foreground">
                      {ev.start_time && (
                        <p className="flex items-center gap-1.5">
                          <Clock className="size-3 shrink-0 opacity-70" />
                          <span>Horário: {ev.start_time.slice(0, 5)}</span>
                        </p>
                      )}
                      {(ev.venue || ev.city) && (
                        <p className="flex items-center gap-1.5">
                          <MapPin className="size-3 shrink-0 opacity-70" />
                          <span className="truncate">
                            {[ev.venue, [ev.city, ev.state].filter(Boolean).join(" · ")]
                              .filter(Boolean)
                              .join(" — ")}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-border/60">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs h-7"
                      onClick={() => onSelectEvent(ev)}
                    >
                      Ver detalhes
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      asChild
                      className="text-xs h-7 gap-1 hover:bg-primary hover:text-primary-foreground transition-colors shrink-0"
                      title="Adicionar ao Google Calendar"
                    >
                      <a
                        href={googleCalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <CalendarPlus className="size-3.5 text-primary" />
                        <span>Google Calendar</span>
                      </a>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
