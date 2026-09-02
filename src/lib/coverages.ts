import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import type { Match } from "./queries";

export type CredentialStatus = "not_requested" | "requested" | "approved" | "denied";

export const CREDENTIAL_STATUSES: CredentialStatus[] = [
  "not_requested",
  "requested",
  "approved",
  "denied",
];

export const CREDENTIAL_LABEL: Record<CredentialStatus, string> = {
  not_requested: "Não solicitado",
  requested: "Solicitado",
  approved: "Aprovado",
  denied: "Negado",
};

export const CREDENTIAL_DOT: Record<CredentialStatus, string> = {
  not_requested: "bg-muted-foreground/40",
  requested: "bg-comp-yellow",
  approved: "bg-comp-green",
  denied: "bg-destructive",
};

export type Coverage = {
  id: string;
  match_id: string;
  credential_status: CredentialStatus;
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
      const { data, error } = await supabase
        .from("coverages")
        .select(
          `id, match_id, credential_status, notes, completed_at, created_at, updated_at, match:matches(${MATCH_SELECT})`,
        );
      if (error) throw error;
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
  };

  /** Jogos → Solicitar credenciamento. Cria a cobertura se ainda não existir. */
  const request = useMutation({
    mutationFn: async (matchId: string) => {
      const { error } = await supabase
        .from("coverages")
        .upsert({ match_id: matchId, credential_status: "requested" }, { onConflict: "match_id" });
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
    onSuccess: invalidate,
  });

  const setNotes = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase.from("coverages").update({ notes }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
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
    onSuccess: invalidate,
  });

  /** Define o status partindo da partida — cria a cobertura se não existir. */
  const setStatusByMatch = useMutation({
    mutationFn: async ({ matchId, status }: { matchId: string; status: CredentialStatus }) => {
      const { error } = await supabase
        .from("coverages")
        .upsert({ match_id: matchId, credential_status: status }, { onConflict: "match_id" });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /** Marca como concluída partindo da partida (cria a cobertura se preciso). */
  const completeByMatch = useMutation({
    mutationFn: async (matchId: string) => {
      const { error } = await supabase.from("coverages").upsert(
        {
          match_id: matchId,
          credential_status: "approved",
          completed_at: new Date().toISOString(),
        },
        { onConflict: "match_id" },
      );
      if (error) throw error;
    },
    onSuccess: invalidate,
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
  };
}
