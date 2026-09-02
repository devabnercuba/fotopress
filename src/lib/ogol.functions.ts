import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { OGOL_ALLOWED_URLS, OGOL_FEEDS, parseRss, type OgolFeedType } from "@/lib/ogol/rss";

/** Extrai confronto/placar do título padronizado do oGol para cards estruturados. */
function parseMatchTitle(
  title: string,
  feedType: OgolFeedType,
): { home_team?: string; away_team?: string; home_score?: number; away_score?: number } {
  if (feedType === "result") {
    const match = /^(.+?)\s+(\d+)\s*-\s*(\d+)\s+(.+)$/.exec(title);
    if (match) {
      return {
        home_team: match[1].trim(),
        away_team: match[4].trim(),
        home_score: Number(match[2]),
        away_score: Number(match[3]),
      };
    }
  }
  if (feedType === "upcoming_match") {
    const match = /^(.+?)\s+-\s+(.+)$/.exec(title);
    if (match) {
      return { home_team: match[1].trim(), away_team: match[2].trim() };
    }
  }
  return {};
}

export type OgolFeedResult = {
  feed: OgolFeedType;
  ok: boolean;
  items: number;
  inserted: number;
  duplicated: number;
  error?: string;
};

export type OgolSyncResult = {
  ok: boolean;
  message: string;
  feeds: OgolFeedResult[];
  lastSyncedAt: string;
};

const input = z.object({ sourceId: z.string().uuid() });

/**
 * Sincroniza os feeds RSS oficiais do oGol habilitados nesta fonte.
 * No máximo uma requisição por feed. Falha em um feed não apaga dados
 * existentes nem interrompe os demais.
 */
export const syncOgolSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data, context }): Promise<OgolSyncResult> => {
    const supabase = context.supabase;

    const { data: source } = await supabase
      .from("content_sources")
      .select("id, name, type, status, config")
      .eq("id", data.sourceId)
      .maybeSingle();

    if (!source || source.type !== "ogol") {
      return {
        ok: false,
        message: "Fonte integrada não encontrada.",
        feeds: [],
        lastSyncedAt: new Date().toISOString(),
      };
    }

    const config = (source.config ?? {}) as { feeds?: Partial<Record<OgolFeedType, boolean>> };
    const enabled = OGOL_FEEDS.filter((f) => config.feeds?.[f.type] !== false);
    const results: OgolFeedResult[] = [];

    for (const feed of enabled) {
      if (!OGOL_ALLOWED_URLS.has(feed.url)) continue;
      const result: OgolFeedResult = {
        feed: feed.type,
        ok: false,
        items: 0,
        inserted: 0,
        duplicated: 0,
      };
      try {
        const res = await fetch(feed.url, {
          headers: { "user-agent": "Mozilla/5.0 (compatible; FotoPressBot/1.0)" },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const items = parseRss(await res.text());
        result.items = items.length;

        if (items.length > 0) {
          const { data: existing } = await supabase
            .from("news_items")
            .select("url, guid")
            .eq("source_id", source.id)
            .in(
              "url",
              items.map((i) => i.link),
            );
          const knownUrls = new Set((existing ?? []).map((r) => r.url as string));
          const knownGuids = new Set(
            (existing ?? []).map((r) => r.guid as string | null).filter(Boolean) as string[],
          );
          const fresh = items.filter(
            (i) => !knownUrls.has(i.link) && !(i.guid && knownGuids.has(i.guid)),
          );
          result.duplicated = items.length - fresh.length;

          if (fresh.length > 0) {
            const rows = fresh.map((i) => ({
              source_id: source.id,
              user_id: context.userId,
              url: i.link,
              guid: i.guid ?? i.link,
              feed_type: feed.type,
              title: i.title,
              summary: i.description,
              excerpt: i.description,
              published_at: i.publishedAt,
              image_url: i.image,
              cover_image_url: i.image,
              status: "collected",
              entities: {
                source_name: "oGol",
                feed: feed.type,
                subjects: i.category ? [i.category] : [],
                competition: i.category ?? undefined,
                kickoff_at: i.publishedAt ?? undefined,
                ...parseMatchTitle(i.title, feed.type),
              },
            }));
            const { error } = await supabase
              .from("news_items")
              .upsert(rows, { onConflict: "user_id,url", ignoreDuplicates: true });
            if (error) throw new Error(error.message);
            result.inserted = rows.length;
          }
        }
        result.ok = true;
      } catch (error) {
        result.error = error instanceof Error ? error.message : "erro desconhecido";
      }
      results.push(result);
    }

    const failed = results.filter((r) => !r.ok);
    const lastSyncedAt = new Date().toISOString();

    await supabase
      .from("content_sources")
      .update({
        last_synced_at: lastSyncedAt,
        last_error: failed.length ? failed.map((f) => f.feed).join(", ") : null,
      })
      .eq("id", source.id);

    return {
      ok: failed.length === 0,
      message: failed.length
        ? `Não foi possível atualizar ${failed.length} feed(s).`
        : `Sincronização concluída: ${results.reduce((sum, r) => sum + r.inserted, 0)} item(ns) novo(s).`,
      feeds: results,
      lastSyncedAt,
    };
  });
