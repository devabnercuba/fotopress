import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { useAuthUser } from "./profile";

/**
 * Configurações do app (perfil, fotógrafo, preferências e aparência).
 * Hoje é uma linha única — a estrutura já está pronta para virar
 * "uma linha por usuário" quando o modo SaaS for ligado.
 */
export type AppSettings = {
  id: string;
  full_name: string | null;
  company: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  photo_url: string | null;
  logo_url: string | null;
  agency: string | null;
  default_credit: string | null;
  instagram: string | null;
  website: string | null;
  max_radius_km: number | null;
  min_value: number | null;
  favorite_competitions: string[];
  favorite_states: string[];
  theme: string;
  language: string;
  first_day_of_week: number;
  /** Modalidades ativas do usuário (personalização da interface). */
  sports: string[];
};

const SELECT =
  "id, full_name, company, city, state, phone, email, photo_url, logo_url, agency, default_credit, instagram, website, max_radius_km, min_value, favorite_competitions, favorite_states, theme, language, first_day_of_week, sports";

export function useSettings() {
  const { data: user } = useAuthUser();
  return useQuery({
    enabled: !!user,
    queryKey: ["app_settings", user?.id],
    queryFn: async (): Promise<AppSettings> => {
      // Uma linha por usuário: o filtro explícito acompanha a política de RLS.
      const { data, error } = await supabase
        .from("app_settings")
        .select(SELECT)
        .eq("user_id", user!.id)
        .limit(1);
      if (error) throw error;
      const row = data?.[0];
      if (row) return normalize(row as Record<string, unknown>);
      const { data: created, error: createError } = await supabase
        .from("app_settings")
        .insert({ user_id: user!.id })
        .select(SELECT)
        .single();
      if (createError) throw createError;
      return normalize(created as unknown as Record<string, unknown>);
    },
  });
}

function normalize(row: Record<string, unknown>): AppSettings {
  const list = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);
  return {
    ...(row as unknown as AppSettings),
    favorite_competitions: list(row.favorite_competitions),
    favorite_states: list(row.favorite_states),
    sports: list(row.sports),
  };
}

export function useSettingsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<AppSettings> & { id: string }) => {
      const { error } = await supabase.from("app_settings").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["app_settings"] }),
  });
}
