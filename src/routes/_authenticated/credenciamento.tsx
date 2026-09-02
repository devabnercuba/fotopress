import { createFileRoute } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

import { HelpHint } from "@/components/help-hint";
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
  const { setStatus } = useCoverageMutations();
  const { data: eventCoverages = [] } = useEventCoverages();
  const { upsert } = useEventCoverageMutations();

  // Eventos esportivos que exigem credencial seguem o mesmo fluxo das partidas.
  const eventItems = eventCoverages.filter(
    (c) => c.event?.accreditation_required && !c.completed_at && c.credential_status !== "denied",
  );

  // Negados saem da lista de credenciamentos; o jogo continua em Jogos.
  const items = coverages.filter(
    (c) => c.match && !c.completed_at && c.credential_status !== "denied",
  );

  return (
    <div className="space-y-6">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          Credenciamento
          <HelpHint text="Controle o andamento das solicitações de credenciamento das partidas que você pretende cobrir." />
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {items.length} {items.length === 1 ? "pedido em andamento" : "pedidos em andamento"}.
          Aprovar move a cobertura para Minha Agenda.
        </p>
      </header>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum credenciamento em andamento. Solicite a partir da tela Jogos.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {items.map((item) => {
            const match = item.match!;
            const style = compStyle(match.competition?.color);
            return (
              <li key={item.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="w-20 shrink-0">
                  <div className="text-lg font-semibold capitalize">
                    {format(parseISO(match.date), "dd MMM", { locale: ptBR })}
                  </div>
                  <div className="text-xs text-muted-foreground">{match.time.slice(0, 5)}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {match.home_team} <span className="text-muted-foreground">×</span>{" "}
                    {match.away_team}
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
                  <SelectTrigger className="w-[180px]">
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
                    <SelectTrigger className="w-[180px]">
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
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
