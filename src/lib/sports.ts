/**
 * Modalidades esportivas
 * ----------------------
 * Campo livre (texto) — sem tabela global e sem enum rígido. As sugestões
 * abaixo são apenas atalhos; o usuário pode criar novas modalidades.
 */
export const SPORT_SUGGESTIONS = [
  "Futebol",
  "Futsal",
  "Beach Soccer",
  "Beach Tennis",
  "Futevôlei",
  "Corrida",
  "Ciclismo",
  "Triathlon",
  "CrossFit",
  "Vôlei",
  "Basquete",
  "Handebol",
  "Natação",
  "Artes Marciais",
  "Outro",
] as const;

/** Chave de comparação: "BEACH TENNIS" e "beach tennis" viram "beach tennis". */
export function normalizeSport(value: string | null | undefined) {
  if (!value) return null;
  const key = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s._/-]+/g, " ")
    .trim();
  return key || null;
}

/** Rótulo apresentável a partir de texto livre ("beach tennis" → "Beach Tennis"). */
export function formatSportLabel(value: string | null | undefined) {
  if (!value) return null;
  const clean = value.trim().replace(/\s+/g, " ");
  if (!clean) return null;
  const known = SPORT_SUGGESTIONS.find((s) => normalizeSport(s) === normalizeSport(clean));
  if (known) return known;
  return clean
    .split(" ")
    .map((w) => (w.length > 2 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export function sameSport(a: string | null | undefined, b: string | null | undefined) {
  const na = normalizeSport(a);
  const nb = normalizeSport(b);
  return !!na && !!nb && na === nb;
}
