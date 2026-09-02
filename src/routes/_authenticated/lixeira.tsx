import { createFileRoute } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RotateCcw, Trash2 } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useBatchMutations, useTrashedMatches } from "@/lib/batches";

export const Route = createFileRoute("/_authenticated/lixeira")({
  head: () => ({
    meta: [
      { title: "Lixeira de jogos — FotoPress" },
      {
        name: "description",
        content: "Restaure jogos excluídos ou remova-os definitivamente da base.",
      },
      { property: "og:title", content: "Lixeira de jogos — FotoPress" },
      {
        property: "og:description",
        content: "Recuperação de jogos excluídos em lote ou individualmente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TrashPage,
});

function TrashPage() {
  const { data: trashed = [], isLoading } = useTrashedMatches();
  const { restore, purge } = useBatchMutations();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allSelected = trashed.length > 0 && selectedIds.length === trashed.length;

  function toggle(id: string, checked: boolean) {
    setSelectedIds((c) => (checked ? [...new Set([...c, id])] : c.filter((x) => x !== id)));
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Lixeira</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {trashed.length} {trashed.length === 1 ? "jogo excluído" : "jogos excluídos"}. Restaure ou
          remova definitivamente.
        </p>
      </header>

      {trashed.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelectedIds(allSelected ? [] : trashed.map((m) => m.id))}
          >
            {allSelected ? "Desmarcar todos" : "Selecionar todos"}
          </Button>
          <span className="text-sm text-muted-foreground">{selectedIds.length} selecionados</span>
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={selectedIds.length === 0 || restore.isPending}
              onClick={() =>
                restore.mutate(selectedIds, {
                  onSuccess: ({ restored, conflicts }) => {
                    if (restored > 0) {
                      toast.success(
                        `${restored} ${restored === 1 ? "jogo restaurado" : "jogos restaurados"}.`,
                      );
                    }
                    if (conflicts > 0) {
                      toast.warning(
                        `${conflicts} ${
                          conflicts === 1
                            ? "jogo não foi restaurado"
                            : "jogos não foram restaurados"
                        } porque já existem novamente no calendário.`,
                      );
                    }
                    setSelectedIds([]);
                  },
                  onError: () => toast.error("Não foi possível restaurar."),
                })
              }
            >
              <RotateCcw className="size-4" /> Restaurar
            </Button>
            <Button
              size="sm"
              variant="destructive"
              disabled={selectedIds.length === 0 || purge.isPending}
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="size-4" /> Excluir definitivamente
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : trashed.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">A lixeira está vazia.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {trashed.map((m) => (
            <article
              key={m.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
            >
              <Checkbox
                checked={selectedSet.has(m.id)}
                onCheckedChange={(v) => toggle(m.id, v === true)}
                aria-label="Selecionar jogo"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {m.home_team} × {m.away_team}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(parseISO(m.date), "dd/MM/yyyy", { locale: ptBR })} · {m.time.slice(0, 5)}
                  {m.competition?.name ? ` · ${m.competition.name}` : ""} · excluído em{" "}
                  {format(parseISO(m.deleted_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir definitivamente {selectedIds.length} jogos?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita e remove também coberturas e radares vinculados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const ids = [...selectedIds];
                setConfirmOpen(false);
                purge.mutate(ids, {
                  onSuccess: () => {
                    toast.success("Jogos removidos definitivamente.");
                    setSelectedIds([]);
                  },
                  onError: () => toast.error("Não foi possível excluir."),
                });
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
