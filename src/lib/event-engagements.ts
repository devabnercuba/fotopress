import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import type { ContactStatus, PackageStatus } from "./engagements";

/**
 * Relacionamento comercial por evento
 * -----------------------------------
 * Espelha `athlete_match_engagements` (mesmos status e mesmo funil), mas
 * aponta para um evento e, opcionalmente, para uma categoria do evento.
 */
export type EventEngagement = {
  id: string;
  athlete_id: string;
  event_id: string;
  event_category_id: string | null;
  contact_status: ContactStatus;
  contacted_at: string | null;
  package_status: PackageStatus;
  package_name: string | null;
  package_value: number | null;
  notes: string | null;
  next_action: string | null;
  no_response: boolean;
};

export type EventEngagementPatch = Partial<
  Pick<
    EventEngagement,
    | "contact_status"
    | "package_status"
    | "package_name"
    | "package_value"
    | "notes"
    | "next_action"
    | "no_response"
    | "event_category_id"
  >
>;

const SELECT =
  "id, athlete_id, event_id, event_category_id, contact_status, contacted_at, package_status, package_name, package_value, notes, next_action, no_response";

export function useEventEngagements(eventId: string | null | undefined) {
  return useQuery({
    queryKey: ["event-engagements", eventId],
    enabled: !!eventId,
    queryFn: async (): Promise<EventEngagement[]> => {
      const { data, error } = await supabase
        .from("athlete_event_engagements")
        .select(SELECT)
        .eq("event_id", eventId!);
      if (error) throw error;
      return (data ?? []) as unknown as EventEngagement[];
    },
  });
}

/** Contagem de contatos por evento — usada nos cards. */
export function useEventEngagementCounts() {
  return useQuery({
    queryKey: ["event-engagements", "counts"],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase.from("athlete_event_engagements").select("event_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const row of data ?? []) counts[row.event_id] = (counts[row.event_id] ?? 0) + 1;
      return counts;
    },
  });
}

export function useEventEngagementMutations(eventId: string | null | undefined) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["event-engagements"] });
  };

  const save = useMutation({
    mutationFn: async ({
      athleteId,
      patch,
    }: {
      athleteId: string;
      patch: EventEngagementPatch;
    }) => {
      const { data: user } = await supabase.auth.getUser();
      const uid = user.user?.id;
      if (!uid) throw new Error("Sessão expirada.");
      const payload = {
        ...patch,
        ...(patch.contact_status && patch.contact_status !== "not_contacted"
          ? { contacted_at: new Date().toISOString() }
          : {}),
      };
      const { error } = await supabase
        .from("athlete_event_engagements")
        .upsert(
          { user_id: uid, athlete_id: athleteId, event_id: eventId!, ...payload },
          { onConflict: "user_id,athlete_id,event_id" },
        );
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("athlete_event_engagements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { save, remove };
}
