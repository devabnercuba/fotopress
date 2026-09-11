import { useMemo, useState } from "react";
import { format, subMonths, parseISO, startOfMonth, endOfMonth, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { BarChart3, Calendar, CheckCircle2, Trophy, ArrowUpRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";
import { useCoverages } from "@/lib/coverages";
import { useEventCoverages } from "@/lib/events";
import { cn } from "@/lib/utils";

type PeriodMonths = 6 | 12;
type CoverageFilter = "all" | "events" | "matches";

interface MonthlyBucket {
  monthKey: string;
  monthShort: string;
  monthFull: string;
  year: number;
  eventsCount: number;
  matchesCount: number;
  totalCount: number;
}

export function DashboardCoverageChart({ className }: { className?: string }) {
  const { data: coverages = [], isLoading: loadingCoverages } = useCoverages();
  const { data: eventCoverages = [], isLoading: loadingEvents } = useEventCoverages();

  const [period, setPeriod] = useState<PeriodMonths>(6);
  const [filter, setFilter] = useState<CoverageFilter>("all");

  const today = useMemo(() => new Date(), []);

  // Processa dados mensais para os últimos N meses (em ordem cronológica)
  const chartData = useMemo<MonthlyBucket[]>(() => {
    const months: MonthlyBucket[] = [];

    for (let i = period - 1; i >= 0; i--) {
      const monthDate = subMonths(today, i);
      const start = startOfMonth(monthDate);
      const end = endOfMonth(monthDate);
      const monthKey = format(monthDate, "yyyy-MM");
      const monthShort = format(monthDate, "MMM/yy", { locale: ptBR });
      const monthFull = format(monthDate, "MMMM 'de' yyyy", { locale: ptBR });
      const year = monthDate.getFullYear();

      // Contagem de partidas cobertas (concluídas ou aprovadas na agenda com data no mês)
      const matchesInMonth = coverages.filter((c) => {
        if (!c.match) return false;
        // Prioriza completed_at se concluído, caso contrário usa a data da partida
        const targetDate = c.completed_at ? parseISO(c.completed_at) : parseISO(c.match.date);

        const isCovered = c.completed_at != null || c.credential_status === "approved";
        return isCovered && isWithinInterval(targetDate, { start, end });
      }).length;

      // Contagem de eventos esportivos cobertos (concluídos ou aprovados na agenda)
      const eventsInMonth = eventCoverages.filter((c) => {
        if (!c.event) return false;
        const targetDate = c.completed_at ? parseISO(c.completed_at) : parseISO(c.event.start_date);

        const isCovered = c.completed_at != null || c.credential_status === "approved";
        return isCovered && isWithinInterval(targetDate, { start, end });
      }).length;

      months.push({
        monthKey,
        monthShort,
        monthFull,
        year,
        eventsCount: eventsInMonth,
        matchesCount: matchesInMonth,
        totalCount: eventsInMonth + matchesInMonth,
      });
    }

    return months;
  }, [coverages, eventCoverages, period, today]);

  // Estatísticas do período selecionado
  const stats = useMemo(() => {
    const values = chartData.map((d) => {
      if (filter === "events") return d.eventsCount;
      if (filter === "matches") return d.matchesCount;
      return d.totalCount;
    });

    const total = values.reduce((sum, v) => sum + v, 0);
    const average = period > 0 ? (total / period).toFixed(1) : "0";
    const peakValue = Math.max(...values, 0);
    const peakItem = chartData.find((d) => {
      const v =
        filter === "events" ? d.eventsCount : filter === "matches" ? d.matchesCount : d.totalCount;
      return v === peakValue && peakValue > 0;
    });

    return {
      total,
      average,
      peakValue,
      peakMonth: peakItem?.monthShort ?? "—",
    };
  }, [chartData, filter, period]);

  const isLoading = loadingCoverages || loadingEvents;

  // Valor chave para a barra de acordo com o filtro selecionado
  const dataKey =
    filter === "events" ? "eventsCount" : filter === "matches" ? "matchesCount" : "totalCount";

  return (
    <section
      id="dashboard-monthly-coverage-section"
      className={cn("rounded-xl border border-border bg-card p-5 space-y-4 shadow-xs", className)}
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <BarChart3 className="size-4" />
            </div>
            <h2 className="text-base font-semibold tracking-tight">Eventos cobertos por mês</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            Volume de coberturas esportivas e partidas ao longo do tempo.
          </p>
        </div>

        {/* Controles de período e filtro */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Seletor de Categoria */}
          <div className="flex rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer",
                filter === "all"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setFilter("events")}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer",
                filter === "events"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Eventos
            </button>
            <button
              type="button"
              onClick={() => setFilter("matches")}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer",
                filter === "matches"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Partidas
            </button>
          </div>

          {/* Seletor de Período */}
          <div className="flex rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setPeriod(6)}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer",
                period === 6
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              6 meses
            </button>
            <button
              type="button"
              onClick={() => setPeriod(12)}
              className={cn(
                "rounded-md px-2.5 py-1 font-medium transition-colors cursor-pointer",
                period === 12
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              12 meses
            </button>
          </div>
        </div>
      </header>

      {/* Mini indicadores */}
      <div className="grid grid-cols-3 gap-3 border-y border-border py-3 text-xs">
        <div>
          <span className="text-muted-foreground">Total no período</span>
          <div className="mt-0.5 text-lg font-semibold tracking-tight text-foreground">
            {stats.total} {stats.total === 1 ? "cobertura" : "coberturas"}
          </div>
        </div>
        <div>
          <span className="text-muted-foreground">Média mensal</span>
          <div className="mt-0.5 text-lg font-semibold tracking-tight text-foreground">
            {stats.average} / mês
          </div>
        </div>
        <div>
          <span className="text-muted-foreground">Mês de pico</span>
          <div className="mt-0.5 text-lg font-semibold tracking-tight text-foreground">
            {stats.peakValue > 0 ? `${stats.peakMonth} (${stats.peakValue})` : "—"}
          </div>
        </div>
      </div>

      {/* Gráfico de Barras Recharts */}
      <div className="h-64 w-full pt-2">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            Carregando métricas…
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 12, right: 10, left: -22, bottom: 4 }}
              barCategoryGap="20%"
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/50" />
              <XAxis
                dataKey="monthShort"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "currentColor" }}
                className="text-muted-foreground capitalize"
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: "currentColor" }}
                className="text-muted-foreground"
              />
              <Tooltip
                cursor={{ fill: "var(--accent)", opacity: 0.25 }}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const data = payload[0].payload as MonthlyBucket;
                  return (
                    <div className="rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg text-xs space-y-1.5 min-w-[170px]">
                      <div className="font-semibold capitalize text-sm border-b border-border/60 pb-1">
                        {data.monthFull}
                      </div>
                      <div className="flex items-center justify-between text-muted-foreground pt-0.5">
                        <span>Eventos esportivos:</span>
                        <span className="font-medium text-foreground">{data.eventsCount}</span>
                      </div>
                      <div className="flex items-center justify-between text-muted-foreground">
                        <span>Partidas de futebol:</span>
                        <span className="font-medium text-foreground">{data.matchesCount}</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-border/60 pt-1 font-semibold text-primary">
                        <span>Total coberto:</span>
                        <span>{data.totalCount}</span>
                      </div>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey={dataKey}
                name="Coberturas"
                radius={[6, 6, 0, 0]}
                className="fill-primary transition-all duration-300"
              >
                {chartData.map((entry, index) => {
                  const val = entry[dataKey as keyof MonthlyBucket] as number;
                  return (
                    <Cell
                      key={`cell-${entry.monthKey}-${index}`}
                      className={cn(val > 0 ? "fill-primary hover:opacity-85" : "fill-muted/50")}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Nota de rodapé ou atalho */}
      {stats.total === 0 && !isLoading && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground">
          <p>
            Nenhuma cobertura contabilizada nos últimos {period} meses. Adicione eventos na sua
            agenda ou conclua coberturas para acompanhar o gráfico.
          </p>
          <Button asChild size="sm" variant="outline" className="shrink-0 text-xs gap-1">
            <Link to="/jogos">
              Ver eventos <ArrowUpRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      )}
    </section>
  );
}
