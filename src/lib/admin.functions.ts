import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PrivilegeRow = {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  isMasterAdmin: boolean;
  roles: string[];
};

/**
 * Lista de usuários com os papéis reconhecidos pelo sistema.
 * Só o administrador master consegue executar: a verificação usa a sessão do
 * requisitante (RLS), antes de qualquer acesso privilegiado.
 */
export const listPrivileges = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PrivilegeRow[]> => {
    const { data: isMaster, error: roleError } = await context.supabase.rpc("is_master_admin", {
      _user_id: context.userId,
    });
    if (roleError) throw roleError;
    if (isMaster !== true) throw new Response("Forbidden", { status: 403 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: users, error: usersError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (usersError) throw usersError;

    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role");
    if (rolesError) throw rolesError;

    const byUser = new Map<string, string[]>();
    for (const row of roles ?? []) {
      byUser.set(row.user_id, [...(byUser.get(row.user_id) ?? []), row.role]);
    }

    return users.users.map((u) => {
      const userRoles = byUser.get(u.id) ?? [];
      return {
        id: u.id,
        email: u.email ?? "—",
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
        isMasterAdmin:
          userRoles.includes("admin") && (u.email ?? "").toLowerCase() === "cubaabner@gmail.com",
        roles: userRoles.length ? userRoles : ["user"],
      };
    });
  });
