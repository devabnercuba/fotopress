import { Check, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useCoverageMutations, type CredentialStatus } from "@/lib/coverages";

/**
 * Aprovar / reprovar credenciamento em um clique.
 * Reutilizado na Dashboard, em Campeonatos e no detalhe do jogo.
 */
export function CredentialActions({
  matchId,
  status,
  size = "sm",
}: {
  matchId: string;
  status: CredentialStatus;
  size?: "sm" | "icon";
}) {
  const { setStatusByMatch } = useCoverageMutations();

  const apply = (next: CredentialStatus, label: string) =>
    setStatusByMatch.mutate(
      { matchId, status: next },
      {
        onSuccess: () => toast.success(label),
        onError: () => toast.error("Não foi possível atualizar o credenciamento."),
      },
    );

  return (
    <div className="flex shrink-0 items-center gap-1">
      {status !== "approved" && (
        <Button
          variant="ghost"
          size={size}
          aria-label="Aprovar credenciamento"
          disabled={setStatusByMatch.isPending}
          onClick={(e) => {
            e.stopPropagation();
            apply("approved", "Credenciamento aprovado.");
          }}
        >
          <Check className="size-4 text-comp-green" />
          {size === "sm" && "Aprovar"}
        </Button>
      )}
      {status !== "denied" && (
        <Button
          variant="ghost"
          size={size}
          aria-label="Reprovar credenciamento"
          disabled={setStatusByMatch.isPending}
          onClick={(e) => {
            e.stopPropagation();
            apply("denied", "Credenciamento reprovado.");
          }}
        >
          <X className="size-4 text-destructive" />
          {size === "sm" && "Reprovar"}
        </Button>
      )}
    </div>
  );
}
