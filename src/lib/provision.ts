import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";

import { claimPendingPurchase } from "./claim-purchase.functions";
import { useAuthUser } from "./profile";

/**
 * Provisionamento da conta
 * ------------------------
 * Toda conta nova precisa das próprias linhas base (perfil e configurações).
 * Nada é herdado de outros usuários: as tabelas têm `user_id default auth.uid()`
 * e RLS por dono, então cada inserção aqui pertence somente a quem está logado.
 */
type SignupMeta = {
  whatsapp?: string | null;
  feedbackOptIn?: boolean;
  founderCommunityInterest?: boolean;
};

async function provision(
  userId: string,
  email: string | null,
  fullName: string,
  signupMeta: SignupMeta = {},
) {
  const [{ data: profile }, { data: settings }, { data: access }] = await Promise.all([
    supabase.from("profiles").select("id, whatsapp").eq("user_id", userId).maybeSingle(),
    supabase.from("app_settings").select("id").eq("user_id", userId).maybeSingle(),
    supabase.from("user_access").select("id").eq("user_id", userId).maybeSingle(),
  ]);

  const [first = null, ...rest] = fullName.trim().split(/\s+/).filter(Boolean);

  const tasks: PromiseLike<unknown>[] = [];
  if (!profile) {
    tasks.push(
      supabase.from("profiles").insert({
        user_id: userId,
        email,
        first_name: first,
        last_name: rest.length ? rest.join(" ") : null,
        whatsapp: signupMeta.whatsapp ?? null,
        feedback_whatsapp_opt_in: signupMeta.feedbackOptIn ?? false,
        feedback_whatsapp_opt_in_at: signupMeta.feedbackOptIn ? new Date().toISOString() : null,
        founder_community_interest: signupMeta.founderCommunityInterest ?? false,
      }),
    );
  } else if (!profile.whatsapp && signupMeta.whatsapp) {
    // Perfil já existia sem número: completa com o informado no cadastro.
    tasks.push(
      supabase.from("profiles").update({ whatsapp: signupMeta.whatsapp }).eq("user_id", userId),
    );
  }

  if (!settings) {
    tasks.push(
      supabase.from("app_settings").insert({
        user_id: userId,
        email,
        full_name: fullName.trim() || null,
      }),
    );
  }
  if (!access) {
    // O banco força trial de 7 dias (datas calculadas por trigger).
    tasks.push(supabase.from("user_access").insert({ user_id: userId, email }));
  }
  await Promise.all(tasks);
  return tasks.length > 0;
}

/** Garante as linhas iniciais do usuário logado no primeiro acesso. */
export function useProvisionAccount() {
  const { data: user } = useAuthUser();
  const qc = useQueryClient();
  const claim = useServerFn(claimPendingPurchase);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
    const fullName = typeof meta.full_name === "string" ? meta.full_name : "";

    provision(user.id, user.email ?? null, fullName, {
      whatsapp: typeof meta.whatsapp === "string" ? meta.whatsapp : null,
      feedbackOptIn: meta.feedback_whatsapp_opt_in === true,
      founderCommunityInterest: meta.founder_community_interest === true,
    })
      .then(async (created) => {
        if (!active) return;
        if (created) {
          qc.invalidateQueries({ queryKey: ["profile"] });
          qc.invalidateQueries({ queryKey: ["app_settings"] });
          qc.invalidateQueries({ queryKey: ["my-access"] });
        }
        // Cenário A: compra feita antes do cadastro é vinculada agora.
        const outcome = await claim({});
        if (active && outcome?.claimed) {
          qc.invalidateQueries({ queryKey: ["my-access"] });
        }
      })
      .catch(() => {
        /* Silencioso: as telas criam a linha sob demanda como plano B. */
      });

    return () => {
      active = false;
    };
  }, [user, qc, claim]);
}
