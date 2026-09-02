import type { Json } from "@/integrations/supabase/types";

import { APPROVED_EVENT, PENDING_EVENT, REVOKE_EVENTS, type KiwifyEvent } from "./parse";
import { validateProduct, type KiwifyConfig } from "./validate";

/**
 * Kiwify — camada de serviço (somente servidor).
 *  - Access Service: escreve em `user_access`.
 *  - Processor: aplica as regras do evento já normalizado.
 *  - Billing Events: mantém histórico, idempotência e separação real/teste.
 * O token do webhook nunca sai daqui.
 */

export const PROVIDER = "kiwify";
export const DEFAULT_CHECKOUT_URL = "https://pay.kiwify.com.br/8pYbV63";
/** Product ID oficial do produto comercial (fallback caso o banco esteja vazio). */
export const OFFICIAL_PRODUCT_ID = "2cfcdbf0-9923-11f1-9467-f157b2556ffa";

export type ProcessResult = {
  result:
    | "processed"
    | "pending_link"
    | "pending_payment"
    | "error"
    | "ignored"
    | "duplicate"
    | "test_event";
  note: string;
  userId: string | null;
  eventId: string | null;
};

async function admin() {
  const mod = await import("@/integrations/supabase/client.server");
  return mod.supabaseAdmin;
}

export async function loadKiwifySettings(): Promise<
  KiwifyConfig & {
    id: string | null;
    checkout_url: string | null;
    product_name: string | null;
    offer_name: string | null;
    price_cents: number | null;
    environment: string | null;
  }
> {
  const db = await admin();
  const { data } = await db
    .from("billing_settings")
    .select(
      "id, product_id, offer_id, checkout_url, product_name, offer_name, price_cents, environment",
    )
    .eq("provider", PROVIDER)
    .maybeSingle();
  const configured = (data?.product_id ?? "").trim();
  return {
    id: data?.id ?? null,
    // Um e-mail jamais é aceito como Product ID.
    product_id: configured && !configured.includes("@") ? configured : OFFICIAL_PRODUCT_ID,
    offer_id: data?.offer_id ?? null,
    checkout_url: data?.checkout_url ?? DEFAULT_CHECKOUT_URL,
    product_name: data?.product_name ?? "FotoPress — Acesso Fundador",
    offer_name: data?.offer_name ?? "Pagamento único",
    price_cents: data?.price_cents ?? null,
    environment: data?.environment ?? null,
  };
}

/** Token do webhook: tabela privada (service role) com fallback para o segredo do ambiente. */
export async function loadWebhookToken(): Promise<string | null> {
  const db = await admin();
  const { data } = await db
    .from("billing_secrets")
    .select("webhook_token")
    .eq("provider", PROVIDER)
    .maybeSingle();
  const stored = (data?.webhook_token ?? "").trim();
  if (stored) return stored;
  const env = (process.env["KIWIFY_WEBHOOK_TOKEN"] ?? "").trim();
  return env || null;
}

export async function saveWebhookToken(token: string, actorId: string | null) {
  const db = await admin();
  await db
    .from("billing_secrets")
    .upsert(
      { provider: PROVIDER, webhook_token: token, updated_by: actorId },
      { onConflict: "provider" },
    );
}

async function findUserIdByEmail(email: string): Promise<string | null> {
  if (!email) return null;
  const db = await admin();
  const { data } = await db.from("profiles").select("user_id").ilike("email", email).maybeSingle();
  return data?.user_id ?? null;
}

/**
 * Referência financeira principal: a transação.
 * Localiza a compra original em billing_events e devolve o usuário vinculado.
 * O e-mail é apenas fallback (o cliente pode ter trocado de e-mail).
 */
async function findUserIdByTransaction(transaction: string | null): Promise<string | null> {
  if (!transaction) return null;
  const db = await admin();
  const { data } = await db
    .from("billing_events")
    .select("user_id, created_at")
    .eq("provider", PROVIDER)
    .eq("transaction_id", transaction)
    .not("user_id", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (data?.user_id) return data.user_id;

  // Fallback: acesso já concedido guarda a transação de origem.
  const { data: access } = await db
    .from("user_access")
    .select("user_id")
    .eq("external_transaction_id", transaction)
    .maybeSingle();
  return access?.user_id ?? null;
}

/**
 * Proteção contra acesso duplicado: se a MESMA transação já concedeu acesso
 * vitalício ativo, um novo `purchase_approved` é apenas duplicado.
 */
async function isTransactionAlreadyGranted(transaction: string | null): Promise<string | null> {
  if (!transaction) return null;
  const db = await admin();
  const { data } = await db
    .from("user_access")
    .select("user_id, lifetime_access, access_status")
    .eq("external_transaction_id", transaction)
    .eq("lifetime_access", true)
    .eq("access_status", "active")
    .maybeSingle();
  return data?.user_id ?? null;
}

/** Access Service — libera o Acesso Fundador vitalício (converte trial/expirado). */
async function grantFounder(
  userId: string,
  email: string,
  transaction: string | null,
  productId: string | null,
) {
  const db = await admin();
  const { error } = await db.from("user_access").upsert(
    {
      user_id: userId,
      email: email || null,
      access_type: "founder" as const,
      access_status: "active" as const,
      plan_code: "founder",
      lifetime_access: true,
      activated_at: new Date().toISOString(),
      source: PROVIDER,
      billing_provider: PROVIDER,
      billing_product_id: productId,
      revoked_reason: null,
      revoked_at: null,
      external_transaction_id: transaction,
    },
    { onConflict: "user_id" },
  );
  return error?.message ?? null;
}

/**
 * Access Service — revoga mantendo o histórico da transação.
 * A revogação é sempre relacionada à transação: se o acesso ativo pertence a
 * outra compra, nada é alterado (preparado para múltiplas compras por conta).
 */
async function revokeAccess(userId: string, transaction: string | null, reason: string) {
  const db = await admin();
  const { data: current } = await db
    .from("user_access")
    .select("id, external_transaction_id, billing_provider, source")
    .eq("user_id", userId)
    .maybeSingle();

  if (!current) return "acesso não encontrado";

  const provider = current.billing_provider ?? current.source;
  const sameTransaction =
    !transaction || !current.external_transaction_id
      ? provider === PROVIDER
      : current.external_transaction_id === transaction;

  if (!sameTransaction) return "transação não corresponde ao acesso ativo";

  const { error } = await db
    .from("user_access")
    .update({
      access_status: "cancelled" as const,
      lifetime_access: false,
      source: PROVIDER,
      billing_provider: PROVIDER,
      revoked_reason: reason,
      revoked_at: new Date().toISOString(),
      ...(transaction ? { external_transaction_id: transaction } : {}),
    })
    .eq("id", current.id);
  return error?.message ?? null;
}

type ProcessOptions = {
  parsed: KiwifyEvent;
  payload: unknown;
  /** Reprocessamento/vinculação manual forçando um usuário específico. */
  forceUserId?: string | null;
  linkedManually?: boolean;
  /** Teste: valida tudo, mas não altera acessos nem grava evento. */
  dryRun?: boolean;
  /** Id da linha existente em billing_events (reprocessamento). */
  existingEventRowId?: string | null;
};

export async function processKiwifyEvent(options: ProcessOptions): Promise<ProcessResult> {
  const { parsed, payload, dryRun = false, linkedManually = false } = options;
  let existingRowId: string | null = options.existingEventRowId ?? null;
  const db = await admin();
  const settings = await loadKiwifySettings();

  // Idempotência: o mesmo evento externo nunca é processado duas vezes.
  if (!dryRun && parsed.id && !existingRowId) {
    const { data: existing } = await db
      .from("billing_events")
      .select("id, result")
      .eq("provider", PROVIDER)
      .eq("provider_event_id", parsed.id)
      .maybeSingle();
    if (existing) {
      if (existing.result === "processed") {
        return {
          result: "duplicate",
          note: "evento já processado",
          userId: null,
          eventId: existing.id,
        };
      }
      existingRowId = existing.id;
    }
  }

  const validation = validateProduct(settings, parsed);

  let result: ProcessResult["result"] = "ignored";
  let note = "evento registrado";
  let errorReason: string | null = null;
  let userId: string | null = options.forceUserId ?? null;

  if (parsed.isTest && !options.forceUserId) {
    // Disparo de teste da Kiwify: registra como teste, nunca concede acesso.
    result = "test_event";
    note = "evento de teste — nenhum acesso alterado";
  } else if (!validation.ok) {
    result = "ignored";
    note = validation.reason;
    errorReason = validation.reason;
  } else if (!parsed.transaction) {
    result = "error";
    note = "transação ausente no evento";
    errorReason = "transação ausente";
  } else {
    const isRevoke = REVOKE_EVENTS.has(parsed.event);
    if (!userId) {
      // Reembolso/chargeback: SEMPRE pela transação primeiro; e-mail é fallback.
      userId = isRevoke
        ? ((await findUserIdByTransaction(parsed.transaction)) ??
          (await findUserIdByEmail(parsed.buyerEmail)))
        : ((await findUserIdByEmail(parsed.buyerEmail)) ??
          (await findUserIdByTransaction(parsed.transaction)));
    }

    if (parsed.event === APPROVED_EVENT) {
      // Guarda por transação: eventos purchase_approved repetidos da mesma
      // compra nunca liberam acesso duas vezes.
      const alreadyGranted = await isTransactionAlreadyGranted(parsed.transaction);
      if (alreadyGranted && !options.forceUserId) {
        // Evento repetido da mesma compra: registra no histórico, sem tocar no acesso.
        result = "duplicate";
        note = "transação já liberou acesso (evento duplicado)";
        userId = alreadyGranted;
      } else if (!userId) {
        result = "pending_link";
        note = "compra aguardando vinculação";
      } else if (dryRun) {
        result = "processed";
        note = "validação concluída (teste, sem alterar acesso)";
      } else {
        const failure = await grantFounder(
          userId,
          parsed.buyerEmail,
          parsed.transaction,
          parsed.productId,
        );
        if (failure) {
          result = "error";
          note = "falha ao liberar acesso";
          errorReason = failure;
        } else {
          result = "processed";
          note = linkedManually
            ? "acesso fundador liberado (vinculação manual)"
            : "acesso fundador liberado";
        }
      }
    } else if (isRevoke) {
      const reason = parsed.event === "chargeback" ? "kiwify_chargeback" : "kiwify_refund";
      if (!userId) {
        result = "pending_link";
        note = "reembolso/chargeback sem compra vinculada";
      } else if (dryRun) {
        result = "processed";
        note = "validação concluída (teste, sem alterar acesso)";
      } else {
        const failure = await revokeAccess(userId, parsed.transaction, reason);

        if (failure) {
          result = "error";
          note = "falha ao cancelar acesso";
          errorReason = failure;
        } else {
          result = "processed";
          note = `acesso cancelado (${reason})`;
        }
      }
    } else if (parsed.event === PENDING_EVENT) {
      result = "pending_payment";
      note = "compra aguardando confirmação";
    } else {
      result = "ignored";
      note = "evento sem ação";
    }
  }

  if (dryRun) {
    return { result, note, userId, eventId: null };
  }

  const row = {
    provider: PROVIDER,
    provider_event_id: parsed.id,
    event: parsed.event,
    event_version: parsed.rawEvent,
    status: parsed.status,
    product_id: parsed.productId,
    offer_id: parsed.orderRef,
    transaction_id: parsed.transaction,
    buyer_email: parsed.buyerEmail || null,
    buyer_name: parsed.buyerName,
    amount_cents: parsed.amountCents,
    currency: parsed.currency,
    is_test: parsed.isTest,
    user_id: userId,
    payload: payload as Json,
    processed: result === "processed",
    processed_at: result === "processed" ? new Date().toISOString() : null,
    result,
    note,
    error_reason: errorReason,
    linked_manually: linkedManually,
  };

  // Persistência financeira é obrigatória: sem histórico, o evento não pode
  // ser considerado concluído (o endpoint devolve 500 e a Kiwify reenvia).
  let eventId: string | null = existingRowId;
  if (eventId) {
    const { error } = await db.from("billing_events").update(row).eq("id", eventId);
    if (error) {
      console.error("billing_events update failed", error);
      throw new Error(`falha ao registrar evento financeiro: ${error.message}`);
    }
  } else {
    const { data, error } = await db.from("billing_events").insert(row).select("id").maybeSingle();
    if (error) {
      console.error("billing_events insert failed", error);
      throw new Error(`falha ao registrar evento financeiro: ${error.message}`);
    }
    eventId = data?.id ?? null;
  }

  return { result, note, userId, eventId };
}

/**
 * Preserva o payload quando o processamento falha de forma inesperada.
 * Sem isto o evento seria perdido e não poderia ser reprocessado.
 */
export async function recordFailedEvent(
  parsed: KiwifyEvent | null,
  payload: unknown,
  reason: string,
): Promise<string | null> {
  try {
    const db = await admin();
    const row = {
      provider: PROVIDER,
      provider_event_id: parsed?.id ?? null,
      event: parsed?.event ?? "unknown",
      event_version: parsed?.rawEvent ?? null,
      status: parsed?.status ?? null,
      product_id: parsed?.productId ?? null,
      offer_id: parsed?.orderRef ?? null,
      transaction_id: parsed?.transaction ?? null,
      buyer_email: parsed?.buyerEmail || null,
      buyer_name: parsed?.buyerName ?? null,
      amount_cents: parsed?.amountCents ?? null,
      currency: parsed?.currency ?? null,
      is_test: parsed?.isTest ?? false,
      user_id: null,
      payload: payload as Json,
      processed: false,
      processed_at: null,
      result: "error",
      note: "falha inesperada no processamento",
      error_reason: reason,
      linked_manually: false,
    };

    if (row.provider_event_id) {
      const { data: existing } = await db
        .from("billing_events")
        .select("id")
        .eq("provider", PROVIDER)
        .eq("provider_event_id", row.provider_event_id)
        .maybeSingle();
      if (existing) {
        await db.from("billing_events").update(row).eq("id", existing.id);
        return existing.id;
      }
    }

    const { data } = await db.from("billing_events").insert(row).select("id").maybeSingle();
    return data?.id ?? null;
  } catch (error) {
    console.error("[kiwify] falha ao preservar evento com erro", error);
    return null;
  }
}

export async function recordAudit(
  actorId: string | null,
  actorEmail: string | null,
  action: string,
  details: Record<string, unknown>,
) {
  const db = await admin();
  await db
    .from("admin_audit")
    .insert({ actor_id: actorId, actor_email: actorEmail, action, details: details as Json });
}
