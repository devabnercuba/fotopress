import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { useAuthUser } from "./profile";
import { isValidSportKey } from "./sport-preferences";

const VALID_ACCENTS = ["indigo", "emerald", "amber", "rose", "slate"] as const;

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
  accent: string;
  language: string;
  first_day_of_week: number;
  /** Modalidade principal escolhida pelo usuário. */
  primary_sport: string;
  /** Modalidades ativas do usuário (personalização da interface). */
  sports: string[];
};

const SELECT =
  "id, full_name, company, city, state, phone, email, photo_url, logo_url, agency, default_credit, instagram, website, max_radius_km, min_value, favorite_competitions, favorite_states, theme, accent, language, first_day_of_week, primary_sport, sports";

export function useSettings() {
  const { data: user } = useAuthUser();
  return useQuery({
    enabled: !!user,
    queryKey: ["app_settings", user?.id],
    queryFn: async (): Promise<AppSettings> => {
      // Ordena por updated_at DESC e created_at DESC para garantir que
      // a linha mais recente seja retornada mesmo na presença de linhas duplicadas.
      const { data, error } = await supabase
        .from("app_settings")
        .select(SELECT)
        .eq("user_id", user!.id)
        .order("updated_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false, nullsFirst: false })
        .limit(1);
      if (error) throw error;
      const row = data?.[0];
      if (row) return normalizeSettings(row as Record<string, unknown>);
      const { data: created, error: createError } = await supabase
        .from("app_settings")
        .upsert({ user_id: user!.id }, { onConflict: "user_id" })
        .select(SELECT)
        .single();
      if (createError) throw createError;
      return normalizeSettings(created as unknown as Record<string, unknown>);
    },
  });
}

export function normalizeSettings(row: Record<string, unknown>): AppSettings {
  const list = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);
  const rawPrimary = typeof row.primary_sport === "string" ? row.primary_sport.trim() : "";
  const primary_sport = isValidSportKey(rawPrimary) ? rawPrimary : "futebol";

  const rawAccent = typeof row.accent === "string" ? row.accent.trim() : "";
  const accent =
    rawAccent && VALID_ACCENTS.includes(rawAccent as (typeof VALID_ACCENTS)[number])
      ? rawAccent
      : "indigo";

  return {
    ...(row as unknown as AppSettings),
    primary_sport,
    accent,
    favorite_competitions: list(row.favorite_competitions),
    favorite_states: list(row.favorite_states),
    sports: list(row.sports),
  };
}

export function useSettingsMutation() {
  const qc = useQueryClient();
  const { data: user } = useAuthUser();

  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<AppSettings> & { id: string }) => {
      const userId = user?.id ?? (await supabase.auth.getUser()).data.user?.id;
      if (!userId) {
        throw new Error("Usuário não autenticado para atualizar configurações.");
      }

      // 1. Confirma que os campos obrigatórios estão sendo enviados ao Supabase
      const payload: Record<string, unknown> = {
        ...patch,
      };

      if (patch.primary_sport !== undefined) {
        payload.primary_sport = patch.primary_sport;
      }
      if (patch.sports !== undefined) {
        payload.sports = patch.sports;
      }
      if (patch.accent !== undefined) {
        payload.accent = patch.accent;
      }

      // 2. Identifica a linha correta de app_settings pelo id e pelo usuário autenticado.
      // 3. Depois do update, utiliza .select(SELECT).single(). Se nenhuma linha for modificada, lança erro.
      const { data, error } = await supabase
        .from("app_settings")
        .update(payload)
        .eq("id", id)
        .eq("user_id", userId)
        .select(SELECT)
        .single();

      if (error) throw error;
      if (!data) {
        throw new Error("Nenhuma linha de configurações foi modificada.");
      }

      return normalizeSettings(data as Record<string, unknown>);
    },
    onSuccess: (updatedSettings) => {
      // 4. Atualiza o cache do usuário e invalida para manter consistência
      if (user?.id) {
        qc.setQueryData(["app_settings", user.id], updatedSettings);
      }
      qc.invalidateQueries({ queryKey: ["app_settings"] });
    },
  });
}
