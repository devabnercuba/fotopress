import { createFileRoute } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Pencil, Plus, Settings2, Trash2, Wallet } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { FinanceCategoriesDialog } from "@/components/finance-categories-dialog";
import { FinanceEntryDialog, type CoverageOption } from "@/components/finance-entry-dialog";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEvents } from "@/lib/events";
import {
  ENTRY_TYPE_LABEL,
  coverageKey,
  formatMoney,
  groupByCoverage,
  useFinanceMutations,
  useFinancialEntries,
  type FinancialEntry,
} from "@/lib/finance";
import { useMatches } from "@/lib/queries";

type Search = { cobertura?: string };

export const Route = createFileRoute("/_authenticated/financeiro")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    cobertura: typeof search["cobertura"] === "string" ? search["cobertura"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Financeiro — FotoPress" },
      {
        name: "description",
        content:
          "Receitas, despesas e saldo de cada cobertura esportiva: saiba quanto cada partida ou evento rendeu.",
      },
      { property: "og:title", content: "Financeiro — FotoPress" },
      {
        property: "og:description",
        content: "Entenda o resultado financeiro das suas coberturas no FotoPress.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FinancePage,
});

const ALL = "todas";

function Indicator({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1.5 text-xl font-semibold tracking-tight ${tone ?? ""}`}>{value}</div>
    </div>
  );
}

function FinancePage() {
  const { cobertura } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: entries = [], isLoading } = useFinancialEntries();
  const { data: matches = [] } = useMatches();
  const { data: events = [] } = useEvents();
  const { remove } = useFinanceMutations();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialEntry | null>(null);
  const [toDelete, setToDelete] = useState<FinancialEntry | null>(null);
  const [type, setType] = useState<string>(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const options = useMemo<CoverageOption[]>(
    () => [
      ...matches.map((m) => ({
        key: `match:${m.id}`,
        label: `${m.home_team} × ${m.away_team}`,
        date: m.date,
        kind: "PARTIDA" as const,
      })),
      ...events.map((e) => ({
        key: `event:${e.id}`,
        label: e.name,
        date: e.start_date,
        kind: "EVENTO" as const,
      })),
    ],
    [matches, events],
  );

  const optionByKey = useMemo(() => new Map(options.map((o) => [o.key, o])), [options]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return entries.filter((entry) => {
      const key = coverageKey(entry);
      if (cobertura && key !== cobertura) return false;
      if (type !== ALL && entry.type !== type) return false;
      if (from && entry.occurred_at < from) return false;
      if (to && entry.occurred_at > to) return false;
      if (term) {
        const haystack = `${entry.description ?? ""} ${entry.category ?? ""} ${
          optionByKey.get(key)?.label ?? ""
        }`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [entries, cobertura, type, from, to, search, optionByKey]);

  const totals = useMemo(() => {
    const income = filtered.filter((e) => e.type === "income").reduce((s, e) => s + e.amount, 0);
    const expense = filtered.filter((e) => e.type === "expense").reduce((s, e) => s + e.amount, 0);
    return { income, expense, balance: income - expense };
  }, [filtered]);

  const groups = useMemo(() => {
    return groupByCoverage(filtered).sort((a, b) => b.balance - a.balance);
  }, [filtered]);

  function confirmDelete() {
    if (!toDelete) return;
    const id = toDelete.id;
    setToDelete(null);
    remove.mutate(id, {
      onSuccess: () => toast.success("Movimentação excluída."),
      onError: () => toast.error("Não foi possível excluir."),
    });
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Financeiro</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Entenda o resultado financeiro das suas coberturas.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setCategoriesOpen(true)}>
            <Settings2 className="size-4" /> Categorias
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" /> Nova movimentação
          </Button>
        </div>
      </header>

      {cobertura && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs">
          <span className="text-muted-foreground">Filtrando por cobertura:</span>
          <span className="font-medium">{optionByKey.get(cobertura)?.label ?? cobertura}</span>
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-7 px-2 text-xs"
            onClick={() => navigate({ search: {} })}
          >
            Limpar filtro
          </Button>
        </div>
      )}

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicator label="Receitas" value={formatMoney(totals.income)} tone="text-comp-green" />
        <Indicator label="Despesas" value={formatMoney(totals.expense)} />
        <Indicator
          label="Saldo"
          value={formatMoney(totals.balance)}
          tone={totals.balance < 0 ? "text-destructive" : ""}
        />
        <Indicator label="Coberturas" value={String(groups.length)} />
      </section>

      <section className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar movimentação"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-[220px]"
        />
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-[160px]" aria-label="Filtrar tipo">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os tipos</SelectItem>
            <SelectItem value="income">Receitas</SelectItem>
            <SelectItem value="expense">Despesas</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="date"
          aria-label="Data inicial"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="w-[150px]"
        />
        <Input
          type="date"
          aria-label="Data final"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="w-[150px]"
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Resultado por cobertura</h2>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : groups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center">
            <Wallet className="mx-auto mb-2 size-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Nenhuma movimentação registrada. Use “Nova movimentação” para lançar receitas e
              despesas de uma cobertura.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => {
              const option = optionByKey.get(group.key);
              const open = expanded === group.key;
              return (
                <article key={group.key} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium">
                          {option?.label ?? "Cobertura removida"}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {group.key.startsWith("match:") ? "PARTIDA" : "EVENTO"}
                        </Badge>
                        {option && (
                          <span className="text-[11px] text-muted-foreground">
                            {format(parseISO(option.date), "dd/MM/yyyy")}
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          Receitas{" "}
                          <strong className="text-foreground">{formatMoney(group.income)}</strong>
                        </span>
                        <span>
                          Despesas{" "}
                          <strong className="text-foreground">{formatMoney(group.expense)}</strong>
                        </span>
                        <span>
                          Saldo{" "}
                          <strong
                            className={group.balance < 0 ? "text-destructive" : "text-foreground"}
                          >
                            {formatMoney(group.balance)}
                          </strong>
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setExpanded(open ? null : group.key)}
                    >
                      {open ? "Ocultar" : "Ver detalhes"}
                    </Button>
                  </div>

                  {open && (
                    <ul className="mt-4 divide-y divide-border border-t border-border">
                      {group.entries.map((entry) => (
                        <li
                          key={entry.id}
                          className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5"
                        >
                          <span
                            className={`text-sm font-medium ${
                              entry.type === "income" ? "text-comp-green" : "text-destructive"
                            }`}
                          >
                            {entry.type === "income" ? "+" : "−"} {formatMoney(entry.amount)}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm">
                            {entry.description || entry.category || ENTRY_TYPE_LABEL[entry.type]}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {entry.category ? `${entry.category} · ` : ""}
                            {format(parseISO(entry.occurred_at), "dd/MM/yyyy", { locale: ptBR })}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Editar movimentação"
                            onClick={() => {
                              setEditing(entry);
                              setDialogOpen(true);
                            }}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label="Excluir movimentação"
                            onClick={() => setToDelete(entry)}
                          >
                            <Trash2 className="size-3.5 opacity-70" />
                          </Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <FinanceEntryDialog
        open={dialogOpen}
        onOpenChange={(next) => {
          setDialogOpen(next);
          if (!next) setEditing(null);
        }}
        options={options}
        entry={editing}
        {...(cobertura ? { defaultCoverage: cobertura } : {})}
        onManageCategories={() => setCategoriesOpen(true)}
      />

      <FinanceCategoriesDialog open={categoriesOpen} onOpenChange={setCategoriesOpen} />

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta movimentação?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não poderá ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
