import { Link } from "@tanstack/react-router";
import { Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { engagementSummary, formatBRL, useMatchEngagements } from "@/lib/engagements";
import type { MatchLike } from "@/components/match-commercial-panel";

/**
 * Resumo comercial compacto da partida.
 * O fluxo completo (Kanban) vive em Atletas/Clientes → Por jogo.
 */
export function MatchClientsPanel({ match }: { match: MatchLike }) {
  const { data: engagements = [] } = useMatchEngagements(match.id);
  const s = engagementSummary(engagements);

  return (
    <section className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <Users className="size-4 opacity-70" />
        <h3 className="text-sm font-medium">Atletas/Clientes</h3>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Metric label="Contatos" value={String(s.added)} />
        <Metric label="Abordados" value={String(s.contacted)} />
        <Metric label="Fechados" value={String(s.closed)} />
      </div>

      {s.revenue > 0 && (
        <p className="text-xs text-muted-foreground">
          Valor fechado nesta cobertura: <strong>{formatBRL(s.revenue)}</strong>
        </p>
      )}

      <Button asChild size="sm" variant="outline" className="w-full">
        <Link to="/atletas" search={{ tab: "jogo", match: match.id }}>
          Gerenciar
        </Link>
      </Button>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
