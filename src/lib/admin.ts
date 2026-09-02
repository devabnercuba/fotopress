import { useQuery } from "@tanstack/react-query";
import { redirect } from "@tanstack/react-router";

import { supabase } from "@/integrations/supabase/client";

/**
 * Controle de administração
 * -------------------------
 * Existe um único administrador master no sistema. A verificação real acontece
 * no banco (função `is_master_admin`, usada também pelas políticas de RLS);
 * aqui apenas espelhamos o resultado para esconder/bloquear a interface.
 */
export const MASTER_ADMIN_EMAIL = "cubaabner@gmail.com";

/** Consulta o banco para saber se o usuário logado é o administrador master. */
export async function fetchIsMasterAdmin(): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return false;
  const { data, error } = await supabase.rpc("is_master_admin", { _user_id: user.id });
  if (error) return false;
  return data === true;
}

/** Hook para exibir ou esconder elementos administrativos. */
export function useIsMasterAdmin() {
  return useQuery({
    queryKey: ["is-master-admin"],
    staleTime: 60_000,
    queryFn: fetchIsMasterAdmin,
  });
}

/**
 * Guarda de rota: bloqueia o acesso direto por URL a qualquer página
 * administrativa quando o usuário não é o administrador master.
 */
export async function requireMasterAdmin() {
  if (!(await fetchIsMasterAdmin())) {
    throw redirect({ to: "/dashboard" });
  }
}
