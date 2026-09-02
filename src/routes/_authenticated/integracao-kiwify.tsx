import { createFileRoute } from "@tanstack/react-router";

import { KiwifySettings } from "@/components/kiwify-settings";
import { requireMasterAdmin } from "@/lib/admin";

export const Route = createFileRoute("/_authenticated/integracao-kiwify")({
  beforeLoad: requireMasterAdmin,
  head: () => ({
    meta: [
      { title: "Integração Kiwify — FotoPress" },
      {
        name: "description",
        content: "Produto, oferta, checkout, webhook e eventos da integração Kiwify do FotoPress.",
      },
      { property: "og:title", content: "Integração Kiwify — FotoPress" },
      {
        property: "og:description",
        content: "Central de configuração e monitoramento da integração Kiwify.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: KiwifyPage,
});

function KiwifyPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">Integração Kiwify</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Produto, checkout, webhook, eventos e testes da integração.
        </p>
      </header>

      <KiwifySettings />
    </div>
  );
}
