import { Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, CalendarPlus, CheckCircle2, MapPin, RotateCcw, Send } from "lucide-react";
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
 * Mostra data, local e clubes, e permite solicitar credenciamento,
 * adicionar/ver na Minha Agenda, concluir cobertura e fechar separadamente.
 */
export function MatchDetailDialog({
  match,
  onOpenChange,
}: {
  match: Match | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: coverages = [] } = useCoverages();
  const { setStatusByMatch, completeByMatch, request, reopen } = useCoverageMutations();

  const coverage = match ? coverageByMatch(coverages)[match.id] : undefined;
  const status = coverage?.credential_status ?? "not_requested";
  const isApproved = status === "approved";
  const isCompleted = !!coverage?.completed_at;
  const style = compStyle(match?.competition?.color);

  return (
    <Dialog open={!!match} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
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

            <div className="space-y-3.5 text-sm">
              <div className="flex items-center gap-2">
                <span className={`size-2 rounded-full ${style.dot}`} />
                <span className="font-medium">{match.competition?.name ?? "Sem campeonato"}</span>
              </div>
              <div className="flex items-start gap-2 text-muted-foreground">
                <MapPin className="mt-0.5 size-4 shrink-0" />
                <span>
                  {[match.venue, match.city, match.state].filter(Boolean).join(" · ") ||
                    "Local a definir"}
                </span>
              </div>

              {/* Status de Credenciamento e Cobertura */}
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`size-2 rounded-full ${CREDENTIAL_DOT[status]}`} />
                    <span className="text-sm font-medium">
                      Credenciamento: {CREDENTIAL_LABEL[status]}
                    </span>
                    {isApproved && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="size-3" /> Na Minha Agenda
                      </span>
                    )}
                    {isCompleted && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        Cobertura concluída
                      </span>
                    )}
                  </div>
                  <CredentialActions matchId={match.id} status={status} />
                </div>
              </div>

              <div className="border-t border-border pt-3">
                <MatchClientsPanel match={match} />
              </div>
            </div>

            <DialogFooter className="mt-2 flex-wrap items-center justify-between gap-2 sm:justify-between">
              <div>
                <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                  Fechar
                </Button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Se não solicitado ou reprovado: oferece solicitar ou incluir diretamente na agenda */}
                {!isApproved && (status === "not_requested" || status === "denied") && (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={setStatusByMatch.isPending}
                      onClick={() =>
                        setStatusByMatch.mutate(
                          { matchId: match.id, status: "approved" },
                          {
                            onSuccess: () => toast.success("Adicionado à Minha Agenda."),
                            onError: () => toast.error("Não foi possível adicionar à agenda."),
                          },
                        )
                      }
                    >
                      <CalendarPlus className="size-4" /> Adicionar à Minha Agenda
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={request.isPending}
                      onClick={() =>
                        request.mutate(match.id, {
                          onSuccess: () => toast.success("Credenciamento solicitado."),
                          onError: () => toast.error("Não foi possível solicitar credenciamento."),
                        })
                      }
                    >
                      <Send className="size-4" /> Solicitar
                    </Button>
                  </>
                )}

                {/* Se já aprovado: já está na agenda! Oferece navegação e conclusão de cobertura */}
                {isApproved && (
                  <>
                    <Link to="/agenda" onClick={() => onOpenChange(false)}>
                      <Button type="button" variant="outline" size="sm">
                        <Calendar className="size-4" /> Ver na Minha Agenda
                      </Button>
                    </Link>

                    {!isCompleted ? (
                      <Button
                        type="button"
                        variant="default"
                        size="sm"
                        disabled={completeByMatch.isPending}
                        onClick={() =>
                          completeByMatch.mutate(match.id, {
                            onSuccess: () => toast.success("Cobertura concluída."),
                            onError: () => toast.error("Não foi possível concluir a cobertura."),
                          })
                        }
                      >
                        <CheckCircle2 className="size-4" /> Concluir cobertura
                      </Button>
                    ) : (
                      coverage?.id && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={reopen.isPending}
                          onClick={() =>
                            reopen.mutate(coverage.id, {
                              onSuccess: () => toast.success("Cobertura reaberta."),
                              onError: () => toast.error("Não foi possível reabrir a cobertura."),
                            })
                          }
                        >
                          <RotateCcw className="size-4" /> Reabrir cobertura
                        </Button>
                      )
                    )}
                  </>
                )}
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
