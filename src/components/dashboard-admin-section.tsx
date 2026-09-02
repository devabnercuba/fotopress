import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, CreditCard, Lightbulb, Timer } from "lucide-react";

import { useIsMasterAdmin } from "@/lib/admin";
import { useContentSources } from "@/lib/content-sources";
import { useNewSuggestionsCount } from "@/lib/suggestions";
import { listAdminUsers } from "@/lib/users-admin.functions";

type AdminAlert = {
  key: string;
  icon: typeof Lightbulb;
  text: string;
  to: string;
  action: string;
};

/**
 * Bloco administrativo do Dashboard.
 * O administrador master usa o FotoPress como usuário normal, então o painel
 * administrativo é só uma seção extra no rodapé — e some quando não há nada
 * relevante para tratar.
 */
export function DashboardAdminSection() {
  const { data: isAdmin = false } = useIsMasterAdmin();
  const newSuggestions = useNewSuggestionsCount(isAdmin);
  const { data: sources = [] } = useContentSources();

  const { data: admin } = useQuery({
    queryKey: ["admin-users-dashboard"],
    enabled: isAdmin,
    staleTime: 60_000,
    queryFn: () => listAdminUsers(),
  });

  if (!isAdmin) return null;

  const now = Date.now();
  const endingTrials = (admin?.rows ?? []).filter((r) => {
    if (r.isMasterAdmin || r.lifetime) return false;
    if (r.accessStatus !== "trial" || !r.trialEndsAt) return false;
    const diff = new Date(r.trialEndsAt).getTime() - now;
    return diff > 0 && diff <= 2 * 24 * 60 * 60 * 1000;
  }).length;

  const pendingPurchases = admin?.stats.pendingPurchases ?? 0;
  const brokenSources = sources.filter((s) => s.last_error || s.status === "error").length;

  const alerts: AdminAlert[] = [];
  if (newSuggestions > 0)
    alerts.push({
      key: "suggestions",
      icon: Lightbulb,
      text: `${newSuggestions} ${newSuggestions === 1 ? "nova sugestão" : "novas sugestões"} aguardando leitura.`,
      to: "/admin-sugestoes",
      action: "Ver sugestões",
    });
  if (endingTrials > 0)
    alerts.push({
      key: "trials",
      icon: Timer,
      text: `${endingTrials} ${endingTrials === 1 ? "trial termina" : "trials terminam"} nos próximos 2 dias.`,
      to: "/privilegios",
      action: "Ver usuários",
    });
  if (pendingPurchases > 0)
    alerts.push({
      key: "purchases",
      icon: CreditCard,
      text: `${pendingPurchases} ${pendingPurchases === 1 ? "compra pendente" : "compras pendentes"} de vínculo.`,
      to: "/integracao-kiwify",
      action: "Ver compras",
    });
  if (brokenSources > 0)
    alerts.push({
      key: "sources",
      icon: AlertTriangle,
      text: `${brokenSources} ${brokenSources === 1 ? "fonte com erro" : "fontes com erro"} de sincronização.`,
      to: "/fontes-conteudo",
      action: "Revisar fontes",
    });

  if (alerts.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
        Administração
      </h2>
      <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
        {alerts.map((alert) => (
          <li key={alert.key} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm">
            <alert.icon className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">{alert.text}</span>
            <Link
              to={alert.to}
              className="shrink-0 text-xs font-medium text-primary hover:underline"
            >
              {alert.action}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
