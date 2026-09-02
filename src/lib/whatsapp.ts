/**
 * WhatsApp da conta (usuário do FotoPress)
 * -----------------------------------------
 * Padrão de armazenamento: E.164 sem o "+" (ex.: 5547999999999).
 * Números sem DDI são considerados brasileiros (+55).
 * Este dado é privado: nunca aparece em áreas públicas nem em logs.
 */

/** Apenas dígitos do valor digitado. */
export function digitsOf(value: string) {
  return value.replace(/\D+/g, "");
}

/**
 * Normaliza para E.164 sem "+".
 * - "(47) 99999-9999" -> "5547999999999"
 * - "+1 415 555 2671" -> "14155552671"
 */
export function normalizeWhatsapp(value: string): string | null {
  const raw = value.trim();
  if (!raw) return null;
  const digits = digitsOf(raw);
  if (!digits) return null;

  const hasCountryCode = raw.trimStart().startsWith("+") || digits.startsWith("55");
  const normalized =
    hasCountryCode || digits.length > 11 ? digits.replace(/^0+/, "") : `55${digits}`;

  return normalized.length >= 10 && normalized.length <= 15 ? normalized : null;
}

/** Validação leve: só verifica se é possível normalizar para um número plausível. */
export function isValidWhatsapp(value: string) {
  const normalized = normalizeWhatsapp(value);
  if (!normalized) return false;
  if (normalized.startsWith("55")) {
    const local = normalized.slice(2);
    return local.length === 10 || local.length === 11;
  }
  return normalized.length >= 10 && normalized.length <= 15;
}

/** Máscara brasileira enquanto o usuário digita: (47) 99999-9999. */
export function maskWhatsapp(value: string) {
  if (value.trimStart().startsWith("+")) return `+${digitsOf(value)}`;
  const d = digitsOf(value).slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

/** Exibição amigável a partir do valor normalizado salvo no perfil. */
export function formatWhatsapp(stored?: string | null) {
  if (!stored) return null;
  const d = digitsOf(stored);
  if (d.startsWith("55") && (d.length === 12 || d.length === 13)) {
    const local = d.slice(2);
    const ddd = local.slice(0, 2);
    const rest = local.slice(2);
    const half = rest.length === 9 ? 5 : 4;
    return `(${ddd}) ${rest.slice(0, half)}-${rest.slice(half)}`;
  }
  return `+${d}`;
}

/** Link wa.me com mensagem opcional pré-preenchida (nunca envia sozinho). */
export function waLink(stored?: string | null, message?: string) {
  const d = stored ? digitsOf(stored) : "";
  if (!d) return null;
  const url = new URL(`https://wa.me/${d}`);
  if (message) url.searchParams.set("text", message);
  return url.toString();
}

/** Mensagem sugerida de acompanhamento pós-teste. */
export function postTrialMessage(firstName?: string | null) {
  const name = firstName?.trim() ? `, ${firstName.trim()}` : "";
  return `Olá${name}! Aqui é do FotoPress. Vi que você experimentou a plataforma nos últimos dias e queria saber como foi sua experiência 🙂`;
}
