import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { sanitizeBody, sanitizeSummary, sanitizeTitle } from "./external-content";
import {
  collectNews,
  enrichNewsItem,
  type CollectNewsResult,
  type EnrichedNewsItem,
} from "./news.functions";

/** Tipos de item vindos dos feeds (oGol) e de coleta manual (sempre "news"). */
export type NewsFeedType = "news" | "transfer" | "result" | "upcoming_match";

/** Rótulos exibidos na UI para cada tipo de item. */
export const NEWS_FEED_TYPE_LABEL: Record<NewsFeedType, string> = {
  news: "Notícia",
  transfer: "Mercado",
  result: "Resultado",
  upcoming_match: "Próximo jogo",
};

export const NEWS_FEED_TYPES: NewsFeedType[] = ["news", "transfer", "result", "upcoming_match"];

function toFeedType(value: string): NewsFeedType {
  return (NEWS_FEED_TYPES as string[]).includes(value) ? (value as NewsFeedType) : "news";
}

/** Agrupa itens de notícia pelo tipo de feed, preservando a ordem original. */
export function groupNewsByFeedType(items: NewsItem[]): Record<NewsFeedType, NewsItem[]> {
  const groups: Record<NewsFeedType, NewsItem[]> = {
    news: [],
    transfer: [],
    result: [],
    upcoming_match: [],
  };
  for (const item of items) {
    groups[toFeedType(item.feed_type)].push(item);
  }
  return groups;
}

/**
 * Base de Notícias
 * ----------------
 * Registros reais coletados das Fontes de Notícias. Sempre guardam a URL
 * original, o título publicado e a fonte — insumo para o Radar e, no futuro,
 * para conteúdo editorial original.
 */
export type NewsItem = {
  id: string;
  source_id: string | null;
  url: string;
  title: string;
  summary: string | null;
  excerpt: string | null;
  published_at: string | null;
  fact_key: string | null;
  status: string;
  feed_type: string;
  image_url: string | null;
  cover_image_url: string | null;
  article_summary: string | null;
  article_highlights: string[];
  article_content_available: boolean;
  article_enriched_at: string | null;
  entities: {
    states?: string[];
    subjects?: string[];
    source_name?: string;
    feed?: string;
    home_team?: string;
    away_team?: string;
    home_score?: number | null;
    away_score?: number | null;
    competition?: string;
    kickoff_at?: string;
  };
  related_team_ids: string[];
  related_competition_ids: string[];
  related_match_ids: string[];
  related_athlete_ids: string[];
  created_at: string;
  source: { id: string; name: string } | null;
};

/** Melhor imagem disponível: capa enriquecida → imagem coletada → nenhuma (placeholder na UI). */
export function coverImageOf(item: Pick<NewsItem, "cover_image_url" | "image_url">) {
  return item.cover_image_url ?? item.image_url ?? null;
}

/**
 * Exibição: todo texto vindo de fonte externa passa pela sanitização antes de
 * chegar à tela (entidades HTML, tags e tokens internos das fontes).
 */
export function newsTitle(item: Pick<NewsItem, "title">) {
  return sanitizeTitle(item.title) || "Sem título";
}

/** Resumo curto para cards: prioriza o Resumo FotoPress quando existir. */
export function newsSummary(item: Pick<NewsItem, "article_summary" | "summary">) {
  return sanitizeSummary(item.article_summary ?? item.summary);
}

/** Texto longo (Resumo FotoPress ou resumo da fonte) preservando parágrafos. */
export function newsBody(value: string | null | undefined) {
  return sanitizeBody(value);
}

/** Lista de pontos principais já sanitizada. */
export function newsHighlights(item: Pick<NewsItem, "article_highlights">) {
  return (item.article_highlights ?? []).map((h) => sanitizeSummary(h)).filter((h) => h.length > 0);
}

const SELECT =
  "id, source_id, url, title, summary, excerpt, published_at, fact_key, status, feed_type, image_url, cover_image_url, article_summary, article_highlights, article_content_available, article_enriched_at, entities, related_team_ids, related_competition_ids, related_match_ids, related_athlete_ids, created_at, source:content_sources(id, name)";

export function useNewsItems(limit = 60) {
  return useQuery({
    queryKey: ["news_items", limit],
    queryFn: async (): Promise<NewsItem[]> => {
      const { data, error } = await supabase
        .from("news_items")
        .select(SELECT)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as NewsItem[];
    },
  });
}

export function useCollectNews() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sourceId: string): Promise<CollectNewsResult> =>
      collectNews({ data: { sourceId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["news_items"] });
    },
  });
}

export function useEnrichNewsItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<EnrichedNewsItem> => enrichNewsItem({ data: { id } }),
    onSuccess: (result) => {
      qc.setQueryData<NewsItem[] | undefined>(["news_items", 200], (prev) =>
        prev?.map((item) => (item.id === result.id ? { ...item, ...result } : item)),
      );
      qc.invalidateQueries({ queryKey: ["news_items"] });
    },
  });
}
