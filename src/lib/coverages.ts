import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import type { Match } from "./queries";

export type CredentialStatus = "not_requested" | "requested" | "approved" | "denied" | "exempt";

export const CREDENTIAL_STATUSES: CredentialStatus[] = [
  "not_requested",
  "requested",
  "approved",
  "denied",
  "exempt",
];

export const CREDENTIAL_LABEL: Record<CredentialStatus, string> = {
  not_requested: "Não solicitado",
  requested: "Solicitado",
  approved: "Aprovado",
  denied: "Negado",
  exempt: "Credenciamento dispensado",
};

export const CREDENTIAL_DOT: Record<CredentialStatus, string> = {
  not_requested: "bg-muted-foreground/40",
  requested: "bg-comp-yellow",
  approved: "bg-comp-green",
  denied: "bg-destructive",
  exempt: "bg-sky-500",
};

export type Coverage = {
  id: string;
  match_id: string;
  credential_status: CredentialStatus;
  reminder_enabled?: boolean | null;
  notes: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  match: Match | null;
};

const MATCH_SELECT =
  "id, competition_id, home_team, away_team, home_team_id, away_team_id, date, time, venue, city, state, notes, source, category, competition:competitions(id, name, category, color, season)";

export function useCoverages() {
  return useQuery({
    queryKey: ["coverages"],
    queryFn: async (): Promise<Coverage[]> => {
      // Tenta consultar com reminder_enabled; se a coluna ainda não existir no DB remoto, faz fallback
      let data: Record<string, unknown>[] | null = null;
      const resWithReminder = await supabase
        .from("coverages")
        .select(
          `id, match_id, credential_status, reminder_enabled, notes, completed_at, created_at, updated_at, match:matches(${MATCH_SELECT})`,
        );

      if (resWithReminder.error) {
        // Fallback gracioso se a coluna reminder_enabled não estiver provisionada ainda
        const fallbackRes = await supabase
          .from("coverages")
          .select(
            `id, match_id, credential_status, notes, completed_at, created_at, updated_at, match:matches(${MATCH_SELECT})`,
          );
        if (fallbackRes.error) throw fallbackRes.error;
        data = fallbackRes.data;
      } else {
        data = resWithReminder.data;
      }

      const items = (data ?? []) as unknown as Coverage[];
      return items.sort((a, b) => {
        const ka = `${a.match?.date ?? ""}${a.match?.time ?? ""}`;
        const kb = `${b.match?.date ?? ""}${b.match?.time ?? ""}`;
        return ka.localeCompare(kb);
      });
    },
  });
}

/** Mapa match_id → cobertura, para telas que partem da partida. */
export function coverageByMatch(coverages: Coverage[]) {
  const map: Record<string, Coverage> = {};
  for (const c of coverages) map[c.match_id] = c;
  return map;
}

export function useCoverageMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["coverages"] });
    qc.invalidateQueries({ queryKey: ["matches"] });
    qc.invalidateQueries({ queryKey: ["event-coverages"] });
    qc.invalidateQueries({ queryKey: ["events"] });
  };

  /** Jogos → Solicitar credenciamento. Cria a cobertura se ainda não existir. */
  const request = useMutation({
    mutationFn: async (matchId: string) => {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData?.user?.id;
      const { error } = await supabase.from("coverages").upsert(
        {
          match_id: matchId,
          ...(uid ? { user_id: uid } : {}),
          credential_status: "requested",
          completed_at: null,
        },
        { onConflict: "match_id" },
      );
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: CredentialStatus }) => {
      const { error } = await supabase
        .from("coverages")
        .update({ credential_status: status })
        .eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["coverages"] });
      const previous = qc.getQueryData<Coverage[]>(["coverages"]);
      qc.setQueryData<Coverage[]>(["coverages"], (old) =>
        old ? old.map((c) => (c.id === id ? { ...c, credential_status: status } : c)) : [],
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(["coverages"], context.previous);
      }
    },
    onSettled: invalidate,
  });

  const setNotes = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string | null }) => {
      const { error } = await supabase.from("coverages").update({ notes }).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, notes }) => {
      await qc.cancelQueries({ queryKey: ["coverages"] });
      const previous = qc.getQueryData<Coverage[]>(["coverages"]);
      qc.setQueryData<Coverage[]>(["coverages"], (old) =>
        old ? old.map((c) => (c.id === id ? { ...c, notes } : c)) : [],
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(["coverages"], context.previous);
      }
    },
    onSettled: invalidate,
  });

  const complete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("coverages")
        .update({ completed_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const reopen = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("coverages")
        .update({ completed_at: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("coverages").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: ["coverages"] });
      const previous = qc.getQueryData<Coverage[]>(["coverages"]);
      qc.setQueryData<Coverage[]>(["coverages"], (old) =>
        old ? old.filter((c) => c.id !== id) : [],
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        qc.setQueryData(["coverages"], context.previous);
      }
    },
    onSettled: invalidate,
  });

  /** Remove cobertura pelo match_id diretamente, garantindo restauração imediata do botão Solicitar. */
  const removeByMatch = useMutation({
    mutationFn: async (matchId: string) => {
      const { error } = await supabase.from("coverages").delete().eq("match_id", matchId);
      if (error) throw error;
    },
    onMutate: async (matchId: string) => {
      await qc.cancelQueries({ queryKey: ["coverages"] });
      const previous = qc.getQueryData<Coverage[]>(["coverages"]);
      qc.setQueryData<Coverage[]>(["coverages"], (old) =>
        old ? old.filter((c) => c.match_id !== matchId) : [],
      );
      return { previous };
    },
    onError: (_err, _matchId, context) => {
      if (context?.previous) {
        qc.setQueryData(["coverages"], context.previous);
      }
    },
    onSettled: invalidate,
  });

  /** Define o status partindo da partida — cria a cobertura se não existir. */
  const setStatusByMatch = useMutation({
    mutationFn: async ({ matchId, status }: { matchId: string; status: CredentialStatus }) => {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData?.user?.id;
      const { error } = await supabase.from("coverages").upsert(
        {
          match_id: matchId,
          ...(uid ? { user_id: uid } : {}),
          credential_status: status,
        },
        { onConflict: "match_id" },
      );
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /** Marca como concluída partindo da partida (cria a cobertura se preciso). */
  const completeByMatch = useMutation({
    mutationFn: async (matchId: string) => {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData?.user?.id;
      const { error } = await supabase.from("coverages").upsert(
        {
          match_id: matchId,
          ...(uid ? { user_id: uid } : {}),
          credential_status: "approved",
          completed_at: new Date().toISOString(),
        },
        { onConflict: "match_id" },
      );
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /** Alterna ou define se o lembrete push da cobertura está ativo (reminder_enabled) */
  const setReminderEnabled = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      try {
        const { error } = await supabase
          .from("coverages")
          .update({ reminder_enabled: enabled })
          .eq("id", id);
        if (error) {
          console.warn("Aviso ao salvar reminder_enabled na tabela coverages:", error);
        }
      } catch (err) {
        console.warn("Erro ao atualizar reminder_enabled no Supabase:", err);
      }
    },
    onMutate: async ({ id, enabled }) => {
      await qc.cancelQueries({ queryKey: ["coverages"] });
      const previous = qc.getQueryData<Coverage[]>(["coverages"]);
      qc.setQueryData<Coverage[]>(["coverages"], (old) =>
        old ? old.map((c) => (c.id === id ? { ...c, reminder_enabled: enabled } : c)) : [],
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(["coverages"], context.previous);
      }
    },
    onSettled: invalidate,
  });

  return {
    request,
    setStatus,
    setStatusByMatch,
    completeByMatch,
    setNotes,
    complete,
    reopen,
    remove,
    removeByMatch,
    setReminderEnabled,
  };
}
