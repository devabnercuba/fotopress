import { useMemo, useState } from "react";
import { Heart, Plus, Trophy } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { EventCard } from "@/components/event-card";
import { EventDetailSheet } from "@/components/event-detail-sheet";
import { EventFormDialog } from "@/components/event-form-dialog";
import { EventSearchInput } from "@/components/event-search-input";
import { NoFavoritesEmptyState, NoSearchResultsEmptyState } from "@/components/sports-empty-states";
import { EventListSkeleton } from "@/components/sports-event-skeletons";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEventEngagementCounts } from "@/lib/event-engagements";
import { coverageByEvent, useEventCoverages, useEvents, type SportEvent } from "@/lib/events";
import { useEventFavorites } from "@/lib/favorites";
import { formatSportLabel, normalizeSport } from "@/lib/sports";
import { cn } from "@/lib/utils";

const ALL = "todos";

/** Aba Eventos dentro da página Jogos — cadastro manual de eventos esportivos. */
export function EventsTab() {
  const { data: events = [], isLoading } = useEvents();
  const { data: counts = {} } = useEventEngagementCounts();
  const { data: coverages = [] } = useEventCoverages();
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<SportEvent | null>(null);
  const [search, setSearch] = useState("");
  const [sport, setSport] = useState(ALL);
  const [onlyFavorites, setOnlyFavorites] = useState(false);

  const { isFavorite, favoriteCount } = useEventFavorites();

  const byEvent = useMemo(() => coverageByEvent(coverages), [coverages]);

  const sports = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of events) map.set(normalizeSport(e.sport)!, formatSportLabel(e.sport)!);
    return [...map.entries()];
  }, [events]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return events.filter((e) => {
      if (onlyFavorites && !isFavorite(e.id)) return false;
      if (sport !== ALL && normalizeSport(e.sport) !== sport) return false;
      if (
        term &&
        ![e.name, e.venue, e.city, e.organizer]
          .filter(Boolean)
          .every((v) => !String(v).toLowerCase().includes(term))
      )
        return false;
      return true;
    });
  }, [events, search, sport, onlyFavorites, isFavorite]);

  // Mantém o evento aberto sincronizado com os dados mais recentes.
  const current = selected ? (events.find((e) => e.id === selected.id) ?? null) : null;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Eventos esportivos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastre eventos esportivos que não seguem o formato tradicional de mandante ×
            visitante.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4" /> Novo evento
        </Button>
      </header>

      {events.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full sm:w-[320px]">
            <EventSearchInput
              placeholder="Buscar evento, time ou organizador"
              value={search}
              onChange={setSearch}
              resultsCount={rows.length}
              id="events-tab-search-input"
            />
          </div>
          <Select value={sport} onValueChange={setSport}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Modalidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas as modalidades</SelectItem>
              {sports.map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filtro por favoritos */}
          <Button
            id="events-tab-filter-favorites"
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
        </div>
      )}

      {isLoading ? (
        <EventListSkeleton count={6} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" />
      ) : rows.length === 0 ? (
        onlyFavorites ? (
          <NoFavoritesEmptyState onExploreAll={() => setOnlyFavorites(false)} />
        ) : search ? (
          <NoSearchResultsEmptyState query={search} onClear={() => setSearch("")} />
        ) : (
          <EmptyState
            icon={Trophy}
            title="Nenhum evento cadastrado"
            description="Cadastre corridas, torneios e outras coberturas que não seguem o formato tradicional de partida."
            action={
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus className="size-4" /> Novo evento
              </Button>
            }
          />
        )
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((e) => (
            <EventCard
              key={e.id}
              event={e}
              contacts={counts[e.id] ?? 0}
              badge={
                byEvent[e.id] ? (
                  <span className="rounded-full bg-comp-green/10 px-2 py-0.5 text-[11px] font-medium text-comp-green">
                    {byEvent[e.id]!.completed_at ? "Cobertura concluída" : "Na minha agenda"}
                  </span>
                ) : null
              }
              onOpen={() => setSelected(e)}
            />
          ))}
        </div>
      )}

      <EventFormDialog
        open={creating}
        onOpenChange={setCreating}
        sports={events.map((e) => e.sport)}
      />
      <EventDetailSheet event={current} onOpenChange={(open) => !open && setSelected(null)} />
    </div>
  );
}
