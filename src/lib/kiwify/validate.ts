import type { KiwifyEvent } from "./parse";

/**
 * Kiwify — validação de produto e autenticação do webhook.
 * Módulo puro: recebe a configuração já carregada pelo servidor.
 */
export type KiwifyConfig = {
  product_id: string | null;
  offer_id: string | null;
};

export type ValidationResult = { ok: true } | { ok: false; reason: string };

/** Um Product ID válido nunca é um e-mail. */
export function isValidProductId(value: string | null | undefined): boolean {
  const v = (value ?? "").trim();
  if (!v) return false;
  if (v.includes("@")) return false;
  return true;
}

/**
 * Regra de produção: o Product ID recebido precisa ser exatamente o
 * configurado. Oferta (`order_ref`) é opcional e só valida quando definida.
 */
export function validateProduct(config: KiwifyConfig, event: KiwifyEvent): ValidationResult {
  const expectedProduct = (config.product_id ?? "").trim();
  if (!isValidProductId(expectedProduct)) {
    return { ok: false, reason: "Product ID não configurado" };
  }

  const received = (event.productId ?? "").trim();
  if (!received) return { ok: false, reason: "Produto não autorizado" };
  if (received !== expectedProduct) return { ok: false, reason: "Produto não autorizado" };

  const expectedOffer = (config.offer_id ?? "").trim();
  if (expectedOffer && (event.orderRef ?? "").trim() !== expectedOffer) {
    return { ok: false, reason: "Oferta não corresponde" };
  }

  return { ok: true };
}

/** Comparação em tempo constante (sem depender de Buffer). */
export function safeTokenEquals(received: string, expected: string): boolean {
  if (!expected || !received) return false;
  if (received.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < received.length; i += 1) {
    diff |= received.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacHex(algorithm: "SHA-1" | "SHA-256", secret: string, body: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: algorithm },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(body)));
}

export type AuthResult = { ok: boolean; how: string };

/**
 * A Kiwify autentica o webhook com uma assinatura HMAC do corpo bruto
 * (query `signature`) usando o token cadastrado. Também aceitamos o envio do
 * token puro (query ou cabeçalho), que é como o painel permite configurar.
 * O segredo nunca sai do servidor e nunca é registrado em log.
 */
export async function authenticateKiwifyRequest(
  request: Request,
  rawBody: string,
  secret: string,
): Promise<AuthResult> {
  const url = new URL(request.url);
  const signature = (url.searchParams.get("signature") ?? "").trim().toLowerCase();

  if (signature) {
    const sha1 = await hmacHex("SHA-1", secret, rawBody);
    if (safeTokenEquals(signature, sha1)) return { ok: true, how: "hmac-sha1" };
    const sha256 = await hmacHex("SHA-256", secret, rawBody);
    if (safeTokenEquals(signature, sha256)) return { ok: true, how: "hmac-sha256" };
    return { ok: false, how: "assinatura inválida" };
  }

  const plain = (
    url.searchParams.get("token") ??
    request.headers.get("x-kiwify-token") ??
    request.headers.get("x-webhook-token") ??
    (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "") ??
    ""
  ).trim();

  if (plain && safeTokenEquals(plain, secret)) return { ok: true, how: "token" };
  return { ok: false, how: "token ausente ou inválido" };
}
