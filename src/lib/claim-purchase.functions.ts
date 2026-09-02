import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Cenário A — compra antes do cadastro.
 * Quando a compra chega na Kiwify e o e-mail ainda não tem conta, o evento fica
 * como `pending_link`. No primeiro acesso da conta recém-criada, esta função
 * procura compras aprovadas com o MESMO e-mail (validado pelo token da sessão,
 * nunca informado pelo cliente) e vincula automaticamente o Acesso Fundador.
 */
export const claimPendingPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = ((context.claims as { email?: string } | null)?.email ?? "").trim().toLowerCase();
    if (!email) return { claimed: false as const, note: "sessão sem e-mail" };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { processKiwifyEvent, recordAudit, PROVIDER } =
      await import("@/lib/kiwify/service.server");
    const { parseKiwifyWebhook } = await import("@/lib/kiwify/parse");

    // Já é fundador? Nada a fazer.
    const { data: access } = await supabaseAdmin
      .from("user_access")
      .select("lifetime_access, access_status")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (access?.lifetime_access) return { claimed: false as const, note: "acesso já vitalício" };

    const { data: rows } = await supabaseAdmin
      .from("billing_events")
      .select("id, payload, result")
      .eq("provider", PROVIDER)
      .eq("event", "purchase_approved")
      .eq("is_test", false)
      .is("user_id", null)
      .ilike("buyer_email", email)
      .order("created_at", { ascending: true })
      .limit(5);

    for (const row of rows ?? []) {
      if (row.result === "processed") continue;
      const parsed = parseKiwifyWebhook(row.payload);
      const outcome = await processKiwifyEvent({
        parsed,
        payload: row.payload,
        existingEventRowId: row.id,
        forceUserId: context.userId,
        linkedManually: false,
      });
      if (outcome.result === "processed") {
        await recordAudit(context.userId, email, "kiwify_purchase_auto_linked", {
          eventId: row.id,
          userId: context.userId,
        });
        return { claimed: true as const, note: outcome.note };
      }
    }

    return { claimed: false as const, note: "nenhuma compra pendente" };
  });

export type MyPurchaseStatus = {
  state: "linked" | "pending" | "error" | "none";
  email: string;
  /** Última tentativa de vinculação, se houver evento da Kiwify com este e-mail. */
  transactionId: string | null;
  purchasedAt: string | null;
  linkedAt: string | null;
  note: string | null;
};

/**
 * Status da compra do usuário logado (tela /obrigado).
 * Antes de responder, tenta vincular uma compra pendente — assim o botão
 * "Atualizar" resolve o Cenário A sem intervenção do administrador.
 */
export const getMyPurchaseStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyPurchaseStatus> => {
    const email = ((context.claims as { email?: string } | null)?.email ?? "").trim().toLowerCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { PROVIDER } = await import("@/lib/kiwify/service.server");

    const { data: access } = await supabaseAdmin
      .from("user_access")
      .select("lifetime_access, access_status, activated_at, external_transaction_id")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (access?.lifetime_access && access.access_status === "active") {
      return {
        state: "linked",
        email,
        transactionId: access.external_transaction_id,
        purchasedAt: null,
        linkedAt: access.activated_at,
        note: "Acesso Fundador vitalício ativo.",
      };
    }

    const { data: event } = await supabaseAdmin
      .from("billing_events")
      .select("result, note, transaction_id, created_at, processed_at")
      .eq("provider", PROVIDER)
      .eq("event", "purchase_approved")
      .eq("is_test", false)
      .ilike("buyer_email", email)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!event) {
      return {
        state: "none",
        email,
        transactionId: null,
        purchasedAt: null,
        linkedAt: null,
        note: "Nenhuma compra encontrada para este e-mail.",
      };
    }

    return {
      state: event.result === "error" ? "error" : "pending",
      email,
      transactionId: event.transaction_id,
      purchasedAt: event.created_at,
      linkedAt: event.processed_at,
      note: event.note,
    };
  });
