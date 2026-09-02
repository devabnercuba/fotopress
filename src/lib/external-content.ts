/**
 * Sanitização de conteúdo externo
 * --------------------------------
 * Ponto único de limpeza para qualquer texto vindo de fora do FotoPress
 * (RSS do oGol, HTML de portais, retorno de IA). Decodifica entidades HTML,
 * remove marcação e tokens internos das fontes (ex.: `TEAM_LINK`) e normaliza
 * espaços. Use sempre estas funções antes de exibir ou armazenar texto externo.
 */

/** Entidades nomeadas mais comuns em feeds e portais em português. */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ensp: " ",
  emsp: " ",
  thinsp: " ",
  shy: "",
  laquo: "«",
  raquo: "»",
  ldquo: "\u201c",
  rdquo: "\u201d",
  lsquo: "\u2018",
  rsquo: "\u2019",
  sbquo: "\u201a",
  bdquo: "\u201e",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  minus: "−",
  middot: "·",
  bull: "•",
  deg: "°",
  euro: "€",
  pound: "£",
  yen: "¥",
  cent: "¢",
  copy: "©",
  reg: "®",
  trade: "™",
  times: "×",
  divide: "÷",
  frac12: "½",
  frac14: "¼",
  frac34: "¾",
  sup2: "²",
  sup3: "³",
  ordf: "ª",
  ordm: "º",
  iexcl: "¡",
  iquest: "¿",
  sect: "§",
  para: "¶",
  dagger: "†",
  permil: "‰",
  prime: "′",
  Prime: "″",
  aacute: "á",
  eacute: "é",
  iacute: "í",
  oacute: "ó",
  uacute: "ú",
  Aacute: "Á",
  Eacute: "É",
  Iacute: "Í",
  Oacute: "Ó",
  Uacute: "Ú",
  agrave: "à",
  egrave: "è",
  igrave: "ì",
  ograve: "ò",
  ugrave: "ù",
  Agrave: "À",
  Egrave: "È",
  Igrave: "Ì",
  Ograve: "Ò",
  Ugrave: "Ù",
  acirc: "â",
  ecirc: "ê",
  icirc: "î",
  ocirc: "ô",
  ucirc: "û",
  Acirc: "Â",
  Ecirc: "Ê",
  Icirc: "Î",
  Ocirc: "Ô",
  Ucirc: "Û",
  atilde: "ã",
  otilde: "õ",
  ntilde: "ñ",
  Atilde: "Ã",
  Otilde: "Õ",
  Ntilde: "Ñ",
  auml: "ä",
  euml: "ë",
  iuml: "ï",
  ouml: "ö",
  uuml: "ü",
  Auml: "Ä",
  Euml: "Ë",
  Iuml: "Ï",
  Ouml: "Ö",
  Uuml: "Ü",
  ccedil: "ç",
  Ccedil: "Ç",
};

function codePointToChar(code: number): string {
  if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return "";
  // Faixa de surrogates isolados: descarta em vez de gerar caractere inválido.
  if (code >= 0xd800 && code <= 0xdfff) return "";
  try {
    return String.fromCodePoint(code);
  } catch {
    return "";
  }
}

/** Decodifica entidades HTML (nomeadas, decimais e hexadecimais), inclusive aninhadas. */
export function decodeHtmlEntities(value: string): string {
  let out = value;
  // Fontes com dupla codificação (`&amp;quot;`) exigem mais de uma passada.
  for (let pass = 0; pass < 3; pass += 1) {
    const next = out.replace(
      /&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]{1,31});/gi,
      (match, entity: string) => {
        if (entity.startsWith("#x") || entity.startsWith("#X")) {
          return codePointToChar(Number.parseInt(entity.slice(2), 16)) || match;
        }
        if (entity.startsWith("#")) {
          return codePointToChar(Number.parseInt(entity.slice(1), 10)) || match;
        }
        const named = NAMED_ENTITIES[entity];
        return named === undefined ? match : named;
      },
    );
    if (next === out) break;
    out = next;
  }
  return out;
}

/**
 * Tokens internos que algumas fontes (notadamente o oGol) deixam vazar no RSS,
 * como `TEAM_LINK`, `PLAYER_LINK`, `[COACH_LINK]` ou `{{COMPETITION_LINK}}`.
 */
const SOURCE_TOKEN_RE =
  /[[{(]{0,2}\s*(?:TEAM|PLAYER|COACH|CLUB|COMPETITION|MATCH|COUNTRY|STAFF|REFEREE|VENUE|USER|IMG|IMAGE)_(?:LINK|IMG|IMAGE|NAME|ID)\s*[\]})]{0,2}/g;

/** Remove tokens de template das fontes e placeholders genéricos `{{...}}`. */
export function stripSourceTokens(value: string): string {
  return value
    .replace(SOURCE_TOKEN_RE, " ")
    .replace(/\{\{[^{}]{0,60}\}\}/g, " ")
    .replace(/\[\[[^[\]]{0,60}\]\]/g, " ");
}

/** Remove blocos perigosos e toda a marcação HTML restante. */
export function stripHtml(value: string): string {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n\n")
    .replace(/<[^>]*>/g, " ");
}

/** Normaliza espaços mantendo, opcionalmente, quebras de parágrafo. */
function normalizeSpaces(value: string, keepParagraphs: boolean): string {
  if (!keepParagraphs) return value.replace(/\s+/g, " ").trim();
  return value
    .replace(/[ \t\u00a0]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Restos comuns de scraping: reticências soltas, pontuação duplicada, aspas órfãs. */
function tidyPunctuation(value: string): string {
  return value
    .replace(/\s+([,.;:!?%)\]])/g, "$1")
    .replace(/([([])\s+/g, "$1")
    .replace(/([,.;:])\1+/g, "$1")
    .replace(/^[\s\-–—•|]+/, "")
    .replace(/[\s\-–—•|]+$/, "");
}

export type SanitizeOptions = {
  /** Preserva quebras de parágrafo (para corpos de texto). Padrão: false. */
  keepParagraphs?: boolean;
  /** Corta o resultado neste número de caracteres, sem quebrar palavra. */
  maxLength?: number;
};

/**
 * Limpeza completa de um texto externo: HTML → entidades → tokens de fonte →
 * espaços. Devolve string vazia quando nada de útil sobra.
 */
export function sanitizeExternalContent(
  value: string | null | undefined,
  options: SanitizeOptions = {},
): string {
  if (!value) return "";
  const keepParagraphs = options.keepParagraphs ?? false;
  let text = stripHtml(value);
  text = decodeHtmlEntities(text);
  // A decodificação pode revelar marcação escapada (`&lt;b&gt;`): limpa de novo.
  if (/<[^>]+>/.test(text)) text = stripHtml(text);
  text = stripSourceTokens(text);
  text = normalizeSpaces(text, keepParagraphs);
  text = tidyPunctuation(text);

  const max = options.maxLength;
  if (max && text.length > max) {
    const cut = text.slice(0, max);
    const lastSpace = cut.lastIndexOf(" ");
    text = `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
  }
  return text;
}

/** Título pronto para exibição (uma linha, sem HTML nem tokens de fonte). */
export function sanitizeTitle(value: string | null | undefined, maxLength = 180): string {
  return sanitizeExternalContent(value, { maxLength });
}

/** Resumo curto pronto para exibição em cards. */
export function sanitizeSummary(value: string | null | undefined, maxLength = 320): string {
  return sanitizeExternalContent(value, { maxLength });
}

/** Corpo de texto longo preservando parágrafos. */
export function sanitizeBody(value: string | null | undefined, maxLength?: number): string {
  return sanitizeExternalContent(value, {
    keepParagraphs: true,
    ...(maxLength === undefined ? {} : { maxLength }),
  });
}

/** `true` quando o texto ficou vazio ou é apenas ruído após a limpeza. */
export function isEmptyContent(value: string | null | undefined): boolean {
  return sanitizeExternalContent(value).length < 2;
}
