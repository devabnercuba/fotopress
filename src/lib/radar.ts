import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isRadarEnabled } from "@/lib/features";
import { syncRadar } from "@/services/radar-service";
import type { Match } from "./queries";

export type RadarSource = { id: string; name: string; url: string | null };

export type Radar = {
  id: string;
  match_id: string;
  coverage_id: string | null;
  summary: string | null;
  news: string[];
  attention_points: string[];
  photo_suggestions: string[];
  sources_used: RadarSource[];
  status: string;
  last_synced_at: string | null;
};

export type RadarState = "updated" | "stale" | "none";

const STALE_DAYS = 3;

export function radarState(radar?: Radar | null): RadarState {
  if (!radar?.last_synced_at) return "none";
  const days = (Date.now() - new Date(radar.last_synced_at).getTime()) / 86_400_000;
  return days <= STALE_DAYS ? "updated" : "stale";
}

export const RADAR_LABEL: Record<RadarState, string> = {
  updated: "Radar atualizado",
  stale: "Radar desatualizado",
  none: "Radar não gerado",
};

export const RADAR_DOT: Record<RadarState, string> = {
  updated: "bg-comp-green",
  stale: "bg-comp-yellow",
  none: "bg-muted-foreground/40",
};

function normalize(row: Record<string, unknown>): Radar {
  const list = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);
  const sources = (v: unknown) => (Array.isArray(v) ? (v as RadarSource[]) : []);
  return {
    id: row.id as string,
    match_id: row.match_id as string,
    coverage_id: (row.coverage_id as string | null) ?? null,
    summary: (row.summary as string | null) ?? null,
    news: list(row.news),
    attention_points: list(row.attention_points),
    photo_suggestions: list(row.photo_suggestions),
    sources_used: sources(row.sources_used),
    status: (row.status as string) ?? "pending",
    last_synced_at: (row.last_synced_at as string | null) ?? null,
  };
}

export function useRadars() {
  const enabled = isRadarEnabled();
  return useQuery({
    queryKey: ["match_radar"],
    queryFn: async (): Promise<Record<string, Radar>> => {
      if (!isRadarEnabled()) return {};
      const { data, error } = await supabase
        .from("match_radar")
        .select(
          "id, match_id, coverage_id, summary, news, attention_points, photo_suggestions, sources_used, status, last_synced_at",
        );
      if (error) throw error;
      const map: Record<string, Radar> = {};
      for (const row of data ?? []) {
        const radar = normalize(row as unknown as Record<string, unknown>);
        map[radar.match_id] = radar;
      }
      return map;
    },
    enabled,
  });
}

export function useRadarSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ match, coverageId }: { match: Match; coverageId: string }) => {
      if (!isRadarEnabled()) {
        throw new Error("O módulo Radar está temporariamente desativado.");
      }
      return syncRadar(match, coverageId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["match_radar"] }),
  });
}
