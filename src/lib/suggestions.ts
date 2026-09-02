import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Sugestões de funcionalidades
 * ----------------------------
 * Cada usuário cria e acompanha as próprias sugestões (RLS por user_id).
 * Administradores enxergam todas e podem alterar status e resposta.
 */
export type SuggestionStatus =
  "new" | "read" | "planned" | "in_progress" | "done" | "declined" | "archived";

export type Suggestion = {
  id: string;
  user_id: string;
  title: string;
  description: string;
  category: string;
  status: SuggestionStatus;
  admin_note: string | null;
  created_at: string;
};

export const SUGGESTION_STATUS: { value: SuggestionStatus; label: string }[] = [
  { value: "new", label: "Nova" },
  { value: "read", label: "Lida" },
  { value: "planned", label: "Planejada" },
  { value: "in_progress", label: "Em desenvolvimento" },
  { value: "done", label: "Concluída" },
  { value: "declined", label: "Recusada" },
  { value: "archived", label: "Arquivada" },
];

export const SUGGESTION_CATEGORIES = [
  "geral",
  "jogos",
  "credenciamento",
  "radar",
  "importação",
  "relatórios",
] as const;

export function statusLabel(status: string) {
  return SUGGESTION_STATUS.find((s) => s.value === status)?.label ?? status;
}

const SELECT = "id, user_id, title, description, category, status, admin_note, created_at";

/** RLS já limita o resultado: usuário vê as suas, admin vê todas. */
export function useSuggestions() {
  return useQuery({
    queryKey: ["suggestions"],
    queryFn: async (): Promise<Suggestion[]> => {
      const { data, error } = await supabase
        .from("feature_suggestions")
        .select(SELECT)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Suggestion[];
    },
  });
}

export function useSuggestionMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["suggestions"] });

  const create = useMutation({
    mutationFn: async (input: { title: string; description: string; category: string }) => {
      const { error } = await supabase.from("feature_suggestions").insert(input);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: { id: string } & Partial<
      Pick<Suggestion, "status" | "admin_note" | "title" | "description">
    >) => {
      const { error } = await supabase.from("feature_suggestions").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("feature_suggestions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

/**
 * Autores das sugestões.
 * `feature_suggestions.user_id` aponta para `auth.users`, então buscamos os
 * nomes em `profiles` (o administrador master enxerga todos pelas policies).
 */
export type SuggestionAuthor = { name: string; email: string | null };

export function useSuggestionAuthors(enabled = true) {
  return useQuery({
    queryKey: ["suggestion-authors"],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<Record<string, SuggestionAuthor>> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, professional_name, email");
      if (error) return {};
      const map: Record<string, SuggestionAuthor> = {};
      for (const p of data ?? []) {
        const name =
          p.professional_name?.trim() ||
          [p.first_name, p.last_name].filter(Boolean).join(" ").trim() ||
          p.email ||
          "Usuário";
        map[p.user_id] = { name, email: p.email };
      }
      return map;
    },
  });
}

/** Quantidade de sugestões ainda não lidas (status = new). Usada nos badges. */
export function useNewSuggestionsCount(enabled = true) {
  const { data: suggestions = [] } = useSuggestions();
  if (!enabled) return 0;
  return suggestions.filter((s) => s.status === "new").length;
}

/**
 * Observa INSERTs em tempo real na tabela de sugestões.
 * Usado apenas pelo administrador: dispara um toast discreto e revalida a
 * listagem (o badge continua correto mesmo se o admin estiver offline, pois é
 * calculado a partir dos dados carregados no próximo acesso).
 */
export function useSuggestionsRealtime(enabled: boolean, onNew: (suggestion: Suggestion) => void) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;
    const channel = supabase
      .channel("feature-suggestions-admin")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "feature_suggestions" },
        (payload) => {
          qc.invalidateQueries({ queryKey: ["suggestions"] });
          onNew(payload.new as Suggestion);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, qc]);
}
