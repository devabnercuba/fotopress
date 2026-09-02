import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { format, parseISO } from "date-fns";
import { Copy, ExternalLink, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { publicOrigin } from "@/lib/app-url";
import { useCheckoutUrl } from "@/lib/billing";
import {
  getKiwifyOverview,
  getKiwifyWebhookDiagnostic,
  listKiwifyEvents,
  listPurchaseLinkTrail,
  reprocessKiwifyEvent,
  saveKiwifySettings,
  saveKiwifyToken,
  searchAppUsers,
  testKiwifyWebhook,
  type BillingEventRow,
  type KiwifySettingsInput,
  type PurchaseLinkTrailRow,
  type WebhookTestResult,
} from "@/lib/kiwify.functions";

/**
 * Integração Kiwify (somente administrador master).
 * O token do webhook nunca é lido pelo navegador: o painel só recebe o status.
 */

const RESULT_LABEL: Record<string, { dot: string; label: string }> = {
  processed: { dot: "🟢", label: "Processado" },
  pending_link: { dot: "🟡", label: "Aguardando vinculação" },
  pending_payment: { dot: "🟡", label: "Aguardando confirmação" },
  error: { dot: "🔴", label: "Erro" },
  ignored: { dot: "⚪", label: "Ignorado" },
  duplicate: { dot: "⚪", label: "Duplicado" },
  test_event: { dot: "⚪", label: "Evento de teste" },
};

function resultInfo(result: string) {
  return RESULT_LABEL[result] ?? { dot: "⚪", label: result };
}

function Status({ ok, warn, children }: { ok: boolean; warn?: boolean; children: string }) {
  const dot = ok ? "🟢" : warn ? "🟡" : "🔴";
  return (
    <div className="flex items-center gap-2 text-sm">
      <span aria-hidden>{dot}</span>
      <span className={ok ? "" : "text-muted-foreground"}>{children}</span>
    </div>
  );
}

function copy(value: string, message: string) {
  void navigator.clipboard.writeText(value);
  toast.success(message);
}

/** Último POST externo AUTENTICADO enviado pela Kiwify. */
function WebhookDiagnosticCard() {
  const load = useServerFn(getKiwifyWebhookDiagnostic);
  const { data, isFetching, refetch } = useQuery({
    queryKey: ["kiwify-webhook-diagnostic"],
    queryFn: () => load({}),
    refetchInterval: 15000,
  });

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">Webhook Kiwify</h3>
        <Button size="sm" variant="secondary" disabled={isFetching} onClick={() => void refetch()}>
          <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} /> Atualizar
        </Button>
      </div>
      {data ? (
        <>
          <div className="flex items-center gap-2 text-sm">
            <span aria-hidden>🟢</span>
            <span>Webhook Kiwify autenticado recebido</span>
          </div>
          <dl className="grid gap-2 text-xs sm:grid-cols-6">
            {(
              [
                ["Data", format(parseISO(data.received_at), "dd/MM/yyyy")],
                ["Hora", format(parseISO(data.received_at), "HH:mm:ss")],
                ["Evento", data.event ?? "—"],
                ["Teste", data.is_test ? "sim" : "não"],
                ["Content-Type", data.content_type ?? "—"],
                ["Payload", `${data.body_size ?? 0} bytes`],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className="rounded-md bg-surface px-2 py-1.5">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted-foreground">
            Último POST autenticado recebido da Kiwify ({data.method}).
            {data.note ? ` ${data.note}.` : ""}
          </p>
        </>
      ) : (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span aria-hidden>🟡</span>
          <span>Nenhum webhook autenticado da Kiwify recebido ainda.</span>
        </div>
      )}
    </div>
  );
}

function LinkPurchaseDialog({
  event,
  onClose,
}: {
  event: BillingEventRow | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const search = useServerFn(searchAppUsers);
  const reprocess = useServerFn(reprocessKiwifyEvent);
  const [term, setTerm] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (event) {
      setTerm(event.buyer_email ?? "");
      setSelected(null);
    }
  }, [event]);

  const { data: users = [] } = useQuery({
    enabled: !!event,
    queryKey: ["kiwify-users", term],
    queryFn: () => search({ data: { term } }),
  });

  const link = useMutation({
    mutationFn: async () => {
      if (!event || !selected) return;
      return reprocess({ data: { eventId: event.id, userId: selected } });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kiwify-events"] });
      qc.invalidateQueries({ queryKey: ["kiwify-overview"] });
      toast.success("Compra vinculada e acesso liberado.");
      onClose();
    },
    onError: () => toast.error("Não foi possível vincular a compra."),
  });

  return (
    <Dialog open={!!event} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Vincular compra a um usuário</DialogTitle>
          <DialogDescription>
            {event?.buyer_email ?? "—"} · {event?.transaction_id ?? "—"}
          </DialogDescription>
        </DialogHeader>
        <Input
          placeholder="Buscar por nome ou e-mail"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
        />
        <ul className="max-h-64 space-y-1 overflow-auto">
          {users.map((u) => (
            <li key={u.userId}>
              <button
                type="button"
                onClick={() => setSelected(u.userId)}
                className={`w-full rounded-md border px-3 py-2 text-left text-sm ${
                  selected === u.userId ? "border-primary" : "border-border"
                }`}
              >
                <div className="font-medium">{u.name || "Sem nome"}</div>
                <div className="text-xs text-muted-foreground">{u.email}</div>
              </button>
            </li>
          ))}
        </ul>
        <Button disabled={!selected || link.isPending} onClick={() => link.mutate()}>
          Vincular e liberar acesso
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function EventDetailDialog({
  event,
  onClose,
  onLink,
}: {
  event: BillingEventRow | null;
  onClose: () => void;
  onLink: (event: BillingEventRow) => void;
}) {
  const qc = useQueryClient();
  const reprocess = useServerFn(reprocessKiwifyEvent);
  const run = useMutation({
    mutationFn: async () => {
      if (!event) return;
      return reprocess({ data: { eventId: event.id } });
    },
    onSuccess: (outcome) => {
      qc.invalidateQueries({ queryKey: ["kiwify-events"] });
      qc.invalidateQueries({ queryKey: ["kiwify-overview"] });
      toast.success(
        outcome?.result === "duplicate"
          ? "Evento já havia sido processado — nada foi duplicado."
          : "Evento reprocessado.",
      );
    },
    onError: () => toast.error("Falha ao reprocessar o evento."),
  });

  if (!event) return null;
  const rows: [string, string][] = [
    ["ID do evento", event.provider_event_id ?? "—"],
    ["Evento", event.event],
    ["Data", format(parseISO(event.created_at), "dd/MM/yyyy HH:mm")],
    ["Comprador", event.buyer_name ?? "—"],
    ["E-mail", event.buyer_email ?? "—"],
    ["Produto", event.product_id ?? "—"],
    ["Referência da oferta", event.offer_id ?? "—"],
    ["Transação", event.transaction_id ?? "—"],
    ["Status da compra", event.status ?? "—"],
    ["Usuário vinculado", event.user_id ?? "—"],
    ["Resultado", `${resultInfo(event.result).dot} ${resultInfo(event.result).label}`],
    ["Observação", event.note ?? "—"],
    ["Motivo do erro", event.error_reason ?? "—"],
    ["Vinculação manual", event.linked_manually ? "Sim" : "Não"],
  ];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Detalhe do evento</DialogTitle>
          <DialogDescription>Dados registrados pelo webhook da Kiwify.</DialogDescription>
        </DialogHeader>
        <dl className="grid gap-1.5 text-sm">
          {rows.map(([k, v]) => (
            <div key={k} className="grid grid-cols-[160px_minmax(0,1fr)] gap-2">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="break-words">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" disabled={run.isPending} onClick={() => run.mutate()}>
            <RefreshCw className="size-4" /> Reprocessar
          </Button>
          {event.result === "pending_link" && (
            <Button onClick={() => onLink(event)}>Vincular usuário</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Trilha de auditoria de vinculação — quando cada compra aprovada virou acesso,
 * com e-mail da compra, e-mail da conta e carimbos de tempo de cada etapa.
 */
function PurchaseTrailCard() {
  const trailFn = useServerFn(listPurchaseLinkTrail);
  const {
    data: rows = [],
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["kiwify-link-trail"],
    queryFn: () => trailFn(),
  });

  const when = (value: string | null) => {
    if (!value) return "—";
    try {
      return format(parseISO(value), "dd/MM/yyyy HH:mm:ss");
    } catch {
      return "—";
    }
  };

  return (
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">Trilha de vinculação</h3>
          <p className="text-xs text-muted-foreground">
            Cada compra aprovada real, o e-mail usado e quando o acesso foi liberado.
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {(rows as PurchaseLinkTrailRow[]).length === 0 ? (
        <p className="text-xs text-muted-foreground">Nenhuma compra aprovada registrada ainda.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface text-muted-foreground">
              <tr>
                {[
                  "E-mail da compra",
                  "Conta vinculada",
                  "Transação",
                  "Recebido em",
                  "Vinculado em",
                  "Acesso ativo em",
                  "Situação",
                ].map((h) => (
                  <th key={h} className="px-3 py-2 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(rows as PurchaseLinkTrailRow[]).map((r) => {
                const info = resultInfo(r.result);
                return (
                  <tr key={r.id}>
                    <td className="px-3 py-2">{r.buyer_email ?? "—"}</td>
                    <td className="px-3 py-2">
                      {r.account_email ?? (r.user_id ? r.user_id : "não vinculada")}
                      {r.linked_manually && (
                        <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                          manual
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">{r.transaction_id ?? "—"}</td>
                    <td className="px-3 py-2">{when(r.received_at)}</td>
                    <td className="px-3 py-2">{when(r.linked_at)}</td>
                    <td className="px-3 py-2">{when(r.access_activated_at)}</td>
                    <td className="px-3 py-2">
                      {info.dot} {info.label}
                      {r.error_reason && (
                        <div className="text-[11px] text-destructive">{r.error_reason}</div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** Diagnóstico temporário: mostra como a URL de checkout é montada para o admin logado. */
function CheckoutDiagnosticCard() {
  const { url, baseUrl, email, isLoading, authenticated } = useCheckoutUrl();
  const parsedEmail = (() => {
    if (!url) return null;
    try {
      return new URL(url).searchParams.get("email");
    } catch {
      return null;
    }
  })();

  return (
    <div className="space-y-2 rounded-lg border border-border p-4 text-xs">
      <div className="text-sm font-medium">Diagnóstico do Checkout</div>
      <dl className="grid gap-2 sm:grid-cols-2">
        <div>
          <dt className="text-muted-foreground">Usuário autenticado</dt>
          <dd className="font-medium">
            {isLoading ? "carregando…" : authenticated ? "sim" : "não"}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">E-mail autenticado</dt>
          <dd className="font-medium break-all">{email ?? "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Checkout base</dt>
          <dd className="font-mono break-all">{baseUrl ?? "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">Checkout final</dt>
          <dd className="font-mono break-all">{url ?? "—"}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-muted-foreground">email na URL final</dt>
          <dd className="font-medium break-all">{parsedEmail ?? "—"}</dd>
        </div>
      </dl>
      <Button
        size="sm"
        variant="outline"
        disabled={!url}
        onClick={() => {
          if (!url) return;
          void navigator.clipboard.writeText(url);
          toast.success("URL final copiada");
        }}
      >
        <Copy className="size-3.5" /> Copiar URL final
      </Button>
    </div>
  );
}

export function KiwifySettings() {
  const qc = useQueryClient();
  const overviewFn = useServerFn(getKiwifyOverview);
  const saveSettingsFn = useServerFn(saveKiwifySettings);
  const saveTokenFn = useServerFn(saveKiwifyToken);
  const listEventsFn = useServerFn(listKiwifyEvents);
  const testFn = useServerFn(testKiwifyWebhook);

  const { data: overview } = useQuery({
    queryKey: ["kiwify-overview"],
    queryFn: () => overviewFn(),
  });

  const [form, setForm] = useState<KiwifySettingsInput | null>(null);
  const [token, setToken] = useState("");
  const [filters, setFilters] = useState({
    event: "",
    result: "",
    email: "",
    transaction: "",
    scope: "real" as "real" | "test" | "all",
  });
  const [detail, setDetail] = useState<BillingEventRow | null>(null);
  const [linking, setLinking] = useState<BillingEventRow | null>(null);
  const [test, setTest] = useState<WebhookTestResult | null>(null);

  useEffect(() => {
    if (overview && !form) {
      const { environment: _env, ...rest } = overview.settings;
      setForm(rest);
    }
  }, [overview, form]);

  const { data: events = [] } = useQuery({
    queryKey: ["kiwify-events", filters],
    queryFn: () =>
      listEventsFn({
        data: {
          event: filters.event || null,
          result: filters.result || null,
          email: filters.email || null,
          transaction: filters.transaction || null,
          scope: filters.scope,
        },
      }),
  });

  const webhookUrl = useMemo(() => `${publicOrigin()}/api/public/kiwify`, []);

  const saveSettings = useMutation({
    mutationFn: (patch: KiwifySettingsInput) => saveSettingsFn({ data: patch }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kiwify-overview"] });
      qc.invalidateQueries({ queryKey: ["checkout-config"] });
      toast.success("Configuração da Kiwify salva.");
    },
    onError: () => toast.error("Não foi possível salvar a configuração."),
  });

  const saveToken = useMutation({
    mutationFn: (value: string) => saveTokenFn({ data: { token: value } }),
    onSuccess: () => {
      setToken("");
      qc.invalidateQueries({ queryKey: ["kiwify-overview"] });
      toast.success("Token do webhook atualizado no servidor.");
    },
    onError: () => toast.error("Token inválido ou não salvo."),
  });

  const runTest = useMutation({
    mutationFn: () => testFn({ data: { origin: window.location.origin } }),
    onSuccess: (result) => setTest(result),
    onError: () => toast.error("Não foi possível executar o teste."),
  });

  if (!form || !overview) return null;

  const eventNames = Array.from(new Set(events.map((e) => e.event)));

  return (
    <section className="space-y-5 rounded-xl border border-border bg-card p-5">
      <header>
        <h2 className="text-base font-medium">Integração Kiwify</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          A Kiwify cuida do checkout. O FotoPress valida o webhook e libera ou revoga o Acesso
          Fundador automaticamente.
        </p>
      </header>

      <CheckoutDiagnosticCard />

      {/* Status */}
      <div className="grid gap-2 rounded-lg border border-border p-4 sm:grid-cols-2">
        <Status ok={!!overview.settings.checkout_url}>
          {overview.settings.checkout_url ? "Checkout configurado" : "Checkout não configurado"}
        </Status>
        <Status ok={overview.productIdValid} warn>
          {overview.productIdValid
            ? `Product ID configurado (${overview.settings.product_id})`
            : "Product ID inválido ou não configurado — o webhook não liberará acesso"}
        </Status>
        <Status ok={overview.tokenConfigured}>
          {overview.tokenConfigured
            ? `Token configurado (${overview.tokenSource})`
            : "Token não configurado"}
        </Status>
        <Status ok>Endpoint online (/api/public/kiwify)</Status>
        <Status ok={!!overview.lastAuthenticatedWebhook} warn>
          {overview.lastAuthenticatedWebhook
            ? `Webhook Kiwify autenticado recebido · ${overview.lastAuthenticatedWebhook.event ?? "—"} em ${format(parseISO(overview.lastAuthenticatedWebhook.received_at), "dd/MM/yyyy HH:mm")}`
            : "Nenhum webhook autenticado da Kiwify recebido ainda"}
        </Status>
        <Status ok={!!overview.lastExternalEvent} warn>
          {overview.lastExternalEvent
            ? `Evento comercial real · ${overview.lastExternalEvent.event} em ${format(parseISO(overview.lastExternalEvent.created_at), "dd/MM/yyyy HH:mm")}`
            : "Nenhum evento comercial real recebido ainda"}
        </Status>
        <Status ok={overview.mode === "PRODUÇÃO"} warn>
          {overview.mode === "PRODUÇÃO"
            ? "Modo: PRODUÇÃO"
            : "Configuração pendente — integração incompleta"}
        </Status>
      </div>

      {/* Produto */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Produto</h3>
        <div className="rounded-lg border border-dashed border-border p-3 text-xs text-muted-foreground">
          <div>
            <span className="font-medium text-foreground">
              {form.product_name || "FotoPress — Acesso Fundador"}
            </span>{" "}
            · {form.offer_name || "Pagamento único"}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="k-product">Product ID (Kiwify)</Label>
            <Input
              id="k-product"
              placeholder="Copie do painel da Kiwify"
              value={form.product_id ?? ""}
              onChange={(e) => setForm({ ...form, product_id: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="k-offer">Referência da oferta (order_ref)</Label>
            <Input
              id="k-offer"
              placeholder="Vazio aceita qualquer oferta do produto"
              value={form.offer_id ?? ""}
              onChange={(e) => setForm({ ...form, offer_id: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="k-pname">Nome do produto</Label>
            <Input
              id="k-pname"
              value={form.product_name ?? ""}
              onChange={(e) => setForm({ ...form, product_name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="k-oname">Tipo / oferta</Label>
            <Input
              id="k-oname"
              value={form.offer_name ?? ""}
              onChange={(e) => setForm({ ...form, offer_name: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="k-price">Preço (R$)</Label>
            <Input
              id="k-price"
              inputMode="decimal"
              value={form.price_cents != null ? (form.price_cents / 100).toFixed(2) : ""}
              onChange={(e) => {
                const value = Number(e.target.value.replace(",", "."));
                setForm({
                  ...form,
                  price_cents:
                    Number.isFinite(value) && e.target.value ? Math.round(value * 100) : null,
                });
              }}
            />
          </div>
        </div>
      </div>

      {/* Checkout */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Checkout</h3>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[260px] flex-1 space-y-1.5">
            <Label htmlFor="k-url">URL do checkout</Label>
            <Input
              id="k-url"
              placeholder="https://pay.kiwify.com.br/..."
              value={form.checkout_url ?? ""}
              onChange={(e) => setForm({ ...form, checkout_url: e.target.value })}
            />
          </div>
          <Button
            variant="secondary"
            disabled={!form.checkout_url}
            onClick={() => window.open(form.checkout_url!, "_blank", "noopener")}
          >
            <ExternalLink className="size-4" /> Abrir checkout
          </Button>
          <Button
            variant="secondary"
            disabled={!form.checkout_url}
            onClick={() => copy(form.checkout_url!, "Checkout copiado.")}
          >
            <Copy className="size-4" /> Copiar checkout
          </Button>
        </div>
        <Button
          size="sm"
          disabled={saveSettings.isPending}
          onClick={() => saveSettings.mutate(form)}
        >
          {saveSettings.isPending ? "Salvando…" : "Salvar configuração"}
        </Button>
      </div>

      <WebhookDiagnosticCard />

      {/* Webhook */}

      <div className="space-y-3">
        <h3 className="text-sm font-medium">Webhook</h3>
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border p-3 text-xs">
          <code className="rounded bg-surface px-1.5 py-1">{webhookUrl}</code>
          <Button size="sm" variant="secondary" onClick={() => copy(webhookUrl, "URL copiada.")}>
            <Copy className="size-4" /> Copiar URL
          </Button>
          <span className="text-muted-foreground">
            Cadastre esta URL em Apps → Webhooks na Kiwify, escolhendo o produto e os eventos compra
            aprovada, reembolso e chargeback.
          </span>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[260px] flex-1 space-y-1.5">
            <Label htmlFor="k-token">Token do webhook</Label>
            <Input
              id="k-token"
              type="password"
              autoComplete="off"
              placeholder={
                overview.tokenConfigured ? "✓ Token configurado" : "⚠ Token não configurado"
              }
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>
          <Button
            variant="secondary"
            disabled={token.trim().length < 8 || saveToken.isPending}
            onClick={() => saveToken.mutate(token.trim())}
          >
            Salvar token
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          O token é gravado apenas no servidor e nunca é devolvido para o navegador.
        </p>
        <Button
          variant="secondary"
          size="sm"
          disabled={runTest.isPending}
          onClick={() => runTest.mutate()}
        >
          {runTest.isPending ? "Verificando…" : "Diagnóstico Interno"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Verifica a configuração do FotoPress sem simular uma venda real.
        </p>
      </div>

      {/* Vendas */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Vendas Kiwify</h3>
        <p className="text-xs text-muted-foreground">
          Indicadores consideram apenas eventos reais — disparos de teste são contabilizados à
          parte.
        </p>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Fundadores ativos", overview.summary.founders],
            ["Compras aprovadas", overview.summary.approved],
            ["Compras pendentes", overview.summary.pendingLink + overview.summary.pendingPayment],
            ["Reembolsos", overview.summary.refunds],
            ["Chargebacks", overview.summary.chargebacks],
            ["Eventos de teste", overview.summary.testEvents],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg border border-border p-3">
              <div className="text-[11px] text-muted-foreground">{label}</div>
              <div className="mt-0.5 text-xl font-semibold">{value}</div>
            </div>
          ))}
        </div>
        {overview.lastSale && (
          <div className="rounded-lg border border-border p-3 text-xs">
            <span className="font-medium">Última venda:</span> {overview.lastSale.buyer_name ?? "—"}{" "}
            · {overview.lastSale.buyer_email ?? "—"} ·{" "}
            {format(parseISO(overview.lastSale.created_at), "dd/MM/yyyy HH:mm")} ·{" "}
            {overview.lastSale.product ?? "—"} · {overview.lastSale.transaction_id ?? "—"} ·{" "}
            {overview.lastSale.status ?? "—"}
          </div>
        )}
      </div>

      {/* Eventos */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Eventos Kiwify</h3>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="w-[200px]"
            placeholder="E-mail"
            value={filters.email}
            onChange={(e) => setFilters({ ...filters, email: e.target.value })}
          />
          <Input
            className="w-[180px]"
            placeholder="Transação"
            value={filters.transaction}
            onChange={(e) => setFilters({ ...filters, transaction: e.target.value })}
          />
          <Select
            value={filters.event || "all"}
            onValueChange={(v) => setFilters({ ...filters, event: v === "all" ? "" : v })}
          >
            <SelectTrigger className="w-[200px]" aria-label="Filtrar evento">
              <SelectValue placeholder="Evento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os eventos</SelectItem>
              {eventNames.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.result || "all"}
            onValueChange={(v) => setFilters({ ...filters, result: v === "all" ? "" : v })}
          >
            <SelectTrigger className="w-[200px]" aria-label="Filtrar resultado">
              <SelectValue placeholder="Resultado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os resultados</SelectItem>
              {Object.entries(RESULT_LABEL).map(([value, info]) => (
                <SelectItem key={value} value={value}>
                  {info.dot} {info.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.scope}
            onValueChange={(v) => setFilters({ ...filters, scope: v as "real" | "test" | "all" })}
          >
            <SelectTrigger className="w-[180px]" aria-label="Filtrar origem">
              <SelectValue placeholder="Origem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="real">Somente reais</SelectItem>
              <SelectItem value="test">Somente testes</SelectItem>
              <SelectItem value="all">Reais + testes</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum evento recebido ainda.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface text-muted-foreground">
                <tr>
                  {["Data", "Evento", "Comprador", "Produto", "Transação", "Resultado", ""].map(
                    (h) => (
                      <th key={h} className="px-3 py-2 font-medium">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {events.map((e) => {
                  const info = resultInfo(e.result);
                  return (
                    <tr key={e.id} className="border-t border-border">
                      <td className="px-3 py-2">
                        {format(parseISO(e.created_at), "dd/MM/yyyy HH:mm")}
                      </td>
                      <td className="px-3 py-2">
                        {e.event}
                        <span
                          className={`ml-1.5 rounded px-1.5 py-0.5 text-[10px] uppercase ${
                            e.is_test
                              ? "bg-muted text-muted-foreground"
                              : "bg-primary/10 text-primary"
                          }`}
                        >
                          {e.is_test ? "teste" : "real"}
                        </span>
                      </td>

                      <td className="px-3 py-2">{e.buyer_email ?? "—"}</td>
                      <td className="px-3 py-2">{e.product_id ?? "—"}</td>
                      <td className="px-3 py-2">{e.transaction_id ?? "—"}</td>
                      <td className="px-3 py-2">
                        {info.dot} {info.label}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setDetail(e)}>
                            Detalhes
                          </Button>
                          {e.result === "pending_link" && (
                            <Button size="sm" variant="secondary" onClick={() => setLinking(e)}>
                              Vincular
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <PurchaseTrailCard />

      <EventDetailDialog
        event={detail}
        onClose={() => setDetail(null)}
        onLink={(e) => {
          setDetail(null);
          setLinking(e);
        }}
      />
      <LinkPurchaseDialog event={linking} onClose={() => setLinking(null)} />

      <Dialog open={!!test} onOpenChange={(open) => !open && setTest(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Diagnóstico Interno</DialogTitle>
            <DialogDescription>
              Verifica a configuração do FotoPress sem simular uma venda real — nenhum acesso,
              venda, reembolso ou chargeback é registrado.
            </DialogDescription>
          </DialogHeader>

          <ul className="space-y-2 text-sm">
            {test?.checks.map((c) => (
              <li key={c.label} className="rounded-md border border-border p-2.5">
                <div className="font-medium">
                  {c.ok ? "🟢" : "🔴"} {c.label}
                </div>
                <div className="text-xs text-muted-foreground">{c.detail}</div>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </section>
  );
}
