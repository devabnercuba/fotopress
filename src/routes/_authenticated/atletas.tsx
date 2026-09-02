import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ArrowLeft, Download, History, Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

import { AthleteContactActions } from "@/components/athlete-contact-actions";
import { AthleteImportDialog } from "@/components/athlete-import-dialog";
import { AthleteSourcesPanel } from "@/components/athlete-sources-panel";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { TeamCrest } from "@/components/team-crest";
import { MatchCommercialPanel } from "@/components/match-commercial-panel";
import { CategorySelect } from "@/components/category-select";
import { SportSelect } from "@/components/sport-select";
import { formatSportLabel, normalizeSport } from "@/lib/sports";
import {
  ATHLETE_STATUS,
  ATHLETE_STATUS_LABEL,
  formatCategoryLabel,
  normalizeCategory,
  POSITIONS,
  RELATIONSHIPS,
  RELATIONSHIP_LABEL,
  useAthleteMutations,
  useAthletes,
  type Athlete,
} from "@/lib/athletes";
import {
  CONTACT_LABEL,
  PACKAGE_LABEL,
  STAGE_LABEL,
  engagementStage,
  engagementSummary,
  formatBRL,
  useAllEngagements,
  useAthleteEngagements,
  useMatchEngagements,
  type Engagement,
} from "@/lib/engagements";
import { useCoverages, type Coverage } from "@/lib/coverages";
import { SearchableTeamSelect } from "@/components/searchable-team-select";

type Search = { tab?: string; match?: string };

export const Route = createFileRoute("/_authenticated/atletas")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
    match: typeof search.match === "string" ? search.match : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Atletas/Clientes — FotoPress" },
      {
        name: "description",
        content:
          "Contatos, clientes e oportunidades comerciais das suas coberturas: funil por jogo, ações rápidas de contato e histórico.",
      },
      { property: "og:title", content: "Atletas/Clientes — FotoPress" },
      {
        property: "og:description",
        content: "Gerencie contatos, clientes e oportunidades relacionadas às coberturas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AthletesPage,
});

const ALL = "todos";

type AthleteForm = {
  name: string;
  nickname: string;
  team_id: string | null;
  position: string;
  number: string;
  instagram: string;
  notes: string;
  phone: string;
  whatsapp: string;
  email: string;
  relationship: string;
  status: string;
  category: string | null;
  sport: string | null;
};

const empty: AthleteForm = {
  name: "",
  nickname: "",
  team_id: null,
  position: "",
  number: "",
  instagram: "",
  notes: "",
  phone: "",
  whatsapp: "",
  email: "",
  relationship: "unclassified",
  status: "active",
  category: null,
  sport: null,
};

function AthleteDialog({
  athlete,
  open,
  onOpenChange,
  trigger,
}: {
  athlete?: Athlete | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trigger?: React.ReactNode;
}) {
  const { save } = useAthleteMutations();

  const [photo, setPhoto] = useState<File | null>(null);
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (!open) return;
    setPhoto(null);
    setForm(
      athlete
        ? {
            name: athlete.name,
            nickname: athlete.nickname ?? "",
            team_id: athlete.team_id,
            position: athlete.position ?? "",
            number: athlete.number != null ? String(athlete.number) : "",
            instagram: athlete.instagram ?? "",
            notes: athlete.notes ?? "",
            phone: athlete.phone ?? "",
            whatsapp: athlete.whatsapp ?? "",
            email: athlete.email ?? "",
            relationship: athlete.relationship || "unclassified",
            status: athlete.status || "active",
            category: athlete.category ?? null,
            sport: athlete.sport ?? null,
          }
        : empty,
    );
  }, [open, athlete]);

  const reset = (next: boolean) => {
    if (!next && save.isPending) return;
    onOpenChange(next);
  };

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const editing = !!athlete;

  function submit() {
    const name = form.name.trim();
    if (name.length < 2) {
      toast.error("Informe o nome completo do contato (mínimo 2 caracteres).");
      return;
    }
    if (form.number && Number(form.number) > 999) {
      toast.error("Número da camisa inválido.");
      return;
    }
    save.mutate(
      {
        id: athlete?.id,
        name,
        nickname: form.nickname.trim() || null,
        team_id: form.team_id,
        position: form.position || null,
        number: form.number.trim() ? Number(form.number) : null,
        instagram: form.instagram.trim().replace(/^@/, "") || null,
        notes: form.notes.trim() || null,
        phone: form.phone.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        email: form.email.trim() || null,
        relationship: form.relationship,
        status: form.status,
        category: form.category,
        sport: form.sport,
        photo,
      },
      {
        onSuccess: () => {
          toast.success(editing ? "Alterações salvas." : "Contato criado.");
          reset(false);
        },
        onError: (error) =>
          toast.error(
            editing
              ? "Não foi possível salvar as alterações."
              : "Não foi possível criar o contato.",
            { description: error instanceof Error ? error.message : undefined },
          ),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={reset}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? `Editar ${athlete.name}` : "Novo contato"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Ajuste os dados do contato já cadastrado e confirme para salvar."
              : "Atletas, clientes, comissão técnica e imprensa vinculados aos clubes. Os dados de contato são opcionais."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="athlete-name">Nome completo *</Label>
            <Input
              id="athlete-name"
              value={form.name}
              onChange={(e) => set({ name: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="athlete-nickname">Apelido</Label>
            <Input
              id="athlete-nickname"
              placeholder="Como é conhecido (opcional)"
              value={form.nickname}
              onChange={(e) => set({ nickname: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Modalidade</Label>
            <SportSelect value={form.sport} onChange={(sport) => set({ sport })} />
          </div>

          <div className="space-y-1.5">
            <Label>Clube (opcional)</Label>
            <SearchableTeamSelect value={form.team_id} onChange={(team_id) => set({ team_id })} />
          </div>

          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <CategorySelect value={form.category} onChange={(category) => set({ category })} />
          </div>

          <div className="grid grid-cols-[1fr_100px] gap-3">
            <div className="space-y-1.5">
              <Label>Posição</Label>
              <Select value={form.position} onValueChange={(v) => set({ position: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {POSITIONS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="athlete-number">Camisa</Label>
              <Input
                id="athlete-number"
                inputMode="numeric"
                value={form.number}
                onChange={(e) => set({ number: e.target.value.replace(/\D/g, "") })}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Relacionamento</Label>
              <Select value={form.relationship} onValueChange={(v) => set({ relationship: v })}>
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
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => set({ status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ATHLETE_STATUS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="athlete-phone">Telefone</Label>
              <Input
                id="athlete-phone"
                placeholder="(47) 99999-9999"
                value={form.phone}
                onChange={(e) => set({ phone: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="athlete-whatsapp">WhatsApp</Label>
              <Input
                id="athlete-whatsapp"
                placeholder="(47) 99999-9999"
                value={form.whatsapp}
                onChange={(e) => set({ whatsapp: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="athlete-email">E-mail</Label>
            <Input
              id="athlete-email"
              type="email"
              value={form.email}
              onChange={(e) => set({ email: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="athlete-instagram">Instagram</Label>
            <Input
              id="athlete-instagram"
              placeholder="@usuario"
              value={form.instagram}
              onChange={(e) => set({ instagram: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="athlete-photo">Foto</Label>
            <Input
              id="athlete-photo"
              type="file"
              accept="image/*"
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="athlete-notes">Observações</Label>
            <Textarea
              id="athlete-notes"
              rows={3}
              value={form.notes}
              onChange={(e) => set({ notes: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => reset(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending ? "Salvando…" : editing ? "Salvar alterações" : "Criar contato"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AthleteHistoryDialog({
  athlete,
  open,
  onOpenChange,
}: {
  athlete: Athlete;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: history = [], isLoading } = useAthleteEngagements(open ? athlete.id : null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Histórico comercial</DialogTitle>
          <DialogDescription>Partidas em que houve interação com {athlete.name}.</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : history.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
            Ainda não há registros comerciais para este contato.
          </p>
        ) : (
          <div className="space-y-2">
            {history.map((item) => (
              <article key={item.id} className="rounded-lg border border-border bg-card p-3">
                <p className="text-sm font-medium">
                  {item.match?.home_team} × {item.match?.away_team}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {CONTACT_LABEL[item.contact_status]} · {PACKAGE_LABEL[item.package_status]}
                  {item.package_value != null ? ` · ${formatBRL(item.package_value)}` : ""}
                  {item.match?.date ? ` · ${format(parseISO(item.match.date), "dd/MM/yyyy")}` : ""}
                </p>
                {item.notes && <p className="mt-1 text-xs text-muted-foreground">{item.notes}</p>}
              </article>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LastInteraction({ engagement }: { engagement?: Engagement }) {
  if (!engagement) return null;
  return (
    <div className="rounded-lg bg-surface/60 p-2 text-xs text-muted-foreground">
      <p className="font-medium text-foreground">
        {engagement.match?.home_team} × {engagement.match?.away_team}
      </p>
      <p>
        {STAGE_LABEL[engagementStage(engagement)]}
        {engagement.package_status === "closed" && engagement.package_value != null
          ? ` · ${formatBRL(engagement.package_value)}`
          : ""}
      </p>
    </div>
  );
}

function AthleteCard({ athlete, last }: { athlete: Athlete; last?: Engagement }) {
  const { remove } = useAthleteMutations();
  const [editing, setEditing] = useState(false);
  const [history, setHistory] = useState(false);

  return (
    <div className="space-y-2.5 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-surface text-xs font-semibold text-muted-foreground">
          {athlete.photo_url ? (
            <img
              src={athlete.photo_url}
              alt={`Foto de ${athlete.name}`}
              className="size-full object-cover"
            />
          ) : (
            athlete.name.slice(0, 2).toUpperCase()
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{athlete.name}</span>
            {athlete.number != null && (
              <span className="rounded bg-surface px-1.5 text-[11px] text-muted-foreground">
                #{athlete.number}
              </span>
            )}
            <span className="rounded bg-surface px-1.5 text-[11px] text-muted-foreground">
              {formatCategoryLabel(athlete.category) ?? "Sem categoria"}
            </span>
            <span className="rounded bg-surface px-1.5 text-[11px] text-muted-foreground">
              {RELATIONSHIP_LABEL[athlete.relationship] ?? "Sem classificação"}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            {athlete.nickname && <span>“{athlete.nickname}”</span>}
            {athlete.team && (
              <span className="flex items-center gap-1">
                <TeamCrest name={athlete.team.name} size="sm" />
                {athlete.team.name}
              </span>
            )}
            {athlete.position && <span>{athlete.position}</span>}
            {athlete.status === "inactive" && <span>Inativo</span>}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Ver perfil e histórico"
            onClick={() => setHistory(true)}
          >
            <History className="size-4" />
          </Button>
          <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => setEditing(true)}>
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Excluir"
            onClick={() =>
              remove.mutate(athlete.id, {
                onSuccess: () => toast.success("Contato excluído."),
                onError: () => toast.error("Não foi possível excluir."),
              })
            }
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      <AthleteContactActions athlete={athlete} />
      <LastInteraction engagement={last} />

      <AthleteDialog athlete={athlete} open={editing} onOpenChange={setEditing} />
      <AthleteHistoryDialog athlete={athlete} open={history} onOpenChange={setHistory} />
    </div>
  );
}

function ContactsTab({ onCreate }: { onCreate: () => void }) {
  const { data: athletes = [], isLoading } = useAthletes();
  const { data: engagements = [] } = useAllEngagements();
  const [team, setTeam] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [relationship, setRelationship] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [category, setCategory] = useState(ALL);
  const [sport, setSport] = useState(ALL);

  /** Modalidades realmente cadastradas pelo usuário. */
  const sports = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of athletes) {
      const key = normalizeSport(a.sport);
      if (key && !map.has(key)) map.set(key, formatSportLabel(a.sport)!);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [athletes]);

  /** Categorias realmente cadastradas pelo usuário. */
  const categories = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of athletes) {
      const key = normalizeCategory(a.category);
      if (key && !map.has(key)) map.set(key, formatCategoryLabel(a.category)!);
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [athletes]);

  // Última interação por contato (a consulta já vem ordenada por atualização).
  const lastByAthlete = useMemo(() => {
    const map: Record<string, Engagement> = {};
    for (const e of engagements) if (!map[e.athlete_id]) map[e.athlete_id] = e;
    return map;
  }, [engagements]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return athletes.filter((a) => {
      if (team && a.team_id !== team) return false;
      if (relationship !== ALL && (a.relationship || "unclassified") !== relationship) return false;
      if (status !== ALL && (a.status || "active") !== status) return false;
      if (category !== ALL) {
        const key = normalizeCategory(a.category);
        if (category === "__none__" ? !!key : key !== category) return false;
      }
      if (sport !== ALL) {
        const key = normalizeSport(a.sport);
        if (sport === "__none__" ? !!key : key !== sport) return false;
      }
      if (
        term &&
        !`${a.name} ${a.full_name ?? ""} ${a.nickname ?? ""} ${a.position ?? ""}`
          .toLowerCase()
          .includes(term)
      )
        return false;
      return true;
    });
  }, [athletes, team, search, relationship, status, category, sport]);

  const clearFilters = () => {
    setSearch("");
    setTeam(null);
    setRelationship(ALL);
    setStatus(ALL);
    setCategory(ALL);
    setSport(ALL);
  };

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  // Base vazia: nada de filtros, apenas o caminho para criar o primeiro contato.
  if (athletes.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title="Nenhum atleta/cliente cadastrado"
        description="Comece criando sua base de atletas, prospects e clientes para organizar seus contatos e oportunidades em cada cobertura."
        learnLabel="Como funciona"
        action={
          <Button onClick={onCreate}>
            <Plus className="size-4" /> Adicionar atleta/cliente
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Input
          placeholder="Buscar atleta ou cliente"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full"
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-5">
          <SearchableTeamSelect
            value={team}
            onChange={setTeam}
            noneLabel="Todos os clubes"
            className="w-full min-w-0"
          />
          <Select value={relationship} onValueChange={setRelationship}>
            <SelectTrigger className="w-full min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os relacionamentos</SelectItem>
              {RELATIONSHIPS.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas as categorias</SelectItem>
              <SelectItem value="__none__">Sem categoria</SelectItem>
              {categories.map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sport} onValueChange={setSport}>
            <SelectTrigger className="w-full min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todas as modalidades</SelectItem>
              <SelectItem value="__none__">Sem modalidade</SelectItem>
              {sports.map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-full min-w-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Todos os status</SelectItem>
              {ATHLETE_STATUS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {ATHLETE_STATUS_LABEL[s.value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum contato encontrado"
          description="Não encontramos atletas/clientes com os filtros selecionados."
          learnLabel="Como funciona"
          action={
            <Button variant="secondary" onClick={clearFilters}>
              Limpar filtros
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((athlete) => (
            <AthleteCard key={athlete.id} athlete={athlete} last={lastByAthlete[athlete.id]} />
          ))}
        </div>
      )}
    </div>
  );
}

function CoverageCard({
  coverage,
  onOpen,
}: {
  coverage: Coverage;
  onOpen: (matchId: string) => void;
}) {
  const match = coverage.match!;
  const { data: engagements = [] } = useMatchEngagements(match.id);
  const s = engagementSummary(engagements);

  return (
    <article className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div>
        <p className="text-sm font-medium">
          {match.home_team} × {match.away_team}
        </p>
        <p className="text-xs text-muted-foreground">
          {format(parseISO(match.date), "dd/MM/yyyy")} · {match.time.slice(0, 5)}
        </p>
      </div>
      <ul className="space-y-0.5 text-xs text-muted-foreground">
        <li>{s.added} contatos</li>
        <li>{s.contacted} contatados</li>
        <li>{s.responded} responderam</li>
        <li>{s.closed} fechados</li>
        <li className="font-medium text-foreground">{formatBRL(s.revenue)}</li>
      </ul>
      <Button size="sm" variant="outline" className="w-full" onClick={() => onOpen(match.id)}>
        Gerenciar contatos
      </Button>
    </article>
  );
}

function ByMatchTab({
  selected,
  onSelect,
}: {
  selected?: string;
  onSelect: (matchId?: string) => void;
}) {
  const { data: coverages = [], isLoading } = useCoverages();

  const upcoming = useMemo(
    () => coverages.filter((c) => c.match && c.credential_status === "approved" && !c.completed_at),
    [coverages],
  );

  const active = coverages.find((c) => c.match_id === selected);

  if (active?.match) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => onSelect(undefined)}>
          <ArrowLeft className="size-4" /> Voltar às coberturas
        </Button>
        <MatchCommercialPanel match={active.match} />
      </div>
    );
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  if (upcoming.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center">
        <p className="text-sm text-muted-foreground">
          Nenhuma cobertura aprovada em aberto. Aprove um credenciamento para trabalhar o funil
          comercial daquele jogo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium">Próximas coberturas</h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {upcoming.map((c) => (
          <CoverageCard key={c.id} coverage={c} onOpen={(id) => onSelect(id)} />
        ))}
      </div>
    </div>
  );
}

function HistoryTab() {
  const { data: engagements = [], isLoading } = useAllEngagements();
  const [search, setSearch] = useState("");
  const [result, setResult] = useState(ALL);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return engagements
      .filter((e) => {
        const haystack = `${e.athlete?.name ?? ""} ${e.athlete?.team?.name ?? ""} ${
          e.match?.home_team ?? ""
        } ${e.match?.away_team ?? ""}`.toLowerCase();
        if (term && !haystack.includes(term)) return false;
        if (result === "closed" && e.package_status !== "closed") return false;
        if (result === "declined" && e.package_status !== "declined") return false;
        if (result === "no_response" && !e.no_response) return false;
        return true;
      })
      .sort((a, b) => (b.match?.date ?? "").localeCompare(a.match?.date ?? ""));
  }, [engagements, search, result]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar contato, clube ou jogo"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-[280px]"
        />
        <Select value={result} onValueChange={setResult}>
          <SelectTrigger className="w-[190px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os resultados</SelectItem>
            <SelectItem value="closed">Fechados</SelectItem>
            <SelectItem value="declined">Não fechou</SelectItem>
            <SelectItem value="no_response">Não respondeu</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">Nenhuma interação comercial registrada.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((e) => (
            <article
              key={e.id}
              className="flex flex-wrap items-baseline justify-between gap-2 rounded-lg border border-border bg-card p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {e.athlete?.name}
                  {e.athlete?.team?.name ? (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {e.athlete.team.name}
                    </span>
                  ) : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {e.match?.home_team} × {e.match?.away_team}
                  {e.match?.date ? ` · ${format(parseISO(e.match.date), "dd/MM/yyyy")}` : ""}
                </p>
                {e.notes && <p className="mt-1 text-xs text-muted-foreground">{e.notes}</p>}
              </div>
              <div className="text-right text-xs text-muted-foreground">
                <p>{STAGE_LABEL[engagementStage(e)]}</p>
                {e.package_status === "closed" && e.package_value != null && (
                  <p className="font-medium text-comp-green">{formatBRL(e.package_value)}</p>
                )}
                {e.package_status === "declined" && <p>Não fechou</p>}
                {e.no_response && <p>Não respondeu</p>}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function AthletesPage() {
  const { tab, match } = Route.useSearch();
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const navigate = useNavigate({ from: Route.fullPath });

  const value = tab === "jogo" || tab === "historico" || tab === "fontes" ? tab : "contatos";

  const setTab = (next: string) =>
    navigate({ search: { tab: next, match: next === "jogo" ? match : undefined } });

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Atletas/Clientes</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie seus contatos, clientes e oportunidades relacionadas às coberturas.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <AthleteImportDialog
            open={importing}
            onOpenChange={setImporting}
            trigger={
              <Button variant="outline" className="w-full sm:w-auto">
                <Download className="size-4" /> Importar atletas
              </Button>
            }
          />
          <AthleteDialog
            open={creating}
            onOpenChange={setCreating}
            trigger={
              <Button className="w-full sm:w-auto">
                <Plus className="size-4" /> Novo atleta/cliente
              </Button>
            }
          />
        </div>
      </header>

      <Tabs value={value} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="contatos">Contatos</TabsTrigger>
          <TabsTrigger value="jogo">Por jogo</TabsTrigger>
          <TabsTrigger value="fontes">Fontes</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="contatos" className="mt-5">
          <ContactsTab onCreate={() => setCreating(true)} />
        </TabsContent>
        <TabsContent value="jogo" className="mt-5">
          <ByMatchTab
            selected={match}
            onSelect={(id) => navigate({ search: { tab: "jogo", match: id } })}
          />
        </TabsContent>
        <TabsContent value="fontes" className="mt-5">
          <AthleteSourcesPanel />
        </TabsContent>
        <TabsContent value="historico" className="mt-5">
          <HistoryTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
