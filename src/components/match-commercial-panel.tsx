import { useMemo, useState } from "react";
import { Plus, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { AthleteContactActions } from "@/components/athlete-contact-actions";
import { SearchableTeamSelect } from "@/components/searchable-team-select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useIsMobile } from "@/hooks/use-mobile";
import { CategorySelect } from "@/components/category-select";
import {
  RELATIONSHIPS,
  RELATIONSHIP_LABEL,
  formatCategoryLabel,
  sameCategory,
  useAthleteMutations,
  useAthletes,
  type Athlete,
} from "@/lib/athletes";
import { useMatchMutations } from "@/lib/matches";
import {
  STAGES,
  engagementStage,
  engagementSummary,
  formatBRL,
  stagePatch,
  useEngagementMutations,
  useMatchEngagements,
  type Engagement,
  type EngagementPatch,
  type Stage,
} from "@/lib/engagements";

export type MatchLike = {
  id: string;
  home_team: string;
  away_team: string;
  home_team_id: string | null;
  away_team_id: string | null;
  category?: string | null;
};

/** Atletas dos clubes da partida — vínculo por `team_id` sempre que possível. */
export function athletesOfMatchTeams(athletes: Athlete[], match: MatchLike) {
  const ids = new Set([match.home_team_id, match.away_team_id].filter(Boolean) as string[]);
  const names = new Set([match.home_team, match.away_team].map((n) => n.trim().toLowerCase()));
  return athletes.filter((a) => {
    if (a.team_id && ids.has(a.team_id)) return true;
    return !!a.team?.name && names.has(a.team.name.trim().toLowerCase());
  });
}

/**
 * Clube + categoria caminham juntos: com categoria definida na partida só entram
 * atletas da mesma categoria; os sem categoria ficam em uma lista secundária.
 */
export function relatedAthletes(athletes: Athlete[], match: MatchLike) {
  const ofTeams = athletesOfMatchTeams(athletes, match);
  if (!match.category) return { matched: ofTeams, uncategorized: [] as Athlete[] };
  return {
    matched: ofTeams.filter((a) => sameCategory(a.category, match.category)),
    uncategorized: ofTeams.filter((a) => !a.category),
  };
}

type Filter = "all" | "added" | "clients" | "prospects";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Todos relacionados" },
  { value: "added", label: "Somente adicionados" },
  { value: "clients", label: "Clientes" },
  { value: "prospects", label: "Prospects" },
];

/** Painel comercial da partida: métricas, Kanban (desktop) e lista por status (mobile). */
export function MatchCommercialPanel({ match }: { match: MatchLike }) {
  const isMobile = useIsMobile();
  const { data: athletes = [] } = useAthletes();
  const { data: engagements = [] } = useMatchEngagements(match.id);
  const { save, remove } = useEngagementMutations();
  const { save: saveAthlete } = useAthleteMutations();
  const { setCategory: setMatchCategory } = useMatchMutations();

  const [filter, setFilter] = useState<Filter>("all");
  const [adding, setAdding] = useState(false);

  const byAthlete = useMemo(
    () =>
      Object.fromEntries(engagements.map((e) => [e.athlete_id, e])) as Record<string, Engagement>,
    [engagements],
  );
  const athleteById = useMemo(
    () => Object.fromEntries(athletes.map((a) => [a.id, a])) as Record<string, Athlete>,
    [athletes],
  );

  const { matched: related, uncategorized } = useMemo(
    () => relatedAthletes(athletes, match),
    [athletes, match],
  );
  const summary = engagementSummary(engagements);

  const visible = useMemo(() => {
    const ids = new Set(related.map((a) => a.id));
    for (const e of engagements) ids.add(e.athlete_id);
    const list = [...ids].map((id) => athleteById[id]).filter(Boolean);
    return list.filter((a) => {
      if (filter === "added") return !!byAthlete[a.id];
      if (filter === "clients") return a.relationship === "client";
      if (filter === "prospects") return a.relationship === "prospect";
      return true;
    });
  }, [related, engagements, athleteById, byAthlete, filter]);

  const suggestions = visible.filter((a) => !byAthlete[a.id]);
  const uncategorizedSuggestions = uncategorized.filter((a) => !byAthlete[a.id]);

  /** Classifica um atleta sem categoria com a categoria da partida. */
  const setAthleteCategory = (a: Athlete, category: string) =>
    saveAthlete.mutate(
      {
        id: a.id,
        name: a.name,
        team_id: a.team_id,
        position: a.position,
        number: a.number,
        instagram: a.instagram,
        notes: a.notes,
        phone: a.phone,
        whatsapp: a.whatsapp,
        email: a.email,
        relationship: a.relationship,
        status: a.status,
        category,
      },
      {
        onSuccess: () => toast.success(`Categoria definida: ${formatCategoryLabel(category)}.`),
        onError: () => toast.error("Não foi possível atualizar a categoria."),
      },
    );

  const update = (athleteId: string, patch: EngagementPatch) =>
    save.mutate(
      { athleteId, matchId: match.id, patch },
      { onError: () => toast.error("Não foi possível salvar.") },
    );

  const setStage = (athlete: Athlete, stage: Stage) => {
    update(athlete.id, stagePatch(stage));
    if (stage === "closed" && athlete.relationship === "prospect") {
      toast("Transformar este prospect em Cliente?", {
        description: athlete.name,
        action: {
          label: "Sim",
          onClick: () =>
            promoteToClient(athlete.id).then(
              () => toast.success("Contato atualizado para Cliente."),
              () => toast.error("Não foi possível atualizar."),
            ),
        },
        cancel: { label: "Agora não", onClick: () => undefined },
      });
    }
  };

  const promoteToClient = (athleteId: string) => {
    const a = athleteById[athleteId];
    return saveAthlete.mutateAsync({
      id: a.id,
      name: a.name,
      team_id: a.team_id,
      position: a.position,
      number: a.number,
      instagram: a.instagram,
      notes: a.notes,
      phone: a.phone,
      whatsapp: a.whatsapp,
      email: a.email,
      relationship: "client",
      status: a.status,
      category: a.category,
    });
  };

  const columns = STAGES.map((stage) => ({
    ...stage,
    items: engagements
      .filter((e) => engagementStage(e) === stage.value)
      .map((e) => ({ engagement: e, athlete: athleteById[e.athlete_id] }))
      .filter((row) => !!row.athlete),
  }));

  return (
    <section className="space-y-4">
      <SummaryBar title={`${match.home_team} × ${match.away_team}`} summary={summary} />

      <div className="flex flex-wrap items-center gap-2">
        <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <SelectTrigger className="h-9 w-[200px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>
                {f.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
          <UserPlus className="size-4" /> Adicionar atleta/cliente
        </Button>
      </div>

      {!match.category && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border p-3">
          <p className="text-xs text-muted-foreground">
            Esta partida não possui categoria definida. Os atletas dos clubes aparecem sem filtro de
            categoria.
          </p>
          <div className="ml-auto w-[190px]">
            <CategorySelect
              value={null}
              noneLabel="Definir categoria"
              onChange={(category) =>
                category &&
                setMatchCategory.mutate(
                  { id: match.id, category },
                  {
                    onSuccess: () => toast.success("Categoria da partida definida."),
                    onError: () => toast.error("Não foi possível definir a categoria."),
                  },
                )
              }
            />
          </div>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="rounded-xl border border-dashed border-border p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Sugestões dos clubes desta partida
            {match.category ? ` · ${formatCategoryLabel(match.category)}` : ""} (
            {suggestions.length})
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((a) => (
              <Button
                key={a.id}
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => update(a.id, stagePatch("not_contacted"))}
              >
                <Plus className="size-3.5" /> {a.name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {match.category && uncategorizedSuggestions.length > 0 && (
        <div className="rounded-xl border border-dashed border-border p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Atletas sem categoria ({uncategorizedSuggestions.length})
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {uncategorizedSuggestions.map((a) => (
              <div key={a.id} className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => update(a.id, stagePatch("not_contacted"))}
                >
                  <Plus className="size-3.5" /> {a.name}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setAthleteCategory(a, match.category!)}
                >
                  Definir como {formatCategoryLabel(match.category)}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {engagements.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
          Nenhum contato no fluxo comercial desta partida ainda. Adicione um contato existente ou
          crie um novo.
        </p>
      ) : isMobile ? (
        <MobileBoard
          columns={columns}
          onStage={setStage}
          onRemove={(id) => remove.mutate(id)}
          onPatch={update}
        />
      ) : (
        <KanbanBoard
          columns={columns}
          onStage={setStage}
          onRemove={(id) => remove.mutate(id)}
          onPatch={update}
        />
      )}

      <AddContactDialog
        open={adding}
        onOpenChange={setAdding}
        match={match}
        existing={athletes}
        alreadyAdded={byAthlete}
        onAdd={(athleteId) => {
          update(athleteId, stagePatch("not_contacted"));
          setAdding(false);
        }}
      />
    </section>
  );
}

function SummaryBar({
  title,
  summary,
}: {
  title: string;
  summary: ReturnType<typeof engagementSummary>;
}) {
  const cells = [
    { label: "Contatos", value: String(summary.added) },
    { label: "Contatados", value: String(summary.contacted) },
    { label: "Responderam", value: String(summary.responded) },
    { label: "Fechados", value: String(summary.closed) },
    { label: "Valor fechado", value: formatBRL(summary.revenue) },
  ];
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-medium">{title}</p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
        {cells.map((c) => (
          <div key={c.label}>
            <p className="text-lg font-semibold tabular-nums">{c.value}</p>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

type Column = (typeof STAGES)[number] & {
  items: { engagement: Engagement; athlete: Athlete }[];
};

type BoardProps = {
  columns: Column[];
  onStage: (athlete: Athlete, stage: Stage) => void;
  onRemove: (id: string) => void;
  onPatch: (athleteId: string, patch: EngagementPatch) => void;
};

function KanbanBoard({ columns, onStage, onRemove, onPatch }: BoardProps) {
  const [dragging, setDragging] = useState<string | null>(null);

  return (
    <div className="grid gap-3 lg:grid-cols-5">
      {columns.map((col) => (
        <div
          key={col.value}
          className="min-h-32 rounded-xl border border-border bg-surface/50 p-2"
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => {
            const row = columns.flatMap((c) => c.items).find((i) => i.engagement.id === dragging);
            if (row) onStage(row.athlete, col.value);
            setDragging(null);
          }}
        >
          <div className="flex items-center gap-2 px-1 pb-2">
            <span className={`size-2 rounded-full ${col.dot}`} />
            <span className="text-xs font-medium">{col.label}</span>
            <span className="ml-auto text-xs text-muted-foreground">{col.items.length}</span>
          </div>
          <div className="space-y-2">
            {col.items.map((row) => (
              <div
                key={row.engagement.id}
                draggable
                onDragStart={() => setDragging(row.engagement.id)}
              >
                <EngagementCard row={row} onStage={onStage} onRemove={onRemove} onPatch={onPatch} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MobileBoard({ columns, onStage, onRemove, onPatch }: BoardProps) {
  const [open, setOpen] = useState<Stage | null>(null);
  return (
    <div className="space-y-2">
      {columns.map((col) => (
        <div key={col.value} className="rounded-xl border border-border bg-card">
          <button
            type="button"
            className="flex w-full items-center gap-2 p-3 text-left"
            onClick={() => setOpen(open === col.value ? null : col.value)}
          >
            <span className={`size-2 rounded-full ${col.dot}`} />
            <span className="text-sm">{col.label}</span>
            <span className="ml-auto text-sm font-semibold tabular-nums">{col.items.length}</span>
          </button>
          {open === col.value && col.items.length > 0 && (
            <div className="space-y-2 border-t border-border p-2">
              {col.items.map((row) => (
                <EngagementCard
                  key={row.engagement.id}
                  row={row}
                  onStage={onStage}
                  onRemove={onRemove}
                  onPatch={onPatch}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function EngagementCard({
  row,
  onStage,
  onRemove,
  onPatch,
}: {
  row: { engagement: Engagement; athlete: Athlete };
  onStage: (athlete: Athlete, stage: Stage) => void;
  onRemove: (id: string) => void;
  onPatch: (athleteId: string, patch: EngagementPatch) => void;
}) {
  const { engagement: e, athlete } = row;
  const [notes, setNotes] = useState(e.notes ?? "");
  const [nextAction, setNextAction] = useState(e.next_action ?? "");
  const stage = engagementStage(e);

  return (
    <article className="space-y-2 rounded-lg border border-border bg-card p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{athlete.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {[
            athlete.team?.name,
            formatCategoryLabel(athlete.category),
            RELATIONSHIP_LABEL[athlete.relationship],
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>

      <div className="flex flex-wrap gap-1">
        {e.package_status === "declined" && (
          <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-muted-foreground">
            Não fechou
          </span>
        )}
        {e.no_response && (
          <span className="rounded bg-surface px-1.5 py-0.5 text-[10px] text-muted-foreground">
            Não respondeu
          </span>
        )}
        {e.package_status === "closed" && e.package_value != null && (
          <span className="rounded bg-comp-green/10 px-1.5 py-0.5 text-[10px] font-medium text-comp-green">
            {formatBRL(e.package_value)}
          </span>
        )}
      </div>

      <AthleteContactActions athlete={athlete} size="icon" />

      {(stage === "offered" || stage === "closed") && (
        <Input
          className="h-8 text-xs"
          inputMode="decimal"
          placeholder="Valor do pacote (R$)"
          defaultValue={e.package_value ?? ""}
          onBlur={(ev) => {
            const raw = ev.target.value.replace(",", ".").trim();
            const value = raw ? Number(raw) : null;
            if (value !== null && Number.isNaN(value)) return;
            if (value === (e.package_value ?? null)) return;
            onPatch(athlete.id, { package_value: value });
          }}
        />
      )}

      <Input
        className="h-8 text-xs"
        placeholder="Nota desta partida"
        value={notes}
        onChange={(ev) => setNotes(ev.target.value)}
        onBlur={() => {
          if (notes.trim() === (e.notes ?? "")) return;
          onPatch(athlete.id, { notes: notes.trim() || null });
        }}
      />

      <Input
        className="h-8 text-xs"
        placeholder="Próxima ação"
        value={nextAction}
        onChange={(ev) => setNextAction(ev.target.value)}
        onBlur={() => {
          if (nextAction.trim() === (e.next_action ?? "")) return;
          onPatch(athlete.id, { next_action: nextAction.trim() || null });
        }}
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 w-full text-xs">
            Alterar status
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuLabel>Funil</DropdownMenuLabel>
          {STAGES.map((s) => (
            <DropdownMenuItem key={s.value} onSelect={() => onStage(athlete, s.value)}>
              {s.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Resultado</DropdownMenuLabel>
          <DropdownMenuItem onSelect={() => onPatch(athlete.id, { no_response: !e.no_response })}>
            {e.no_response ? "Remover “não respondeu”" : "Marcar “não respondeu”"}
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              onPatch(athlete.id, {
                package_status: e.package_status === "declined" ? "offered" : "declined",
              })
            }
          >
            {e.package_status === "declined" ? "Reabrir proposta" : "Marcar “não fechou”"}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onRemove(e.id)}>
            <Trash2 className="size-4" /> Remover deste jogo
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </article>
  );
}

function AddContactDialog({
  open,
  onOpenChange,
  match,
  existing,
  alreadyAdded,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  match: MatchLike;
  existing: Athlete[];
  alreadyAdded: Record<string, Engagement>;
  onAdd: (athleteId: string) => void;
}) {
  const { save } = useAthleteMutations();
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: "",
    team_id: match.home_team_id,
    instagram: "",
    whatsapp: "",
    email: "",
    relationship: "prospect",
    category: match.category ?? null,
  });

  const term = search.trim().toLowerCase();
  const results = term
    ? existing.filter((a) => a.name.toLowerCase().includes(term)).slice(0, 8)
    : [];

  function create() {
    const name = form.name.trim();
    if (name.length < 2) {
      toast.error("Informe o nome do contato.");
      return;
    }
    save.mutate(
      {
        name,
        team_id: form.team_id,
        position: null,
        number: null,
        instagram: form.instagram.trim().replace(/^@/, "") || null,
        notes: null,
        phone: null,
        whatsapp: form.whatsapp.trim() || null,
        email: form.email.trim() || null,
        relationship: form.relationship,
        status: "active",
        category: form.category,
      },
      {
        onSuccess: () => {
          toast.success("Contato criado. Busque pelo nome para adicioná-lo ao jogo.");
          setSearch(name);
          setForm((f) => ({ ...f, name: "", instagram: "", whatsapp: "", email: "" }));
        },
        onError: () => toast.error("Não foi possível criar o contato."),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar atleta/cliente</DialogTitle>
          <DialogDescription>
            {match.home_team} × {match.away_team} — busque um contato já cadastrado antes de criar
            um novo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="engagement-search">Buscar contato existente</Label>
            <Input
              id="engagement-search"
              placeholder="Nome do contato"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="space-y-1">
              {results.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5"
                >
                  <span className="min-w-0 truncate text-sm">
                    {a.name}
                    <span className="ml-1 text-xs text-muted-foreground">
                      {[a.team?.name, formatCategoryLabel(a.category)].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={!!alreadyAdded[a.id]}
                    onClick={() => onAdd(a.id)}
                  >
                    {alreadyAdded[a.id] ? "Já no jogo" : "Adicionar a este jogo"}
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-dashed border-border p-3">
            <p className="text-xs font-medium text-muted-foreground">Criar novo contato</p>
            <Input
              placeholder="Nome"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <SearchableTeamSelect
              value={form.team_id}
              onChange={(team_id) => setForm((f) => ({ ...f, team_id }))}
            />
            <div className="flex flex-wrap gap-1">
              {[
                { id: match.home_team_id, name: match.home_team },
                { id: match.away_team_id, name: match.away_team },
              ]
                .filter((t) => t.id)
                .map((t) => (
                  <Button
                    key={t.id}
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => setForm((f) => ({ ...f, team_id: t.id }))}
                  >
                    {t.name}
                  </Button>
                ))}
            </div>
            <CategorySelect
              value={form.category}
              onChange={(category) => setForm((f) => ({ ...f, category }))}
            />
            <Input
              placeholder="@instagram"
              value={form.instagram}
              onChange={(e) => setForm((f) => ({ ...f, instagram: e.target.value }))}
            />
            <Input
              placeholder="WhatsApp"
              value={form.whatsapp}
              onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))}
            />
            <Input
              placeholder="E-mail"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <Select
              value={form.relationship}
              onValueChange={(v) => setForm((f) => ({ ...f, relationship: v }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIPS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={create} disabled={save.isPending}>
              {save.isPending ? "Salvando…" : "Criar contato"}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
