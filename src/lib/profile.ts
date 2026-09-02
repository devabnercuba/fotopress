import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Perfil do usuário autenticado (uma linha por usuário). */
export type Profile = {
  id: string;
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  professional_name: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  bio: string | null;
  photo_url: string | null;
  logo_url: string | null;
  onboarded: boolean;
  /** WhatsApp da conta em E.164 sem "+" (dado privado). */
  whatsapp: string | null;
  feedback_whatsapp_opt_in: boolean;
  founder_community_interest: boolean;
};

const SELECT =
  "id, user_id, first_name, last_name, professional_name, email, city, state, bio, photo_url, logo_url, onboarded, whatsapp, feedback_whatsapp_opt_in, founder_community_interest";

/** Usuário autenticado atual (null quando deslogado). */
export function useAuthUser() {
  return useQuery({
    queryKey: ["auth-user"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data } = await supabase.auth.getUser();
      return data.user ?? null;
    },
  });
}

/** Perfil do usuário logado; cria a linha automaticamente no primeiro acesso. */
export function useProfile() {
  const { data: user } = useAuthUser();
  return useQuery({
    enabled: !!user,
    queryKey: ["profile", user?.id],
    queryFn: async (): Promise<Profile | null> => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select(SELECT)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      if (data) return data as unknown as Profile;

      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const fullName = typeof meta.full_name === "string" ? meta.full_name : "";
      const [first = null, ...rest] = fullName.trim().split(/\s+/).filter(Boolean);
      const { data: created, error: createError } = await supabase
        .from("profiles")
        .insert({
          user_id: user.id,
          email: user.email ?? null,
          first_name: first,
          last_name: rest.length ? rest.join(" ") : null,
          whatsapp: typeof meta.whatsapp === "string" ? meta.whatsapp : null,
          feedback_whatsapp_opt_in: meta.feedback_whatsapp_opt_in === true,
          founder_community_interest: meta.founder_community_interest === true,
        })

        .select(SELECT)
        .single();
      if (createError) throw createError;
      return created as unknown as Profile;
    },
  });
}

export function useProfileMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Profile> & { id: string }) => {
      const { error } = await supabase.from("profiles").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}

/** Nome exibido na interface: nome profissional > nome > e-mail. */
export function displayName(profile?: Profile | null, email?: string | null) {
  const full = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ").trim();
  return profile?.professional_name?.trim() || full || email?.split("@")[0] || "Usuário";
}

export function firstNameOf(profile?: Profile | null, email?: string | null) {
  return displayName(profile, email).split(/\s+/)[0];
}

export function initialsOf(name: string) {
  const parts = name.split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "U";
}
