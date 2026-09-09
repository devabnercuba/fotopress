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

import { compStyle } from "@/lib/competitions";
import { exportMatchToIcs, getGoogleCalendarUrl, matchToSportEvent } from "@/lib/calendar-export";
import type { Coverage } from "@/lib/coverages";
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

  return (
    <Sheet open={!!match} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        {match && coverage && (
          <>
            <SheetHeader className="gap-3">
              <span className={`w-fit rounded-md px-2 py-0.5 text-xs font-medium ${style.chip}`}>
                {match.competition?.name ?? "Sem campeonato"}
              </span>
              <SheetTitle className="text-xl leading-snug">
                {match.home_team} <span className="text-muted-foreground">×</span> {match.away_team}
              </SheetTitle>
            </SheetHeader>

            <div className="px-4 pb-8">
              <Tabs defaultValue="detalhes">
                <TabsList>
                  <TabsTrigger value="detalhes">Detalhes</TabsTrigger>
                  <TabsTrigger value="clientes">Clientes</TabsTrigger>
                  <TabsTrigger value="radar">Radar</TabsTrigger>
                </TabsList>

                <TabsContent value="detalhes" className="mt-4">
                  <Row
                    label="Data"
                    value={format(parseISO(match.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  />
                  <Row label="Hora" value={match.time.slice(0, 5)} />
                  <Row label="Mandante" value={match.home_team} />
                  <Row label="Visitante" value={match.away_team} />
                  <Row label="Estádio" value={match.venue || "A definir"} />
                  <Row
                    label="Cidade"
                    value={[match.city, match.state].filter(Boolean).join(" · ") || "A definir"}
                  />

                  <div className="mt-5 pt-3 border-t border-border flex flex-wrap gap-2">
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
                          onClick={() => exportMatchToIcs(match)}
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

                <TabsContent value="radar" className="mt-5">
                  <RadarPanel coverage={coverage} radar={radar} />
                </TabsContent>
              </Tabs>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
