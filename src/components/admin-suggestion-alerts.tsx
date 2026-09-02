import { useRouter } from "@tanstack/react-router";
import { toast } from "sonner";

import { useIsMasterAdmin } from "@/lib/admin";
import { useSuggestionAuthors, useSuggestionsRealtime } from "@/lib/suggestions";

/**
 * Alerta administrativo em tempo real.
 * Fica montado na aplicação inteira: quando um usuário envia uma sugestão e o
 * administrador está com o FotoPress aberto, aparece um toast discreto (nunca
 * um modal bloqueante). Se o admin estiver offline, o badge da sidebar mostra
 * as sugestões novas no próximo acesso.
 */
export function AdminSuggestionAlerts() {
  const { data: isAdmin = false } = useIsMasterAdmin();
  const { data: authors = {} } = useSuggestionAuthors(isAdmin);
  const router = useRouter();

  useSuggestionsRealtime(isAdmin, (suggestion) => {
    const author = authors[suggestion.user_id]?.name ?? "Um usuário";
    toast("Nova sugestão recebida 💡", {
      description: `${author} enviou uma nova ideia.`,
      action: {
        label: "Ver sugestão",
        onClick: () => router.navigate({ to: "/admin-sugestoes" }),
      },
    });
  });

  return null;
}
