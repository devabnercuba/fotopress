import { createFileRoute } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Pencil, Plus, Trash2, Trophy } from "lucide-react";
import { useState } from "react";

import { CompetitionDeleteDialog } from "@/components/competition-delete-dialog";
import { EmptyState } from "@/components/empty-state";
import { CompetitionFormDialog } from "@/components/competition-form-dialog";
import { CredentialActions } from "@/components/credential-actions";
import { MatchDetailDialog } from "@/components/match-detail-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { compStyle } from "@/lib/competitions";
import {
  coverageByMatch,
  CREDENTIAL_DOT,
  CREDENTIAL_LABEL,
  useCoverages,
  type CredentialStatus,
} from "@/lib/coverages";
import { useCompetitions, useMatches, type Competition, type Match } from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/campeonatos")({
  head: () => ({
    meta: [
      { title: "Campeonatos — Cobertura esportiva" },
      {
        name: "description",
        content: "Competições cadastradas, temporada e quantidade de jogos importados.",
      },
      { property: "og:title", content: "Campeonatos — Cobertura esportiva" },
      {
        property: "og:description",
        content: "Todas as competições disponíveis para cobertura.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CompetitionsPage,
});

const STATUSES: CredentialStatus[] = ["not_requested", "requested", "approved", "denied"];

function CompetitionDetail({
  competition,
  matches,
  statusOf,
  onSelectMatch,
}: {
  competition: Competition;
  matches: Match[];
  statusOf: (matchId: string) => CredentialStatus;
  onSelectMatch: (match: Match) => void;
}) {
  const style = compStyle(competition.color);
  const todayKey = format(new Date(), "yyyy-MM-dd");
  const upcoming = matches.filter((m) => m.date >= todayKey);

  const counts = STATUSES.map((s) => ({
    status: s,
    total: matches.filter((m) => statusOf(m.id) === s).length,
  }));

  const byMonth = new Map<string, number>();
  for (const m of matches) {
    const key = m.date.slice(0, 7);
    byMonth.set(key, (byMonth.get(key) ?? 0) + 1);
  }
  const months = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b));
  const maxMonth = Math.max(1, ...months.map(([, n]) => n));

  const byState = new Map<string, number>();
  for (const m of matches) {
    const key = m.state || "—";
    byState.set(key, (byState.get(key) ?? 0) + 1);
  }
  const states = [...byState.entries()].sort(([, a], [, b]) => b - a).slice(0, 6);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg border border-border p-3">
          <div className="text-xl font-semibold">{matches.length}</div>
          <div className="text-[11px] text-muted-foreground">Jogos</div>
        </div>
        <div className="rounded-lg border border-border p-3">
          <div className="text-xl font-semibold">{upcoming.length}</div>
          <div className="text-[11px] text-muted-foreground">A realizar</div>
        </div>
        <div className="rounded-lg border border-border p-3">
          <div className="text-xl font-semibold">{competition.season}</div>
          <div className="text-[11px] text-muted-foreground">Temporada</div>
        </div>
      </div>

      <div>
        <div className="mb-2 text-xs font-medium text-muted-foreground">Credenciamentos</div>
        <ul className="space-y-1.5">
          {counts.map(({ status, total }) => (
            <li key={status} className="flex items-center gap-2 text-sm">
              <span className={`size-2 rounded-full ${CREDENTIAL_DOT[status]}`} />
              <span className="flex-1">{CREDENTIAL_LABEL[status]}</span>
              <span className="font-medium">{total}</span>
            </li>
          ))}
        </ul>
      </div>

      {months.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-medium text-muted-foreground">Jogos por mês</div>
          <div className="space-y-1.5">
            {months.map(([key, n]) => (
              <div key={key} className="flex items-center gap-2 text-xs">
                <span className="w-16 shrink-0 capitalize text-muted-foreground">
                  {format(parseISO(`${key}-01`), "MMM/yy", { locale: ptBR })}
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface">
                  <span
                    className={`block h-full rounded-full ${style.dot}`}
                    style={{ width: `${(n / maxMonth) * 100}%` }}
                  />
                </span>
                <span className="w-6 text-right font-medium">{n}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {states.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-medium text-muted-foreground">Estados</div>
          <div className="flex flex-wrap gap-1.5">
            {states.map(([uf, n]) => (
              <span key={uf} className="rounded-md bg-surface px-2 py-1 text-xs">
                {uf} · {n}
              </span>
            ))}
          </div>
        </div>
      )}

      {upcoming.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-medium text-muted-foreground">Próximos jogos</div>
          <ul className="divide-y divide-border rounded-lg border border-border">
            {upcoming.slice(0, 10).map((m) => (
              <li key={m.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left hover:underline"
                  onClick={() => onSelectMatch(m)}
                >
                  <span className="block truncate font-medium">
                    {m.home_team} × {m.away_team}
                  </span>
                  <span className="text-muted-foreground">
                    {format(parseISO(m.date), "dd/MM", { locale: ptBR })} · {m.time.slice(0, 5)}
                  </span>
                </button>
                <CredentialActions matchId={m.id} status={statusOf(m.id)} size="icon" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CompetitionsPage() {
  const { data: competitions = [] } = useCompetitions();
  const { data: matches = [] } = useMatches();
  const { data: coverages = [] } = useCoverages();
  const [selected, setSelected] = useState<Competition | null>(null);
  const [match, setMatch] = useState<Match | null>(null);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Competition | null>(null);
  const [deleting, setDeleting] = useState<Competition | null>(null);

  const byMatch = coverageByMatch(coverages);
  const statusOf = (matchId: string): CredentialStatus =>
    byMatch[matchId]?.credential_status ?? "not_requested";

  const matchesOf = (id: string) => matches.filter((m) => m.competition_id === id);
  const visible = competitions.filter((c) =>
    c.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campeonatos</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Competições cadastradas, com estatísticas de jogos e credenciamentos.
          </p>
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          <Plus className="size-4" /> Novo Campeonato
        </Button>
      </header>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar campeonato…"
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring sm:max-w-xs"
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((c) => {
          const style = compStyle(c.color);
          const list = matchesOf(c.id);
          const approved = list.filter((m) => statusOf(m.id) === "approved").length;
          return (
            <button
              key={c.id}
              onClick={() => setSelected(c)}
              className="rounded-xl border border-border bg-card p-5 text-left transition-colors hover:bg-accent"
            >
              <span className={`size-2 rounded-full ${style.dot} inline-block`} />
              <div className="mt-3 text-sm font-medium">{c.name}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                {c.category} · {list.length} jogos · {approved} aprovados
              </div>
            </button>
          );
        })}
        {visible.length === 0 && (
          <div className="sm:col-span-2 lg:col-span-3">
            <EmptyState
              icon={Trophy}
              title="Nenhum campeonato cadastrado"
              description="Crie seu primeiro campeonato para começar a organizar seus jogos."
              learnLabel="Saiba como funciona"
            />
          </div>
        )}
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 pr-8">
                  <span className="min-w-0 truncate">{selected.name}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto"
                    onClick={() => setEditing(selected)}
                  >
                    <Pencil className="size-4" /> Editar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    title="Excluir campeonato"
                    onClick={() => setDeleting(selected)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </DialogTitle>
              </DialogHeader>
              <CompetitionDetail
                competition={selected}
                matches={matchesOf(selected.id)}
                statusOf={statusOf}
                onSelectMatch={setMatch}
              />
            </>
          )}
        </DialogContent>
      </Dialog>

      <CompetitionFormDialog open={creating} onOpenChange={setCreating} />
      <CompetitionFormDialog
        open={!!editing}
        onOpenChange={(open) => !open && setEditing(null)}
        competition={editing}
      />

      <CompetitionDeleteDialog
        competition={deleting}
        competitions={competitions}
        onOpenChange={(open) => !open && setDeleting(null)}
        onDeleted={() => setSelected(null)}
      />

      <MatchDetailDialog match={match} onOpenChange={(open) => !open && setMatch(null)} />
    </div>
  );
}
