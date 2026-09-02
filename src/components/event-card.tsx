import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Heart, MapPin, Trophy, Users } from "lucide-react";

import { EventStatusBadge } from "@/components/event-status-badge";
import { Button } from "@/components/ui/button";
import { type SportEvent } from "@/lib/events";
import { useEventFavorites } from "@/lib/favorites";
import { formatSportLabel } from "@/lib/sports";
import { cn } from "@/lib/utils";

/** Card compacto do evento — visual alinhado aos cards de partida. */
export function EventCard({
  event,
  contacts = 0,
  badge,
  onOpen,
}: {
  event: SportEvent;
  contacts?: number;
  badge?: React.ReactNode;
  onOpen: () => void;
}) {
  const { isFavorite, toggleFavorite } = useEventFavorites();
  const isFav = isFavorite(event.id);

  const dateLabel = format(parseISO(event.start_date), "dd/MM/yyyy", { locale: ptBR });
  const endLabel = event.end_date
    ? format(parseISO(event.end_date), "dd/MM/yyyy", { locale: ptBR })
    : null;

  return (
    <article className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-medium">{event.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-[11px]">
              <Trophy className="size-3 opacity-60" />
              {formatSportLabel(event.sport)}
            </span>
            <EventStatusBadge status={event.status} size="sm" showDot={true} />
            {badge}
          </div>
        </div>

        {/* Botão de favorito */}
        <button
          type="button"
          aria-label={isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          onClick={(e) => toggleFavorite(event.id, e)}
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-full transition-all cursor-pointer",
            isFav
              ? "text-rose-500 bg-rose-500/10 hover:bg-rose-500/20"
              : "text-muted-foreground/40 hover:text-rose-500 hover:bg-muted",
          )}
          title={isFav ? "Favorito (clique para remover)" : "Adicionar aos favoritos"}
        >
          <Heart className={cn("size-3.5", isFav && "fill-current")} />
        </button>
      </div>

      <div className="space-y-1 text-xs text-muted-foreground">
        <p className="flex items-center gap-1.5">
          <CalendarDays className="size-3.5 shrink-0 opacity-60" />
          {dateLabel}
          {event.start_time ? ` · ${event.start_time.slice(0, 5)}` : ""}
          {endLabel && endLabel !== dateLabel ? ` até ${endLabel}` : ""}
        </p>
        {(event.venue || event.city) && (
          <p className="flex items-center gap-1.5">
            <MapPin className="size-3.5 shrink-0 opacity-60" />
            <span className="truncate">
              {[event.venue, [event.city, event.state].filter(Boolean).join(" · ")]
                .filter(Boolean)
                .join(" — ")}
            </span>
          </p>
        )}
        {event.categories.length > 0 && (
          <p className="truncate">Categorias: {event.categories.map((c) => c.name).join(" · ")}</p>
        )}
        <p className="flex items-center gap-1.5">
          <Users className="size-3.5 shrink-0 opacity-60" />
          {contacts} {contacts === 1 ? "atleta/cliente" : "atletas/clientes"}
        </p>
      </div>

      <Button size="sm" variant="outline" className="w-full" onClick={onOpen}>
        Ver evento
      </Button>
    </article>
  );
}
