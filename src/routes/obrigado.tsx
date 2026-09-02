import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { format, parseISO } from "date-fns";
import { AlertCircle, CheckCircle2, Clock, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { claimPendingPurchase, getMyPurchaseStatus } from "@/lib/claim-purchase.functions";
import { useAuthUser } from "@/lib/profile";

export const Route = createFileRoute("/obrigado")({
  head: () => ({
    meta: [
      { title: "Obrigado pela compra — FotoPress" },
      {
        name: "description",
        content:
          "Recebemos sua compra do Acesso Fundador do FotoPress. Acompanhe aqui o status da liberação do seu acesso.",
      },
      { property: "og:title", content: "Obrigado pela compra — FotoPress" },
      {
        property: "og:description",
        content: "Acompanhe o status da liberação do seu Acesso Fundador no FotoPress.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ObrigadoPage,
});

function when(value: string | null) {
  if (!value) return "—";
  try {
    return format(parseISO(value), "dd/MM/yyyy HH:mm");
  } catch {
    return "—";
  }
}

function PurchaseStatus() {
  const claim = useServerFn(claimPendingPurchase);
  const statusFn = useServerFn(getMyPurchaseStatus);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["my-purchase-status"],
    queryFn: async () => {
      // Cenário A: tenta vincular a compra pendente antes de exibir o status.
      await claim({}).catch(() => null);
      return statusFn({});
    },
  });

  const state = data?.state;
  const visual =
    state === "linked"
      ? { icon: CheckCircle2, tone: "text-primary", title: "Compra vinculada" }
      : state === "error"
        ? { icon: AlertCircle, tone: "text-destructive", title: "Erro na liberação" }
        : state === "pending"
          ? { icon: Clock, tone: "text-muted-foreground", title: "Compra pendente" }
          : { icon: Clock, tone: "text-muted-foreground", title: "Aguardando compra" };
  const Icon = visual.icon;

  return (
    <div className="w-full rounded-lg border border-border p-4 text-left">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className={`size-4 ${visual.tone}`} />
          <span className="text-sm font-medium">{visual.title}</span>
        </div>
        <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <dl className="mt-3 space-y-1.5 text-xs text-muted-foreground">
        <div className="flex justify-between gap-3">
          <dt>E-mail da conta</dt>
          <dd className="text-foreground">{data?.email ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Transação</dt>
          <dd className="text-foreground">{data?.transactionId ?? "—"}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Compra recebida em</dt>
          <dd className="text-foreground">{when(data?.purchasedAt ?? null)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt>Acesso liberado em</dt>
          <dd className="text-foreground">{when(data?.linkedAt ?? null)}</dd>
        </div>
      </dl>

      {data?.note && <p className="mt-3 text-xs text-muted-foreground">{data.note}</p>}

      {state === "linked" && (
        <Button asChild className="mt-4 w-full">
          <Link to="/dashboard">Ir para o FotoPress</Link>
        </Button>
      )}
    </div>
  );
}

function ObrigadoPage() {
  const { data: user } = useAuthUser();

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-5 px-6 text-center">
      <CheckCircle2 className="size-10 text-primary" />
      <h1 className="text-2xl font-semibold tracking-tight">Obrigado por adquirir o FotoPress!</h1>
      <p className="text-sm text-muted-foreground">
        Use o e-mail informado na compra para acessar ou criar sua conta. Assim que o pagamento for
        confirmado, o Acesso Fundador vitalício é liberado automaticamente.
      </p>

      {user ? (
        <PurchaseStatus />
      ) : (
        <div className="flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link to="/auth" search={{ mode: "signup" }}>
              Criar minha conta
            </Link>
          </Button>
          <Button asChild variant="secondary">
            <Link to="/auth" search={{ mode: "signin" }}>
              Já tenho conta
            </Link>
          </Button>
        </div>
      )}
    </main>
  );
}
