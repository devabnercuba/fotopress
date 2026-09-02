import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarCheck, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { EventCommercialPanel } from "@/components/event-commercial-panel";
import { EventFormDialog } from "@/components/event-form-dialog";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CREDENTIAL_LABEL, CREDENTIAL_STATUSES } from "@/lib/coverages";
import {
  coverageByEvent,
  useEventCoverageMutations,
  useEventCoverages,
  useEventMutations,
  type SportEvent,
} from "@/lib/events";
import { useEventEngagements } from "@/lib/event-engagements";
import { formatSportLabel } from "@/lib/sports";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-2.5 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-right text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

export function EventDetailSheet({
  event,
  onOpenChange,
}: {
  event: SportEvent | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: coverages = [] } = useEventCoverages();
  const { upsert, complete, reopen, remove: removeCoverage } = useEventCoverageMutations();
  const { remove } = useEventMutations();
  const { data: engagements = [] } = useEventEngagements(event?.id);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const coverage = event ? coverageByEvent(coverages)[event.id] : undefined;

  return (
    <>
      <Sheet open={!!event} onOpenChange={onOpenChange}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-2xl">
          {event && (
            <>
              <SheetHeader className="gap-2">
                <span className="w-fit rounded-md bg-surface px-2 py-0.5 text-xs font-medium">
                  {formatSportLabel(event.sport)}
                </span>
                <SheetTitle className="text-xl leading-snug">{event.name}</SheetTitle>
              </SheetHeader>

              <div className="px-4 pb-10">
                <Tabs defaultValue="informacoes">
                  <TabsList>
                    <TabsTrigger value="informacoes">Informações</TabsTrigger>
                    <TabsTrigger value="clientes">Atletas/Clientes</TabsTrigger>
                  </TabsList>

                  <TabsContent value="informacoes" className="mt-4 space-y-5">
                    <div>
                      <Row
                        label="Data"
                        value={
                          format(parseISO(event.start_date), "dd 'de' MMMM 'de' yyyy", {
                            locale: ptBR,
                          }) +
                          (event.end_date && event.end_date !== event.start_date
                            ? ` até ${format(parseISO(event.end_date), "dd/MM/yyyy", { locale: ptBR })}`
                            : "")
                        }
                      />
                      <Row
                        label="Horário"
                        value={
                          [event.start_time?.slice(0, 5), event.end_time?.slice(0, 5)]
                            .filter(Boolean)
                            .join(" — ") || "A definir"
                        }
                      />
                      <Row label="Modalidade" value={formatSportLabel(event.sport) ?? "—"} />
                      <Row label="Local" value={event.venue || "A definir"} />
                      <Row
                        label="Cidade"
                        value={[event.city, event.state].filter(Boolean).join(" · ") || "A definir"}
                      />
                      <Row label="Organizador" value={event.organizer || "—"} />
                      <Row
                        label="Categorias"
                        value={
                          event.categories.length
                            ? event.categories.map((c) => c.name).join(" · ")
                            : "Sem categorias"
                        }
                      />
                      {event.notes && <Row label="Observações" value={event.notes} />}
                    </div>

                    {event.official_url && (
                      <Button asChild size="sm" variant="outline">
                        <a href={event.official_url} target="_blank" rel="noreferrer">
                          <ExternalLink className="size-4" /> Link oficial
                        </a>
                      </Button>
                    )}

                    <section className="space-y-3 rounded-xl border border-border p-4">
                      <p className="text-sm font-medium">Cobertura</p>

                      {event.accreditation_required ? (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground">
                            Este evento exige credenciamento. A cobertura entra na Minha Agenda
                            quando o credenciamento for aprovado.
                          </p>
                          <Select
                            value={coverage?.credential_status ?? "not_requested"}
                            onValueChange={(v) =>
                              upsert.mutate(
                                { eventId: event.id, status: v as never },
                                {
                                  onSuccess: () => toast.success("Credenciamento atualizado."),
                                  onError: () => toast.error("Não foi possível atualizar."),
                                },
                              )
                            }
                          >
                            <SelectTrigger className="w-full sm:w-[220px]">
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
                        </div>
                      ) : coverage ? (
                        <p className="text-xs text-muted-foreground">
                          {coverage.completed_at
                            ? "Cobertura concluída."
                            : "Este evento está na sua agenda."}
                        </p>
                      ) : (
                        <Button
                          size="sm"
                          disabled={upsert.isPending}
                          onClick={() =>
                            upsert.mutate(
                              { eventId: event.id, status: "approved" },
                              {
                                onSuccess: () => toast.success("Evento adicionado à Minha Agenda."),
                                onError: () => toast.error("Não foi possível adicionar."),
                              },
                            )
                          }
                        >
                          <CalendarCheck className="size-4" /> Adicionar à Minha Agenda
                        </Button>
                      )}

                      {coverage && (
                        <div className="flex flex-wrap gap-2">
                          {coverage.completed_at ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => reopen.mutate(coverage.id)}
                            >
                              Reabrir cobertura
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                complete.mutate(coverage.id, {
                                  onSuccess: () => toast.success("Cobertura concluída."),
                                })
                              }
                            >
                              Marcar cobertura como concluída
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removeCoverage.mutate(coverage.id)}
                          >
                            Remover da agenda
                          </Button>
                        </div>
                      )}
                    </section>

                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                        <Pencil className="size-4" /> Editar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirm(true)}>
                        <Trash2 className="size-4" /> Excluir
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="clientes" className="mt-5">
                    <EventCommercialPanel event={event} />
                  </TabsContent>
                </Tabs>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <EventFormDialog open={editing} onOpenChange={setEditing} event={event} />

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir evento?</AlertDialogTitle>
            <AlertDialogDescription>
              {engagements.length > 0
                ? `Este evento possui ${engagements.length} ${engagements.length === 1 ? "contato comercial vinculado" : "contatos comerciais vinculados"}${coverage ? " e uma cobertura na sua agenda" : ""}.`
                : coverage
                  ? "Este evento possui uma cobertura na sua agenda."
                  : "O evento sairá da lista de eventos."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!event) return;
                remove.mutate(event.id, {
                  onSuccess: () => {
                    toast.success("Evento excluído.");
                    setConfirm(false);
                    onOpenChange(false);
                  },
                  onError: () => toast.error("Não foi possível excluir o evento."),
                });
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
