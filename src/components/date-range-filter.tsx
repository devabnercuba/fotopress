import { addDays, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type DateRange = { from: string; to: string };

export const EMPTY_RANGE: DateRange = { from: "", to: "" };

const iso = (d: Date) => format(d, "yyyy-MM-dd");

export const getTodayRange = (): DateRange => ({ from: iso(new Date()), to: iso(new Date()) });
export const getTomorrowRange = (): DateRange => {
  const d = addDays(new Date(), 1);
  return { from: iso(d), to: iso(d) };
};
export const getThisWeekRange = (): DateRange => ({
  from: iso(startOfWeek(new Date(), { weekStartsOn: 1 })),
  to: iso(endOfWeek(new Date(), { weekStartsOn: 1 })),
});
export const getNext7DaysRange = (): DateRange => ({
  from: iso(new Date()),
  to: iso(addDays(new Date(), 7)),
});
export const getThisMonthRange = (): DateRange => ({
  from: iso(startOfMonth(new Date())),
  to: iso(endOfMonth(new Date())),
});

/** Presets rápidos de período. */
const presets = [
  {
    label: "Hoje",
    build: getTodayRange,
  },
  {
    label: "Esta semana",
    build: getThisWeekRange,
  },
  {
    label: "Próximos 7 dias",
    build: getNext7DaysRange,
  },
  {
    label: "Este mês",
    build: getThisMonthRange,
  },
];

/**
 * Filtro de datas reutilizável (data exata, período ou intervalo).
 * Usa inputs nativos `date`, que abrem o seletor de toque no mobile.
 */
export function DateRangeFilter({
  value,
  onChange,
  className = "",
}: {
  value: DateRange;
  onChange: (value: DateRange) => void;
  className?: string;
}) {
  const active = Boolean(value.from || value.to);

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <div className="flex w-full items-center gap-2 sm:w-auto">
        <Input
          type="date"
          aria-label="Data inicial"
          value={value.from}
          max={value.to || undefined}
          onChange={(e) => onChange({ ...value, from: e.target.value })}
          className="w-full sm:w-[150px]"
        />
        <span className="text-xs text-muted-foreground">até</span>
        <Input
          type="date"
          aria-label="Data final"
          value={value.to}
          min={value.from || undefined}
          onChange={(e) => onChange({ ...value, to: e.target.value })}
          className="w-full sm:w-[150px]"
        />
      </div>

      <div className="flex flex-wrap items-center gap-1">
        {presets.map((p) => {
          const range = p.build();
          const selected = value.from === range.from && value.to === range.to;
          return (
            <Button
              key={p.label}
              type="button"
              size="sm"
              variant={selected ? "secondary" : "ghost"}
              onClick={() => onChange(selected ? EMPTY_RANGE : range)}
            >
              {p.label}
            </Button>
          );
        })}
        {active && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label="Limpar datas"
            onClick={() => onChange(EMPTY_RANGE)}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

/** Compara a data ISO (yyyy-MM-dd) do jogo com o intervalo escolhido. */
export function inDateRange(date: string, range: DateRange) {
  if (range.from && date < range.from) return false;
  if (range.to && date > range.to) return false;
  return true;
}
