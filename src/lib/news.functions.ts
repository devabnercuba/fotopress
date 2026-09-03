import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

import { sanitizeExternalContent } from "@/lib/external-content";

/**
 * Coleta de notícias
 * ------------------
 * Fluxo: URL da fonte → coleta real do HTML → extração de títulos, URLs e imagens → base de notícias.
 * Cada registro guarda a URL original, o título publicado e a fonte.
 */

const input = z.object({ sourceId: z.string().uuid() });

export type CollectNewsResult = {
  ok: boolean;
  message: string;
  found: number;
  inserted: number;
  duplicated: number;
};

type Candidate = { url: string; title: string; image?: string | null };

/** Extrai uma imagem plausível associada a um link, olhando o HTML ao redor da âncora. */
function extractNearbyImage(html: string, href: string): string | null {
  const anchorIdx = html.indexOf(href);
  if (anchorIdx === -1) return null;
  const window = html.slice(Math.max(0, anchorIdx - 800), anchorIdx + 800);
  const img =
    /<img\b[^>]*\bsrc=["']([^"']+)["']/i.exec(window) ??
    /<img\b[^>]*\bdata-src=["']([^"']+)["']/i.exec(window);
  return img ? img[1] : null;
}

function safeAbsoluteImage(value: string | null, base: URL): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, base);
    if (!/^https?:$/.test(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function decode(value: string) {
  return sanitizeExternalContent(value);
}

/** Extrai manchetes reais do HTML da página inicial da fonte. */
export function extractCandidates(html: string, baseUrl: string, limit = 25): Candidate[] {
  const base = new URL(baseUrl);
  const seen = new Set<string>();
  const out: (Candidate & { image: string | null })[] = [];
  const anchor = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;

  while ((match = anchor.exec(html)) && out.length < limit) {
    const href = match[1];
    const title = decode(match[2].replace(/<[^>]+>/g, " "));
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) continue;
    if (title.length < 25 || title.length > 220) continue;
    if (/^(assine|leia mais|veja mais|publicidade|menu|home)$/i.test(title)) continue;

    let url: URL;
    try {
      url = new URL(href, base);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(url.protocol)) continue;
    if (url.hostname.replace(/^www\./, "") !== base.hostname.replace(/^www\./, "")) continue;
    url.hash = "";
    const key = url.toString();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ url: key, title, image: safeAbsoluteImage(extractNearbyImage(html, href), base) });
  }
  return out;
}

/** Chave aproximada do fato noticiado, usada para agrupar fontes diferentes. */
export function factKey(title: string) {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .sort()
    .slice(0, 8)
    .join("-");
}

export const collectNews = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data, context }): Promise<CollectNewsResult> => {
    // Cliente autenticado: cada usuário coleta notícias apenas para a própria base.
    const supabase = context.supabase;

    const { data: source } = await supabase
      .from("content_sources")
      .select("id, name, url, type, status")
      .eq("id", data.sourceId)
      .maybeSingle();

    if (!source?.url) {
      return {
        ok: false,
        message: "Fonte sem URL cadastrada.",
        found: 0,
        inserted: 0,
        duplicated: 0,
      };
    }

    let html = "";
    try {
      const res = await fetch(source.url, {
        headers: { "user-agent": "Mozilla/5.0 (compatible; FotoPressBot/1.0)" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      html = await res.text();
    } catch (error) {
      return {
        ok: false,
        message: `Não foi possível acessar a fonte: ${
          error instanceof Error ? error.message : "erro desconhecido"
        }`,
        found: 0,
        inserted: 0,
        duplicated: 0,
      };
    }

    const candidates = extractCandidates(html, source.url);
    if (candidates.length === 0) {
      return {
        ok: false,
        message: "Nenhuma notícia identificada nesta página.",
        found: 0,
        inserted: 0,
        duplicated: 0,
      };
    }

    // Evita duplicação: mesma URL nunca entra duas vezes.
    const { data: existing } = await supabase
      .from("news_items")
      .select("url")
      .in(
        "url",
        candidates.map((c) => c.url),
      );
    const known = new Set((existing ?? []).map((r) => r.url as string));
    const fresh = candidates.filter((c) => !known.has(c.url));

    if (fresh.length === 0) {
      return {
        ok: true,
        message: "Nada novo: todas as notícias encontradas já estavam na base.",
        found: candidates.length,
        inserted: 0,
        duplicated: candidates.length,
      };
    }

    const rows = fresh.map((c) => ({
      source_id: source.id,
      url: c.url,
      title: c.title,
      summary: null,
      excerpt: null,
      published_at: null,
      fact_key: factKey(c.title),
      status: "collected",
      feed_type: "news",
      image_url: c.image ?? null,
      cover_image_url: c.image ?? null,
      entities: {
        source_name: source.name,
      },
      related_team_ids: [],
      related_competition_ids: [],
      related_match_ids: [],
      related_athlete_ids: [],
      user_id: context.userId,
    }));

    const { error } = await supabase.from("news_items").upsert(rows, { onConflict: "user_id,url" });
    if (error) {
      return {
        ok: false,
        message: `Falha ao salvar notícias: ${error.message}`,
        found: candidates.length,
        inserted: 0,
        duplicated: known.size,
      };
    }

    return {
      ok: true,
      message: `${rows.length} notícia(s) coletada(s) de ${source.name}.`,
      found: candidates.length,
      inserted: rows.length,
      duplicated: known.size,
    };
  });
