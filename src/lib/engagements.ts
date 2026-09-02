import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Relacionamento comercial por partida
 * ------------------------------------
 * O contato e o pacote mudam de jogo para jogo — por isso ficam em
 * `athlete_match_engagements` (usuário + atleta + partida), nunca no atleta.
 * Todos os registros são privados (RLS por `user_id`).
 */
export type ContactStatus = "not_contacted" | "contacted" | "responded";
export type PackageStatus = "not_offered" | "offered" | "closed" | "declined";

export const CONTACT_STATUS: { value: ContactStatus; label: string }[] = [
  { value: "not_contacted", label: "Não contatei" },
  { value: "contacted", label: "Contato realizado" },
  { value: "responded", label: "Respondeu" },
];

export const PACKAGE_STATUS: { value: PackageStatus; label: string }[] = [
  { value: "not_offered", label: "Não oferecido" },
  { value: "offered", label: "Pacote oferecido" },
  { value: "closed", label: "Fechado" },
  { value: "declined", label: "Não fechou" },
];

export const CONTACT_LABEL: Record<string, string> = Object.fromEntries(
  CONTACT_STATUS.map((s) => [s.value, s.label]),
);
export const PACKAGE_LABEL: Record<string, string> = Object.fromEntries(
  PACKAGE_STATUS.map((s) => [s.value, s.label]),
);

export type Engagement = {
  id: string;
  athlete_id: string;
  match_id: string;
  contact_status: ContactStatus;
  contacted_at: string | null;
  package_status: PackageStatus;
  package_name: string | null;
  package_value: number | null;
  notes: string | null;
  next_action: string | null;
  no_response: boolean;
  updated_at?: string | null;
  athlete?: {
    id: string;
    name: string;
    relationship: string;
    team: { id: string; name: string } | null;
  } | null;
  match?: {
    id: string;
    home_team: string;
    away_team: string;
    date: string;
    competition: { name: string } | null;
  } | null;
};

const SELECT =
  "id, athlete_id, match_id, contact_status, contacted_at, package_status, package_name, package_value, notes, next_action, no_response, updated_at";

const SELECT_WITH_MATCH = `${SELECT}, match:matches(id, home_team, away_team, date, competition:competitions(name))`;

const SELECT_FULL = `${SELECT_WITH_MATCH}, athlete:athletes(id, name, relationship, team:teams(id, name))`;

/**
 * Funil comercial (Kanban).
 * O estágio é derivado de `contact_status` + `package_status` — nunca há um
 * campo duplicando estados que já existem.
 */
export type Stage = "not_contacted" | "contacted" | "responded" | "offered" | "closed";

export const STAGES: { value: Stage; label: string; dot: string; chip: string }[] = [
  {
    value: "not_contacted",
    label: "Não contatado",
    dot: "bg-muted-foreground/40",
    chip: "bg-muted text-muted-foreground",
  },
  {
    value: "contacted",
    label: "Contato realizado",
    dot: "bg-comp-blue",
    chip: "bg-comp-blue/10 text-comp-blue",
  },
  {
    value: "responded",
    label: "Respondeu",
    dot: "bg-comp-orange",
    chip: "bg-comp-orange/10 text-comp-orange",
  },
  {
    value: "offered",
    label: "Pacote oferecido",
    dot: "bg-comp-yellow",
    chip: "bg-comp-yellow/10 text-comp-yellow",
  },
  {
    value: "closed",
    label: "Fechado",
    dot: "bg-comp-green",
    chip: "bg-comp-green/10 text-comp-green",
  },
];

export const STAGE_LABEL: Record<Stage, string> = Object.fromEntries(
  STAGES.map((s) => [s.value, s.label]),
) as Record<Stage, string>;

export function engagementStage(e: Engagement): Stage {
  if (e.package_status === "closed") return "closed";
  if (e.package_status === "offered" || e.package_status === "declined") return "offered";
  if (e.contact_status === "responded") return "responded";
  if (e.contact_status === "contacted") return "contacted";
  return "not_contacted";
}

/** Patch mínimo para levar um registro até o estágio escolhido. */
export function stagePatch(stage: Stage): EngagementPatch {
  switch (stage) {
    case "closed":
      return { contact_status: "responded", package_status: "closed" };
    case "offered":
      return { contact_status: "responded", package_status: "offered" };
    case "responded":
      return { contact_status: "responded", package_status: "not_offered" };
    case "contacted":
      return { contact_status: "contacted", package_status: "not_offered" };
    default:
      return { contact_status: "not_contacted", package_status: "not_offered" };
  }
}

/** Registros comerciais de uma partida específica. */
export function useMatchEngagements(matchId: string | null | undefined) {
  return useQuery({
    queryKey: ["engagements", "match", matchId],
    enabled: !!matchId,
    queryFn: async (): Promise<Engagement[]> => {
      const { data, error } = await supabase
        .from("athlete_match_engagements")
        .select(SELECT)
        .eq("match_id", matchId!);
      if (error) throw error;
      return (data ?? []) as unknown as Engagement[];
    },
  });
}

/** Todos os registros comerciais do usuário — usado no resumo e no histórico. */
export function useAllEngagements() {
  return useQuery({
    queryKey: ["engagements", "all"],
    queryFn: async (): Promise<Engagement[]> => {
      const { data, error } = await supabase
        .from("athlete_match_engagements")
        .select(SELECT_FULL)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Engagement[];
    },
  });
}

/** Histórico de relacionamento de um atleta. */
export function useAthleteEngagements(athleteId: string | null | undefined) {
  return useQuery({
    queryKey: ["engagements", "athlete", athleteId],
    enabled: !!athleteId,
    queryFn: async (): Promise<Engagement[]> => {
      const { data, error } = await supabase
        .from("athlete_match_engagements")
        .select(SELECT_WITH_MATCH)
        .eq("athlete_id", athleteId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Engagement[];
    },
  });
}

export type EngagementPatch = Partial<{
  contact_status: ContactStatus;
  package_status: PackageStatus;
  package_name: string | null;
  package_value: number | null;
  notes: string | null;
  next_action: string | null;
  no_response: boolean;
}>;

export function useEngagementMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["engagements"] });

  const save = useMutation({
    mutationFn: async ({
      athleteId,
      matchId,
      patch,
    }: {
      athleteId: string;
      matchId: string;
      patch: EngagementPatch;
    }) => {
      const payload = {
        ...patch,
        ...(patch.contact_status && patch.contact_status !== "not_contacted"
          ? { contacted_at: new Date().toISOString() }
          : {}),
      };
      const { data: user } = await supabase.auth.getUser();
      const uid = user.user?.id;
      if (!uid) throw new Error("Sessão expirada.");

      const { error } = await supabase
        .from("athlete_match_engagements")
        .upsert(
          { user_id: uid, athlete_id: athleteId, match_id: matchId, ...payload },
          { onConflict: "user_id,athlete_id,match_id" },
        );
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /** Remove o contato do fluxo comercial da partida. */
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("athlete_match_engagements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { save, remove };
}

/** Resumo para o checklist da partida. */
export function engagementSummary(engagements: Engagement[], related = engagements.length) {
  return {
    related,
    added: engagements.length,
    contacted: engagements.filter((e) => e.contact_status !== "not_contacted").length,
    responded: engagements.filter((e) => e.contact_status === "responded").length,
    offered: engagements.filter((e) => e.package_status === "offered").length,
    closed: engagements.filter((e) => e.package_status === "closed").length,
    revenue: engagements
      .filter((e) => e.package_status === "closed")
      .reduce((sum, e) => sum + (e.package_value ?? 0), 0),
  };
}

export function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
