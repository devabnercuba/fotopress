import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Merge, Pencil, Plus, Search, Shield, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/empty-state";
import { TeamCrest } from "@/components/team-crest";
import { TeamDeleteDialog } from "@/components/team-delete-dialog";
import { TeamEditDialog } from "@/components/team-edit-dialog";
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
import { Input } from "@/components/ui/input";
import {
  duplicateGroups,
  stripAccents,
  teamLabel,
  useTeamMutations,
  useTeams,
  type Team,
} from "@/lib/teams";

export const Route = createFileRoute("/_authenticated/clubes")({
  head: () => ({
    meta: [
      { title: "Clubes — FotoPress" },
      {
        name: "description",
        content:
          "Revise clubes por modalidade e categoria, corrija escudos e mescle cadastros realmente duplicados.",
      },
      { property: "og:title", content: "Clubes — FotoPress" },
      {
        property: "og:description",
        content: "Identidade correta dos clubes: modalidade, categoria, gênero e escudo.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ClubesPage,
});

const normalize = (v: string) => stripAccents(v).toLowerCase().trim();

function ClubesPage() {
  const { data: teams = [], isLoading } = useTeams();
  const { merge } = useTeamMutations();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Team | null>(null);
  const [deleting, setDeleting] = useState<Team | null>(null);
  const [pending, setPending] = useState<{ keep: Team; drop: Team } | null>(null);

  const groups = useMemo(() => duplicateGroups(teams), [teams]);
  const equivalent = groups.filter((g) => g.equivalent);

  const filtered = useMemo(() => {
    const term = normalize(query);
    if (!term) return teams;
    return teams.filter((t) =>
      normalize(
        `${t.name} ${t.short_name ?? ""} ${t.abbreviation ?? ""} ${t.category ?? ""} ${t.sport_key ?? ""} ${t.gender ?? ""} ${t.city ?? ""} ${t.state ?? ""}`,
      ).includes(term),
    );
  }, [teams, query]);

  function confirmMerge() {
    if (!pending) return;
    merge.mutate(
      { keepId: pending.keep.id, dropId: pending.drop.id },
      {
        onSuccess: () => {
          toast.success("Cadastros unificados. Jogos, atletas e fontes foram preservados.");
          setPending(null);
        },
        onError: () => toast.error("Não foi possível unificar os cadastros."),
      },
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">Clubes</h1>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Cada clube é identificado por nome + modalidade + categoria + gênero. Clubes homônimos
            de categorias diferentes são registros legítimos e não devem ser unificados.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" />
          Novo clube
        </Button>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Revisão de duplicados</h2>
        {groups.length === 0 ? (
          <p className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-muted-foreground">
            Nenhum nome repetido encontrado.
          </p>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <div key={group.key} className="rounded-lg border border-border p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                  {group.equivalent ? <AlertTriangle className="size-4 text-comp-orange" /> : null}
                  {group.teams[0].name}
                  <span className="text-xs font-normal text-muted-foreground">
                    {group.equivalent
                      ? "mesma identidade — provavelmente duplicado"
                      : "modalidades/categorias diferentes — manter separados"}
                  </span>
                </div>
                <ul className="space-y-1.5">
                  {group.teams.map((team) => (
                    <li key={team.id} className="flex items-center gap-2 text-sm">
                      <TeamCrest name={team.name} teamId={team.id} size="sm" />
                      <span className="min-w-0 flex-1 truncate">{teamLabel(team)}</span>
                      {group.equivalent && team.id !== group.teams[0].id && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setPending({ keep: group.teams[0], drop: team })}
                        >
                          <Merge className="size-3.5" />
                          Unificar no primeiro
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        {equivalent.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {equivalent.length} grupo(s) com identidade idêntica aguardando revisão.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Search className="size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, sigla, categoria ou modalidade…"
            className="max-w-sm"
          />
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={Shield}
            title="Nenhum clube encontrado"
            description="Os clubes são criados pelas importações de jogos e atletas — ou manualmente em “Novo clube”."
          />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {filtered.map((team) => (
              <li
                key={team.id}
                className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5"
              >
                <TeamCrest name={team.name} teamId={team.id} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{team.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {[team.sport_key, team.category, team.gender, team.state]
                      .filter(Boolean)
                      .join(" · ") || "Sem contexto informado"}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Editar clube"
                  onClick={() => setEditing(team)}
                >
                  <Pencil className="size-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label="Excluir clube"
                  onClick={() => setDeleting(team)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <TeamEditDialog
        mode="create"
        team={null}
        open={creating}
        onOpenChange={(open) => setCreating(open)}
      />
      <TeamDeleteDialog team={deleting} onOpenChange={(open) => !open && setDeleting(null)} />

      <TeamEditDialog team={editing} onOpenChange={(open) => !open && setEditing(null)} />

      <AlertDialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unificar cadastros?</AlertDialogTitle>
            <AlertDialogDescription>
              {pending && (
                <>
                  Jogos, atletas e fontes de <strong>{teamLabel(pending.drop)}</strong> passam para{" "}
                  <strong>{teamLabel(pending.keep)}</strong>. O escudo já enviado manualmente é
                  preservado. Esta ação não pode ser desfeita.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmMerge} disabled={merge.isPending}>
              Unificar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
