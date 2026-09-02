import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/** Chaves estáveis dos blocos da página "Primeiros passos". */
export const HELP_SECTION_KEYS = [
  "videos",
  "setup_checklist",
  "guides",
  "additional_content",
] as const;

export type HelpSectionKey = (typeof HELP_SECTION_KEYS)[number];

export const HELP_SECTION_LABELS: Record<HelpSectionKey, string> = {
  videos: "Aprenda com vídeos",
  setup_checklist: "Configure seu FotoPress",
  guides: "Comece por aqui",
  additional_content: "Outros conteúdos",
};

export type HelpSection = {
  section_key: HelpSectionKey;
  sort_order: number;
  is_visible: boolean;
};

const DEFAULT_SECTIONS: HelpSection[] = HELP_SECTION_KEYS.map((key, i) => ({
  section_key: key,
  sort_order: i,
  is_visible: true,
}));

/** Ordem global dos blocos (uma única leitura, com fallback para o padrão). */
export function useHelpSections() {
  return useQuery({
    queryKey: ["help-page-sections"],
    staleTime: 60_000,
    queryFn: async (): Promise<HelpSection[]> => {
      const { data, error } = await supabase
        .from("help_page_sections")
        .select("section_key, sort_order, is_visible")
        .order("sort_order");
      if (error || !data?.length) return DEFAULT_SECTIONS;

      const saved = new Map(data.map((row) => [row.section_key, row]));
      return [...DEFAULT_SECTIONS]
        .map((fallback) => {
          const row = saved.get(fallback.section_key);
          return row
            ? {
                section_key: fallback.section_key,
                sort_order: row.sort_order,
                is_visible: row.is_visible,
              }
            : fallback;
        })
        .sort((a, b) => a.sort_order - b.sort_order);
    },
  });
}

/** Salva a nova ordem/visibilidade — permitido apenas ao administrador (RLS). */
export function useSaveHelpSections() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (sections: HelpSection[]) => {
      const rows = sections.map((s, i) => ({
        section_key: s.section_key,
        sort_order: i,
        is_visible: s.is_visible,
      }));
      const { error } = await supabase
        .from("help_page_sections")
        .upsert(rows, { onConflict: "section_key" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["help-page-sections"] }),
  });
}
