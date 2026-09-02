import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

import { sanitizeExternalContent, sanitizeSummary } from "@/lib/external-content";
import {
  extractArticle,
  fetchArticleHtml,
  generateFotoPressSummary,
} from "@/lib/news-enrich.server";

/**
 * Coleta de notícias
 * ------------------
 * Fluxo obrigatório: URL da fonte → coleta real do HTML → conteúdo encontrado →
 * IA analisa e classifica → base de notícias. A IA nunca inventa uma notícia:
 * cada registro guarda a URL original, o título publicado e a fonte.
 */

const input = z.object({ sourceId: z.string().uuid() });

export type CollectNewsResult = {
  ok: boolean;
  message: string;
  found: number;
  inserted: number;
  duplicated: number;
  classified: number;
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
        classified: 0,
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
        classified: 0,
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
        classified: 0,
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
        classified: 0,
      };
    }

    // Contexto real do banco para a IA relacionar entidades existentes.
    const [teams, competitions, athletes, matches] = await Promise.all([
      supabase.from("teams").select("id, name").limit(500),
      supabase.from("competitions").select("id, name").limit(200),
      supabase.from("athletes").select("id, name").limit(500),
      supabase
        .from("matches")
        .select("id, home_team, away_team, date")
        .gte("date", new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10))
        .limit(300),
    ]);

    type Classification = {
      index: number;
      summary?: string;
      teams?: string[];
      athletes?: string[];
      competitions?: string[];
      matches?: string[];
      states?: string[];
      subjects?: string[];
    };
    let classifications: Classification[] = [];

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (apiKey) {
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
                  "Você classifica manchetes esportivas reais. Nunca invente notícias: use apenas os títulos fornecidos. " +
                  "Relacione cada título às entidades existentes do banco, usando os IDs informados. Responda apenas JSON.",
              },
              {
                role: "user",
                content: JSON.stringify({
                  fonte: source.name,
                  clubes: (teams.data ?? []).map((t) => ({ id: t.id, nome: t.name })),
                  campeonatos: (competitions.data ?? []).map((c) => ({ id: c.id, nome: c.name })),
                  atletas: (athletes.data ?? []).map((a) => ({ id: a.id, nome: a.name })),
                  jogos: (matches.data ?? []).map((m) => ({
                    id: m.id,
                    jogo: `${m.home_team} x ${m.away_team}`,
                    data: m.date,
                  })),
                  titulos: fresh.map((c, index) => ({ index, titulo: c.title, url: c.url })),
                  formato:
                    '{"itens":[{"index":0,"summary":"resumo curto e original","teams":["id"],"athletes":["id"],"competitions":["id"],"matches":["id"],"states":["SC"],"subjects":["reforço"]}]}',
                }),
              },
            ],
          }),
        });
        if (res.ok) {
          const payload = (await res.json()) as {
            choices?: { message?: { content?: string } }[];
          };
          const text = payload.choices?.[0]?.message?.content ?? "";
          const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
          const parsed = JSON.parse(json) as { itens?: Classification[] };
          classifications = parsed.itens ?? [];
        }
      } catch {
        classifications = [];
      }
    }

    const byIndex = new Map(classifications.map((c) => [c.index, c]));
    const rows = fresh.map((c, index) => {
      const ai = byIndex.get(index);
      return {
        source_id: source.id,
        url: c.url,
        title: c.title,
        summary: sanitizeSummary(ai?.summary) || null,
        excerpt: null,
        published_at: null,
        fact_key: factKey(c.title),
        status: ai ? "classified" : "collected",
        feed_type: "news",
        image_url: c.image ?? null,
        cover_image_url: c.image ?? null,
        entities: {
          states: ai?.states ?? [],
          subjects: ai?.subjects ?? [],
          source_name: source.name,
        },
        related_team_ids: ai?.teams ?? [],
        related_competition_ids: ai?.competitions ?? [],
        related_match_ids: ai?.matches ?? [],
        related_athlete_ids: ai?.athletes ?? [],
        user_id: context.userId,
      };
    });

    const { error } = await supabase.from("news_items").upsert(rows, { onConflict: "user_id,url" });
    if (error) {
      return {
        ok: false,
        message: `Falha ao salvar notícias: ${error.message}`,
        found: candidates.length,
        inserted: 0,
        duplicated: known.size,
        classified: 0,
      };
    }

    return {
      ok: true,
      message: `${rows.length} notícia(s) coletada(s) de ${source.name}.`,
      found: candidates.length,
      inserted: rows.length,
      duplicated: known.size,
      classified: rows.filter((r) => r.status === "classified").length,
    };
  });

const enrichInput = z.object({ id: z.string().uuid() });

export type EnrichedNewsItem = {
  id: string;
  cover_image_url: string | null;
  article_summary: string | null;
  article_highlights: string[];
  article_content_available: boolean;
  article_enriched_at: string | null;
};

/**
 * Enriquecimento sob demanda: só roda na primeira abertura de uma matéria
 * (feed_type = "news"). Resultado fica em cache — chamadas seguintes com
 * `article_enriched_at` preenchido retornam imediatamente sem nova requisição
 * externa nem novo custo de IA.
 */
export const enrichNewsItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => enrichInput.parse(data))
  .handler(async ({ data, context }): Promise<EnrichedNewsItem> => {
    const supabase = context.supabase;

    const { data: item, error } = await supabase
      .from("news_items")
      .select(
        "id, url, title, feed_type, image_url, cover_image_url, article_summary, article_highlights, article_content_available, article_enriched_at",
      )
      .eq("id", data.id)
      .maybeSingle();

    if (error || !item) {
      throw new Error("Notícia não encontrada.");
    }

    // Cache: já enriquecida, não reprocessa.
    if (item.article_enriched_at) {
      return {
        id: item.id,
        cover_image_url: item.cover_image_url,
        article_summary: item.article_summary,
        article_highlights: (item.article_highlights as string[] | null) ?? [],
        article_content_available: item.article_content_available,
        article_enriched_at: item.article_enriched_at,
      };
    }

    // Só geramos resumo por IA para matérias (news); resultados, próximos
    // jogos e mercado usam apenas os dados estruturados já coletados.
    if (item.feed_type !== "news") {
      const now = new Date().toISOString();
      await supabase
        .from("news_items")
        .update({ article_content_available: false, article_enriched_at: now })
        .eq("id", item.id);
      return {
        id: item.id,
        cover_image_url: item.cover_image_url,
        article_summary: null,
        article_highlights: [],
        article_content_available: false,
        article_enriched_at: now,
      };
    }

    const html = await fetchArticleHtml(item.url);
    const now = new Date().toISOString();

    if (!html) {
      await supabase
        .from("news_items")
        .update({ article_content_available: false, article_enriched_at: now })
        .eq("id", item.id);
      return {
        id: item.id,
        cover_image_url: item.cover_image_url,
        article_summary: null,
        article_highlights: [],
        article_content_available: false,
        article_enriched_at: now,
      };
    }

    const extracted = extractArticle(html, item.url);
    const coverImage = extracted.image ?? item.cover_image_url ?? item.image_url ?? null;

    if (!extracted.text || extracted.text.length < 200) {
      await supabase
        .from("news_items")
        .update({
          cover_image_url: coverImage,
          article_content_available: false,
          article_enriched_at: now,
        })
        .eq("id", item.id);
      return {
        id: item.id,
        cover_image_url: coverImage,
        article_summary: null,
        article_highlights: [],
        article_content_available: false,
        article_enriched_at: now,
      };
    }

    const fotopress = await generateFotoPressSummary(extracted.title ?? item.title, extracted.text);

    if (!fotopress) {
      await supabase
        .from("news_items")
        .update({
          cover_image_url: coverImage,
          article_content_available: false,
          article_enriched_at: now,
        })
        .eq("id", item.id);
      return {
        id: item.id,
        cover_image_url: coverImage,
        article_summary: null,
        article_highlights: [],
        article_content_available: false,
        article_enriched_at: now,
      };
    }

    await supabase
      .from("news_items")
      .update({
        cover_image_url: coverImage,
        article_summary: fotopress.summary,
        article_highlights: fotopress.highlights,
        article_content_available: true,
        article_enriched_at: now,
      })
      .eq("id", item.id);

    return {
      id: item.id,
      cover_image_url: coverImage,
      article_summary: fotopress.summary,
      article_highlights: fotopress.highlights,
      article_content_available: true,
      article_enriched_at: now,
    };
  });
