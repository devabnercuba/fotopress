import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MatchClientsPanel } from "@/components/match-clients-panel";
import { RadarPanel } from "@/components/radar-panel";

import { compStyle } from "@/lib/competitions";
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
