import React from "react";
import { CalendarX2, Heart, RotateCcw, SearchX, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface NoSearchResultsProps {
  query: string;
  onClear: () => void;
  className?: string;
  id?: string;
}

export function NoSearchResultsEmptyState({
  query,
  onClear,
  className,
  id = "empty-search-results",
}: NoSearchResultsProps) {
  return (
    <div
      id={id}
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center shadow-xs transition-all",
        className,
      )}
    >
      <div className="relative mb-4 flex size-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
        <SearchX className="size-7" />
        <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-background border border-border text-[10px]">
          0
        </span>
      </div>

      <h3 className="text-base font-semibold text-foreground">
        Nenhum evento encontrado para "{query}"
      </h3>
      <p className="mt-1.5 max-w-md text-xs sm:text-sm text-muted-foreground leading-relaxed">
        Não encontramos nenhum jogo ou evento correspondente com o nome do time ou da competição
        pesquisada. Verifique a ortografia ou tente termos mais genéricos.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button
          id={`${id}-clear-button`}
          variant="outline"
          size="sm"
          onClick={onClear}
          className="text-xs gap-1.5"
        >
          <RotateCcw className="size-3.5" /> Limpar busca
        </Button>
      </div>
    </div>
  );
}

export interface NoDayEventsProps {
  dateLabel: string;
  onViewUpcoming?: () => void;
  className?: string;
  id?: string;
}

export function NoDayEventsEmptyState({
  dateLabel,
  onViewUpcoming,
  className,
  id = "empty-day-events",
}: NoDayEventsProps) {
  return (
    <div
      id={id}
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center shadow-xs transition-all",
        className,
      )}
    >
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <CalendarX2 className="size-7" />
      </div>

      <h3 className="text-base font-semibold text-foreground">
        Sem eventos agendados para {dateLabel}
      </h3>
      <p className="mt-1.5 max-w-md text-xs sm:text-sm text-muted-foreground leading-relaxed">
        Não há partidas ou modalidades esportivas programadas para esta data específica. Você pode
        navegar para outra data no calendário ou explorar os próximos jogos confirmados.
      </p>

      {onViewUpcoming && (
        <div className="mt-6">
          <Button
            id={`${id}-upcoming-button`}
            variant="default"
            size="sm"
            onClick={onViewUpcoming}
            className="text-xs gap-1.5"
          >
            <Sparkles className="size-3.5" /> Ver todos os próximos eventos
          </Button>
        </div>
      )}
    </div>
  );
}

export interface NoFavoritesProps {
  onExploreAll?: () => void;
  className?: string;
  id?: string;
}

export function NoFavoritesEmptyState({
  onExploreAll,
  className,
  id = "empty-favorites",
}: NoFavoritesProps) {
  return (
    <div
      id={id}
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-12 text-center shadow-xs transition-all",
        className,
      )}
    >
      <div className="mb-4 flex size-14 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-500">
        <Heart className="size-7 fill-rose-500/20" />
      </div>

      <h3 className="text-base font-semibold text-foreground">Nenhum evento favoritado ainda</h3>
      <p className="mt-1.5 max-w-md text-xs sm:text-sm text-muted-foreground leading-relaxed">
        Clique no ícone de coração nos cartões dos jogos ou na tela de detalhes do evento para
        salvar seus eventos favoritos e acompanhá-los com facilidade.
      </p>

      {onExploreAll && (
        <div className="mt-6">
          <Button
            id={`${id}-explore-button`}
            variant="outline"
            size="sm"
            onClick={onExploreAll}
            className="text-xs"
          >
            Ver todos os eventos
          </Button>
        </div>
      )}
    </div>
  );
}
