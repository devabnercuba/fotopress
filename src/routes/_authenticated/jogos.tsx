import { createFileRoute } from "@tanstack/react-router";
import { addMonths, format, isSameMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  CalendarDays,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  List,
  Trash2,
  Volleyball,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/empty-state";
import { NewMatchDialog } from "@/components/new-match-dialog";
import { EventsTab } from "@/components/events-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DateRangeFilter,
  EMPTY_RANGE,
  inDateRange,
  type DateRange,
} from "@/components/date-range-filter";
import { MatchCard } from "@/components/match-card";
import { MatchDetailDialog } from "@/components/match-detail-dialog";
import { MonthCalendar } from "@/components/month-calendar";
import { useBatchMutations, restoreDeletionBatch } from "@/lib/batches";
import {
  coverageByMatch,
  useCoverageMutations,
  useCoverages,
  type CredentialStatus,
} from "@/lib/coverages";
import { useDataSources } from "@/lib/data-sources";
import { useMatches, type Match } from "@/lib/queries";
import { useSportPreferences } from "@/lib/sport-preferences";
import { useSportTerminology } from "@/lib/sport-terminology";

export const Route = createFileRoute("/_authenticated/jogos")({
  validateSearch: (search: Record<string, unknown>): { source?: string } => ({
    source: typeof search["source"] === "string" ? (search["source"] as string) : undefined,
  }),

  head: () => ({
    meta: [
      { title: "Jogos — Cobertura esportiva" },
      {
        name: "description",
        content:
          "Lista completa de partidas cadastradas e importadas, com origem e status de credenciamento.",
      },
      { property: "og:title", content: "Jogos — Cobertura esportiva" },
      {
        property: "og:description",
        content: "Todas as partidas do sistema e o ponto de partida para solicitar credenciamento.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JogosPage,
});

const ALL = "todos";

/** Página Jogos: partidas (fluxo atual) e eventos esportivos, em abas. */
function JogosPage() {
  const { primarySport } = useSportPreferences();
  const terminology = useSportTerminology();
  const isFutebol = primarySport === "futebol";

  const headerTitle = isFutebol ? "Jogos" : terminology.coveragePlural;
  const headerDescription = isFutebol
    ? "Organize suas partidas e eventos esportivos."
    : terminology.coveragePlural === "Eventos"
      ? "Organize seus eventos esportivos."
      : `Organize suas ${terminology.coveragePlural.toLowerCase()} e eventos esportivos.`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">{headerTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{headerDescription}</p>
      </header>

      <Tabs defaultValue="partidas" className="space-y-6">
        <TabsList>
          <TabsTrigger value="partidas">Partidas</TabsTrigger>
          <TabsTrigger value="eventos">Eventos</TabsTrigger>
        </TabsList>
        <TabsContent value="partidas">
          <MatchesPage />
        </TabsContent>
        <TabsContent value="eventos">
          <EventsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MatchesPage() {
  const { data: matches = [], isLoading } = useMatches();
  const { data: coverages = [] } = useCoverages();
  const { request } = useCoverageMutations();

  const [view, setView] = useState<"lista" | "calendario">("lista");
  const [month, setMonth] = useState(() => new Date());
  const [day, setDay] = useState<string | null>(null);
  const [selected, setSelected] = useState<Match | null>(null);

  const [status, setStatus] = useState(ALL);
  const [state, setState] = useState(ALL);
  const { data: sources = [] } = useDataSources();
  const { source: sourceParam } = Route.useSearch();
  const [sourceFilter, setSourceFilter] = useState(sourceParam ?? ALL);
  const [search, setSearch] = useState("");

  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_RANGE);

  // Seleção múltipla / exclusão em lote.
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const { bulkDelete } = useBatchMutations();

  const byMatch = useMemo(() => coverageByMatch(coverages), [coverages]);

  const states = useMemo(
    () =>
      [...new Set(matches.map((m) => m.state).filter(Boolean) as string[])].sort((a, b) =>
        a.localeCompare(b),
      ),
    [matches],
  );

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return matches.filter((m) => {
      const st = byMatch[m.id]?.credential_status ?? "not_requested";
      if (status !== ALL && st !== status) return false;
      if (state !== ALL && (m.state ?? "") !== state) return false;
      if (sourceFilter !== ALL && (m.source_id ?? "") !== sourceFilter) return false;
      if (!inDateRange(m.date, dateRange)) return false;
      if (
        term &&
        ![m.home_team, m.away_team, m.venue, m.city]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(term))
      )
        return false;
      return true;
    });
  }, [matches, status, state, sourceFilter, search, dateRange, byMatch]);

  /** Jogos do mês em exibição, agrupados por data — base da visão mobile. */
  const monthGroups = useMemo(() => {
    const inMonth = rows
      .filter((m) => isSameMonth(parseISO(m.date), month))
      .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
    const map = new Map<string, Match[]>();
    for (const m of inMonth) map.set(m.date, [...(map.get(m.date) ?? []), m]);
    return [...map.entries()];
  }, [rows, month]);

  const dayMatches = useMemo(() => (day ? rows.filter((m) => m.date === day) : []), [rows, day]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const visibleIds = rows.map((m) => m.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));

  function toggleSelection(id: string, checked: boolean) {
    setSelectedIds((current) =>
      checked ? [...new Set([...current, id])] : current.filter((x) => x !== id),
    );
  }

  function exitSelection() {
    setSelectionMode(false);
    setSelectedIds([]);
  }

  /** Exclui em lote com soft delete e oferece desfazer imediato. */
  function confirmBulkDelete() {
    const ids = [...selectedIds];
    setConfirmOpen(false);
    bulkDelete.mutate(
      { ids, description: `${ids.length} jogos removidos da tela Jogos` },
      {
        onSuccess: ({ batchId, count }) => {
          exitSelection();
          toast.success(`${count} ${count === 1 ? "jogo excluído" : "jogos excluídos"}.`, {
            duration: 10000,
            action: {
              label: "Desfazer",
              onClick: async () => {
                try {
                  await restoreDeletionBatch(batchId);
                  toast.success("Exclusão desfeita.");
                  window.location.reload();
                } catch {
                  toast.error("Não foi possível desfazer.");
                }
              },
            },
          });
        },
        onError: () => toast.error("Não foi possível excluir os jogos."),
      },
    );
  }

  function renderCard(m: Match) {
    const st = (byMatch[m.id]?.credential_status ?? "not_requested") as CredentialStatus;
    return (
      <MatchCard
        key={m.id}
        match={m}
        status={st}
        selectable={selectionMode}
        selected={selectedSet.has(m.id)}
        onSelectedChange={(checked) => toggleSelection(m.id, checked)}
        action={
          !selectionMode && (st === "not_requested" || st === "denied") ? (
            <Button
              size="sm"
              variant="outline"
              disabled={request.isPending}
              onClick={() =>
                request.mutate(m.id, {
                  onSuccess: () => toast.success("Credenciamento solicitado."),
                  onError: () => toast.error("Não foi possível solicitar o credenciamento."),
                })
              }
            >
              Solicitar
            </Button>
          ) : null
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Partidas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {rows.length} {rows.length === 1 ? "partida" : "partidas"} cadastradas ou importadas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <NewMatchDialog />
          <Button
            size="sm"
            variant={selectionMode ? "secondary" : "outline"}
            onClick={() => (selectionMode ? exitSelection() : setSelectionMode(true))}
          >
            {selectionMode ? <X className="size-4" /> : <CheckSquare className="size-4" />}
            {selectionMode ? "Sair da seleção" : "Selecionar"}
          </Button>

          <div className="flex items-center gap-1 rounded-lg border border-border p-1">
            <Button
              size="sm"
              variant={view === "lista" ? "secondary" : "ghost"}
              onClick={() => setView("lista")}
            >
              <List className="size-4" /> Lista
            </Button>
            <Button
              size="sm"
              variant={view === "calendario" ? "secondary" : "ghost"}
              onClick={() => setView("calendario")}
            >
              <CalendarDays className="size-4" /> Calendário
            </Button>
          </div>
        </div>
      </header>

      {selectionMode && (
        <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 shadow-sm">
          <span className="text-sm font-medium">
            {selectedIds.length}{" "}
            {selectedIds.length === 1 ? "jogo selecionado" : "jogos selecionados"}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              allVisibleSelected
                ? setSelectedIds((c) => c.filter((id) => !visibleIds.includes(id)))
                : setSelectedIds((c) => [...new Set([...c, ...visibleIds])])
            }
          >
            {allVisibleSelected ? "Desmarcar visíveis" : `Selecionar todos (${visibleIds.length})`}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds([])}>
            Limpar seleção
          </Button>
          <Button
            size="sm"
            variant="destructive"
            className="ml-auto"
            disabled={selectedIds.length === 0 || bulkDelete.isPending}
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="size-4" /> Excluir selecionados
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar time, estádio ou cidade"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-[240px]"
        />
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Fonte" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as fontes</SelectItem>
            {sources.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={state} onValueChange={setState}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os estados</SelectItem>
            {states.map((uf) => (
              <SelectItem key={uf} value={uf}>
                {uf}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[190px]">
            <SelectValue placeholder="Credenciamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os status</SelectItem>
            <SelectItem value="not_requested">Não solicitado</SelectItem>
            <SelectItem value="requested">Solicitado</SelectItem>
            <SelectItem value="approved">Aprovado</SelectItem>
            <SelectItem value="denied">Negado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2 rounded-xl border border-border bg-card p-3">
        <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Data
        </div>
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : view === "lista" ? (
        rows.length === 0 ? (
          <EmptyState
            icon={Volleyball}
            title="Nenhum jogo encontrado"
            description="Depois de adicionar uma fonte ou cadastrar uma partida, seus jogos aparecerão aqui."
            learnLabel="Como importar jogos"
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{rows.map(renderCard)}</div>
        )
      ) : (
        <div className="space-y-5">
          {/* Desktop: grade mensal completa. */}
          <div className="hidden md:block">
            <MonthCalendar
              month={month}
              onMonthChange={setMonth}
              matches={rows}
              onSelect={setSelected}
              onDaySelect={(d) => setDay((current) => (current === d ? null : d))}
              selectedDay={day}
            />
            {day && (
              <section className="mt-5 space-y-3">
                <h2 className="text-sm font-medium">
                  Jogos de {format(parseISO(day), "dd 'de' MMMM", { locale: ptBR })}
                </h2>
                {dayMatches.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum jogo nesta data.</p>
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {dayMatches.map(renderCard)}
                  </div>
                )}
              </section>
            )}
          </div>

          {/* Mobile: agenda simplificada em cartões, agrupada por dia. */}
          <div className="space-y-4 md:hidden">
            <div className="flex items-center justify-between rounded-lg border border-border px-2 py-1.5">
              <Button size="icon" variant="ghost" onClick={() => setMonth(addMonths(month, -1))}>
                <ChevronLeft className="size-4" />
              </Button>
              <span className="text-sm font-medium capitalize">
                {format(month, "MMMM 'de' yyyy", { locale: ptBR })}
              </span>
              <Button size="icon" variant="ghost" onClick={() => setMonth(addMonths(month, 1))}>
                <ChevronRight className="size-4" />
              </Button>
            </div>

            {monthGroups.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum jogo neste mês.</p>
            ) : (
              monthGroups.map(([date, list]) => (
                <section key={date} className="space-y-2">
                  <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {format(parseISO(date), "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </h2>
                  <div className="grid gap-3">{list.map(renderCard)}</div>
                </section>
              ))
            )}
          </div>
        </div>
      )}

      <MatchDetailDialog match={selected} onOpenChange={(open) => !open && setSelected(null)} />

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir {selectedIds.length} {selectedIds.length === 1 ? "jogo" : "jogos"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Os jogos vão para a Lixeira e podem ser restaurados a qualquer momento pelo Histórico
              de operações.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
