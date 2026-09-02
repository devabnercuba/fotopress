import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

/**
 * Fontes de Notícias
 * ------------------
 * Uma fonte é um SITE/PORTAL que o sistema poderá varrer para encontrar
 * notícias reais. Ela NÃO alimenta o calendário de partidas (isso é papel das
 * Fontes de Jogos) e NÃO é limitada a um campeonato — a IA identifica o
 * contexto de cada notícia coletada.
 */
export type ContentSource = {
  id: string;
  name: string;
  type: string;
  url: string | null;
  status: string;
  created_at: string;
  config: Json;
  last_synced_at: string | null;
  last_error: string | null;
};

export type ContentSourceInput = {
  name: string;
  type: string;
  url: string | null;
  status: string;
  config?: Json;
};

/** Tipos previstos. Hoje só "url" é coletável; os demais ficam preparados. */
export const SOURCE_TYPES = [
  { value: "url", label: "URL (site)" },
  { value: "rss", label: "RSS (em breve)" },
  { value: "api", label: "API (em breve)" },
  { value: "official", label: "Site oficial (em breve)" },
  { value: "feed", label: "Feed (em breve)" },
] as const;

const SELECT = "id, name, type, url, status, created_at, config, last_synced_at, last_error";

export function useContentSources() {
  return useQuery({
    queryKey: ["content_sources"],
    queryFn: async (): Promise<ContentSource[]> => {
      const { data, error } = await supabase.from("content_sources").select(SELECT).order("name");
      if (error) throw error;
      return (data ?? []) as unknown as ContentSource[];
    },
  });
}

export function useContentSourceMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["content_sources"] });
  };
  /** Fonte + notícias mudaram: Base de notícias e Radar precisam recarregar. */
  const invalidateAll = () => {
    invalidate();
    qc.invalidateQueries({ queryKey: ["news_items"] });
    qc.invalidateQueries({ queryKey: ["ogol_intel"] });
    qc.invalidateQueries({ queryKey: ["radar"] });
  };

  const create = useMutation({
    mutationFn: async (input: ContentSourceInput): Promise<string> => {
      const { data, error } = await supabase
        .from("content_sources")
        .insert(input)
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...input }: ContentSourceInput & { id: string }) => {
      const { error } = await supabase.from("content_sources").update(input).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /**
   * Exclui a fonte em uma única transação no banco. Com `deleteNews`, remove
   * também as notícias sincronizadas por ela (somente do usuário atual).
   */
  const remove = useMutation({
    mutationFn: async ({
      id,
      deleteNews,
    }: {
      id: string;
      deleteNews: boolean;
    }): Promise<number> => {
      const { data, error } = await supabase.rpc("delete_content_source", {
        p_source_id: id,
        p_delete_news: deleteNews,
      });
      if (error) throw error;
      return (data as number) ?? 0;
    },
    onSuccess: invalidateAll,
  });

  /** Mantém a fonte configurada e apaga apenas as notícias já coletadas. */
  const clearNews = useMutation({
    mutationFn: async (id: string): Promise<number> => {
      const { data, error } = await supabase.rpc("clear_content_source_news", {
        p_source_id: id,
      });
      if (error) throw error;
      return (data as number) ?? 0;
    },
    onSuccess: invalidateAll,
  });

  return { create, update, remove, clearNews };
}
