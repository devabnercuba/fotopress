import { createServerFn } from "@tanstack/react-start";

/**
 * Configuração pública de checkout (Kiwify).
 * Única fonte da URL de checkout do app — nenhum componente escreve o link fixo.
 * Só devolve a URL (informação não sensível). Product ID e o token do webhook
 * nunca saem do servidor.
 */
const FALLBACK_CHECKOUT_URL = "https://pay.kiwify.com.br/8pYbV63";

export const getCheckoutConfig = createServerFn({ method: "GET" }).handler(async () => {
  const envUrl = process.env["KIWIFY_CHECKOUT_URL"] ?? FALLBACK_CHECKOUT_URL;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("billing_settings")
      .select("checkout_url")
      .eq("provider", "kiwify")
      .maybeSingle();
    return { checkoutUrl: data?.checkout_url ?? envUrl };
  } catch {
    return { checkoutUrl: envUrl };
  }
});
