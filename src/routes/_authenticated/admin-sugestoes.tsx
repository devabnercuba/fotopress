import { createFileRoute } from "@tanstack/react-router";

import { SuggestionsAdminPanel } from "@/components/suggestions-admin-panel";
import { requireMasterAdmin } from "@/lib/admin";

export const Route = createFileRoute("/_authenticated/admin-sugestoes")({
  beforeLoad: requireMasterAdmin,
  head: () => ({
    meta: [
      { title: "Sugestões dos usuários — FotoPress" },
      {
        name: "description",
        content:
          "Painel administrativo do FotoPress para ler, responder e organizar as sugestões enviadas pelos usuários.",
      },
      { property: "og:title", content: "Sugestões dos usuários — FotoPress" },
      {
        property: "og:description",
        content: "Gerencie as ideias enviadas pelos usuários do FotoPress.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminSuggestionsPage,
});

function AdminSuggestionsPage() {
  return <SuggestionsAdminPanel />;
}
