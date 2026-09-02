import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCompetitionDeletion, useCompetitionDependencies } from "@/lib/competition-admin";
import type { Competition } from "@/lib/queries";

/**
 * Exclusão de campeonato com análise de vínculos.
 * Nada é apagado sem que o usuário decida o destino dos jogos e fontes.
 */
export function CompetitionDeleteDialog({
  competition,
  competitions,
  onOpenChange,
  onDeleted,
}: {
  competition: Competition | null;
  competitions: Competition[];
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const { data: deps, isLoading } = useCompetitionDependencies(competition?.id ?? null);
  const { remove, restore } = useCompetitionDeletion();
  const [mode, setMode] = useState<"cascade" | "move">("cascade");
  const [targetId, setTargetId] = useState<string>("");

  const linked = (deps?.matches ?? 0) + (deps?.sources ?? 0) > 0;
  const others = competitions.filter((c) => c.id !== competition?.id);

  function confirm() {
    if (!competition) return;
    const finalMode = linked ? mode : "simple";
    if (finalMode === "move" && !targetId) {
      toast.error("Selecione o campeonato de destino.");
      return;
    }
    remove.mutate(
      { id: competition.id, name: competition.name, mode: finalMode, targetId },
      {
        onSuccess: ({ batchId, affected }) => {
          onOpenChange(false);
          onDeleted?.();
          toast.success(
            finalMode === "move"
              ? `Campeonato excluído e ${affected} jogos movidos.`
              : `Campeonato excluído${affected ? ` com ${affected} jogos` : ""}.`,
            {
              duration: 10000,
              action: {
                label: "DESFAZER",
                onClick: () =>
                  restore.mutate(
                    { competitionId: competition.id, batchId },
                    {
                      onSuccess: () => toast.success("Exclusão desfeita."),
                      onError: () => toast.error("Não foi possível desfazer."),
                    },
                  ),
              },
            },
          );
        },
        onError: (error) =>
          toast.error(error instanceof Error ? error.message : "Não foi possível excluir."),
      },
    );
  }

  return (
    <Dialog open={!!competition} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Excluir “{competition?.name}”?</DialogTitle>
          <DialogDescription>
            {isLoading
              ? "Analisando vínculos…"
              : linked
                ? `Este campeonato tem ${deps?.matches ?? 0} jogos e ${deps?.sources ?? 0} fontes vinculadas.`
                : "Nenhum jogo ou fonte vinculada a este campeonato."}
          </DialogDescription>
        </DialogHeader>

        {linked && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>O que fazer com os dados vinculados?</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as "cascade" | "move")}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cascade">Excluir também os jogos e fontes</SelectItem>
                  <SelectItem value="move">Mover para outro campeonato</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {mode === "move" && (
              <div className="space-y-1.5">
                <Label>Campeonato de destino</Label>
                <Select value={targetId} onValueChange={setTargetId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {others.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" disabled={remove.isPending} onClick={confirm}>
            Excluir campeonato
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
