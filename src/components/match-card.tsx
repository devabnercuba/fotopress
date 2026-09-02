import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, Clock, MapPin } from "lucide-react";
import type { ReactNode } from "react";

import { MatchActions } from "@/components/match-actions";
import { Checkbox } from "@/components/ui/checkbox";

import { TeamCrest } from "@/components/team-crest";
import { compStyle } from "@/lib/competitions";
import { CREDENTIAL_DOT, CREDENTIAL_LABEL, type CredentialStatus } from "@/lib/coverages";
import type { Match } from "@/lib/queries";

/** Cartão de partida usado em Jogos, Calendário e demais telas. */
export function MatchCard({
  match,
  status,
  action,
  compact = false,
  showSource = true,
  onClick,
  selectable = false,
  selected = false,
  onSelectedChange,
}: {
  match: Match;
  status?: CredentialStatus;
  action?: ReactNode;
  compact?: boolean;
  showSource?: boolean;
  /** Quando informado, o cartão abre o detalhe rápido da partida. */
  onClick?: () => void;
  /** Modo seleção múltipla (exclusão em lote). */
  selectable?: boolean;
  selected?: boolean;
  onSelectedChange?: (checked: boolean) => void;
}) {
  const style = compStyle(match.competition?.color);
  const place = [match.venue || "A definir", match.city, match.state].filter(Boolean).join(" · ");
  const origin = match.import_type || match.source || "Manual";

  return (
    <article
      onClick={selectable ? () => onSelectedChange?.(!selected) : onClick}
      className={`rounded-xl border bg-card p-4 transition-colors hover:bg-accent/40 ${
        selected ? "border-primary ring-1 ring-primary" : "border-border"
      } ${onClick || selectable ? "cursor-pointer" : ""}`}
    >
      <div className="flex items-start gap-3">
        {selectable && (
          <Checkbox
            checked={selected}
            onCheckedChange={(v) => onSelectedChange?.(v === true)}
            onClick={(e) => e.stopPropagation()}
            aria-label="Selecionar jogo"
            className="mt-0.5"
          />
        )}
        <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${style.chip}`}>
          {match.competition?.name ?? "Sem campeonato"}
        </span>
        <div className="ml-auto flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {action}
          <MatchActions match={match} />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <TeamCrest name={match.home_team} size={compact ? "md" : "lg"} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">
            {match.home_team} <span className="font-normal text-muted-foreground">×</span>{" "}
            {match.away_team}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CalendarDays className="size-3.5" />
              {format(parseISO(match.date), "dd/MM/yyyy", { locale: ptBR })}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="size-3.5" />
              {match.time.slice(0, 5)}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="size-3.5" />
              {place}
            </span>
          </div>
        </div>
        <TeamCrest name={match.away_team} size={compact ? "md" : "lg"} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {status && (
          <span className="flex items-center gap-1.5">
            <span className={`size-1.5 rounded-full ${CREDENTIAL_DOT[status]}`} />
            {CREDENTIAL_LABEL[status]}
          </span>
        )}
        {showSource && (
          <span className="rounded-md border border-border px-1.5 py-0.5">Origem: {origin}</span>
        )}
      </div>
    </article>
  );
}
