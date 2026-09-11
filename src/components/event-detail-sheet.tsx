import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Calendar,
  CalendarCheck,
  CalendarPlus,
  CheckCircle2,
  Download,
  ExternalLink,
  Pencil,
  RotateCcw,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { EventCommercialPanel } from "@/components/event-commercial-panel";
import { EventFormDialog } from "@/components/event-form-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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
import { CoverageReminderToggle } from "@/components/coverage-reminder-toggle";
import {
  CoverageStatusBadge,
  toCoverageStatus,
  toCredentialStatus,
} from "@/components/coverage-status-badge";
import { CoverageNotesEditor } from "@/components/coverage-notes-editor";
import {
  agendaSportEventToExport,
  exportAgendaSportEventToIcs,
  getGoogleCalendarUrl,
} from "@/lib/calendar-export";

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
  const {
    request,
    upsert,
    complete,
    reopen,
    remove: removeCoverage,
    setStatus,
    setNotes,
  } = useEventCoverageMutations();
  const { remove } = useEventMutations();
  const { data: engagements = [] } = useEventEngagements(event?.id);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const coverage = event ? coverageByEvent(coverages)[event.id] : undefined;
  const isApproved = coverage?.credential_status === "approved";
  const isCompleted = !!coverage?.completed_at;

  return (
    <>
      <Sheet open={!!event} onOpenChange={onOpenChange}>
        <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-2xl">
          {event && (
            <>
              <SheetHeader className="gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="w-fit rounded-md bg-surface px-2 py-0.5 text-xs font-medium">
                    {formatSportLabel(event.sport)}
                  </span>
                  {coverage && (
                    <CoverageStatusBadge
                      status={toCoverageStatus(coverage.credential_status)}
                      onChange={(newStatus) =>
                        setStatus.mutate({ id: coverage.id, status: toCredentialStatus(newStatus) })
                      }
                      size="default"
                    />
                  )}
                </div>
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
                      <Row
                        label="Esporte / Modalidade"
                        value={formatSportLabel(event.sport) ?? "—"}
                      />
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

                    <section className="space-y-3.5 rounded-xl border border-border p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold">Cobertura & Agenda</p>
                        {isApproved && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="size-3.5" /> Na Minha Agenda
                          </span>
                        )}
                        {isCompleted && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                            Cobertura concluída
                          </span>
                        )}
                      </div>

                      {event.accreditation_required ? (
                        <div className="space-y-3">
                          <p className="text-xs text-muted-foreground">
                            Este evento exige credenciamento. A cobertura entra na Minha Agenda
                            automaticamente quando o credenciamento for aprovado.
                          </p>

                          <div className="flex flex-wrap items-center gap-2">
                            {(!coverage ||
                              coverage.credential_status === "not_requested" ||
                              coverage.credential_status === "denied") && (
                              <Button
                                size="sm"
                                disabled={request.isPending}
                                onClick={() =>
                                  request.mutate(event.id, {
                                    onSuccess: () => toast.success("Credenciamento solicitado."),
                                    onError: () =>
                                      toast.error("Não foi possível solicitar credenciamento."),
                                  })
                                }
                              >
                                <Send className="size-4" /> Solicitar credenciamento
                              </Button>
                            )}

                            {coverage?.credential_status === "requested" && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-emerald-500 text-emerald-600 hover:bg-emerald-500/10"
                                disabled={upsert.isPending}
                                onClick={() =>
                                  upsert.mutate(
                                    { eventId: event.id, status: "approved" },
                                    {
                                      onSuccess: () =>
                                        toast.success(
                                          "Credenciamento aprovado e adicionado à Minha Agenda.",
                                        ),
                                      onError: () =>
                                        toast.error("Não foi possível aprovar credenciamento."),
                                    },
                                  )
                                }
                              >
                                <CheckCircle2 className="size-4" /> Aprovar credenciamento
                              </Button>
                            )}

                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">Status:</span>
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
                            </div>
                          </div>
                        </div>
                      ) : coverage ? (
                        <p className="text-xs text-muted-foreground">
                          {isCompleted
                            ? "Cobertura concluída."
                            : "Este evento está confirmado na sua agenda."}
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
                                onError: () => toast.error("Não foi possível adicionar à agenda."),
                              },
                            )
                          }
                        >
                          <CalendarCheck className="size-4" /> Adicionar à Minha Agenda
                        </Button>
                      )}

                      {/* Ações quando já está na agenda */}
                      {isApproved && coverage && (
                        <>
                          <CoverageReminderToggle
                            coverageId={coverage.id}
                            variant="row"
                            className="mt-2"
                          />

                          <CoverageNotesEditor
                            coverageId={coverage.id}
                            initialNotes={coverage.notes}
                            onSave={async (newNotes) => {
                              await setNotes.mutateAsync({ id: coverage.id, notes: newNotes });
                            }}
                            variant="sheet"
                            className="mt-3"
                          />

                          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                            <Link to="/agenda" onClick={() => onOpenChange(false)}>
                              <Button size="sm" variant="outline">
                                <Calendar className="size-4" /> Ver na Minha Agenda
                              </Button>
                            </Link>

                            {!isCompleted ? (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={complete.isPending}
                                onClick={() =>
                                  complete.mutate(coverage.id, {
                                    onSuccess: () => toast.success("Cobertura concluída."),
                                    onError: () =>
                                      toast.error("Não foi possível concluir a cobertura."),
                                  })
                                }
                              >
                                <CheckCircle2 className="size-4" /> Concluir cobertura
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={reopen.isPending}
                                onClick={() =>
                                  reopen.mutate(coverage.id, {
                                    onSuccess: () => toast.success("Cobertura reaberta."),
                                    onError: () =>
                                      toast.error("Não foi possível reabrir a cobertura."),
                                  })
                                }
                              >
                                <RotateCcw className="size-4" /> Reabrir cobertura
                              </Button>
                            )}

                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => removeCoverage.mutate(coverage.id)}
                            >
                              Remover da agenda
                            </Button>
                          </div>
                        </>
                      )}
                    </section>

                    <div className="flex flex-wrap gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            id="event-export-calendar-btn"
                            variant="outline"
                            size="sm"
                            className="gap-2 text-xs"
                          >
                            <CalendarPlus className="size-4 text-primary" />
                            <span>Exportar Calendário</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56">
                          <DropdownMenuItem
                            id="event-download-ics"
                            onClick={() =>
                              exportAgendaSportEventToIcs(
                                event,
                                coverage?.notes,
                                toCoverageStatus(coverage?.credential_status),
                              )
                            }
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
                          <DropdownMenuItem asChild className="cursor-pointer gap-2 text-xs">
                            <a
                              href={getGoogleCalendarUrl(agendaSportEventToExport(event))}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
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

              <SheetFooter className="mt-4 flex flex-row items-center justify-end border-t border-border pt-4">
                <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                  Fechar
                </Button>
              </SheetFooter>
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
