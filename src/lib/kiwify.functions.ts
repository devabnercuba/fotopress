import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Integração Kiwify — funções administrativas.
 * Todas exigem o administrador master (verificado no banco a cada chamada).
 * O token do webhook nunca é devolvido ao navegador: só o status.
 */

export type KiwifySettingsInput = {
  product_id: string | null;
  offer_id: string | null;
  product_name: string | null;
  offer_name: string | null;
  price_cents: number | null;
  checkout_url: string | null;
};

export type KiwifyOverview = {
  settings: KiwifySettingsInput & { environment: string | null };
  tokenConfigured: boolean;
  tokenSource: "banco" | "ambiente" | null;
  productIdValid: boolean;
  checkoutConfigured: boolean;
  mode: "PRODUÇÃO" | "CONFIGURAÇÃO PENDENTE";
  /** Último POST externo AUTENTICADO da Kiwify (inclui disparos de teste da própria Kiwify). */
  lastAuthenticatedWebhook: {
    received_at: string;
    event: string | null;
    is_test: boolean;
    note: string | null;
  } | null;
  /** Último evento comercial real (ignora eventos de teste). */
  lastExternalEvent: {
    event: string;
    raw_event: string | null;
    created_at: string;
    result: string;
    buyer_email: string | null;
    buyer_name: string | null;
    product_name: string | null;
  } | null;
  lastSale: {
    buyer_name: string | null;
    buyer_email: string | null;
    created_at: string;
    transaction_id: string | null;
    status: string | null;
    product: string | null;
    amount_cents: number | null;
  } | null;
  summary: {
    buyers: number;
    founders: number;
    approved: number;
    refunds: number;
    chargebacks: number;
    pendingLink: number;
    pendingPayment: number;
    errors: number;
    totalEvents: number;
    testEvents: number;
  };
};

export type BillingEventRow = {
  id: string;
  created_at: string;
  event: string;
  event_version: string | null;
  provider_event_id: string | null;
  buyer_email: string | null;
  buyer_name: string | null;
  product_id: string | null;
  offer_id: string | null;
  transaction_id: string | null;
  status: string | null;
  result: string;
  note: string | null;
  error_reason: string | null;
  linked_manually: boolean;
  user_id: string | null;
  processed_at: string | null;
  is_test: boolean;
  amount_cents: number | null;
  currency: string | null;
};

type MasterContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
};

async function assertMaster(context: MasterContext) {
  const { data, error } = await context.supabase.rpc("is_master_admin", {
    _user_id: context.userId,
  });
  if (error) throw error;
  if (data !== true) throw new Response("Forbidden", { status: 403 });
}

export const getKiwifyOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<KiwifyOverview> => {
    await assertMaster(context);
    const { loadKiwifySettings, PROVIDER } = await import("@/lib/kiwify/service.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const settings = await loadKiwifySettings();

    const { data: secretRow } = await supabaseAdmin
      .from("billing_secrets")
      .select("webhook_token")
      .eq("provider", PROVIDER)
      .maybeSingle();
    const storedToken = (secretRow?.webhook_token ?? "").trim();
    const envToken = (process.env["KIWIFY_WEBHOOK_TOKEN"] ?? "").trim();

    // Comunicação real da Kiwify: último POST externo autenticado (teste ou não).
    const { data: authPing } = await supabaseAdmin
      .from("webhook_diagnostics")
      .select("received_at, event, is_test, note")
      .eq("provider", PROVIDER)
      .eq("authenticated", true)
      .maybeSingle();

    // Último evento comercial real — eventos de teste ficam fora.
    const { data: lastExternal } = await supabaseAdmin
      .from("billing_events")
      .select("event, event_version, created_at, result, buyer_email, buyer_name")
      .eq("provider", PROVIDER)
      .eq("is_test", false)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: lastSale } = await supabaseAdmin
      .from("billing_events")
      .select(
        "buyer_name, buyer_email, created_at, transaction_id, status, product_id, amount_cents",
      )
      .eq("provider", PROVIDER)
      .eq("is_test", false)
      .eq("result", "processed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    /** Métricas comerciais consideram somente eventos reais (is_test = false). */
    const countEvents = async (filter?: { result?: string; event?: string; test?: boolean }) => {
      let query = supabaseAdmin
        .from("billing_events")
        .select("id", { count: "exact", head: true })
        .eq("provider", PROVIDER)
        .eq("is_test", filter?.test ?? false);
      if (filter?.result) query = query.eq("result", filter.result);
      if (filter?.event) query = query.eq("event", filter.event);
      const { count: total } = await query;
      return total ?? 0;
    };

    const [
      pendingLink,
      pendingPayment,
      errors,
      totalEvents,
      approved,
      refunds,
      chargebacks,
      testEvents,
    ] = await Promise.all([
      countEvents({ result: "pending_link" }),
      countEvents({ result: "pending_payment" }),
      countEvents({ result: "error" }),
      countEvents(),
      countEvents({ event: "purchase_approved", result: "processed" }),
      countEvents({ event: "purchase_refunded" }),
      countEvents({ event: "chargeback" }),
      countEvents({ test: true }),
    ]);

    const accessBase = () =>
      supabaseAdmin.from("user_access").select("id", { count: "exact", head: true });

    const [founders, buyers] = await Promise.all([
      accessBase().eq("access_type", "founder").eq("access_status", "active"),
      accessBase().eq("source", PROVIDER),
    ]).then((rows) => rows.map((r) => r.count ?? 0));

    const productId = (settings.product_id ?? "").trim();
    const productIdValid = productId.length > 0 && !productId.includes("@");
    const tokenConfigured = Boolean(storedToken || envToken);
    const checkoutConfigured = Boolean((settings.checkout_url ?? "").trim());

    return {
      settings: {
        product_id: settings.product_id,
        offer_id: settings.offer_id,
        product_name: settings.product_name,
        offer_name: settings.offer_name,
        price_cents: settings.price_cents,
        checkout_url: settings.checkout_url,
        environment: settings.environment,
      },
      tokenConfigured,
      tokenSource: storedToken ? "banco" : envToken ? "ambiente" : null,
      productIdValid,
      checkoutConfigured,
      mode:
        productIdValid && tokenConfigured && checkoutConfigured
          ? "PRODUÇÃO"
          : "CONFIGURAÇÃO PENDENTE",
      lastAuthenticatedWebhook: authPing
        ? {
            received_at: authPing.received_at,
            event: authPing.event,
            is_test: authPing.is_test,
            note: authPing.note,
          }
        : null,
      lastExternalEvent: lastExternal
        ? {
            event: lastExternal.event,
            raw_event: lastExternal.event_version,
            created_at: lastExternal.created_at,
            result: lastExternal.result,
            buyer_email: lastExternal.buyer_email,
            buyer_name: lastExternal.buyer_name,
            product_name: settings.product_name,
          }
        : null,
      lastSale: lastSale
        ? {
            buyer_name: lastSale.buyer_name,
            buyer_email: lastSale.buyer_email,
            created_at: lastSale.created_at,
            transaction_id: lastSale.transaction_id,
            status: lastSale.status,
            product: settings.product_name ?? lastSale.product_id,
            amount_cents: lastSale.amount_cents,
          }
        : null,
      summary: {
        buyers,
        founders,
        approved,
        refunds,
        chargebacks,
        pendingLink,
        pendingPayment,
        errors,
        totalEvents,
        testEvents,
      },
    };
  });

export const saveKiwifySettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: KiwifySettingsInput) => input)
  .handler(async ({ data, context }) => {
    await assertMaster(context);
    const { recordAudit, PROVIDER } = await import("@/lib/kiwify/service.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const patch = {
      provider: PROVIDER,
      product_id: data.product_id?.trim() || null,
      offer_id: data.offer_id?.trim() || null,
      product_name: data.product_name?.trim() || null,
      offer_name: data.offer_name?.trim() || null,
      price_cents: data.price_cents ?? null,
      checkout_url: data.checkout_url?.trim() || null,
    };

    const { data: existing } = await supabaseAdmin
      .from("billing_settings")
      .select("id")
      .eq("provider", PROVIDER)
      .maybeSingle();

    if (existing) {
      const { error } = await supabaseAdmin
        .from("billing_settings")
        .update(patch)
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabaseAdmin.from("billing_settings").insert(patch);
      if (error) throw error;
    }

    await recordAudit(
      context.userId,
      (context.claims as { email?: string } | null)?.email ?? null,
      "kiwify_settings_updated",
      patch,
    );
    return { ok: true };
  });

export const saveKiwifyToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { token: string }) => {
    const token = input.token.trim();
    if (token.length < 8) throw new Error("Token muito curto.");
    return { token };
  })
  .handler(async ({ data, context }) => {
    await assertMaster(context);
    const { saveWebhookToken, recordAudit } = await import("@/lib/kiwify/service.server");
    await saveWebhookToken(data.token, context.userId);
    await recordAudit(
      context.userId,
      (context.claims as { email?: string } | null)?.email ?? null,
      "kiwify_token_updated",
      { length: data.token.length },
    );
    return { ok: true };
  });

export type WebhookDiagnostic = {
  received_at: string;
  method: string;
  content_type: string | null;
  body_size: number | null;
  token_present: boolean;
  authenticated: boolean;
  event: string | null;
  is_test: boolean;
  note: string | null;
} | null;

/** Último POST EXTERNO autenticado da Kiwify (metadados apenas, nunca o token). */
export const getKiwifyWebhookDiagnostic = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WebhookDiagnostic> => {
    await assertMaster(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("webhook_diagnostics")
      .select(
        "received_at, method, content_type, body_size, token_present, authenticated, event, is_test, note",
      )
      .eq("provider", "kiwify")
      .eq("authenticated", true)
      .maybeSingle();
    return data ?? null;
  });

export type EventFilters = {
  event?: string | null;
  result?: string | null;
  email?: string | null;
  transaction?: string | null;
  from?: string | null;
  to?: string | null;
  /** real = webhooks externos, test = disparos de teste, all = tudo. */
  scope?: "real" | "test" | "all" | null;
};

export const listKiwifyEvents = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: EventFilters) => input)
  .handler(async ({ data, context }): Promise<BillingEventRow[]> => {
    await assertMaster(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { PROVIDER } = await import("@/lib/kiwify/service.server");

    let query = supabaseAdmin
      .from("billing_events")
      .select(
        "id, created_at, event, event_version, provider_event_id, buyer_email, buyer_name, product_id, offer_id, transaction_id, status, result, note, error_reason, linked_manually, user_id, processed_at, is_test, amount_cents, currency",
      )
      .eq("provider", PROVIDER)
      .order("created_at", { ascending: false })
      .limit(200);

    const scope = data.scope ?? "real";
    if (scope === "real") query = query.eq("is_test", false);
    if (scope === "test") query = query.eq("is_test", true);
    if (data.event) query = query.eq("event", data.event);
    if (data.result) query = query.eq("result", data.result);
    if (data.email) query = query.ilike("buyer_email", `%${data.email}%`);
    if (data.transaction) query = query.ilike("transaction_id", `%${data.transaction}%`);
    if (data.from) query = query.gte("created_at", data.from);
    if (data.to) query = query.lte("created_at", data.to);

    const { data: rows, error } = await query;
    if (error) throw error;
    return (rows ?? []) as BillingEventRow[];
  });

export const reprocessKiwifyEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { eventId: string; userId?: string | null }) => input)
  .handler(async ({ data, context }) => {
    await assertMaster(context);
    const { processKiwifyEvent, recordAudit } = await import("@/lib/kiwify/service.server");
    const { parseKiwifyWebhook } = await import("@/lib/kiwify/parse");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row, error } = await supabaseAdmin
      .from("billing_events")
      .select("id, payload, result")
      .eq("id", data.eventId)
      .maybeSingle();
    if (error) throw error;
    if (!row) throw new Error("Evento não encontrado.");
    if (row.result === "processed" && !data.userId) {
      return {
        result: "duplicate" as const,
        note: "evento já processado",
        userId: null,
        eventId: row.id,
      };
    }

    const parsed = parseKiwifyWebhook(row.payload);
    const outcome = await processKiwifyEvent({
      parsed,
      payload: row.payload,
      existingEventRowId: row.id,
      forceUserId: data.userId ?? null,
      linkedManually: Boolean(data.userId),
    });

    await recordAudit(
      context.userId,
      (context.claims as { email?: string } | null)?.email ?? null,
      data.userId ? "kiwify_purchase_linked" : "kiwify_event_reprocessed",
      { eventId: data.eventId, userId: data.userId ?? null, result: outcome.result },
    );

    return outcome;
  });

export const searchAppUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { term: string }) => input)
  .handler(async ({ data, context }) => {
    await assertMaster(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const term = data.term.trim().toLowerCase();

    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("user_id, first_name, last_name, professional_name, email")
      .limit(200);
    if (error) throw error;

    return (profiles ?? [])
      .map((p) => ({
        userId: p.user_id,
        email: p.email ?? "",
        name:
          p.professional_name ||
          [p.first_name, p.last_name].filter(Boolean).join(" ") ||
          (p.email ?? ""),
      }))
      .filter((u) => !term || `${u.name} ${u.email}`.toLowerCase().includes(term))
      .slice(0, 20);
  });

export type WebhookTestResult = {
  checks: { label: string; ok: boolean; detail: string }[];
  ok: boolean;
};

export const testKiwifyWebhook = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { origin: string }) => input)
  .handler(async ({ data, context }): Promise<WebhookTestResult> => {
    await assertMaster(context);
    const { loadKiwifySettings, loadWebhookToken, processKiwifyEvent } =
      await import("@/lib/kiwify/service.server");
    const { parseKiwifyWebhook } = await import("@/lib/kiwify/parse");

    const checks: WebhookTestResult["checks"] = [];

    const token = await loadWebhookToken();
    checks.push({
      label: "Token do webhook",
      ok: Boolean(token),
      detail: token ? "Token configurado no servidor." : "Nenhum token configurado.",
    });

    const settings = await loadKiwifySettings();
    checks.push({
      label: "Produto configurado",
      ok: Boolean(settings.product_id) && !(settings.product_id ?? "").includes("@"),
      detail: settings.product_id
        ? `Product ID ${settings.product_id}`
        : "Product ID não configurado — qualquer produto seria aceito.",
    });

    checks.push({
      label: "Checkout",
      ok: Boolean((settings.checkout_url ?? "").trim()),
      detail: settings.checkout_url ?? "Checkout não configurado.",
    });

    // Banco: leitura simples na tabela de eventos (não grava nada).
    let dbOk = false;
    let dbDetail = "Não foi possível consultar o banco.";
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { error: dbError, count } = await supabaseAdmin
        .from("billing_events")
        .select("id", { count: "exact", head: true })
        .eq("provider", "kiwify");
      dbOk = !dbError;
      dbDetail = dbError
        ? dbError.message
        : `Banco acessível — ${count ?? 0} evento(s) registrados.`;
    } catch (err) {
      dbDetail = err instanceof Error ? err.message : dbDetail;
    }
    checks.push({ label: "Banco de dados", ok: dbOk, detail: dbDetail });

    // Endpoint acessível: GET de saúde (nenhum POST — não polui o diagnóstico da Kiwify).
    let endpointOk = false;
    let endpointDetail = "Não foi possível alcançar o endpoint.";
    try {
      const res = await fetch(`${data.origin.replace(/\/$/, "")}/api/public/kiwify`, {
        method: "GET",
        headers: { accept: "application/json" },
      });
      const body = (await res.json().catch(() => null)) as {
        status?: string;
        mode?: string;
      } | null;
      endpointOk = res.status === 200 && body?.status === "online";
      endpointDetail = endpointOk
        ? `Endpoint online (HTTP 200, modo ${body?.mode ?? "—"}).`
        : `Resposta inesperada: HTTP ${res.status}.`;
    } catch (err) {
      endpointDetail = err instanceof Error ? err.message : endpointDetail;
    }
    checks.push({ label: "Endpoint público", ok: endpointOk, detail: endpointDetail });

    // Parser + processamento em modo simulação (não altera acesso algum).
    const samplePayload = {
      order_id: `test-${Date.now()}`,
      order_ref: settings.offer_id ?? "8pYbV63",
      order_status: "paid",
      webhook_event_type: "order_approved",
      created_at: new Date().toISOString(),
      Product: {
        product_id: settings.product_id ?? "000000",
        product_name: settings.product_name ?? "FotoPress — Acesso Fundador",
      },
      Customer: { full_name: "Comprador de Teste", email: "teste@fotopress.local" },
    };
    const parsed = parseKiwifyWebhook(samplePayload);
    checks.push({
      label: "Parser (parseKiwifyWebhook)",
      ok: parsed.event === "purchase_approved" && parsed.buyerEmail.length > 0,
      detail: `Evento ${parsed.event}, produto ${parsed.productId ?? "—"}, transação ${parsed.transaction ?? "—"}.`,
    });

    const dry = await processKiwifyEvent({ parsed, payload: samplePayload, dryRun: true });
    checks.push({
      label: "Processamento (simulação)",
      ok: dry.result !== "error",
      detail: `${dry.note} — nenhum acesso foi alterado.`,
    });

    return { checks, ok: checks.every((c) => c.ok) };
  });

export type PurchaseLinkTrailRow = {
  id: string;
  buyer_email: string | null;
  buyer_name: string | null;
  transaction_id: string | null;
  result: string;
  note: string | null;
  error_reason: string | null;
  linked_manually: boolean;
  user_id: string | null;
  /** Quando a Kiwify entregou o purchase_approved. */
  received_at: string;
  /** Quando a compra foi efetivamente vinculada/processada. */
  linked_at: string | null;
  /** Quando o acesso fundador ficou ativo para a conta. */
  access_activated_at: string | null;
  account_email: string | null;
};

/**
 * Trilha de auditoria de vinculação: cada purchase_approved real, com e-mail da
 * compra, e-mail da conta vinculada e os carimbos de tempo de cada etapa.
 */
export const listPurchaseLinkTrail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PurchaseLinkTrailRow[]> => {
    await assertMaster(context);
    const { PROVIDER } = await import("@/lib/kiwify/service.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows, error } = await supabaseAdmin
      .from("billing_events")
      .select(
        "id, buyer_email, buyer_name, transaction_id, result, note, error_reason, linked_manually, user_id, created_at, processed_at",
      )
      .eq("provider", PROVIDER)
      .eq("event", "purchase_approved")
      .eq("is_test", false)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;

    const userIds = [...new Set((rows ?? []).map((r) => r.user_id).filter(Boolean))] as string[];
    const accessByUser = new Map<string, { activated_at: string | null; email: string | null }>();
    if (userIds.length) {
      const { data: access } = await supabaseAdmin
        .from("user_access")
        .select("user_id, activated_at, email")
        .in("user_id", userIds);
      for (const a of access ?? []) {
        accessByUser.set(a.user_id, { activated_at: a.activated_at, email: a.email });
      }
    }

    return (rows ?? []).map((r) => ({
      id: r.id,
      buyer_email: r.buyer_email,
      buyer_name: r.buyer_name,
      transaction_id: r.transaction_id,
      result: r.result,
      note: r.note,
      error_reason: r.error_reason,
      linked_manually: r.linked_manually,
      user_id: r.user_id,
      received_at: r.created_at,
      linked_at: r.processed_at,
      access_activated_at: r.user_id ? (accessByUser.get(r.user_id)?.activated_at ?? null) : null,
      account_email: r.user_id ? (accessByUser.get(r.user_id)?.email ?? null) : null,
    }));
  });
