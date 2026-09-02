import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";

import { getCheckoutConfig } from "./billing.functions";
import { useAuthUser } from "./profile";

/**
 * Camada comercial do FotoPress
 * ------------------------------
 * O banco é a fonte da verdade do acesso: a função `my_access()` calcula
 * status, dias restantes e vitaliciedade no servidor. O frontend só exibe.
 * Nada aqui libera acesso — o usuário não consegue mudar o próprio plano.
 */

export const FOUNDER_PLAN_CODE = "founder";
/** Configuração central do produto comercial (única fonte de verdade). */
export const FOUNDER_PRODUCT = {
  name: "FotoPress — Acesso Fundador",
  price: 97,
  priceCents: 9700,
  currency: "BRL",
  paymentType: "one_time" as const,
  accessType: "lifetime" as const,
  provider: "Kiwify",
};
export const FOUNDER_PRICE_LABEL = "R$ 97,00";
export const FOUNDER_PAYMENT_LABEL = "Pagamento único";
export const FOUNDER_ACCESS_LABEL = "Acesso vitalício";
export const TRIAL_DAYS = 7;

export const FOUNDER_FEATURES = [
  "Recursos atuais",
  "Futuras funcionalidades disponibilizadas para usuários do plano fundador",
  "Atualizações do produto",
  "Perfil personalizado",
  "Organização de jogos",
  "Minha Agenda",
  "Credenciamentos",
  "Atletas",
  "Radar",
  "Fontes",
  "E muito mais",
];

export type AccessType = "trial" | "founder" | "monthly" | "annual" | "professional" | "business";
export type AccessStatus = "trial" | "active" | "expired" | "cancelled";

export type MyAccess = {
  access_type: AccessType;
  access_status: AccessStatus;
  plan_code: string | null;
  lifetime_access: boolean;
  trial_started_at: string;
  trial_ends_at: string;
  days_left: number;
  is_active: boolean;
  /** Administrador master: acesso total e vitalício, nunca em teste. */
  is_master?: boolean;
};

/** Situação de acesso do usuário logado, calculada pelo banco. */
export function useMyAccess() {
  const { data: user } = useAuthUser();
  return useQuery({
    enabled: !!user,
    queryKey: ["my-access", user?.id],
    staleTime: 60_000,
    queryFn: async (): Promise<MyAccess | null> => {
      const { data, error } = await supabase.rpc("my_access");
      if (error) throw error;
      const row = (data as MyAccess[] | null)?.[0];
      return row ?? null;
    },
  });
}

/**
 * Monta a URL de checkout acrescentando `email` apenas quando há usuário
 * autenticado. Usa URL/URLSearchParams (encoding seguro, preserva parâmetros).
 * O parâmetro é só conveniência de preenchimento — não concede acesso.
 */
export function buildKiwifyCheckoutUrl(
  checkoutBaseUrl: string | null | undefined,
  authenticatedUserEmail?: string | null,
): string | null {
  if (!checkoutBaseUrl) return null;
  try {
    const url = new URL(checkoutBaseUrl);
    if (authenticatedUserEmail) url.searchParams.set("email", authenticatedUserEmail);
    return url.toString();
  } catch {
    return checkoutBaseUrl;
  }
}

export type CheckoutState = {
  /** URL final (já com email quando autenticado). Null enquanto não estiver pronta. */
  url: string | null;
  /** Checkout base configurado, sem parâmetros adicionais. */
  baseUrl: string | null;
  email: string | null;
  isLoading: boolean;
  authenticated: boolean;
};

/**
 * URL de checkout (configurável no admin/ambiente, nunca escrita em componentes).
 * Só fica pronta quando auth e configuração terminaram de carregar — assim um
 * usuário autenticado nunca abre o checkout sem o e-mail pré-preenchido.
 */
export function useCheckoutUrl(): CheckoutState {
  const fetchConfig = useServerFn(getCheckoutConfig);
  const { data: user, isPending: authLoading } = useAuthUser();
  const { data, isPending: configLoading } = useQuery({
    queryKey: ["checkout-config"],
    staleTime: 5 * 60_000,
    queryFn: () => fetchConfig(),
  });

  const isLoading = authLoading || configLoading;
  const email = user?.email?.trim() || null;
  const authenticated = !!user;
  const baseUrl = data?.checkoutUrl ?? null;

  return {
    url: isLoading ? null : buildKiwifyCheckoutUrl(baseUrl, email),
    baseUrl,
    email,
    isLoading,
    authenticated,
  };
}

/** E-mail autenticado que será usado no checkout (null se visitante). */
export function useCheckoutEmail() {
  const { data: user } = useAuthUser();
  return user?.email?.trim() || null;
}

/** Registra interesse do usuário em uma funcionalidade futura. */
export function useFeatureInterest(feature: string) {
  const { data: user } = useAuthUser();
  const qc = useQueryClient();

  const query = useQuery({
    enabled: !!user,
    queryKey: ["feature-interest", feature, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feature_interest")
        .select("id")
        .eq("feature", feature)
        .limit(1);
      if (error) throw error;
      return (data?.length ?? 0) > 0;
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("feature_interest").insert({ feature });
      if (error && error.code !== "23505") throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feature-interest", feature] }),
  });

  return { registered: query.data === true, register: mutation };
}

/** Acesso permanente: administrador master ou fundador vitalício. */
export function isFullAccess(access: MyAccess | null | undefined) {
  return (
    !!access && (!!access.is_master || access.lifetime_access || access.access_type === "founder")
  );
}

export function accessLabel(access: MyAccess | null | undefined) {
  if (!access) return { plan: "Teste gratuito", status: "Ativo", detail: "" };
  if (access.is_master) {
    return { plan: "Administrador Master", status: "Ativo", detail: "Acesso total vitalício" };
  }
  if (access.lifetime_access || access.access_type === "founder") {
    return { plan: "Acesso Fundador", status: "Ativo", detail: "Vitalício" };
  }
  if (access.access_status === "expired") {
    return { plan: "Teste gratuito", status: "Expirado", detail: "Teste encerrado" };
  }

  return {
    plan: "Teste gratuito",
    status: "Ativo",
    detail: `Restam ${access.days_left} ${access.days_left === 1 ? "dia" : "dias"}`,
  };
}
