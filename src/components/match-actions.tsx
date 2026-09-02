import { useState } from "react";
import { Copy, MoreVertical, Pencil, Trash2 } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MatchEditSheet } from "@/components/match-edit-sheet";
import { useMatchMutations } from "@/lib/matches";
import { coverageByMatch, useCoverages } from "@/lib/coverages";
import type { Match } from "@/lib/queries";

/** Ações rápidas de uma partida: editar, duplicar e excluir. */
export function MatchActions({ match }: { match: Match }) {
  const { duplicate, remove } = useMatchMutations();
  const { data: coverages = [] } = useCoverages();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const coverage = coverageByMatch(coverages)[match.id];

  const doRemove = (withCoverage: boolean) =>
    remove.mutate(
      { id: match.id, withCoverage },
      {
        onSuccess: () => {
          toast.success("Jogo excluído.");
          setConfirming(false);
        },
        onError: () => toast.error("Não foi possível excluir o jogo."),
      },
    );

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Ações do jogo">
            <MoreVertical className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <Pencil className="size-4" /> Editar
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              duplicate.mutate(match, {
                onSuccess: () => toast.success("Jogo duplicado."),
                onError: () => toast.error("Não foi possível duplicar o jogo."),
              })
            }
          >
            <Copy className="size-4" /> Duplicar
          </DropdownMenuItem>
          <DropdownMenuItem className="text-destructive" onSelect={() => setConfirming(true)}>
            <Trash2 className="size-4" /> Excluir
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <MatchEditSheet
        match={editing ? match : null}
        onOpenChange={(o) => !o && setEditing(false)}
      />

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Excluir {match.home_team} × {match.away_team}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {coverage
                ? "Este jogo possui uma cobertura vinculada (credenciamento e radar). Deseja remover a cobertura também?"
                : "O jogo será removido definitivamente do banco."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            {coverage ? (
              <>
                <Button
                  variant="outline"
                  disabled={remove.isPending}
                  onClick={() => doRemove(false)}
                >
                  Manter cobertura
                </Button>
                <AlertDialogAction disabled={remove.isPending} onClick={() => doRemove(true)}>
                  Excluir jogo e cobertura
                </AlertDialogAction>
              </>
            ) : (
              <AlertDialogAction disabled={remove.isPending} onClick={() => doRemove(true)}>
                Excluir jogo
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
