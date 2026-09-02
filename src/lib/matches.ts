import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { ensureTeams, teamSlug } from "./teams";
import type { Match } from "./queries";

export type MatchInput = {
  competition_id: string | null;
  date: string;
  time: string;
  home_team: string;
  away_team: string;
  venue: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
};

/** Vincula a partida aos clubes da tabela `teams`, criando-os se necessário. */
async function teamIds(input: Pick<MatchInput, "home_team" | "away_team" | "state">) {
  const { bySlug } = await ensureTeams([
    { name: input.home_team, state: input.state },
    { name: input.away_team, state: null },
  ]);
  return {
    home_team_id: bySlug.get(teamSlug(input.home_team))?.id ?? null,
    away_team_id: bySlug.get(teamSlug(input.away_team))?.id ?? null,
  };
}

export function useMatchMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["matches"] });
    qc.invalidateQueries({ queryKey: ["coverages"] });
    qc.invalidateQueries({ queryKey: ["teams"] });
  };

  const update = useMutation({
    mutationFn: async ({ id, ...input }: MatchInput & { id: string }) => {
      const links = await teamIds(input);
      const { error } = await supabase
        .from("matches")
        .update({ ...input, ...links })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /** Define/ajusta apenas a categoria da partida (Sub-15, Principal, …). */
  const setCategory = useMutation({
    mutationFn: async ({ id, category }: { id: string; category: string | null }) => {
      const { error } = await supabase.from("matches").update({ category }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const duplicate = useMutation({
    mutationFn: async (match: Match) => {
      const links = await teamIds({
        home_team: match.home_team,
        away_team: match.away_team,
        state: match.state,
      });
      const { error } = await supabase.from("matches").insert({
        competition_id: match.competition_id,
        date: match.date,
        time: match.time,
        home_team: match.home_team,
        away_team: match.away_team,
        venue: match.venue,
        city: match.city,
        state: match.state,
        notes: match.notes,
        source: "Cadastro Manual",
        ...links,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /** Exclui a partida. `withCoverage` remove também a cobertura vinculada. */
  const remove = useMutation({
    mutationFn: async ({ id, withCoverage }: { id: string; withCoverage: boolean }) => {
      if (withCoverage) {
        await supabase.from("match_radar").delete().eq("match_id", id);
        await supabase.from("coverages").delete().eq("match_id", id);
      }
      await supabase.from("agenda").delete().eq("match_id", id);
      const { error } = await supabase.from("matches").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { update, setCategory, duplicate, remove };
}
