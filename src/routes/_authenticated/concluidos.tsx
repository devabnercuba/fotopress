import { createFileRoute } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { compStyle } from "@/lib/competitions";
import { useCoverageMutations, useCoverages } from "@/lib/coverages";
import { useEventCoverageMutations, useEventCoverages } from "@/lib/events";
import { formatSportLabel } from "@/lib/sports";

export const Route = createFileRoute("/_authenticated/concluidos")({
  head: () => ({
    meta: [
      { title: "Coberturas concluídas — Cobertura esportiva" },
      {
        name: "description",
        content: "Histórico das partidas e eventos já cobertos, com a opção de reabrir a pauta.",
      },
      { property: "og:title", content: "Coberturas concluídas — Cobertura esportiva" },
      {
        property: "og:description",
        content: "Todas as coberturas que você já finalizou.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CompletedPage,
});

type Row = { kind: "match" | "event"; id: string; sortKey: string };

function TypeBadge({ kind }: { kind: Row["kind"] }) {
  return (
    <span className="rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      {kind === "match" ? "Partida" : "Evento"}
    </span>
  );
}

function CompletedPage() {
  const { data: coverages = [], isLoading } = useCoverages();
  const { reopen, remove } = useCoverageMutations();
  const { data: eventCoverages = [], isLoading: loadingEvents } = useEventCoverages();
  const eventActions = useEventCoverageMutations();

  const matchItems = coverages.filter((c) => c.completed_at && c.match);
  const eventItems = eventCoverages.filter((c) => c.completed_at && c.event);

  const matchById = new Map(matchItems.map((c) => [c.id, c]));
  const eventById = new Map(eventItems.map((c) => [c.id, c]));

  const items: Row[] = [
    ...matchItems.map((c) => ({
      kind: "match" as const,
      id: c.id,
      sortKey: `${c.match!.date}${c.match!.time ?? ""}`,
    })),
    ...eventItems.map((c) => ({
      kind: "event" as const,
      id: c.id,
      sortKey: `${c.event!.start_date}${c.event!.start_time ?? ""}`,
    })),
  ].sort((a, b) => b.sortKey.localeCompare(a.sortKey));

  const loading = isLoading || loadingEvents;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Concluídos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {items.length} {items.length === 1 ? "cobertura concluída" : "coberturas concluídas"},
          entre partidas e eventos.
        </p>
      </header>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">Nenhuma cobertura concluída ainda.</p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {items.map((item) => {
            if (item.kind === "match") {
              const coverage = matchById.get(item.id)!;
              const match = coverage.match!;
              const style = compStyle(match.competition?.color);
              return (
                <li key={`m-${item.id}`} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <div className="w-20 shrink-0">
                    <div className="text-lg font-semibold capitalize">
                      {format(parseISO(match.date), "dd MMM", { locale: ptBR })}
                    </div>
                    <div className="text-xs text-muted-foreground">{match.time.slice(0, 5)}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {match.home_team} <span className="text-muted-foreground">×</span>{" "}
                        {match.away_team}
                      </span>
                      <TypeBadge kind="match" />
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <span className={`size-1.5 rounded-full ${style.dot}`} />
                      {match.competition?.name}
                      {match.venue ? ` · ${match.venue}` : ""}
                      {match.city ? ` · ${match.city}` : ""}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={reopen.isPending}
                      onClick={() => reopen.mutate(item.id)}
                    >
                      <RotateCcw className="size-4" /> Reabrir
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(item.id)}
                    >
                      Remover
                    </Button>
                  </div>
                </li>
              );
            }

            const coverage = eventById.get(item.id)!;
            const event = coverage.event!;
            return (
              <li key={`e-${item.id}`} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="w-20 shrink-0">
                  <div className="text-lg font-semibold capitalize">
                    {format(parseISO(event.start_date), "dd MMM", { locale: ptBR })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {event.start_time ? event.start_time.slice(0, 5) : "—"}
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{event.name}</span>
                    <TypeBadge kind="event" />
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="size-1.5 rounded-full bg-comp-green" />
                    {formatSportLabel(event.sport)}
                    {event.venue ? ` · ${event.venue}` : ""}
                    {event.city ? ` · ${event.city}` : ""}
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={eventActions.reopen.isPending}
                    onClick={() => eventActions.reopen.mutate(item.id)}
                  >
                    <RotateCcw className="size-4" /> Reabrir
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={eventActions.remove.isPending}
                    onClick={() => eventActions.remove.mutate(item.id)}
                  >
                    Remover
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
