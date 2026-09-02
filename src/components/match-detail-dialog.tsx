import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarPlus, CheckCircle2, MapPin } from "lucide-react";
import { toast } from "sonner";

import { CredentialActions } from "@/components/credential-actions";
import { MatchClientsPanel } from "@/components/match-clients-panel";

import { TeamCrest } from "@/components/team-crest";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { compStyle } from "@/lib/competitions";
import {
  coverageByMatch,
  CREDENTIAL_DOT,
  CREDENTIAL_LABEL,
  useCoverageMutations,
  useCoverages,
} from "@/lib/coverages";
import type { Match } from "@/lib/queries";

/**
 * Detalhe rápido de um jogo — usado no calendário e em Campeonatos.
 * Mostra data, local e clubes, e permite adicionar à Minha Agenda,
 * concluir a cobertura e resolver o credenciamento.
 */
export function MatchDetailDialog({
  match,
  onOpenChange,
}: {
  match: Match | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: coverages = [] } = useCoverages();
  const { setStatusByMatch, completeByMatch } = useCoverageMutations();

  const coverage = match ? coverageByMatch(coverages)[match.id] : undefined;
  const status = coverage?.credential_status ?? "not_requested";
  const style = compStyle(match?.competition?.color);

  return (
    <Dialog open={!!match} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {match && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <TeamCrest name={match.home_team} size="sm" />
                <span className="min-w-0 truncate">
                  {match.home_team} <span className="text-muted-foreground">×</span>{" "}
                  {match.away_team}
                </span>
                <TeamCrest name={match.away_team} size="sm" />
              </DialogTitle>
              <DialogDescription className="capitalize">
                {format(parseISO(match.date), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })} ·{" "}
                {match.time.slice(0, 5)}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <span className={`size-2 rounded-full ${style.dot}`} />
                <span>{match.competition?.name ?? "Sem campeonato"}</span>
              </div>
              <div className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="mt-0.5 size-4 shrink-0" />
                <span>
                  {[match.venue, match.city, match.state].filter(Boolean).join(" · ") ||
                    "Local a definir"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`size-2 rounded-full ${CREDENTIAL_DOT[status]}`} />
                <span className="text-muted-foreground">
                  Credenciamento: {CREDENTIAL_LABEL[status]}
                  {coverage?.completed_at ? " · cobertura concluída" : ""}
                </span>
                <span className="ml-auto">
                  <CredentialActions matchId={match.id} status={status} />
                </span>
              </div>

              <div className="border-t border-border pt-3">
                <MatchClientsPanel match={match} />
              </div>
            </div>

            <DialogFooter className="flex-row justify-end gap-2">
              <Button
                variant="outline"
                disabled={setStatusByMatch.isPending}
                onClick={() =>
                  setStatusByMatch.mutate(
                    { matchId: match.id, status: "approved" },
                    {
                      onSuccess: () => toast.success("Adicionado à Minha Agenda."),
                      onError: () => toast.error("Não foi possível adicionar."),
                    },
                  )
                }
              >
                <CalendarPlus className="size-4" /> Minha Agenda
              </Button>
              <Button
                disabled={completeByMatch.isPending || !!coverage?.completed_at}
                onClick={() =>
                  completeByMatch.mutate(match.id, {
                    onSuccess: () => toast.success("Cobertura concluída."),
                    onError: () => toast.error("Não foi possível concluir."),
                  })
                }
              >
                <CheckCircle2 className="size-4" /> Concluir
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
