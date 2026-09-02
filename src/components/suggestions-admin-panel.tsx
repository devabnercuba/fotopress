import { MoreHorizontal, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  SUGGESTION_STATUS,
  statusLabel,
  useSuggestionAuthors,
  useSuggestionMutations,
  useSuggestions,
  type Suggestion,
  type SuggestionAuthor,
  type SuggestionStatus,
} from "@/lib/suggestions";

const ALL = "todas";

/** Status destacados no resumo compacto; os demais ficam acessíveis no filtro. */
const HIGHLIGHT: SuggestionStatus[] = ["new", "planned", "in_progress", "done"];

function SuggestionCard({
  suggestion,
  author,
  onDelete,
}: {
  suggestion: Suggestion;
  author?: SuggestionAuthor;
  onDelete: () => void;
}) {
  const { update } = useSuggestionMutations();
  const [note, setNote] = useState(suggestion.admin_note ?? "");

  const setStatus = (status: SuggestionStatus) =>
    update.mutate(
      { id: suggestion.id, status },
      { onSuccess: () => toast.success("Status atualizado.") },
    );

  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={suggestion.status === "new" ? "default" : "outline"}
              className="text-[10px]"
            >
              {statusLabel(suggestion.status)}
            </Badge>
            <span className="truncate text-xs text-muted-foreground">
              {author?.name ?? "Usuário"} ·{" "}
              {new Date(suggestion.created_at).toLocaleDateString("pt-BR")}
            </span>
            <span className="rounded bg-surface px-1.5 py-0.5 text-[11px] text-muted-foreground">
              {suggestion.category}
            </span>
          </div>
          <h3 className="mt-2 text-sm font-medium">{suggestion.title}</h3>
          <p className="mt-1 whitespace-pre-line text-sm text-muted-foreground">
            {suggestion.description}
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Ações da sugestão">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>Marcar como…</DropdownMenuLabel>
            {SUGGESTION_STATUS.map((s) => (
              <DropdownMenuItem
                key={s.value}
                disabled={s.value === suggestion.status}
                onSelect={() => setStatus(s.value)}
              >
                {s.label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive" onSelect={onDelete}>
              <Trash2 className="size-4" /> Excluir
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)_auto] sm:items-start">
        <Select value={suggestion.status} onValueChange={(v) => setStatus(v as SuggestionStatus)}>
          <SelectTrigger aria-label="Status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUGGESTION_STATUS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Textarea
          rows={2}
          placeholder="Resposta ao usuário"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <Button
          variant="secondary"
          disabled={update.isPending || note === (suggestion.admin_note ?? "")}
          onClick={() =>
            update.mutate(
              { id: suggestion.id, admin_note: note.trim() || null },
              { onSuccess: () => toast.success("Resposta salva.") },
            )
          }
        >
          Salvar
        </Button>
      </div>
    </article>
  );
}

/** Painel do administrador master: todas as sugestões enviadas pelos usuários. */
export function SuggestionsAdminPanel() {
  const { data: suggestions = [], isLoading } = useSuggestions();
  const { data: authors = {} } = useSuggestionAuthors();
  const { remove } = useSuggestionMutations();
  const [status, setStatus] = useState<string>(ALL);
  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Suggestion | null>(null);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return suggestions.filter((s) => {
      if (status !== ALL && s.status !== status) return false;
      if (term && !`${s.title} ${s.description}`.toLowerCase().includes(term)) return false;
      return true;
    });
  }, [suggestions, status, search]);

  const counts = HIGHLIGHT.map((value) => ({
    value,
    label: statusLabel(value),
    total: suggestions.filter((x) => x.status === value).length,
  }));

  function confirmDelete() {
    const target = pendingDelete;
    if (!target) return;
    remove.mutate(target.id, {
      onSuccess: () => toast.success("Sugestão excluída."),
      onError: () => toast.error("Não foi possível excluir a sugestão."),
      onSettled: () => setPendingDelete(null),
    });
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Sugestões dos usuários</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {suggestions.length}{" "}
          {suggestions.length === 1 ? "sugestão recebida" : "sugestões recebidas"} no FotoPress.
        </p>
      </header>

      {/* Resumo compacto: só os status principais, o resto vem pelo filtro. */}
      <div className="flex flex-wrap gap-2">
        {counts.map((c) => (
          <button
            key={c.value}
            type="button"
            onClick={() => setStatus(status === c.value ? ALL : c.value)}
            className={`flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition-colors ${
              status === c.value
                ? "border-foreground/30 bg-surface font-medium"
                : "border-border text-muted-foreground hover:bg-surface"
            }`}
          >
            {c.label}
            <span className="font-semibold text-foreground">{c.total}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_200px]">
        <Input
          placeholder="Buscar sugestão"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger aria-label="Filtrar status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todos os status</SelectItem>
            {SUGGESTION_STATUS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhuma sugestão {status !== ALL ? `com status “${statusLabel(status)}”` : ""}.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((s) => (
            <SuggestionCard
              key={s.id}
              suggestion={s}
              author={authors[s.user_id]}
              onDelete={() => setPendingDelete(s)}
            />
          ))}
        </div>
      )}

      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir esta sugestão?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não poderá ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={remove.isPending}>
              Excluir sugestão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
