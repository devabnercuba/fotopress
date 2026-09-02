import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { createOperationBatch } from "./batches";
import type { Competition } from "./queries";

export type DataSource = {
  id: string;
  name: string;
  type: string;
  competition_id: string | null;
  season: string;
  url: string | null;
  file_name: string | null;
  status: string;
  last_sync: string | null;
  last_update: string | null;
  games_count: number;
  last_error: string | null;
  competition: Pick<Competition, "id" | "name" | "color"> | null;
};

const SELECT =
  "id, name, type, competition_id, season, url, file_name, status, last_sync, last_update, games_count, last_error, competition:competitions(id, name, color)";

export function useDataSources() {
  return useQuery({
    queryKey: ["data_sources"],
    queryFn: async (): Promise<DataSource[]> => {
      const { data, error } = await supabase
        .from("data_sources")
        .select(SELECT)
        .is("deleted_at", null)
        .order("name");

      if (error) throw error;
      return (data ?? []) as unknown as DataSource[];
    },
  });
}

export type ImportHistoryEntry = {
  id: string;
  data_source_id: string | null;
  source_type: string;
  status: string;
  imported: number;
  updated: number;
  skipped: number;
  message: string | null;
  created_at: string;
};

export function useImportHistory(dataSourceId?: string) {
  return useQuery({
    queryKey: ["import_history", dataSourceId ?? "all"],
    queryFn: async (): Promise<ImportHistoryEntry[]> => {
      let query = supabase
        .from("import_history")
        .select(
          "id, data_source_id, source_type, status, imported, updated, skipped, message, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(20);
      if (dataSourceId) query = query.eq("data_source_id", dataSourceId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as ImportHistoryEntry[];
    },
  });
}

export type DataSourceInput = {
  name: string;
  type: string;
  competition_id: string | null;
  season: string;
  url: string | null;
  file_name: string | null;
  status: string;
};

export function useDataSourceMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["data_sources"] });
    qc.invalidateQueries({ queryKey: ["import_history"] });
  };

  const create = useMutation({
    mutationFn: async (input: DataSourceInput) => {
      const { data, error } = await supabase
        .from("data_sources")
        .insert(input)
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...input }: DataSourceInput & { id: string }) => {
      const { error } = await supabase.from("data_sources").update(input).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /**
   * Exclui a fonte. Com `withMatches`, remove também as partidas importadas
   * por ela; sem, os jogos permanecem no banco como partidas manuais.
   */
  const remove = useMutation({
    mutationFn: async ({
      id,
      withMatches,
      name,
    }: {
      id: string;
      withMatches: boolean;
      name?: string;
    }) => {
      const userId = await currentUserId();
      let removed = 0;
      let detachedIds: string[] = [];

      // O lote nasce antes: ele guarda como devolver fonte e jogos ao estado atual.
      const batchId = await createOperationBatch({
        operation_type: "source_delete",
        entity_type: "data_sources",
        description: withMatches
          ? `Fonte “${name ?? id}” excluída com os jogos vinculados`
          : `Fonte “${name ?? id}” excluída (jogos mantidos)`,
        source_id: id,
        metadata: { source_id: id, with_matches: withMatches },
      });

      if (withMatches) {
        removed = await softDeleteMatchesBySource(id, batchId, userId);
      } else {
        const { data: detached, error: detachError } = await supabase
          .from("matches")
          .update({ source_id: null })
          .eq("source_id", id)
          .select("id");
        if (detachError) throw detachError;
        detachedIds = (detached ?? []).map((m) => m.id);
      }

      const { error } = await supabase
        .from("data_sources")
        .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
        .eq("id", id);
      if (error) throw error;

      if (batchId) {
        await supabase
          .from("operation_batches")
          .update({
            affected_count: withMatches ? removed : detachedIds.length,
            metadata: {
              source_id: id,
              with_matches: withMatches,
              detached_match_ids: detachedIds,
            } as never,
          })
          .eq("id", batchId);
      }
      return { batchId, removed };
    },
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["matches"] });
      qc.invalidateQueries({ queryKey: ["coverages"] });
      qc.invalidateQueries({ queryKey: ["operation-batches"] });
    },
  });

  /** Limpa somente os jogos importados por esta fonte (reversível). */
  const clearMatches = useMutation({
    mutationFn: async (id: string) => {
      const userId = await currentUserId();
      const batchId = await createOperationBatch({
        operation_type: "source_cleanup",
        description: "Jogos removidos de uma fonte",
        source_id: id,
      });
      const removed = await softDeleteMatchesBySource(id, batchId, userId);
      await supabase.from("data_sources").update({ games_count: 0 }).eq("id", id);
      if (batchId) {
        await supabase
          .from("operation_batches")
          .update({ affected_count: removed })
          .eq("id", batchId);
      }
      return { removed, batchId };
    },
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["matches"] });
      qc.invalidateQueries({ queryKey: ["coverages"] });
      qc.invalidateQueries({ queryKey: ["operation-batches"] });
    },
  });

  const touchSync = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("data_sources")
        .update({ last_sync: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, update, remove, clearMatches, touchSync };
}

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Quantos jogos ativos vieram de uma fonte. */
export function useSourceMatchCount(sourceId: string | null) {
  return useQuery({
    queryKey: ["source-match-count", sourceId],
    enabled: !!sourceId,
    queryFn: async () => {
      const { count } = await supabase
        .from("matches")
        .select("id", { count: "exact", head: true })
        .eq("source_id", sourceId!)
        .is("deleted_at", null);
      return count ?? 0;
    },
  });
}

/** Remove logicamente as partidas de uma fonte, permitindo desfazer depois. */
async function softDeleteMatchesBySource(
  sourceId: string,
  batchId: string | null,
  userId: string | null,
) {
  const { data: rows, error } = await supabase
    .from("matches")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: userId,
      deletion_batch_id: batchId,
    })
    .eq("source_id", sourceId)
    .is("deleted_at", null)
    .select("id");
  if (error) throw error;
  return rows?.length ?? 0;
}
