import React, { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar as CalendarIcon,
  CalendarPlus,
  Check,
  Clock,
  Download,
  ExternalLink,
  Heart,
  MapPin,
  Share2,
  Sparkles,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";

import { EventStatusBadge } from "@/components/event-status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { exportEventToIcs, getGoogleCalendarUrl, shareSportsEvent } from "@/lib/calendar-export";
import { useEventFavorites } from "@/lib/favorites";
import { cn } from "@/lib/utils";
import type { ISportEvent, SportEvent, SportEventStatus } from "@/schemas/sport-event";

export interface SportsEventDetailsDialogProps {
  event: (SportEvent | ISportEvent) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Modal reutilizável de Detalhes do Evento Esportivo.
 * Abre ao clicar em um evento no calendário ou na busca.
 * Apresenta dados completos, status temático e ações: Adicionar à Agenda, Exportar .ics, Favoritar e Compartilhar.
 */
export function SportsEventDetailsDialog({
  event,
  open,
  onOpenChange,
}: SportsEventDetailsDialogProps) {
  const { isFavorite, toggleFavorite } = useEventFavorites();
  const [copiedRecently, setCopiedRecently] = useState(false);

  if (!event) return null;

  const isFav = isFavorite(event.id);
  const parsedDate = event.date ? parseISO(event.date) : null;
  const formattedDate = parsedDate
    ? format(parsedDate, "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : "Data não definida";

  const fullLocation = [event.venue, event.city, event.state].filter(Boolean).join(" - ");

  const handleExportIcs = () => {
    try {
      exportEventToIcs(event);
      toast.success("Arquivo de calendário (.ics) baixado com sucesso!");
    } catch {
      toast.error("Erro ao gerar arquivo do calendário.");
    }
  };

  const handleShare = async () => {
    const result = await shareSportsEvent(event);
    if (result.success) {
      if (result.method === "clipboard") {
        setCopiedRecently(true);
        setTimeout(() => setCopiedRecently(false), 2500);
        toast.success("Detalhes do evento copiados para a área de transferência!");
      } else {
        toast.success("Evento compartilhado!");
      }
    } else {
      toast.info("Não foi possível compartilhar.");
    }
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    toggleFavorite(event.id, e);
    if (!isFav) {
      toast.success("Evento adicionado aos seus favoritos!");
    } else {
      toast.info("Evento removido dos favoritos.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        id="sports-event-details-dialog"
        className="max-w-lg p-0 overflow-hidden sm:rounded-2xl"
      >
        {/* Banner superior com tags e botão de favorito */}
        <div className="bg-surface/80 border-b border-border/80 px-6 py-5">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                <Trophy className="size-3.5" />
                {event.sportType}
              </span>
              {event.competition && (
                <span className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                  {event.competition}
                </span>
              )}
            </div>

            {/* Botão de Favorito no cabeçalho */}
            <Button
              id="dialog-favorite-button"
              variant="ghost"
              size="icon-sm"
              onClick={handleToggleFavorite}
              aria-label={isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
              className={cn(
                "rounded-full transition-all",
                isFav
                  ? "text-rose-500 bg-rose-500/10 hover:bg-rose-500/20"
                  : "text-muted-foreground hover:text-rose-500 hover:bg-muted",
              )}
              title={isFav ? "Favorito (clique para remover)" : "Adicionar aos favoritos"}
            >
              <Heart className={cn("size-4", isFav && "fill-current")} />
            </Button>
          </div>

          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
              {event.homeTeam && event.awayTeam ? (
                <span className="flex items-center gap-2">
                  <span>{event.homeTeam}</span>
                  <span className="text-muted-foreground font-normal text-sm">×</span>
                  <span>{event.awayTeam}</span>
                </span>
              ) : (
                event.title
              )}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground flex items-center gap-2">
              <EventStatusBadge
                status={event.status as SportEventStatus}
                size="sm"
                showIcon={true}
              />
              {event.city && <span className="text-muted-foreground/80">· {event.city}</span>}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Corpo com Informações do Evento */}
        <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Card de Data e Horário */}
          <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-3.5">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <CalendarIcon className="size-5" />
            </div>
            <div className="space-y-0.5 min-w-0">
              <p className="text-xs text-muted-foreground font-medium">Data e Horário</p>
              <p className="text-sm font-semibold capitalize text-foreground">{formattedDate}</p>
              {event.time && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Clock className="size-3.5 opacity-70" />
                  Horário: <span className="font-medium text-foreground">{event.time}</span>
                </p>
              )}
            </div>
          </div>

          {/* Local / Venue */}
          {fullLocation && (
            <div className="flex items-start gap-3 rounded-xl border border-border bg-card p-3.5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <MapPin className="size-5" />
              </div>
              <div className="space-y-0.5 min-w-0">
                <p className="text-xs text-muted-foreground font-medium">Local do Evento</p>
                <p className="text-sm font-medium text-foreground">{fullLocation}</p>
              </div>
            </div>
          )}

          {/* Confronto detalhado se houver times definidos */}
          {event.homeTeam && event.awayTeam && (
            <div className="rounded-xl border border-border bg-surface p-3.5">
              <p className="text-xs text-muted-foreground font-medium mb-2.5">Confronto</p>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-lg border border-border bg-card p-2.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-0.5">
                    Mandante
                  </span>
                  <p className="text-sm font-bold text-foreground truncate">{event.homeTeam}</p>
                </div>
                <div className="rounded-lg border border-border bg-card p-2.5">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider block mb-0.5">
                    Visitante
                  </span>
                  <p className="text-sm font-bold text-foreground truncate">{event.awayTeam}</p>
                </div>
              </div>
            </div>
          )}

          {/* Observações / Notas */}
          {event.notes && (
            <div className="rounded-xl border border-border bg-card p-3.5 space-y-1">
              <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                <Sparkles className="size-3 text-primary" /> Observações
              </p>
              <p className="text-xs text-foreground/90 whitespace-pre-line leading-relaxed">
                {event.notes}
              </p>
            </div>
          )}
        </div>

        {/* Rodapé com Ações Principais: Adicionar ao Calendário & Compartilhar */}
        <DialogFooter className="bg-surface/60 border-t border-border px-6 py-4 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          <Button
            id="dialog-close-button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            Fechar
          </Button>

          <div className="flex flex-wrap items-center gap-2">
            {/* Botão de Compartilhar */}
            <Button
              id="dialog-share-button"
              variant="outline"
              size="sm"
              onClick={handleShare}
              className="text-xs gap-1.5 flex-1 sm:flex-initial"
            >
              {copiedRecently ? (
                <>
                  <Check className="size-3.5 text-comp-green" /> Copiado!
                </>
              ) : (
                <>
                  <Share2 className="size-3.5" /> Compartilhar
                </>
              )}
            </Button>

            {/* Dropdown de Adicionar ao Calendário / Exportar .ics */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  id="dialog-add-calendar-button"
                  variant="default"
                  size="sm"
                  className="text-xs gap-1.5 flex-1 sm:flex-initial"
                >
                  <CalendarPlus className="size-3.5" />
                  <span>Adicionar ao Calendário</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  id="action-export-ics"
                  onClick={handleExportIcs}
                  className="cursor-pointer gap-2 text-xs"
                >
                  <Download className="size-4 text-primary" />
                  <div className="flex flex-col">
                    <span className="font-medium">Baixar arquivo (.ics)</span>
                    <span className="text-[10px] text-muted-foreground">
                      Apple Calendar, Outlook e outros
                    </span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem
                  id="action-open-google-calendar"
                  asChild
                  className="cursor-pointer gap-2 text-xs"
                >
                  <a href={getGoogleCalendarUrl(event)} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="size-4 text-primary" />
                    <div className="flex flex-col">
                      <span className="font-medium">Google Agenda</span>
                      <span className="text-[10px] text-muted-foreground">
                        Adicionar via navegador
                      </span>
                    </div>
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
