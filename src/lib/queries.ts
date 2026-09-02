import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Competition = {
  id: string;
  name: string;
  category: string;
  color: string;
  season: string;
  short_name?: string | null;
  state?: string | null;
  country?: string | null;
  type?: string | null;
  logo_url?: string | null;
  description?: string | null;
  active?: boolean;
  /** Modalidade e gênero dão contexto aos clubes criados na importação. */
  sport_key?: string;
  gender?: string | null;
};

export type Match = {
  id: string;
  competition_id: string | null;
  home_team: string;
  away_team: string;
  home_team_id: string | null;
  away_team_id: string | null;
  date: string;
  time: string;
  venue: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  source: string;
  source_id?: string | null;
  import_type?: string | null;
  category?: string | null;
  competition: Competition | null;
};

export type AgendaItem = {
  id: string;
  match_id: string;
  status: string;
  match: Match | null;
};

const MATCH_SELECT =
  "id, competition_id, home_team, away_team, home_team_id, away_team_id, date, time, venue, city, state, notes, source, source_id, import_type, category, competition:competitions(id, name, category, color, season)";

const COMPETITION_SELECT =
  "id, name, category, color, season, short_name, state, country, type, logo_url, description, active, sport_key, gender";

export function useCompetitions() {
  return useQuery({
    queryKey: ["competitions"],
    queryFn: async (): Promise<Competition[]> => {
      const { data, error } = await supabase
        .from("competitions")
        .select(COMPETITION_SELECT)
        .is("deleted_at", null)
        .order("name");

      if (error) throw error;
      return (data ?? []) as unknown as Competition[];
    },
  });
}

const COLORS = ["green", "blue", "orange", "yellow", "gray"] as const;

export type CompetitionInput = {
  name: string;
  short_name: string | null;
  category: string;
  state: string | null;
  country: string;
  season: string;
  type: string | null;
  logo_url: string | null;
  description: string | null;
  active: boolean;
  sport_key: string;
  gender: string | null;
};

/** Normalização usada para evitar campeonatos duplicados. */
export function normalizeCompetitionName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function useCompetitionMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["competitions"] });
    qc.invalidateQueries({ queryKey: ["matches"] });
  };

  /** Cria o campeonato; se já existir (mesmo nome normalizado + temporada), devolve o existente. */
  const create = useMutation({
    mutationFn: async (input: CompetitionInput): Promise<Competition> => {
      const { data: existing, error: readError } = await supabase
        .from("competitions")
        .select(COMPETITION_SELECT)
        .is("deleted_at", null);
      if (readError) throw readError;

      const key = normalizeCompetitionName(input.name);
      const found = (existing ?? []).find(
        (c) =>
          normalizeCompetitionName((c as { name: string }).name) === key &&
          (c as { season: string }).season === input.season,
      );
      if (found) return found as unknown as Competition;

      const color = COLORS[(existing?.length ?? 0) % COLORS.length];
      const { data, error } = await supabase
        .from("competitions")
        .insert({ ...input, color })
        .select(COMPETITION_SELECT)
        .single();
      if (error) throw error;
      return data as unknown as Competition;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<CompetitionInput> & { id: string }) => {
      const { error } = await supabase.from("competitions").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, update };
}

export function useMatches() {
  return useQuery({
    queryKey: ["matches"],
    queryFn: async (): Promise<Match[]> => {
      const { data, error } = await supabase
        .from("matches")
        .select(MATCH_SELECT)
        .is("deleted_at", null)
        .order("date")
        .order("time");
      if (error) throw error;

      return (data ?? []) as unknown as Match[];
    },
  });
}

export function useAgenda() {
  return useQuery({
    queryKey: ["agenda"],
    queryFn: async (): Promise<AgendaItem[]> => {
      const { data, error } = await supabase
        .from("agenda")
        .select(`id, match_id, status, match:matches(${MATCH_SELECT})`);
      if (error) throw error;
      const items = (data ?? []) as unknown as AgendaItem[];
      return items.sort((a, b) => {
        const ka = `${a.match?.date ?? ""}${a.match?.time ?? ""}`;
        const kb = `${b.match?.date ?? ""}${b.match?.time ?? ""}`;
        return ka.localeCompare(kb);
      });
    },
  });
}

export function useAgendaMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["agenda"] });
  };

  const add = useMutation({
    mutationFn: async (matchId: string) => {
      const { error } = await supabase.from("agenda").insert({ match_id: matchId });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agenda").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const complete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agenda").update({ status: "completed" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const reopen = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agenda").update({ status: "scheduled" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { add, remove, complete, reopen };
}
