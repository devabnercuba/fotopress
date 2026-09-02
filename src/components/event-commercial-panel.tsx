import { useMemo, useState } from "react";
import { Plus, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { AthleteContactActions } from "@/components/athlete-contact-actions";
import { CategorySelect } from "@/components/category-select";
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
import {
  RELATIONSHIPS,
  RELATIONSHIP_LABEL,
  formatCategoryLabel,
  useAthleteMutations,
  useAthletes,
  type Athlete,
} from "@/lib/athletes";
import { STAGES, formatBRL, stagePatch, type Stage } from "@/lib/engagements";
import {
  useEventEngagementMutations,
  useEventEngagements,
  type EventEngagement,
  type EventEngagementPatch,
} from "@/lib/event-engagements";
import { sameSport } from "@/lib/sports";
import type { SportEvent } from "@/lib/events";

/** Mesmo funil das partidas, derivado de contact_status + package_status. */
function stageOf(e: EventEngagement): Stage {
  if (e.package_status === "closed") return "closed";
  if (e.package_status === "offered" || e.package_status === "declined") return "offered";
  if (e.contact_status === "responded") return "responded";
  if (e.contact_status === "contacted") return "contacted";
  return "not_contacted";
}

export function eventEngagementSummary(list: EventEngagement[]) {
  return {
    added: list.length,
    contacted: list.filter((e) => e.contact_status !== "not_contacted").length,
    responded: list.filter((e) => e.contact_status === "responded").length,
    offered: list.filter((e) => e.package_status === "offered").length,
    closed: list.filter((e) => e.package_status === "closed").length,
    revenue: list
      .filter((e) => e.package_status === "closed")
      .reduce((sum, e) => sum + (e.package_value ?? 0), 0),
  };
}

type Filter = "all" | "added" | "clients" | "prospects";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Todos sugeridos" },
  { value: "added", label: "Somente adicionados" },
  { value: "clients", label: "Clientes" },
  { value: "prospects", label: "Prospects" },
];

/** Painel comercial do evento: métricas, Kanban (desktop) e lista (mobile). */
export function EventCommercialPanel({ event }: { event: SportEvent }) {
  const isMobile = useIsMobile();
  const { data: athletes = [] } = useAthletes();
  const { data: engagements = [] } = useEventEngagements(event.id);
  const { save, remove } = useEventEngagementMutations(event.id);

  const [filter, setFilter] = useState<Filter>("all");
  const [adding, setAdding] = useState(false);

  const byAthlete = useMemo(
    () =>
      Object.fromEntries(engagements.map((e) => [e.athlete_id, e])) as Record<
        string,
        EventEngagement
      >,
    [engagements],
  );
  const athleteById = useMemo(
    () => Object.fromEntries(athletes.map((a) => [a.id, a])) as Record<string, Athlete>,
    [athletes],
  );

  /** Sugestões: contatos com a mesma modalidade do evento. */
  const related = useMemo(
    () => athletes.filter((a) => sameSport(a.sport, event.sport)),
    [athletes, event.sport],
  );

  const summary = eventEngagementSummary(engagements);

  const visible = useMemo(() => {
    const ids = new Set(related.map((a) => a.id));
    for (const e of engagements) ids.add(e.athlete_id);
    return [...ids]
      .map((id) => athleteById[id])
      .filter(Boolean)
      .filter((a) => {
        if (filter === "added") return !!byAthlete[a.id];
        if (filter === "clients") return a.relationship === "client";
        if (filter === "prospects") return a.relationship === "prospect";
        return true;
      });
  }, [related, engagements, athleteById, byAthlete, filter]);

  const suggestions = visible.filter((a) => !byAthlete[a.id]);

  const update = (athleteId: string, patch: EventEngagementPatch) =>
    save.mutate({ athleteId, patch }, { onError: () => toast.error("Não foi possível salvar.") });

  const setStage = (athlete: Athlete, stage: Stage) => update(athlete.id, stagePatch(stage));

  const columns = STAGES.map((stage) => ({
    ...stage,
    items: engagements
      .filter((e) => stageOf(e) === stage.value)
      .map((e) => ({ engagement: e, athlete: athleteById[e.athlete_id] }))
      .filter((row) => !!row.athlete),
  }));

  return (
    <section className="space-y-4">
      <SummaryBar title={event.name} summary={summary} />

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

      {suggestions.length > 0 && (
        <div className="rounded-xl border border-dashed border-border p-3">
          <p className="text-xs font-medium text-muted-foreground">
            Contatos da modalidade {event.sport} ({suggestions.length})
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

      {engagements.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
          Nenhum contato no fluxo comercial deste evento ainda. Adicione um contato existente ou
          crie um novo.
        </p>
      ) : isMobile ? (
        <MobileBoard
          columns={columns}
          event={event}
          onStage={setStage}
          onRemove={(id) => remove.mutate(id)}
          onPatch={update}
        />
      ) : (
        <KanbanBoard
          columns={columns}
          event={event}
          onStage={setStage}
          onRemove={(id) => remove.mutate(id)}
          onPatch={update}
        />
      )}

      <AddContactDialog
        open={adding}
        onOpenChange={setAdding}
        event={event}
        existing={athletes}
        alreadyAdded={byAthlete}
        onAdd={(athleteId, categoryId) => {
          update(athleteId, { ...stagePatch("not_contacted"), event_category_id: categoryId });
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
  summary: ReturnType<typeof eventEngagementSummary>;
}) {
  const cells = [
    { label: "Contatos", value: String(summary.added) },
    { label: "Contatados", value: String(summary.contacted) },
    { label: "Responderam", value: String(summary.responded) },
    { label: "Ofertas", value: String(summary.offered) },
    { label: "Fechados", value: String(summary.closed) },
    { label: "Valor fechado", value: formatBRL(summary.revenue) },
  ];
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-sm font-medium">{title}</p>
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-6">
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
  items: { engagement: EventEngagement; athlete: Athlete }[];
};

type BoardProps = {
  columns: Column[];
  event: SportEvent;
  onStage: (athlete: Athlete, stage: Stage) => void;
  onRemove: (id: string) => void;
  onPatch: (athleteId: string, patch: EventEngagementPatch) => void;
};

function KanbanBoard({ columns, event, onStage, onRemove, onPatch }: BoardProps) {
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
                <EngagementCard
                  row={row}
                  event={event}
                  onStage={onStage}
                  onRemove={onRemove}
                  onPatch={onPatch}
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MobileBoard({ columns, event, onStage, onRemove, onPatch }: BoardProps) {
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
                  event={event}
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
  event,
  onStage,
  onRemove,
  onPatch,
}: {
  row: { engagement: EventEngagement; athlete: Athlete };
  event: SportEvent;
  onStage: (athlete: Athlete, stage: Stage) => void;
  onRemove: (id: string) => void;
  onPatch: (athleteId: string, patch: EventEngagementPatch) => void;
}) {
  const { engagement: e, athlete } = row;
  const [notes, setNotes] = useState(e.notes ?? "");
  const [nextAction, setNextAction] = useState(e.next_action ?? "");
  const stage = stageOf(e);

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

      {event.categories.length > 0 && (
        <Select
          value={e.event_category_id ?? "__none__"}
          onValueChange={(v) =>
            onPatch(athlete.id, { event_category_id: v === "__none__" ? null : v })
          }
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="Categoria do evento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Sem categoria</SelectItem>
            {event.categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

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
        placeholder="Nota deste evento"
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
            <Trash2 className="size-4" /> Remover deste evento
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </article>
  );
}

function AddContactDialog({
  open,
  onOpenChange,
  event,
  existing,
  alreadyAdded,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: SportEvent;
  existing: Athlete[];
  alreadyAdded: Record<string, EventEngagement>;
  onAdd: (athleteId: string, categoryId: string | null) => void;
}) {
  const { save } = useAthleteMutations();
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    team_id: null as string | null,
    instagram: "",
    whatsapp: "",
    email: "",
    relationship: "prospect",
    category: null as string | null,
  });

  const term = search.trim().toLowerCase();
  const results = term
    ? existing.filter((a) => a.name.toLowerCase().includes(term)).slice(0, 8)
    : [];

  const selectedCategoryName = event.categories.find((c) => c.id === categoryId)?.name ?? null;

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
        category: form.category ?? selectedCategoryName,
        sport: event.sport,
      },
      {
        onSuccess: () => {
          toast.success("Contato criado. Busque pelo nome para adicioná-lo ao evento.");
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
            {event.name} — busque um contato já cadastrado antes de criar um novo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {event.categories.length > 0 && (
            <div className="space-y-1.5">
              <Label>Categoria do evento</Label>
              <Select
                value={categoryId ?? "__none__"}
                onValueChange={(v) => setCategoryId(v === "__none__" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sem categoria</SelectItem>
                  {event.categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="event-engagement-search">Buscar contato existente</Label>
            <Input
              id="event-engagement-search"
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
                      {[a.sport, formatCategoryLabel(a.category)].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={!!alreadyAdded[a.id]}
                    onClick={() => onAdd(a.id, categoryId)}
                  >
                    {alreadyAdded[a.id] ? "Já no evento" : "Adicionar ao evento"}
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-dashed border-border p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Criar novo contato · modalidade {event.sport}
              {selectedCategoryName ? ` · ${selectedCategoryName}` : ""}
            </p>
            <Input
              placeholder="Nome"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <SearchableTeamSelect
              value={form.team_id}
              onChange={(team_id) => setForm((f) => ({ ...f, team_id }))}
            />
            <p className="text-[11px] text-muted-foreground">Clube é opcional nesta modalidade.</p>
            <CategorySelect
              value={form.category ?? selectedCategoryName}
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
