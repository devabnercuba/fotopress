import { APP_URL } from "@/lib/app-url";

/**
 * Catálogo oficial de competições da FCF.
 *
 * Fluxo em duas etapas, para não sobrecarregar o site da federação:
 *  1. lista as competições da temporada (páginas oficiais de competições);
 *  2. só quando o usuário escolhe uma, abrimos a página dela e capturamos o
 *     link "Tabela" (eGol/SisGol) que o importador atual já sabe ler.
 */

const UA = `Mozilla/5.0 (compatible; CoberturaBot/1.0; +${APP_URL})`;
const BASE = "https://fcf.com.br";

export type FcfCompetition = {
  /** Slug da página oficial da competição. */
  id: string;
  label: string;
  /** Página oficial da competição (não é a tabela). */
  url: string;
  /** Categoria explícita no nome (Sub-15, Sub-17…), quando houver. */
  category: string | null;
};

const decode = (value: string) =>
  value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");

const clean = (value: string) =>
  decode(value.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

/** Categoria só quando publicada explicitamente no nome oficial. */
export function fcfCategory(name: string): string | null {
  const m = name.match(/sub\s*-?\s*(\d{2})/i);
  return m ? `Sub-${m[1]}` : null;
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml",
        "accept-language": "pt-BR,pt;q=0.9",
      },
    });
    if (!response.ok) return null;
    return await response.text();
  } catch {
    return null;
  }
}

const IGNORE = /share=|#|\/(federacao|clubes|ligas|imprensa|contatos|credenciamento|eleicoes)\//i;

/** Links de competições dentro de uma página-índice da temporada. */
export function parseFcfCompetitionLinks(html: string, season: string): FcfCompetition[] {
  const found = new Map<string, FcfCompetition>();

  for (const match of html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]{0,300}?)<\/a>/gi)) {
    const href = decode(match[1]);
    const label = clean(match[2]);
    if (!label || IGNORE.test(href)) continue;
    if (!/fcf\.com\.br\/competicoes\//i.test(href)) continue;
    // As páginas-índice ("competicoes-profissionais-2025") não são competições.
    if (/competicoes-(nao-)?profissionais-\d{4}/i.test(href)) continue;

    const slug =
      href
        .replace(/[?#].*$/, "")
        .split("/")
        .filter(Boolean)
        .pop() ?? "";
    // "competicoes" é o próprio índice, não uma competição.
    if (!slug || slug === "competicoes" || found.has(slug)) continue;

    const name = /\d{4}/.test(label) ? label : `${label} ${season}`;
    found.set(slug, {
      id: slug,
      label: name,
      url: new URL(href, BASE).toString(),
      category: fcfCategory(name),
    });
  }

  return [...found.values()];
}

/** Competições publicadas pela FCF na temporada escolhida. */
export async function listFcfCompetitions(season: string): Promise<FcfCompetition[]> {
  const pages = await Promise.all(
    [
      `${BASE}/competicoes/competicoes-profissionais-${season}/`,
      `${BASE}/competicoes/competicoes-nao-profissionais-${season}/`,
    ].map(fetchHtml),
  );

  const competitions = new Map<string, FcfCompetition>();
  for (const html of pages) {
    if (!html) continue;
    for (const item of parseFcfCompetitionLinks(html, season)) competitions.set(item.id, item);
  }

  if (competitions.size === 0) {
    throw new Error(`A FCF ainda não publicou competições para a temporada ${season}.`);
  }

  return [...competitions.values()].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

/** Link "Tabela" (eGol/SisGol) publicado na página oficial da competição. */
export function parseFcfTableUrl(html: string): string | null {
  for (const match of html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]{0,200}?)<\/a>/gi)) {
    const href = decode(match[1]);
    const label = clean(match[2]);
    if (!/sisgol/i.test(href)) continue;
    if (/^tabela$/i.test(label) || /DERW700B/i.test(href)) return href;
  }
  return null;
}

/** Abre apenas a competição escolhida e devolve o endereço da tabela oficial. */
export async function resolveFcfTableUrl(pageUrl: string): Promise<string> {
  const html = await fetchHtml(pageUrl);
  if (!html) throw new Error("Não foi possível abrir a página oficial desta competição.");
  const table = parseFcfTableUrl(html);
  if (!table) throw new Error("Esta competição ainda não publicou a tabela de jogos.");
  return table;
}
