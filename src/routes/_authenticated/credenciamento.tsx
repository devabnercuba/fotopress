import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { HelpHint } from "@/components/help-hint";
import { TeamCrest } from "@/components/team-crest";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { compStyle } from "@/lib/competitions";
import {
  CREDENTIAL_DOT,
  CREDENTIAL_LABEL,
  CREDENTIAL_STATUSES,
  useCoverageMutations,
  useCoverages,
  type CredentialStatus,
} from "@/lib/coverages";
import { useEventCoverageMutations, useEventCoverages } from "@/lib/events";
import { formatSportLabel } from "@/lib/sports";

export const Route = createFileRoute("/_authenticated/credenciamento")({
  head: () => ({
    meta: [
      { title: "Credenciamento — Cobertura esportiva" },
      {
        name: "description",
        content:
          "Acompanhe os pedidos de credenciamento e aprove ou negue cada cobertura solicitada.",
      },
      { property: "og:title", content: "Credenciamento — Cobertura esportiva" },
      {
        property: "og:description",
        content: "Controle dos pedidos de credenciamento das suas coberturas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CredentialsPage,
});

function CredentialsPage() {
  const { data: coverages = [], isLoading } = useCoverages();
  const { setStatus, remove: removeMatchCoverage } = useCoverageMutations();
  const { data: eventCoverages = [] } = useEventCoverages();
  const { upsert, remove: removeEventCoverage } = useEventCoverageMutations();

  const [itemToConfirm, setItemToConfirm] = useState<{
    id: string;
    type: "match" | "event";
    title: string;
  } | null>(null);

  // Eventos esportivos que exigem credencial seguem o mesmo fluxo das partidas.
  const eventItems = eventCoverages.filter(
    (c) => c.event?.accreditation_required && !c.completed_at && c.credential_status !== "denied",
  );

  // Negados saem da lista de credenciamentos; o jogo continua em Jogos.
  const items = coverages.filter(
    (c) => c.match && !c.completed_at && c.credential_status !== "denied",
  );

  const totalCount = items.length + eventItems.length;
  const requestedCount =
    items.filter((i) => i.credential_status === "requested").length +
    eventItems.filter((i) => i.credential_status === "requested").length;
  const waitingCount =
    items.filter((i) => i.credential_status === "waiting_analysis").length +
    eventItems.filter((i) => i.credential_status === "waiting_analysis").length;
  const approvedCount =
    items.filter((i) => i.credential_status === "approved").length +
    eventItems.filter((i) => i.credential_status === "approved").length;

  const handleRemove = (id: string, type: "match" | "event") => {
    if (type === "match") {
      removeMatchCoverage.mutate(id, {
        onSuccess: () => {
          toast.success("Credenciamento removido da sua lista interna.");
        },
        onError: () => toast.error("Não foi possível remover o credenciamento."),
      });
    } else {
      removeEventCoverage.mutate(id, {
        onSuccess: () => {
          toast.success("Credenciamento removido da sua lista interna.");
        },
        onError: () => toast.error("Não foi possível remover o credenciamento."),
      });
    }
  };

  const handleRequestRemove = (
    id: string,
    type: "match" | "event",
    status: CredentialStatus,
    title: string,
  ) => {
    if (status === "approved") {
      setItemToConfirm({ id, type, title });
    } else {
      handleRemove(id, type);
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              Credenciamento
              <HelpHint text="Controle o andamento das solicitações de credenciamento das partidas que você pretende cobrir." />
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {totalCount} {totalCount === 1 ? "pedido em andamento" : "pedidos em andamento"}.
              Aprovar move a cobertura para Minha Agenda.
            </p>
          </div>
        </div>

        {/* Resumo visual dos contadores */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">Total em andamento</div>
            <div className="text-lg font-semibold mt-0.5">{totalCount}</div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">Solicitados</div>
            <div className="text-lg font-semibold text-amber-600 dark:text-amber-400 mt-0.5">
              {requestedCount}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">Em análise</div>
            <div className="text-lg font-semibold text-blue-600 dark:text-blue-400 mt-0.5">
              {waitingCount}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="text-xs text-muted-foreground">Aprovados (Agenda)</div>
            <div className="text-lg font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {approvedCount}
            </div>
          </div>
        </div>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : items.length === 0 && eventItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum credenciamento em andamento. Solicite a partir da tela Jogos ou Calendário.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {items.map((item) => {
            const match = item.match!;
            const style = compStyle(match.competition?.color);
            const matchTitle = `${match.home_team} × ${match.away_team}`;

            return (
              <li key={item.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="w-20 shrink-0">
                  <div className="text-lg font-semibold capitalize">
                    {format(parseISO(match.date), "dd MMM", { locale: ptBR })}
                  </div>
                  <div className="text-xs text-muted-foreground">{match.time.slice(0, 5)}</div>
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 truncate text-sm font-medium">
                    <TeamCrest name={match.home_team} teamId={match.home_team_id} size="xs" />
                    <span>{match.home_team}</span>
                    <span className="text-muted-foreground font-normal">×</span>
                    <span>{match.away_team}</span>
                    <TeamCrest name={match.away_team} teamId={match.away_team_id} size="xs" />
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span className={`size-1.5 rounded-full ${style.dot}`} />
                    {match.competition?.name ?? "Sem campeonato"}
                    {match.venue ? ` · ${match.venue}` : ""}
                    {match.city ? ` · ${match.city}` : ""}
                    <span className="flex items-center gap-1.5">
                      <span
                        className={`size-1.5 rounded-full ${CREDENTIAL_DOT[item.credential_status]}`}
                      />
                      {CREDENTIAL_LABEL[item.credential_status]}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Select
                    value={item.credential_status}
                    onValueChange={(value) =>
                      setStatus.mutate(
                        { id: item.id, status: value as CredentialStatus },
                        {
                          onSuccess: () =>
                            toast.success(
                              value === "approved"
                                ? "Aprovado. Cobertura movida para Minha Agenda."
                                : value === "denied"
                                  ? "Negado. O jogo continua disponível em Jogos."
                                  : "Status atualizado.",
                            ),
                          onError: () => toast.error("Não foi possível atualizar o status."),
                        },
                      )
                    }
                  >
                    <SelectTrigger className="w-[170px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CREDENTIAL_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {CREDENTIAL_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      handleRequestRemove(item.id, "match", item.credential_status, matchTitle)
                    }
                    title="Remover da lista de credenciamento (ação estritamente interna)"
                    className="text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {eventItems.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Eventos esportivos</h2>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
            {eventItems.map((item) => {
              const ev = item.event!;
              return (
                <li key={item.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <div className="w-20 shrink-0">
                    <div className="text-lg font-semibold capitalize">
                      {format(parseISO(ev.start_date), "dd MMM", { locale: ptBR })}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {ev.start_time ? ev.start_time.slice(0, 5) : "—"}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{ev.name}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {formatSportLabel(ev.sport)}
                      {ev.venue ? ` · ${ev.venue}` : ""}
                      {ev.city ? ` · ${ev.city}` : ""}
                      <span className="flex items-center gap-1.5">
                        <span
                          className={`size-1.5 rounded-full ${CREDENTIAL_DOT[item.credential_status]}`}
                        />
                        {CREDENTIAL_LABEL[item.credential_status]}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={item.credential_status}
                      onValueChange={(value) =>
                        upsert.mutate(
                          { eventId: ev.id, status: value as CredentialStatus },
                          {
                            onSuccess: () =>
                              toast.success(
                                value === "approved"
                                  ? "Aprovado. Cobertura movida para Minha Agenda."
                                  : "Status atualizado.",
                              ),
                            onError: () => toast.error("Não foi possível atualizar o status."),
                          },
                        )
                      }
                    >
                      <SelectTrigger className="w-[170px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CREDENTIAL_STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {CREDENTIAL_LABEL[s]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        handleRequestRemove(item.id, "event", item.credential_status, ev.name)
                      }
                      title="Remover da lista de credenciamento (ação estritamente interna)"
                      className="text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* Confirmação segura exclusiva para itens já aprovados */}
      <AlertDialog open={!!itemToConfirm} onOpenChange={(open) => !open && setItemToConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              Remover cobertura já aprovada?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm">
              <p>
                O item <strong>{itemToConfirm?.title}</strong> já foi aprovado e está na sua Minha
                Agenda.
              </p>
              <p>
                Esta ação remove o registro do seu painel de credenciamento e agenda interna, mas
                não exclui o jogo da base do sistema nem aciona cancelamentos com federações
                esportivas.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (itemToConfirm) {
                  handleRemove(itemToConfirm.id, itemToConfirm.type);
                  setItemToConfirm(null);
                }
              }}
            >
              Sim, remover da lista
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
