import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Eventos esportivos
 * ------------------
 * Coberturas que não seguem o formato mandante × visitante (corridas, beach
 * tennis, torneios…). Vivem em tabelas próprias — `matches` e `coverages`
 * seguem intactas para as partidas.
 */
export type EventStatus = "scheduled" | "completed" | "cancelled" | "postponed";

export const EVENT_STATUS: { value: EventStatus; label: string; dot: string }[] = [
  { value: "scheduled", label: "Agendado", dot: "bg-comp-blue" },
  { value: "completed", label: "Concluído", dot: "bg-comp-green" },
  { value: "cancelled", label: "Cancelado", dot: "bg-destructive" },
  { value: "postponed", label: "Adiado", dot: "bg-comp-yellow" },
];

export const EVENT_STATUS_LABEL: Record<string, string> = Object.fromEntries(
  EVENT_STATUS.map((s) => [s.value, s.label]),
);

export type EventCategory = {
  id: string;
  event_id: string;
  name: string;
};

export type SportEvent = {
  id: string;
  name: string;
  sport: string;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  venue: string | null;
  city: string | null;
  state: string | null;
  organizer: string | null;
  official_url: string | null;
  accreditation_required: boolean;
  notes: string | null;
  status: EventStatus;
  created_at: string;
  categories: EventCategory[];
};

export type EventInput = {
  name: string;
  sport: string;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  venue: string | null;
  city: string | null;
  state: string | null;
  organizer: string | null;
  official_url: string | null;
  accreditation_required: boolean;
  notes: string | null;
  status: EventStatus;
};

const SELECT =
  "id, name, sport, start_date, end_date, start_time, end_time, venue, city, state, organizer, official_url, accreditation_required, notes, status, created_at, categories:event_categories(id, event_id, name)";

export function useEvents() {
  return useQuery({
    queryKey: ["events"],
    queryFn: async (): Promise<SportEvent[]> => {
      const { data, error } = await supabase
        .from("events")
        .select(SELECT)
        .is("deleted_at", null)
        .order("start_date");
      if (error) throw error;
      return (data ?? []) as unknown as SportEvent[];
    },
  });
}

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) throw new Error("Sessão expirada.");
  return uid;
}

/** Sincroniza as categorias do evento (cria as novas, remove as ausentes). */
async function syncCategories(eventId: string, names: string[]) {
  const uid = await currentUserId();
  const clean = [...new Set(names.map((n) => n.trim()).filter(Boolean))];

  const { data: existing, error } = await supabase
    .from("event_categories")
    .select("id, name")
    .eq("event_id", eventId);
  if (error) throw error;

  const current = existing ?? [];
  const removed = current.filter((c) => !clean.includes(c.name)).map((c) => c.id);
  const added = clean.filter((n) => !current.some((c) => c.name === n));

  if (removed.length) {
    const { error: delError } = await supabase.from("event_categories").delete().in("id", removed);
    if (delError) throw delError;
  }
  if (added.length) {
    const { error: insError } = await supabase
      .from("event_categories")
      .insert(added.map((name) => ({ user_id: uid, event_id: eventId, name })));
    if (insError) throw insError;
  }
}

export function useEventMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["events"] });
    qc.invalidateQueries({ queryKey: ["event-coverages"] });
  };

  const save = useMutation({
    mutationFn: async ({
      id,
      categories,
      ...input
    }: EventInput & { id?: string; categories: string[] }) => {
      const uid = await currentUserId();
      let eventId = id;
      if (eventId) {
        const { error } = await supabase.from("events").update(input).eq("id", eventId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("events")
          .insert({ ...input, user_id: uid })
          .select("id")
          .single();
        if (error) throw error;
        eventId = data.id;
      }
      await syncCategories(eventId!, categories);
      return eventId!;
    },
    onSuccess: invalidate,
  });

  /** Soft delete, consistente com partidas e campeonatos. */
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("events")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { save, remove };
}

/* ------------------------------------------------------------------ */
/* Cobertura de evento                                                  */
/* ------------------------------------------------------------------ */

export type EventCoverage = {
  id: string;
  event_id: string;
  credential_status: "not_requested" | "requested" | "approved" | "denied";
  reminder_enabled?: boolean | null;
  notes: string | null;
  completed_at: string | null;
  event: SportEvent | null;
};

export function useEventCoverages() {
  return useQuery({
    queryKey: ["event-coverages"],
    queryFn: async (): Promise<EventCoverage[]> => {
      let data: Record<string, unknown>[] | null = null;
      const resWithReminder = await supabase
        .from("event_coverages")
        .select(
          `id, event_id, credential_status, reminder_enabled, notes, completed_at, event:events(${SELECT}, deleted_at)`,
        );

      if (resWithReminder.error) {
        const fallbackRes = await supabase
          .from("event_coverages")
          .select(
            `id, event_id, credential_status, notes, completed_at, event:events(${SELECT}, deleted_at)`,
          );
        if (fallbackRes.error) throw fallbackRes.error;
        data = fallbackRes.data;
      } else {
        data = resWithReminder.data;
      }

      // Eventos com soft delete não podem aparecer em nenhuma lista operacional.
      const items = (
        (data ?? []) as unknown as (EventCoverage & {
          event: (SportEvent & { deleted_at?: string | null }) | null;
        })[]
      ).filter((c) => c.event && !c.event.deleted_at) as EventCoverage[];
      return items.sort((a, b) =>
        `${a.event?.start_date ?? ""}${a.event?.start_time ?? ""}`.localeCompare(
          `${b.event?.start_date ?? ""}${b.event?.start_time ?? ""}`,
        ),
      );
    },
  });
}

export function coverageByEvent(coverages: EventCoverage[]) {
  const map: Record<string, EventCoverage> = {};
  for (const c of coverages) map[c.event_id] = c;
  return map;
}

export function useEventCoverageMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["event-coverages"] });
    qc.invalidateQueries({ queryKey: ["events"] });
    qc.invalidateQueries({ queryKey: ["coverages"] });
    qc.invalidateQueries({ queryKey: ["matches"] });
  };

  /** Solicitar credenciamento para evento esportivo */
  const request = useMutation({
    mutationFn: async (eventId: string) => {
      const uid = await currentUserId();
      const { error } = await supabase.from("event_coverages").upsert(
        {
          user_id: uid,
          event_id: eventId,
          credential_status: "requested",
          completed_at: null,
        },
        { onConflict: "user_id,event_id" },
      );
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const upsert = useMutation({
    mutationFn: async ({
      eventId,
      status,
    }: {
      eventId: string;
      status: EventCoverage["credential_status"];
    }) => {
      const uid = await currentUserId();
      const { error } = await supabase
        .from("event_coverages")
        .upsert(
          { user_id: uid, event_id: eventId, credential_status: status },
          { onConflict: "user_id,event_id" },
        );
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const complete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("event_coverages")
        .update({ completed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const reopen = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("event_coverages")
        .update({ completed_at: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("event_coverages").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ["event-coverages"] });
      const previous = qc.getQueryData<EventCoverage[]>(["event-coverages"]);
      qc.setQueryData<EventCoverage[]>(["event-coverages"], (old) =>
        old ? old.filter((c) => c.id !== id) : [],
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        qc.setQueryData(["event-coverages"], context.previous);
      }
    },
    onSettled: invalidate,
  });

  const removeByEvent = useMutation({
    mutationFn: async (eventId: string) => {
      const uid = await currentUserId();
      const { error } = await supabase
        .from("event_coverages")
        .delete()
        .eq("user_id", uid)
        .eq("event_id", eventId);
      if (error) throw error;
    },
    onMutate: async (eventId: string) => {
      await qc.cancelQueries({ queryKey: ["event-coverages"] });
      const previous = qc.getQueryData<EventCoverage[]>(["event-coverages"]);
      qc.setQueryData<EventCoverage[]>(["event-coverages"], (old) =>
        old ? old.filter((c) => c.event_id !== eventId) : [],
      );
      return { previous };
    },
    onError: (_err, _eventId, context) => {
      if (context?.previous) {
        qc.setQueryData(["event-coverages"], context.previous);
      }
    },
    onSettled: invalidate,
  });

  /** Alterna ou define se o lembrete push do evento está ativo (reminder_enabled) */
  const setReminderEnabled = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      try {
        const { error } = await supabase
          .from("event_coverages")
          .update({ reminder_enabled: enabled })
          .eq("id", id);
        if (error) {
          console.warn("Aviso ao salvar reminder_enabled na tabela event_coverages:", error);
        }
      } catch (err) {
        console.warn("Erro ao atualizar reminder_enabled no Supabase:", err);
      }
    },
    onMutate: async ({ id, enabled }) => {
      await qc.cancelQueries({ queryKey: ["event-coverages"] });
      const previous = qc.getQueryData<EventCoverage[]>(["event-coverages"]);
      qc.setQueryData<EventCoverage[]>(["event-coverages"], (old) =>
        old ? old.map((c) => (c.id === id ? { ...c, reminder_enabled: enabled } : c)) : [],
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(["event-coverages"], context.previous);
      }
    },
    onSettled: invalidate,
  });

  /** Atualiza status de credenciamento/cobertura do evento com atualização otimista */
  const setStatus = useMutation({
    mutationFn: async ({
      id,
      status,
    }: {
      id: string;
      status: EventCoverage["credential_status"];
    }) => {
      const { error } = await supabase
        .from("event_coverages")
        .update({ credential_status: status })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["event-coverages"] });
      const previous = qc.getQueryData<EventCoverage[]>(["event-coverages"]);
      qc.setQueryData<EventCoverage[]>(["event-coverages"], (old) =>
        old ? old.map((c) => (c.id === id ? { ...c, credential_status: status } : c)) : [],
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(["event-coverages"], context.previous);
      }
    },
    onSettled: invalidate,
  });

  /** Salva notas livres ou lembretes da cobertura do evento */
  const setNotes = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string | null }) => {
      const { error } = await supabase.from("event_coverages").update({ notes }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, notes }) => {
      await qc.cancelQueries({ queryKey: ["event-coverages"] });
      const previous = qc.getQueryData<EventCoverage[]>(["event-coverages"]);
      qc.setQueryData<EventCoverage[]>(["event-coverages"], (old) =>
        old ? old.map((c) => (c.id === id ? { ...c, notes } : c)) : [],
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(["event-coverages"], context.previous);
      }
    },
    onSettled: invalidate,
  });

  return {
    request,
    upsert,
    complete,
    reopen,
    remove,
    removeByEvent,
    setReminderEnabled,
    setStatus,
    setNotes,
  };
}
