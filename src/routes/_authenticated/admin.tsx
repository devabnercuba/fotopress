import { createFileRoute, redirect } from "@tanstack/react-router";

import { requireMasterAdmin } from "@/lib/admin";

/**
 * Rota antiga da administração de sugestões.
 * A tela oficial é /admin-sugestoes — mantemos o endereço funcionando para
 * links antigos, sem duplicar a interface.
 */
export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    await requireMasterAdmin();
    throw redirect({ to: "/admin-sugestoes" });
  },
  component: () => null,
});
