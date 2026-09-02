/**
 * Parser RSS determinístico (sem IA) para os feeds oficiais do oGol.
 * Guarda apenas o que vem legitimamente no feed: título, link, data,
 * descrição/resumo e metadados mínimos. Nunca baixa o artigo completo.
 */

import { sanitizeExternalContent } from "@/lib/external-content";

export type OgolFeedType = "news" | "transfer" | "upcoming_match" | "result";

export const OGOL_FEEDS: { type: OgolFeedType; label: string; url: string }[] = [
  { type: "news", label: "Notícias", url: "https://www.ogol.com.br/rss/noticias.php" },
  { type: "transfer", label: "Transferências", url: "https://www.ogol.com.br/rss/transfers.php" },
  {
    type: "upcoming_match",
    label: "Próximos jogos",
    url: "https://www.ogol.com.br/rss/proxjogos.php",
  },
  { type: "result", label: "Resultados", url: "https://www.ogol.com.br/rss/resultados.php" },
];

/** Whitelist exata — nenhuma URL arbitrária é permitida nesta integração. */
export const OGOL_ALLOWED_URLS = new Set(OGOL_FEEDS.map((f) => f.url));

export const OGOL_FEED_LABEL: Record<OgolFeedType, string> = {
  news: "Notícias",
  transfer: "Transferências",
  upcoming_match: "Próximos jogos",
  result: "Resultados",
};

export type OgolItem = {
  guid: string | null;
  title: string;
  link: string;
  description: string | null;
  publishedAt: string | null;
  category: string | null;
  image: string | null;
};

function decodeEntities(value: string) {
  return sanitizeExternalContent(value);
}

/** Remove qualquer HTML/script do texto vindo do feed antes de armazenar/exibir. */
export function sanitizeText(value: string) {
  return sanitizeExternalContent(value);
}

/** Como `tag`, mas devolve o conteúdo bruto (sem sanitizar) para busca de `<img>`. */
function rawTag(block: string, name: string): string | null {
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i");
  const match = re.exec(block);
  if (!match) return null;
  return match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
}

function tag(block: string, name: string): string | null {
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i");
  const match = re.exec(block);
  if (!match) return null;
  const raw = match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  const text = sanitizeText(raw);
  return text.length ? text : null;
}

function attr(block: string, tagName: string, attribute: string): string | null {
  const re = new RegExp(`<${tagName}\\b[^>]*\\b${attribute}=["']([^"']+)["']`, "i");
  const match = re.exec(block);
  return match ? decodeEntities(match[1]) : null;
}

/** Extrai o primeiro atributo de um bloco `<tagName ...>` cujo `attribute` bate um regex de teste. */
function attrWhere(
  block: string,
  tagName: string,
  attribute: string,
  test: (attrs: string) => boolean,
): string | null {
  const re = new RegExp(`<${tagName}\\b([^>]*)>`, "gi");
  let match: RegExpExecArray | null;
  while ((match = re.exec(block))) {
    if (!test(match[1])) continue;
    const attrRe = new RegExp(`\\b${attribute}=["']([^"']+)["']`, "i");
    const attrMatch = attrRe.exec(match[1]);
    if (attrMatch) return decodeEntities(attrMatch[1]);
  }
  return null;
}

/** Extrai a primeira imagem de dentro de um bloco HTML (ex.: description/content:encoded). */
function firstImgSrc(html: string | null): string | null {
  if (!html) return null;
  const match = /<img\b[^>]*\bsrc=["']([^"']+)["']/i.exec(html);
  return match ? decodeEntities(match[1]) : null;
}

/** Valida se uma string é uma URL http(s) de imagem plausível. */
function safeImageUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function toIso(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Converte o XML de um feed RSS em itens normalizados. */
export function parseRss(xml: string, limit = 40): OgolItem[] {
  const items: OgolItem[] = [];
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];

  for (const block of blocks) {
    if (items.length >= limit) break;
    const title = tag(block, "title");
    const link = tag(block, "link") ?? attr(block, "link", "href");
    if (!title || !link) continue;
    let safeLink: string;
    try {
      const url = new URL(link);
      if (!/^https?:$/.test(url.protocol)) continue;
      safeLink = url.toString();
    } catch {
      continue;
    }
    items.push({
      guid: tag(block, "guid"),
      title,
      link: safeLink,
      description: tag(block, "description"),
      publishedAt: toIso(tag(block, "pubDate")),
      category: tag(block, "category"),
      image: safeImageUrl(
        attr(block, "media:content", "url") ??
          attr(block, "media:thumbnail", "url") ??
          attrWhere(block, "enclosure", "url", (attrs) => /type=["']image\//i.test(attrs)) ??
          firstImgSrc(rawTag(block, "content:encoded")) ??
          firstImgSrc(rawTag(block, "description")),
      ),
    });
  }
  return items;
}
