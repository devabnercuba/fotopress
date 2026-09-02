import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { compStyle } from "@/lib/competitions";
import type { Match } from "@/lib/queries";

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

export function MonthCalendar({
  month,
  onMonthChange,
  matches,
  onSelect,
  onDaySelect,
  selectedDay,
}: {
  month: Date;
  onMonthChange: (date: Date) => void;
  matches: Match[];
  onSelect: (match: Match) => void;
  /** Clique no número do dia: abre a lista completa de jogos daquela data. */
  onDaySelect?: (day: string) => void;
  selectedDay?: string | null;
}) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });

  const byDay = new Map<string, Match[]>();
  for (const match of matches) {
    const list = byDay.get(match.date) ?? [];
    list.push(match);
    byDay.set(match.date, list);
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="mr-auto text-base font-semibold capitalize">
          {format(month, "MMMM yyyy", { locale: ptBR })}
        </h2>
        <Button variant="outline" size="sm" onClick={() => onMonthChange(new Date())}>
          Hoje
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onMonthChange(addMonths(month, -1))}>
          <ChevronLeft className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => onMonthChange(addMonths(month, 1))}>
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="grid grid-cols-7 border-b border-border">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-2 text-center text-[11px] text-muted-foreground">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayMatches = byDay.get(key) ?? [];
            const outside = !isSameMonth(day, month);

            return (
              <div
                key={key}
                className={`min-h-28 space-y-1 border-r border-b border-border p-1.5 last:border-r-0 ${
                  outside ? "bg-surface/60" : ""
                } ${selectedDay === key ? "ring-1 ring-primary/40 ring-inset" : ""}`}
              >
                <button
                  type="button"
                  onClick={() => onDaySelect?.(key)}
                  className={`mb-1 flex size-5 items-center justify-center rounded-full text-[11px] transition-colors hover:bg-accent ${
                    isToday(day)
                      ? "bg-primary font-semibold text-primary-foreground"
                      : outside
                        ? "text-muted-foreground/50"
                        : "text-muted-foreground"
                  }`}
                >
                  {format(day, "d")}
                </button>

                {dayMatches.map((match) => {
                  const style = compStyle(match.competition?.color);
                  return (
                    <button
                      key={match.id}
                      onClick={() => onSelect(match)}
                      className={`w-full rounded-md border-l-2 bg-surface px-1.5 py-1 text-left transition-colors hover:bg-accent ${style.bar}`}
                    >
                      <div className="text-[10px] font-medium text-muted-foreground">
                        {match.time.slice(0, 5)}
                      </div>
                      <div className="truncate text-[11px] leading-tight font-medium">
                        {match.home_team} × {match.away_team}
                      </div>
                      <div className={`truncate text-[10px] ${style.text}`}>
                        {match.competition?.name}
                      </div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
