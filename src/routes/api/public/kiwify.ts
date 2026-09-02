import { createFileRoute } from "@tanstack/react-router";

/**
 * Kiwify Receiver — MODO PRODUÇÃO
 * -------------------------------
 * Fluxo: token válido → parser → Product ID válido → processamento →
 * histórico. Sempre responde rápido e nunca registra o token.
 * O diagnóstico do último POST externo é gravado à parte (metadados apenas)
 * e não interfere no processamento.
 */
const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, GET, OPTIONS",
  "access-control-allow-headers": "content-type, x-kiwify-token, x-webhook-token, authorization",
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: CORS_HEADERS });
}

/**
 * Só registra recebimentos EXTERNOS AUTENTICADOS.
 * Falhas de autenticação nunca aparecem como "webhook Kiwify recebido".
 * O token jamais é armazenado.
 */
async function recordAuthenticatedPing(info: {
  method: string;
  contentType: string | null;
  bodySize: number;
  tokenPresent: boolean;
  event: string | null;
  isTest: boolean;
  note: string;
}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("webhook_diagnostics").upsert(
      {
        provider: "kiwify",
        received_at: new Date().toISOString(),
        method: info.method,
        content_type: info.contentType,
        body_size: info.bodySize,
        token_present: info.tokenPresent,
        authenticated: true,
        event: info.event,
        is_test: info.isTest,
        note: info.note,
      },
      { onConflict: "provider" },
    );
  } catch (error) {
    console.error("[kiwify-webhook] falha ao registrar recebimento", error);
  }
}

export const Route = createFileRoute("/api/public/kiwify")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),

      GET: async () => json({ endpoint: "kiwify-webhook", status: "online", mode: "production" }),

      POST: async ({ request }) => {
        const url = new URL(request.url);
        const raw = await request.text();
        const contentType = request.headers.get("content-type");
        const tokenPresent = Boolean(
          url.searchParams.get("token") ??
          url.searchParams.get("signature") ??
          request.headers.get("x-kiwify-token") ??
          request.headers.get("x-webhook-token") ??
          request.headers.get("authorization"),
        );

        const { loadWebhookToken, processKiwifyEvent } =
          await import("@/lib/kiwify/service.server");
        const { parseKiwifyWebhook } = await import("@/lib/kiwify/parse");
        const { authenticateKiwifyRequest } = await import("@/lib/kiwify/validate");

        const secret = await loadWebhookToken();
        if (!secret) {
          console.warn("[kiwify-webhook] POST recebido sem token configurado");
          return json({ error: "webhook not configured" }, 503);
        }

        const auth = await authenticateKiwifyRequest(request, raw, secret);
        if (!auth.ok) {
          // Falha de autenticação nunca vira "webhook Kiwify recebido".
          console.warn(`[kiwify-webhook] autenticação recusada (${auth.how})`);
          return new Response("Invalid token", { status: 401, headers: CORS_HEADERS });
        }

        let payload: unknown;
        try {
          payload = JSON.parse(raw);
        } catch {
          await recordAuthenticatedPing({
            method: request.method,
            contentType,
            bodySize: raw.length,
            tokenPresent,
            event: null,
            isTest: false,
            note: "webhook autenticado — payload inválido (JSON malformado)",
          });
          return json({ error: "invalid payload" }, 400);
        }

        if (!payload || typeof payload !== "object") {
          await recordAuthenticatedPing({
            method: request.method,
            contentType,
            bodySize: raw.length,
            tokenPresent,
            event: null,
            isTest: false,
            note: "webhook autenticado — payload inválido (formato inesperado)",
          });
          return json({ error: "invalid payload" }, 400);
        }

        const parsed = parseKiwifyWebhook(payload);

        let outcome: { result: string; note: string };
        try {
          outcome = await processKiwifyEvent({ parsed, payload });
        } catch (error) {
          const message = error instanceof Error ? error.message : "erro interno";
          console.error("[kiwify-webhook] falha no processamento", message);
          const { recordFailedEvent } = await import("@/lib/kiwify/service.server");
          await recordFailedEvent(parsed, payload, message);
          await recordAuthenticatedPing({
            method: request.method,
            contentType,
            bodySize: raw.length,
            tokenPresent,
            event: parsed.event,
            isTest: parsed.isTest,
            note: `webhook autenticado — falha interna (${parsed.event})`,
          });
          return json({ received: true, error: "processing_failed" }, 500);
        }

        await recordAuthenticatedPing({
          method: request.method,
          contentType,
          bodySize: raw.length,
          tokenPresent,
          event: parsed.event,
          isTest: parsed.isTest,
          note: `webhook autenticado — ${parsed.event} (${outcome.result})`,
        });

        // Erro real de processamento não pode responder 200 (Kiwify reenvia).
        if (outcome.result === "error") {
          return json({ received: true, result: outcome.result, note: outcome.note }, 500);
        }

        // Processado, duplicado, ignorado ou pendente → 200 (sem reenvio).
        return json({
          received: true,
          result: outcome.result,
          duplicate: outcome.result === "duplicate",
          note: outcome.note,
        });
      },
    },
  },
});
