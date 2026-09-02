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
import { teamLabel, useTeamLinks, useTeamMutations, type Team } from "@/lib/teams";

/**
 * Exclusão de clube com verificação de vínculos.
 * Nunca executa DELETE quando existem jogos, atletas ou fontes ligados:
 * nesse caso orienta o usuário a corrigir ou usar a mesclagem já existente.
 */
export function TeamDeleteDialog({
  team,
  onOpenChange,
}: {
  team: Team | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { remove } = useTeamMutations();
  const { data: links, isLoading } = useTeamLinks(team?.id ?? null);
  const linked = (links?.total ?? 0) > 0;

  function confirm() {
    if (!team) return;
    remove.mutate(team.id, {
      onSuccess: () => {
        toast.success("Clube excluído.");
        onOpenChange(false);
      },
      onError: (error) =>
        toast.error(
          error instanceof Error && error.message === "LINKED"
            ? "Este clube passou a ter vínculos e não pode ser excluído."
            : "Não foi possível excluir o clube.",
        ),
    });
  }

  return (
    <AlertDialog open={!!team} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {linked ? "Este clube está sendo utilizado" : "Excluir este clube?"}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              {team && <p className="font-medium text-foreground">{teamLabel(team)}</p>}
              {isLoading ? (
                <p>Verificando vínculos…</p>
              ) : linked && links ? (
                <>
                  <ul className="list-disc space-y-0.5 pl-4">
                    {links.matches > 0 && <li>{links.matches} jogo(s)</li>}
                    {links.athletes > 0 && <li>{links.athletes} atleta(s)</li>}
                    {links.sources > 0 && <li>{links.sources} fonte(s) de atletas</li>}
                  </ul>
                  <p>
                    Corrija esses vínculos ou use a mesclagem de duplicados desta página antes de
                    excluir. Nenhum dado foi alterado.
                  </p>
                </>
              ) : (
                <p>
                  Nenhum jogo, atleta ou fonte está vinculado a este clube. A exclusão não pode ser
                  desfeita.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{linked ? "Fechar" : "Cancelar"}</AlertDialogCancel>
          {!linked && !isLoading && (
            <AlertDialogAction onClick={confirm} disabled={remove.isPending}>
              Excluir
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
