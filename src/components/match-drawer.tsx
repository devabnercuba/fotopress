import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { compStyle } from "@/lib/competitions";
import {
  CREDENTIAL_LABEL,
  coverageByMatch,
  useCoverageMutations,
  useCoverages,
} from "@/lib/coverages";
import type { Match } from "@/lib/queries";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-border py-2.5 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

export function MatchDrawer({
  match,
  onOpenChange,
}: {
  match: Match | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: coverages = [] } = useCoverages();
  const { request } = useCoverageMutations();

  const coverage = match ? coverageByMatch(coverages)[match.id] : undefined;
  const pending =
    coverage && coverage.credential_status !== "denied" ? coverage.credential_status : null;
  const style = compStyle(match?.competition?.color);

  return (
    <Sheet open={!!match} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 sm:max-w-sm">
        {match && (
          <>
            <SheetHeader className="gap-3">
              <span className={`w-fit rounded-md px-2 py-0.5 text-xs font-medium ${style.chip}`}>
                {match.competition?.name ?? "Sem campeonato"}
              </span>
              <SheetTitle className="text-xl leading-snug">
                {match.home_team} <span className="text-muted-foreground">×</span> {match.away_team}
              </SheetTitle>
            </SheetHeader>

            <div className="flex flex-1 flex-col px-4">
              <div className="mt-2">
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
                <Row label="Origem" value={match.source} />
              </div>

              <div className="mt-auto py-5">
                {pending ? (
                  <Button variant="secondary" size="lg" className="w-full" disabled>
                    <Check className="size-4" /> Credenciamento: {CREDENTIAL_LABEL[pending]}
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    className="w-full"
                    disabled={request.isPending}
                    onClick={() =>
                      request.mutate(match.id, {
                        onSuccess: () => {
                          toast.success("Credenciamento solicitado.");
                          onOpenChange(false);
                        },
                        onError: () => toast.error("Não foi possível solicitar o credenciamento."),
                      })
                    }
                  >
                    Solicitar Credenciamento
                  </Button>
                )}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
