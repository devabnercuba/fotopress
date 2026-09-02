import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { syncOgolSource, type OgolSyncResult } from "./ogol.functions";
import { OGOL_FEEDS, OGOL_FEED_LABEL, type OgolFeedType } from "./ogol/rss";
import type { Match } from "./queries";

export { OGOL_FEEDS, OGOL_FEED_LABEL };
export type { OgolFeedType, OgolSyncResult };

export const OGOL_SOURCE_TYPE = "ogol";
export const OGOL_SOURCE_NAME = "oGol";

export type OgolConfig = { feeds: Record<OgolFeedType, boolean> };

export const DEFAULT_OGOL_CONFIG: OgolConfig = {
  feeds: { news: true, transfer: true, upcoming_match: true, result: true },
};

export function readOgolConfig(config: unknown): OgolConfig {
  const feeds = (config as { feeds?: Partial<Record<OgolFeedType, boolean>> } | null)?.feeds ?? {};
  return {
    feeds: {
      news: feeds.news !== false,
      transfer: feeds.transfer !== false,
      upcoming_match: feeds.upcoming_match !== false,
      result: feeds.result !== false,
    },
  };
}

export function useOgolSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sourceId: string): Promise<OgolSyncResult> =>
      syncOgolSource({ data: { sourceId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["news_items"] });
      qc.invalidateQueries({ queryKey: ["content_sources"] });
      qc.invalidateQueries({ queryKey: ["ogol_intel"] });
    },
  });
}

/** Normaliza nomes de clube: acentos, caixa, pontuação e espaços. */
export function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Termos ambíguos demais para relacionar sozinhos (ex.: "Inter", "América"). */
const AMBIGUOUS = new Set([
  "inter",
  "america",
  "atletico",
  "nacional",
  "uniao",
  "gremio",
  "sport",
  "juventude",
  "operario",
  "ferroviario",
  "sao paulo b",
]);

/** Termos de busca seguros extraídos do nome de um clube. */
export function clubTerms(name: string): string[] {
  const full = normalizeName(name);
  if (!full) return [];
  const terms = new Set<string>();
  if (full.length >= 4) terms.add(full);
  for (const word of full.split(" ")) {
    if (word.length < 5) continue;
    if (AMBIGUOUS.has(word)) continue;
    if (["futebol", "clube", "esporte", "associacao", "sociedade"].includes(word)) continue;
    terms.add(word);
  }
  return [...terms].filter((t) => !AMBIGUOUS.has(t));
}

export function mentionsClub(text: string, name: string) {
  const haystack = ` ${normalizeName(text)} `;
  return clubTerms(name).some((term) => haystack.includes(` ${term} `));
}

export type IntelItem = {
  id: string;
  title: string;
  summary: string | null;
  url: string;
  published_at: string | null;
  feed_type: OgolFeedType;
  source_name: string;
};

const INTEL_SELECT =
  "id, title, summary, url, published_at, feed_type, created_at, source:content_sources(id, name, type, status)";

/**
 * Conteúdo do oGol relacionado aos clubes da partida, agrupado por feed.
 * Só considera fontes integradas ativas — desativar a fonte remove o conteúdo
 * do Radar sem apagar o histórico.
 */
export function useMatchIntel(match: Match | null | undefined) {
  return useQuery({
    queryKey: ["ogol_intel", match?.id],
    enabled: Boolean(match),
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Record<OgolFeedType, IntelItem[]>> => {
      const empty: Record<OgolFeedType, IntelItem[]> = {
        news: [],
        transfer: [],
        upcoming_match: [],
        result: [],
      };
      if (!match) return empty;

      const { data, error } = await supabase
        .from("news_items")
        .select(INTEL_SELECT)
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(400);
      if (error) return empty;

      const rows = (data ?? []) as unknown as (IntelItem & {
        created_at: string;
        source: { id: string; name: string; type: string; status: string } | null;
      })[];

      const clubs = [match.home_team, match.away_team].filter(Boolean) as string[];
      for (const row of rows) {
        if (row.source?.type !== OGOL_SOURCE_TYPE || row.source.status !== "active") continue;
        const haystack = `${row.title} ${row.summary ?? ""}`;
        if (!clubs.some((club) => mentionsClub(haystack, club))) continue;
        const bucket = empty[row.feed_type as OgolFeedType];
        if (!bucket || bucket.length >= 5) continue;
        bucket.push({
          id: row.id,
          title: row.title,
          summary: row.summary,
          url: row.url,
          published_at: row.published_at ?? row.created_at,
          feed_type: row.feed_type as OgolFeedType,
          source_name: row.source.name,
        });
      }
      return empty;
    },
  });
}
