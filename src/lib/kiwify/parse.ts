/**
 * Kiwify — parser do webhook.
 * Módulo puro: sem acesso a banco, sem segredos.
 *
 * A estrutura seguida aqui é a do payload REAL enviado pela Kiwify
 * (`webhook_event_type`, `order_id`, `order_status`, `order_ref`, `Product`,
 * `Customer`, `Commissions`, …). Variações em snake_case/minúsculas são
 * aceitas por tolerância, mas o payload real é a referência.
 */

/** Eventos internos normalizados — o resto do sistema só conhece estes. */
export type NormalizedEvent =
  "purchase_approved" | "purchase_refunded" | "chargeback" | "purchase_pending" | "unknown";

export type KiwifyEvent = {
  /** Identificador único do evento (usado para idempotência). */
  id: string | null;
  /** Evento normalizado interno. */
  event: NormalizedEvent;
  /** Nome original do evento recebido da Kiwify (somente para exibição/log). */
  rawEvent: string;
  createdAt: string | null;
  productId: string | null;
  productName: string | null;
  /** Referência da oferta (`order_ref`) — sempre opcional. */
  orderRef: string | null;
  /** Identificador financeiro da compra (`order_id`). */
  transaction: string | null;
  status: string | null;
  buyerEmail: string;
  buyerName: string | null;
  /** Valor da compra em centavos, quando informado. */
  amountCents: number | null;
  currency: string | null;
  /** Evento de teste disparado pelo painel da Kiwify. */
  isTest: boolean;
};

const APPROVED_RAW = new Set(["order_approved", "compra_aprovada", "paid", "approved"]);
const REFUND_RAW = new Set(["order_refunded", "compra_reembolsada", "refunded"]);
const CHARGEBACK_RAW = new Set(["chargeback", "order_chargedback", "chargedback"]);
const PENDING_RAW = new Set([
  "pix_created",
  "billet_created",
  "boleto_gerado",
  "pix_gerado",
  "order_pending",
  "waiting_payment",
  "pending",
]);

/** Rótulos amigáveis dos eventos internos. */
export const EVENT_LABELS: Record<NormalizedEvent, string> = {
  purchase_approved: "Compra aprovada",
  purchase_refunded: "Compra reembolsada",
  chargeback: "Chargeback",
  purchase_pending: "Pagamento pendente",
  unknown: "Evento não tratado",
};

export const APPROVED_EVENT: NormalizedEvent = "purchase_approved";
export const REVOKE_EVENTS = new Set<NormalizedEvent>(["purchase_refunded", "chargeback"]);
export const PENDING_EVENT: NormalizedEvent = "purchase_pending";

type AnyRecord = Record<string, unknown>;

function obj(value: unknown): AnyRecord {
  return value && typeof value === "object" ? (value as AnyRecord) : {};
}

function str(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  return null;
}

function int(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
    return Math.round(Number(value));
  }
  return null;
}

/** Procura a primeira chave existente (case-insensitive) dentro do objeto. */
function pick(source: AnyRecord, keys: string[]): unknown {
  const lower = new Map(Object.keys(source).map((k) => [k.toLowerCase(), k]));
  for (const key of keys) {
    const real = lower.get(key.toLowerCase());
    if (real !== undefined && source[real] !== undefined && source[real] !== null) {
      return source[real];
    }
  }
  return undefined;
}

/** Camada única de normalização: nome bruto/status → evento interno. */
export function normalizeEvent(rawEvent: string | null, status: string | null): NormalizedEvent {
  const candidates = [rawEvent, status].map((v) => (v ?? "").trim().toLowerCase()).filter(Boolean);
  for (const value of candidates) {
    if (APPROVED_RAW.has(value)) return "purchase_approved";
    if (REFUND_RAW.has(value)) return "purchase_refunded";
    if (CHARGEBACK_RAW.has(value)) return "chargeback";
    if (PENDING_RAW.has(value)) return "purchase_pending";
  }
  return "unknown";
}

/** Normaliza o payload real da Kiwify para o formato único do sistema. */
export function parseKiwifyWebhook(raw: unknown): KiwifyEvent {
  const root = obj(raw);
  // Alguns disparos encapsulam o pedido em `order` / `data`.
  const order = { ...obj(pick(root, ["order", "data"])), ...root } as AnyRecord;

  const product = obj(pick(order, ["Product", "product"]));
  const customer = obj(pick(order, ["Customer", "customer", "buyer"]));
  const commissions = obj(pick(order, ["Commissions", "commissions"]));

  const status = str(pick(order, ["order_status", "status"]));
  const rawEvent = str(pick(order, ["webhook_event_type", "event_type", "event", "evento"])) ?? "";
  const event = normalizeEvent(rawEvent, status);

  const email = (
    str(pick(customer, ["email", "e_mail"])) ??
    str(pick(order, ["email", "buyer_email"])) ??
    ""
  )
    .trim()
    .toLowerCase();

  const orderId = str(pick(order, ["order_id", "transaction_id"]));
  const eventId =
    str(pick(root, ["event_id", "webhook_event_id"])) ??
    (orderId ? `${rawEvent || event}:${orderId}` : null);

  const testFlag = pick(order, ["test", "is_test", "sandbox"]);
  const isTest =
    testFlag === true ||
    String(testFlag ?? "").toLowerCase() === "true" ||
    (email.length > 0 && /@(test|example)\.(com|com\.br|local)$/.test(email));

  return {
    id: eventId,
    event,
    rawEvent: rawEvent || (status ?? "desconhecido"),
    createdAt: str(pick(order, ["approved_date", "created_at", "updated_at"])),
    // Product ID vem SEMPRE do bloco Product — nunca de e-mail ou oferta.
    productId: str(pick(product, ["product_id", "id"])) ?? str(pick(order, ["product_id"])),
    productName: str(pick(product, ["product_name", "name"])),
    // Oferta é opcional e vem apenas de `order_ref`.
    orderRef: str(pick(order, ["order_ref"])),
    transaction: orderId,
    status,
    buyerEmail: email,
    buyerName:
      str(pick(customer, ["full_name", "name", "first_name"])) ?? str(pick(order, ["buyer_name"])),
    amountCents:
      int(pick(commissions, ["charge_amount", "settlement_amount", "product_base_price"])) ??
      int(pick(order, ["charge_amount"])),
    currency: str(pick(commissions, ["currency", "charge_amount_currency"])) ?? "BRL",
    isTest,
  };
}
