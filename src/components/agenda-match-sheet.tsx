import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarPlus, Download, ExternalLink } from "lucide-react";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MatchClientsPanel } from "@/components/match-clients-panel";
import { RadarPanel } from "@/components/radar-panel";
import { TeamCrest } from "@/components/team-crest";

import { compStyle } from "@/lib/competitions";
import { exportMatchToIcs, getGoogleCalendarUrl, matchToSportEvent } from "@/lib/calendar-export";
import { isRadarEnabled } from "@/lib/features";
import { CoverageReminderToggle } from "@/components/coverage-reminder-toggle";
import {
  CoverageStatusBadge,
  toCoverageStatus,
  toCredentialStatus,
  type SimpleCoverageStatus,
} from "@/components/coverage-status-badge";
import { CoverageNotesEditor } from "@/components/coverage-notes-editor";
import { useCoverageMutations, type Coverage } from "@/lib/coverages";
import type { Radar } from "@/lib/radar";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-2.5 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

export function AgendaMatchSheet({
  coverage,
  radar,
  onOpenChange,
}: {
  coverage: Coverage | null;
  radar?: Radar | null;
  onOpenChange: (open: boolean) => void;
}) {
  const match = coverage?.match ?? null;
  const style = compStyle(match?.competition?.color);
  const showRadar = isRadarEnabled();
  const { setStatus, setNotes } = useCoverageMutations();

  const handleStatusChange = (newStatus: SimpleCoverageStatus) => {
    if (!coverage) return;
    setStatus.mutate({ id: coverage.id, status: toCredentialStatus(newStatus) });
  };

  const handleSaveNotes = async (newNotes: string | null) => {
    if (!coverage) return;
    await setNotes.mutateAsync({ id: coverage.id, notes: newNotes });
  };

  const currentStatus = toCoverageStatus(coverage?.credential_status);

  return (
    <Sheet open={!!match} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        {match && coverage && (
          <>
            <SheetHeader className="gap-3">
              <div className="flex items-center justify-between gap-2">
                <span className={`w-fit rounded-md px-2 py-0.5 text-xs font-medium ${style.chip}`}>
                  {match.competition?.name ?? "Sem campeonato"}
                </span>
                <CoverageStatusBadge
                  status={currentStatus}
                  onChange={handleStatusChange}
                  size="default"
                />
              </div>
              <SheetTitle className="flex items-center gap-2 text-xl leading-snug">
                <TeamCrest name={match.home_team} teamId={match.home_team_id} size="sm" />
                <span>{match.home_team}</span>
                <span className="text-muted-foreground font-normal">×</span>
                <span>{match.away_team}</span>
                <TeamCrest name={match.away_team} teamId={match.away_team_id} size="sm" />
              </SheetTitle>
            </SheetHeader>

            <div className="px-4 pb-8">
              <Tabs defaultValue="detalhes">
                <TabsList>
                  <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
                  <TabsTrigger value="clientes">Clientes</TabsTrigger>
                  {showRadar && <TabsTrigger value="radar">Radar</TabsTrigger>}
                </TabsList>

                <TabsContent value="detalhes" className="mt-4 space-y-4">
                  <div>
                    <Row
                      label="Data"
                      value={format(parseISO(match.date), "dd 'de' MMMM 'de' yyyy", {
                        locale: ptBR,
                      })}
                    />
                    <Row label="Hora" value={match.time.slice(0, 5)} />
                    <Row label="Mandante" value={match.home_team} />
                    <Row label="Visitante" value={match.away_team} />
                    <Row label="Estádio" value={match.venue || "A definir"} />
                    <Row
                      label="Cidade"
                      value={[match.city, match.state].filter(Boolean).join(" · ") || "A definir"}
                    />
                  </div>

                  <CoverageReminderToggle coverageId={coverage.id} variant="row" />

                  <CoverageNotesEditor
                    coverageId={coverage.id}
                    initialNotes={coverage.notes}
                    onSave={handleSaveNotes}
                    variant="sheet"
                  />

                  <div className="pt-2 border-t border-border flex flex-wrap gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          id="agenda-match-export-calendar-btn"
                          variant="outline"
                          size="sm"
                          className="w-full gap-2 text-xs"
                        >
                          <CalendarPlus className="size-4 text-primary" />
                          <span>Adicionar ao Calendário</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuItem
                          id="agenda-match-download-ics"
                          onClick={() => exportMatchToIcs(match, coverage.notes, currentStatus)}
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
                            href={getGoogleCalendarUrl(matchToSportEvent(match))}
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
                  </div>
                </TabsContent>

                <TabsContent value="clientes" className="mt-5">
                  <MatchClientsPanel match={match} />
                </TabsContent>

                {showRadar && (
                  <TabsContent value="radar" className="mt-5">
                    <RadarPanel coverage={coverage} radar={radar} />
                  </TabsContent>
                )}
              </Tabs>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
