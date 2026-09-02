/**
 * Enriquecimento sob demanda de matérias (feed_type = "news").
 * Busca a URL original com proteção contra SSRF, extrai título/imagem/texto
 * principal de forma determinística e gera um resumo curto via IA — nunca
 * reproduz a matéria integral.
 */

import { sanitizeBody, sanitizeExternalContent } from "@/lib/external-content";

const FETCH_TIMEOUT_MS = 8_000;
const USER_AGENT = "Mozilla/5.0 (compatible; FotoPressBot/1.0; +https://fotopress.app)";

const BLOCKED_HOSTNAME_SUFFIXES = [".local"];

function isPrivateIPv4(hostname: string): boolean {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => Number.isNaN(p) || p < 0 || p > 255)) return false;
  const [a, b] = parts;
  if (a === 127) return true;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  if (a === 0) return true;
  return false;
}

/** Bloqueia hosts internos/privados/metadata antes de qualquer fetch (proteção SSRF). */
export function isSafeExternalUrl(rawUrl: string): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (!/^https?:$/.test(url.protocol)) return false;

  const hostname = url.hostname.toLowerCase();
  if (hostname === "localhost" || hostname === "0.0.0.0") return false;
  if (hostname === "::1" || hostname.startsWith("[::1]")) return false;
  if (BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => hostname.endsWith(suffix))) return false;
  if (isPrivateIPv4(hostname)) return false;
  // Formatos IPv6 privados/loopback comuns (fc00::/7, fe80::/10).
  if (/^(fc|fd|fe8|fe9|fea|feb)/i.test(hostname.replace(/[[\]]/g, ""))) return false;

  return true;
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml" },
      redirect: "follow",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

function decodeEntities(value: string) {
  return sanitizeExternalContent(value);
}

/** Remove scripts/estilos/tags e devolve texto puro preservando parágrafos. */
function stripTags(html: string): string {
  return sanitizeBody(html);
}

function metaContent(html: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const match = re.exec(html);
    if (match?.[1]) return decodeEntities(match[1]);
  }
  return null;
}

function absoluteUrl(value: string | null, base: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    if (!/^https?:$/.test(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

type JsonLdArticle = { headline?: string; articleBody?: string; image?: unknown };

function findJsonLdArticle(html: string): JsonLdArticle | null {
  const blocks =
    html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const block of blocks) {
    const raw = block.replace(/^[\s\S]*?>/, "").replace(/<\/script>$/i, "");
    try {
      const parsed = JSON.parse(raw);
      const candidates = Array.isArray(parsed) ? parsed : [parsed];
      for (const candidate of candidates) {
        const nodes = candidate?.["@graph"] ? candidate["@graph"] : [candidate];
        for (const node of nodes) {
          const type = node?.["@type"];
          const isArticle =
            type === "Article" ||
            type === "NewsArticle" ||
            (Array.isArray(type) && type.some((t: string) => /Article/i.test(t)));
          if (isArticle && (node.articleBody || node.headline)) {
            return { headline: node.headline, articleBody: node.articleBody, image: node.image };
          }
        }
      }
    } catch {
      // JSON-LD malformado: ignora este bloco.
    }
  }
  return null;
}

function imageFromJsonLd(image: unknown): string | null {
  if (!image) return null;
  if (typeof image === "string") return image;
  if (Array.isArray(image)) return imageFromJsonLd(image[0]);
  if (typeof image === "object" && image !== null && "url" in image) {
    return typeof (image as { url?: unknown }).url === "string"
      ? (image as { url: string }).url
      : null;
  }
  return null;
}

/** Extrai o maior bloco de texto de dentro de `<article>` ou `<main>`. */
function extractByTag(html: string, tag: string): string | null {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  let best = "";
  let match: RegExpExecArray | null;
  while ((match = re.exec(html))) {
    const text = stripTags(match[1]);
    if (text.length > best.length) best = text;
  }
  return best.length > 200 ? best : null;
}

/** Fallback: maior sequência de parágrafos `<p>` do documento. */
function extractLargestParagraphBlock(html: string): string | null {
  const paragraphs = html.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) ?? [];
  const texts = paragraphs.map((p) => stripTags(p)).filter((t) => t.length > 40);
  if (texts.length === 0) return null;
  return texts.join("\n\n");
}

/** Ignora sprites, ícones, pixels de tracking e logotipos ao caçar a imagem da matéria. */
function isLikelyContentImage(src: string): boolean {
  return !/(sprite|icon|favicon|logo|avatar|placeholder|pixel|blank|1x1|spacer|ads?[-_/])/i.test(
    src,
  );
}

/** Fallback de imagem: primeira `<img>` plausível dentro de figure/article/main. */
function firstEditorialImage(html: string): string | null {
  for (const tag of ["figure", "article", "main"]) {
    const block = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i").exec(html);
    if (!block) continue;
    const imgRe = /<img\b[^>]*?\b(?:data-src|data-original|src)=["']([^"']+)["']/gi;
    let match: RegExpExecArray | null;
    while ((match = imgRe.exec(block[1]))) {
      const src = match[1];
      if (src && !src.startsWith("data:") && isLikelyContentImage(src)) return src;
    }
  }
  return null;
}

export type ExtractedArticle = {
  title: string | null;
  image: string | null;
  text: string | null;
};

/** Parser determinístico: JSON-LD Article → <article> → <main> → maior bloco de <p>. */
export function extractArticle(html: string, baseUrl: string): ExtractedArticle {
  const jsonLd = findJsonLdArticle(html);
  const ogImage = metaContent(html, [
    /<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["']/i,
  ]);
  const title =
    metaContent(html, [
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      /<title[^>]*>([\s\S]*?)<\/title>/i,
    ]) ??
    jsonLd?.headline ??
    null;

  // Ordem de preferência: og:image → JSON-LD → primeira imagem editorial da página.
  const image = absoluteUrl(
    ogImage ?? imageFromJsonLd(jsonLd?.image) ?? firstEditorialImage(html),
    baseUrl,
  );

  const text =
    (jsonLd?.articleBody ? decodeEntities(jsonLd.articleBody) : null) ??
    extractByTag(html, "article") ??
    extractByTag(html, "main") ??
    extractLargestParagraphBlock(html);

  return {
    title: title ? decodeEntities(title) : null,
    image,
    text: text?.slice(0, 12_000) ?? null,
  };
}

/** Busca a página original respeitando timeout e proteção contra SSRF. */
export async function fetchArticleHtml(url: string): Promise<string | null> {
  if (!isSafeExternalUrl(url)) return null;
  try {
    const res = await fetchWithTimeout(url, FETCH_TIMEOUT_MS);
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType && !contentType.includes("text/html") && !contentType.includes("xml"))
      return null;
    return await res.text();
  } catch {
    return null;
  }
}

export type FotoPressSummary = { summary: string; highlights: string[] };

/** Gera o "Resumo FotoPress" via Lovable AI Gateway, estritamente baseado no texto coletado. */
export async function generateFotoPressSummary(
  title: string,
  text: string,
): Promise<FotoPressSummary | null> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return null;

  // O texto de entrada também passa pela limpeza: nada de tags ou tokens da fonte.
  const cleanText = sanitizeBody(text, 12_000);
  const cleanTitle = sanitizeExternalContent(title, { maxLength: 200 });
  if (cleanText.length < 200) return null;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Você é editor esportivo e escreve o 'Resumo FotoPress' em português do Brasil. " +
              "Reescreva com suas palavras, de forma fiel ao texto fornecido — nunca reproduza a matéria integral " +
              "nem copie parágrafos inteiros. Nunca invente fatos, números, datas ou declarações que não estejam no texto. " +
              "Não use marcação (HTML, markdown), links, códigos internos da fonte nem frases como 'segundo o texto'. " +
              "Responda apenas com JSON no formato pedido.",
          },
          {
            role: "user",
            content: JSON.stringify({
              titulo: cleanTitle,
              texto: cleanText,
              instrucoes: [
                "summary: 3 a 4 parágrafos curtos (total de 120 a 220 palavras), separados por \\n\\n.",
                "Primeiro parágrafo responde o quê, quem, quando e onde.",
                "highlights: 3 a 5 frases objetivas, cada uma com no máximo 140 caracteres, sem repetir o resumo palavra por palavra.",
                "Se o texto for curto demais para 3 parágrafos, escreva o que for possível sem inventar.",
              ],
              formato:
                '{"summary":"parágrafo 1\\n\\nparágrafo 2\\n\\nparágrafo 3","highlights":["ponto 1","ponto 2","ponto 3"]}',
            }),
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const payload = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = payload.choices?.[0]?.message?.content ?? "";
    const json = content.slice(content.indexOf("{"), content.lastIndexOf("}") + 1);
    const parsed = JSON.parse(json) as { summary?: string; highlights?: string[] };
    const summary = sanitizeBody(parsed.summary ?? "");
    if (summary.length < 40) return null;
    return {
      summary,
      highlights: (parsed.highlights ?? [])
        .map((h) => (typeof h === "string" ? sanitizeExternalContent(h, { maxLength: 160 }) : ""))
        .filter((h) => h.length > 3)
        .slice(0, 5),
    };
  } catch {
    return null;
  }
}
