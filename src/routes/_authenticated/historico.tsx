import { createFileRoute } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { History, Trash2, Undo2 } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  OPERATION_LABEL,
  useBatchMutations,
  useOperationBatches,
  type OperationBatch,
} from "@/lib/batches";

export const Route = createFileRoute("/_authenticated/historico")({
  head: () => ({
    meta: [
      { title: "Histórico de operações — FotoPress" },
      {
        name: "description",
        content:
          "Auditoria de importações e exclusões em lote de jogos, com opção de desfazer cada operação.",
      },
      { property: "og:title", content: "Histórico de operações — FotoPress" },
      {
        property: "og:description",
        content: "Acompanhe e reverta importações e exclusões em lote de jogos.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HistoryPage,
});

function HistoryPage() {
  const { data: batches = [], isLoading } = useOperationBatches();
  const { undoBatch, removeBatch, removeBatches } = useBatchMutations();
  const [toRemove, setToRemove] = useState<OperationBatch | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const visibleIds = useMemo(() => batches.map((b) => b.id), [batches]);
  const allSelected = visibleIds.length > 0 && selected.length === visibleIds.length;

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function undo(batch: OperationBatch) {
    undoBatch.mutate(batch, {
      onSuccess: (outcome) => {
        toast.success("Operação desfeita.");
        if (outcome && outcome.conflicts > 0) {
          toast.warning(
            `${outcome.conflicts} ${
              outcome.conflicts === 1 ? "jogo não foi restaurado" : "jogos não foram restaurados"
            } porque já existem novamente no calendário.`,
          );
        }
      },
      onError: () => toast.error("Não foi possível desfazer esta operação."),
    });
  }

  function confirmRemove() {
    if (!toRemove) return;
    const id = toRemove.id;
    setToRemove(null);
    removeBatch.mutate(id, {
      onSuccess: () => {
        setSelected((prev) => prev.filter((x) => x !== id));
        toast.success("Registro removido do histórico.");
      },
      onError: () => toast.error("Não foi possível remover este registro."),
    });
  }

  function confirmBulkRemove() {
    const ids = [...selected];
    setBulkOpen(false);
    removeBatches.mutate(ids, {
      onSuccess: () => {
        setSelected([]);
        toast.success(
          `${ids.length} ${ids.length === 1 ? "registro removido" : "registros removidos"} do histórico.`,
        );
      },
      onError: () => toast.error("Não foi possível remover os registros selecionados."),
    });
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Histórico de operações</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Importações e exclusões em lote de jogos. Operações financeiras e de conta não são
          reversíveis por aqui.
        </p>
      </header>

      {batches.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-3 py-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              checked={allSelected}
              onCheckedChange={(checked) => setSelected(checked ? visibleIds : [])}
              aria-label="Selecionar todos os registros"
            />
            Selecionar todos
          </label>
          <span className="text-xs text-muted-foreground">
            {selected.length} selecionado{selected.length === 1 ? "" : "s"}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            disabled={selected.length === 0 || removeBatches.isPending}
            onClick={() => setBulkOpen(true)}
          >
            <Trash2 className="size-4" /> Excluir selecionados
          </Button>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : batches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <History className="mx-auto mb-2 size-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nenhuma operação registrada ainda.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {batches.map((batch) => {
            const undone = batch.status === "undone";
            return (
              <article
                key={batch.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4"
              >
                <Checkbox
                  checked={selected.includes(batch.id)}
                  onCheckedChange={() => toggle(batch.id)}
                  aria-label="Selecionar registro"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">
                      {OPERATION_LABEL[batch.operation_type] ?? batch.operation_type}
                    </span>
                    <Badge variant={undone ? "outline" : "secondary"}>
                      {undone ? "Desfeita" : "Ativa"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {batch.affected_count} {batch.affected_count === 1 ? "jogo" : "jogos"}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {batch.description ?? "—"}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {format(parseISO(batch.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    {batch.undone_at &&
                      ` · desfeita em ${format(parseISO(batch.undone_at), "dd/MM/yyyy HH:mm", {
                        locale: ptBR,
                      })}`}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={undone || undoBatch.isPending}
                    onClick={() => undo(batch)}
                  >
                    <Undo2 className="size-4" />
                    {batch.operation_type === "bulk_delete" ? "Restaurar" : "Desfazer"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-muted-foreground"
                    disabled={removeBatch.isPending}
                    onClick={() => setToRemove(batch)}
                  >
                    <Trash2 className="size-4" />
                    Excluir do histórico
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!toRemove} onOpenChange={(open) => !open && setToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toRemove?.status === "undone"
                ? "Excluir este registro do histórico?"
                : "Excluir esta operação do histórico?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você perderá a opção de desfazer esta operação por esta tela. Os dados atuais não
              serão alterados: jogos na Lixeira continuam lá e podem ser restaurados ou excluídos
              definitivamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove}>Excluir do histórico</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir {selected.length} {selected.length === 1 ? "registro" : "registros"} do
              histórico?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Apenas os registros de auditoria serão removidos. Nenhum jogo é alterado: os que estão
              na Lixeira continuam lá e podem ser restaurados ou excluídos definitivamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmBulkRemove}>Excluir selecionados</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
