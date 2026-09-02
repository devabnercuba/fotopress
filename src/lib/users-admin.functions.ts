import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type AccountStatus = "active" | "inactive" | "blocked" | "deleted";

export type AdminUserRow = {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  firstName: string | null;
  lastName: string | null;
  professionalName: string | null;
  photoUrl: string | null;
  city: string | null;
  state: string | null;
  bio: string | null;
  whatsapp: string | null;
  feedbackOptIn: boolean;
  communityInterest: boolean;
  postTrialContactedAt: string | null;
  accountStatus: AccountStatus;
  blockedReason: string | null;
  blockedAt: string | null;
  deletedAt: string | null;
  isMasterAdmin: boolean;
  plan: string | null;
  accessType: string | null;
  accessStatus: string | null;
  accessSource: string | null;
  lifetime: boolean;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  activatedAt: string | null;
};

export type AdminAuditRow = {
  id: string;
  action: string;
  reason: string | null;
  adminEmail: string | null;
  metadata: Record<string, string | number | boolean | null>;
  createdAt: string;
};

export type BillingPurchase = {
  id: string;
  provider: string;
  event: string;
  status: string | null;
  result: string;
  productId: string | null;
  offerId: string | null;
  transactionId: string | null;
  buyerEmail: string | null;
  createdAt: string;
};

export type AdminUserDetail = {
  user: AdminUserRow;
  history: AdminAuditRow[];
  purchases: BillingPurchase[];
};

export type AdminStats = {
  total: number;
  active: number;
  trials: number;
  founders: number;
  blocked: number;
  pendingPurchases: number;
};

const MASTER_EMAIL = "cubaabner@gmail.com";

type AdminClient = SupabaseClient<Database>;
type Ctx = { supabase: SupabaseClient; userId: string; claims: Record<string, unknown> };

/** Garante que o requisitante é o administrador master (verificação no banco). */
async function assertMaster(context: Ctx): Promise<AdminClient> {
  const { data, error } = await context.supabase.rpc(
    "is_master_admin" as never,
    {
      _user_id: context.userId,
    } as never,
  );
  if (error) throw error;
  if (data !== true) throw new Response("Forbidden", { status: 403 });
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as AdminClient;
}

async function logAction(
  admin: AdminClient,
  context: Ctx,
  input: {
    targetUserId: string | null;
    targetEmail?: string | null;
    action: string;
    reason?: string | null;
    metadata?: Record<string, string | number | boolean | null>;
  },
) {
  await admin.from("admin_audit_logs").insert({
    admin_user_id: context.userId,
    admin_email: (context.claims?.email as string) ?? MASTER_EMAIL,
    target_user_id: input.targetUserId,
    target_email: input.targetEmail ?? null,
    action: input.action,
    reason: input.reason ?? null,
    metadata: input.metadata ?? {},
  });
}

function buildRow(
  u: { id: string; email?: string | null; created_at: string; last_sign_in_at?: string | null },
  profile: Record<string, unknown> | null | undefined,
  access: Record<string, unknown> | null | undefined,
  isMaster: boolean,
): AdminUserRow {
  return {
    id: u.id,
    email: u.email ?? "—",
    createdAt: u.created_at,
    lastSignInAt: u.last_sign_in_at ?? null,
    firstName: (profile?.first_name as string) ?? null,
    lastName: (profile?.last_name as string) ?? null,
    professionalName: (profile?.professional_name as string) ?? null,
    photoUrl: (profile?.photo_url as string) ?? null,
    city: (profile?.city as string) ?? null,
    state: (profile?.state as string) ?? null,
    bio: (profile?.bio as string) ?? null,
    whatsapp: (profile?.whatsapp as string) ?? null,
    feedbackOptIn: Boolean(profile?.feedback_whatsapp_opt_in),
    communityInterest: Boolean(profile?.founder_community_interest),
    postTrialContactedAt: profile?.post_trial_contacted_at ?? null,
    accountStatus: (profile?.account_status ?? "active") as AccountStatus,
    blockedReason: profile?.blocked_reason ?? null,
    blockedAt: profile?.blocked_at ?? null,
    deletedAt: profile?.deleted_at ?? null,
    isMasterAdmin: isMaster,
    plan: access?.plan_code ?? (access?.access_type === "trial" ? "trial" : null),
    accessType: access?.access_type ?? null,
    accessStatus: access?.access_status ?? null,
    accessSource: access?.source ?? null,
    lifetime: Boolean(access?.lifetime_access),
    trialStartedAt: access?.trial_started_at ?? null,
    trialEndsAt: access?.trial_ends_at ?? null,
    activatedAt: access?.activated_at ?? null,
  };
}

/** Lista administrativa de usuários com perfil, plano e acesso. */
export const listAdminUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ rows: AdminUserRow[]; stats: AdminStats }> => {
    const admin = await assertMaster(context as Ctx);

    const { data: users, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 500 });
    if (error) throw error;

    const [{ data: profiles }, { data: accesses }, { data: pending }] = await Promise.all([
      admin.from("profiles").select("*"),
      admin.from("user_access").select("*"),
      admin.from("billing_events").select("id").eq("result", "pending_link"),
    ]);

    const profileBy = new Map(
      (profiles ?? []).map((p: Record<string, unknown>) => [p.user_id as string, p]),
    );
    const accessBy = new Map(
      (accesses ?? []).map((a: Record<string, unknown>) => [a.user_id as string, a]),
    );

    const rows = users.users.map((u) =>
      buildRow(
        u,
        profileBy.get(u.id),
        accessBy.get(u.id),
        (u.email ?? "").toLowerCase() === MASTER_EMAIL,
      ),
    );

    const stats: AdminStats = {
      total: rows.length,
      active: rows.filter((r) => r.accountStatus === "active").length,
      trials: rows.filter((r) => r.accessType === "trial" && r.accessStatus === "trial").length,
      founders: rows.filter((r) => r.accessType === "founder" && r.accessStatus !== "cancelled")
        .length,
      blocked: rows.filter((r) => r.accountStatus === "blocked").length,
      pendingPurchases: (pending ?? []).length,
    };

    return { rows, stats };
  });

/** Detalhe completo de um usuário: perfil, plano, compras e histórico. */
export const getAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string }) => input)
  .handler(async ({ data, context }): Promise<AdminUserDetail> => {
    const admin = await assertMaster(context as Ctx);

    const { data: authUser, error } = await admin.auth.admin.getUserById(data.userId);
    if (error) throw error;

    const [{ data: profile }, { data: access }, { data: logs }] = await Promise.all([
      admin.from("profiles").select("*").eq("user_id", data.userId).maybeSingle(),
      admin.from("user_access").select("*").eq("user_id", data.userId).maybeSingle(),
      admin
        .from("admin_audit_logs")
        .select("*")
        .eq("target_user_id", data.userId)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    const email = authUser.user?.email ?? null;
    const { data: events } = await admin
      .from("billing_events")
      .select("*")
      .or(`user_id.eq.${data.userId}${email ? `,buyer_email.eq.${email}` : ""}`)
      .order("created_at", { ascending: false })
      .limit(50);

    return {
      user: buildRow(
        {
          id: authUser.user!.id,
          email,
          created_at: authUser.user!.created_at,
          last_sign_in_at: authUser.user!.last_sign_in_at,
        },
        profile,
        access,
        (email ?? "").toLowerCase() === MASTER_EMAIL,
      ),
      history: (logs ?? []).map((l: Record<string, unknown>) => ({
        id: l.id as string,
        action: l.action as string,
        reason: (l.reason as string) ?? null,
        adminEmail: l.admin_email as string,
        metadata: (l.metadata ?? {}) as Record<string, string | number | boolean | null>,
        createdAt: l.created_at as string,
      })),
      purchases: (events ?? []).map((e: Record<string, unknown>) => ({
        id: e.id as string,
        provider: (e.provider as string) ?? "kiwify",
        event: e.event as string,
        status: (e.status as string) ?? null,
        result: (e.result as string) ?? null,
        productId: (e.product_id as string) ?? null,
        offerId: (e.offer_id as string) ?? null,
        transactionId: (e.transaction_id as string) ?? null,
        buyerEmail: (e.buyer_email as string) ?? null,
        createdAt: e.created_at as string,
      })),
    };
  });

/** Atualiza dados de perfil do usuário (nunca senha). */
export const updateAdminUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      userId: string;
      firstName: string;
      lastName: string;
      professionalName: string;
      city: string;
      state: string;
      bio: string;
      whatsapp?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const admin = await assertMaster(context as Ctx);

    const patch = {
      first_name: data.firstName || null,
      last_name: data.lastName || null,
      professional_name: data.professionalName || null,
      city: data.city || null,
      state: data.state || null,
      bio: data.bio || null,
      ...(data.whatsapp === undefined ? {} : { whatsapp: data.whatsapp || null }),
    };

    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("user_id", data.userId)
      .maybeSingle();

    if (existing) {
      const { error } = await admin.from("profiles").update(patch).eq("user_id", data.userId);
      if (error) throw error;
    } else {
      const { error } = await admin.from("profiles").insert({ user_id: data.userId, ...patch });
      if (error) throw error;
    }

    await logAction(admin, context as Ctx, {
      targetUserId: data.userId,
      action: "user_updated",
      metadata: patch,
    });
    return { ok: true };
  });

/** Ativa, desativa, bloqueia ou exclui logicamente uma conta. */
export const setAccountStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; status: AccountStatus; reason?: string }) => input)
  .handler(async ({ data, context }) => {
    const admin = await assertMaster(context as Ctx);
    if (data.userId === (context as Ctx).userId) {
      throw new Response("Não é possível alterar a própria conta", { status: 400 });
    }

    const now = new Date().toISOString();
    const patch = {
      account_status: data.status,
      blocked_reason: data.status === "blocked" ? (data.reason ?? null) : null,
      blocked_at: data.status === "blocked" ? now : null,
      blocked_by: data.status === "blocked" ? (context as Ctx).userId : null,
      deleted_at: data.status === "deleted" ? now : null,
    };

    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("user_id", data.userId)
      .maybeSingle();
    if (existing) {
      const { error } = await admin.from("profiles").update(patch).eq("user_id", data.userId);
      if (error) throw error;
    } else {
      const { error } = await admin.from("profiles").insert({ user_id: data.userId, ...patch });
      if (error) throw error;
    }

    // Bloqueio real de login: contas inativas, bloqueadas ou excluídas são banidas.
    const banDuration = data.status === "active" ? "none" : "876000h";
    await admin.auth.admin.updateUserById(data.userId, { ban_duration: banDuration });

    const action =
      data.status === "active"
        ? "user_enabled"
        : data.status === "inactive"
          ? "user_disabled"
          : data.status === "blocked"
            ? "user_blocked"
            : "user_deleted";

    await logAction(admin, context as Ctx, {
      targetUserId: data.userId,
      action,
      reason: data.reason ?? null,
      metadata: { status: data.status },
    });
    return { ok: true };
  });

/** Concede acesso manual (trial ou fundador vitalício). */
export const grantAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; plan: "trial" | "founder"; reason?: string }) => input)
  .handler(async ({ data, context }) => {
    const admin = await assertMaster(context as Ctx);
    if (data.userId === (context as Ctx).userId) {
      throw new Response("Não é possível conceder acesso a si mesmo", { status: 400 });
    }

    const { data: authUser } = await admin.auth.admin.getUserById(data.userId);
    const email = authUser.user?.email ?? null;
    const now = new Date();

    const payload =
      data.plan === "founder"
        ? {
            access_type: "founder" as const,
            access_status: "active" as const,
            plan_code: "founder",
            lifetime_access: true,
            activated_at: now.toISOString(),
            source: "manual",
          }
        : {
            access_type: "trial" as const,
            access_status: "trial" as const,
            plan_code: null,
            lifetime_access: false,
            activated_at: null,
            source: "manual",
            trial_started_at: now.toISOString(),
            trial_ends_at: new Date(now.getTime() + 7 * 86400000).toISOString(),
          };

    const { data: existing } = await admin
      .from("user_access")
      .select("id")
      .eq("user_id", data.userId)
      .maybeSingle();

    if (existing) {
      const { error } = await admin.from("user_access").update(payload).eq("user_id", data.userId);
      if (error) throw error;
    } else {
      const { error } = await admin
        .from("user_access")
        .insert({ user_id: data.userId, email, ...payload });
      if (error) throw error;
    }

    await logAction(admin, context as Ctx, {
      targetUserId: data.userId,
      targetEmail: email,
      action: "access_granted",
      reason: data.reason ?? null,
      metadata: { plan: data.plan },
    });
    return { ok: true };
  });

/** Revoga o acesso mantendo histórico comercial. */
export const revokeAccess = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; reason?: string }) => input)
  .handler(async ({ data, context }) => {
    const admin = await assertMaster(context as Ctx);

    const { error } = await admin
      .from("user_access")
      .update({ access_status: "cancelled", lifetime_access: false })
      .eq("user_id", data.userId);
    if (error) throw error;

    await logAction(admin, context as Ctx, {
      targetUserId: data.userId,
      action: "access_revoked",
      reason: data.reason ?? null,
    });
    return { ok: true };
  });

/** Envia e-mail de redefinição de senha pelo fluxo seguro do sistema. */
export const sendPasswordReset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; redirectTo: string }) => input)
  .handler(async ({ data, context }) => {
    const admin = await assertMaster(context as Ctx);

    const { data: authUser } = await admin.auth.admin.getUserById(data.userId);
    const email = authUser.user?.email;
    if (!email) throw new Response("Usuário sem e-mail", { status: 400 });

    const { error } = await admin.auth.resetPasswordForEmail(email, {
      redirectTo: data.redirectTo,
    });
    if (error) throw error;

    await logAction(admin, context as Ctx, {
      targetUserId: data.userId,
      targetEmail: email,
      action: "password_reset_requested",
    });
    return { ok: true };
  });

/** Marca (ou desmarca) que o usuário já foi contatado após o fim do teste. */
export const setPostTrialContacted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { userId: string; contacted: boolean }) => input)
  .handler(async ({ data, context }) => {
    const admin = await assertMaster(context as Ctx);
    const patch = {
      post_trial_contacted_at: data.contacted ? new Date().toISOString() : null,
      post_trial_contacted_by: data.contacted ? (context as Ctx).userId : null,
    };

    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("user_id", data.userId)
      .maybeSingle();
    if (existing) {
      const { error } = await admin.from("profiles").update(patch).eq("user_id", data.userId);
      if (error) throw error;
    } else {
      const { error } = await admin.from("profiles").insert({ user_id: data.userId, ...patch });
      if (error) throw error;
    }

    await logAction(admin, context as Ctx, {
      targetUserId: data.userId,
      action: data.contacted ? "post_trial_contacted" : "post_trial_contact_cleared",
    });
    return { ok: true };
  });
