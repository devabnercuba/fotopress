import { useMemo, useState } from "react";
import { CalendarDays, Filter, Heart, List, Plus, Trophy, X } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { EventCard } from "@/components/event-card";
import { EventDetailSheet } from "@/components/event-detail-sheet";
import { EventFormDialog } from "@/components/event-form-dialog";
import { EventMonthCalendar } from "@/components/event-month-calendar";
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

/** Categorias esportivas populares com atalho visual direto */
const POPULAR_SPORT_CATEGORIES = [
  "Futebol",
  "Vôlei",
  "Basquete",
  "Corrida",
  "Beach Tennis",
  "Futsal",
];

/** Aba Eventos dentro da página Jogos — cadastro manual e filtros por categoria esportiva. */
export function EventsTab() {
  const { data: events = [], isLoading } = useEvents();
  const { data: counts = {} } = useEventEngagementCounts();
  const { data: coverages = [] } = useEventCoverages();
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<SportEvent | null>(null);
  const [search, setSearch] = useState("");
  const [sport, setSport] = useState(ALL);
  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [viewMode, setViewMode] = useState<"lista" | "calendario">("lista");

  const { isFavorite, favoriteCount } = useEventFavorites();

  const byEvent = useMemo(() => coverageByEvent(coverages), [coverages]);

  // Contagem de eventos por categoria esportiva
  const sportCounts = useMemo(() => {
    const countsMap = new Map<string, number>();
    for (const e of events) {
      const key = normalizeSport(e.sport) || "outro";
      countsMap.set(key, (countsMap.get(key) ?? 0) + 1);
    }
    return countsMap;
  }, [events]);

  // Lista de opções de esportes (combina eventos cadastrados + categorias sugeridas)
  const sports = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of events) {
      const norm = normalizeSport(e.sport);
      if (norm) map.set(norm, formatSportLabel(e.sport)!);
    }
    for (const s of POPULAR_SPORT_CATEGORIES) {
      const norm = normalizeSport(s);
      if (norm && !map.has(norm)) {
        map.set(norm, s);
      }
    }
    return [...map.entries()].sort((a, b) => {
      const countA = sportCounts.get(a[0]) ?? 0;
      const countB = sportCounts.get(b[0]) ?? 0;
      return countB - countA || a[1].localeCompare(b[1]);
    });
  }, [events, sportCounts]);

  // Categorias para os botões/chips rápidos
  const quickCategoryChips = useMemo(() => {
    const list: { key: string; label: string; count: number }[] = [];
    const seen = new Set<string>();

    // Primeiro os populares principais
    for (const s of POPULAR_SPORT_CATEGORIES) {
      const key = normalizeSport(s)!;
      seen.add(key);
      list.push({
        key,
        label: s,
        count: sportCounts.get(key) ?? 0,
      });
    }

    // Depois outros esportes que já tenham eventos cadastrados
    for (const [key, label] of sports) {
      if (!seen.has(key) && (sportCounts.get(key) ?? 0) > 0) {
        list.push({
          key,
          label,
          count: sportCounts.get(key) ?? 0,
        });
      }
    }

    return list;
  }, [sports, sportCounts]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return events.filter((e) => {
      if (onlyFavorites && !isFavorite(e.id)) return false;
      if (sport !== ALL && normalizeSport(e.sport) !== sport) return false;
      if (
        term &&
        ![e.name, e.venue, e.city, e.organizer, e.sport]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(term))
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
            Gerencie e filtre coberturas esportivas por categoria (Futebol, Vôlei, Basquete, etc.).
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Seletor de modo de visualização (Lista vs Grade Mensal) */}
          <div
            id="events-view-mode-selector"
            className="flex items-center rounded-lg border border-border bg-surface p-0.5"
          >
            <button
              type="button"
              id="events-view-mode-lista"
              onClick={() => setViewMode("lista")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                viewMode === "lista"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title="Visualização em Lista"
            >
              <List className="size-3.5" />
              <span>Lista</span>
            </button>
            <button
              type="button"
              id="events-view-mode-calendario"
              onClick={() => setViewMode("calendario")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                viewMode === "calendario"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title="Visualização em Grade Mensal (Calendário)"
            >
              <CalendarDays className="size-3.5" />
              <span>Grade Mensal</span>
            </button>
          </div>

          <Button size="sm" onClick={() => setCreating(true)} id="btn-new-event">
            <Plus className="size-4" /> Novo evento
          </Button>
        </div>
      </header>

      {events.length > 0 && (
        <div className="space-y-3">
          {/* Barra de Busca e Filtros Dropdown */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="w-full sm:w-[320px]">
              <EventSearchInput
                placeholder="Buscar por nome, esporte ou local…"
                value={search}
                onChange={setSearch}
                resultsCount={rows.length}
                id="events-tab-search-input"
              />
            </div>

            <Select value={sport} onValueChange={setSport}>
              <SelectTrigger id="events-sport-select" className="w-full sm:w-[220px]">
                <SelectValue placeholder="Filtrar por esporte" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os esportes ({events.length})</SelectItem>
                {sports.map(([key, label]) => {
                  const count = sportCounts.get(key) ?? 0;
                  return (
                    <SelectItem key={key} value={key}>
                      {label} {count > 0 ? `(${count})` : ""}
                    </SelectItem>
                  );
                })}
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

            {/* Botão para limpar filtros caso haja algum ativo */}
            {(sport !== ALL || onlyFavorites || search.trim()) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSport(ALL);
                  setOnlyFavorites(false);
                  setSearch("");
                }}
                className="text-xs text-muted-foreground hover:text-foreground h-8 px-2 gap-1"
              >
                <X className="size-3.5" /> Limpar filtros
              </Button>
            )}
          </div>

          {/* Chips rápidos de Categorias Esportivas */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-muted-foreground mr-1 flex items-center gap-1 text-[11px] shrink-0">
              <Filter className="size-3" /> Categorias:
            </span>
            <button
              type="button"
              id="category-chip-all"
              onClick={() => setSport(ALL)}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-colors shrink-0 cursor-pointer border",
                sport === ALL
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-surface border-border text-muted-foreground hover:text-foreground hover:bg-accent",
              )}
            >
              Todas ({events.length})
            </button>
            {quickCategoryChips.map((cat) => (
              <button
                key={cat.key}
                type="button"
                id={`category-chip-${cat.key}`}
                onClick={() => setSport(sport === cat.key ? ALL : cat.key)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors shrink-0 cursor-pointer border flex items-center gap-1.5",
                  sport === cat.key
                    ? "bg-primary text-primary-foreground border-primary shadow-xs"
                    : "bg-surface border-border text-muted-foreground hover:text-foreground hover:bg-accent",
                )}
              >
                <span>{cat.label}</span>
                {cat.count > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.2 text-[10px] font-semibold",
                      sport === cat.key ? "bg-white/20 text-white" : "bg-muted text-foreground",
                    )}
                  >
                    {cat.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <EventListSkeleton count={6} className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" />
      ) : rows.length === 0 ? (
        onlyFavorites ? (
          <NoFavoritesEmptyState onExploreAll={() => setOnlyFavorites(false)} />
        ) : search ? (
          <NoSearchResultsEmptyState query={search} onClear={() => setSearch("")} />
        ) : sport !== ALL ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center space-y-3">
            <div className="mx-auto flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Trophy className="size-5" />
            </div>
            <div>
              <p className="text-sm font-medium">
                Nenhum evento encontrado na categoria "{formatSportLabel(sport)}".
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Cadastre um evento esportivo para esta modalidade ou veja todas as categorias.
              </p>
            </div>
            <div className="flex justify-center gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => setSport(ALL)}>
                Ver todos os esportes
              </Button>
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus className="size-4" /> Cadastrar evento
              </Button>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={Trophy}
            title="Nenhum evento cadastrado"
            description="Cadastre corridas, torneios, partidas de vôlei e outras coberturas que não seguem o formato tradicional de partida."
            action={
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus className="size-4" /> Novo evento
              </Button>
            }
          />
        )
      ) : viewMode === "calendario" ? (
        <EventMonthCalendar events={rows} onSelectEvent={(e) => setSelected(e)} byEvent={byEvent} />
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
