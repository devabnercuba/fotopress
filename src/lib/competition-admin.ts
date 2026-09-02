import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { createOperationBatch, undoOperationBatch, type OperationBatch } from "@/lib/batches";

/**
 * Exclusão de campeonatos com preservação de integridade.
 *
 * Nunca deixamos jogos ou fontes apontando para um campeonato inexistente:
 * ou os dados são movidos para outro campeonato, ou são removidos junto
 * (soft delete), sempre registrando um lote reversível.
 */
export type CompetitionDependencies = {
  matches: number;
  sources: number;
};

export function useCompetitionDependencies(competitionId: string | null) {
  return useQuery({
    queryKey: ["competition-dependencies", competitionId],
    enabled: !!competitionId,
    queryFn: async (): Promise<CompetitionDependencies> => {
      const [matches, sources] = await Promise.all([
        supabase
          .from("matches")
          .select("id", { count: "exact", head: true })
          .eq("competition_id", competitionId!)
          .is("deleted_at", null),
        supabase
          .from("data_sources")
          .select("id", { count: "exact", head: true })
          .eq("competition_id", competitionId!)
          .is("deleted_at", null),
      ]);
      return { matches: matches.count ?? 0, sources: sources.count ?? 0 };
    },
  });
}

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function fetchCompetitionDependencies(id: string): Promise<CompetitionDependencies> {
  const [matches, sources] = await Promise.all([
    supabase
      .from("matches")
      .select("id", { count: "exact", head: true })
      .eq("competition_id", id)
      .is("deleted_at", null),
    supabase
      .from("data_sources")
      .select("id", { count: "exact", head: true })
      .eq("competition_id", id)
      .is("deleted_at", null),
  ]);
  if (matches.error) throw matches.error;
  if (sources.error) throw sources.error;
  return { matches: matches.count ?? 0, sources: sources.count ?? 0 };
}

export function useCompetitionDeletion() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["competitions"] });
    qc.invalidateQueries({ queryKey: ["matches"] });
    qc.invalidateQueries({ queryKey: ["data_sources"] });
    qc.invalidateQueries({ queryKey: ["operation-batches"] });
    qc.invalidateQueries({ queryKey: ["competition-dependencies"] });
  };

  /**
   * `mode`:
   * - `simple`: campeonato sem vínculos (ou mantendo os dados).
   * - `move`: move jogos e fontes para `targetId` antes de excluir.
   * - `cascade`: remove também jogos e fontes vinculados (soft delete).
   */
  const remove = useMutation({
    mutationFn: async ({
      id,
      name,
      mode,
      targetId,
    }: {
      id: string;
      name: string;
      mode: "simple" | "move" | "cascade";
      targetId?: string | null;
    }) => {
      const userId = await currentUserId();
      const now = new Date().toISOString();

      // "Simples" só é válido quando nada depende do campeonato — caso
      // contrário jogos e fontes ficariam apontando para um registro excluído.
      if (mode === "simple") {
        const deps = await fetchCompetitionDependencies(id);
        if (deps.matches > 0 || deps.sources > 0) {
          throw new Error(
            "Este campeonato ainda tem jogos ou fontes vinculados. Mova ou remova esses dados junto.",
          );
        }
      }

      const batchId = await createOperationBatch({
        operation_type: "competition_delete",
        entity_type: "competitions",
        description: `Campeonato “${name}” excluído`,
        metadata: { competition_id: id, mode, target_id: targetId ?? null },
      });

      // Sem lote registrado não há como desfazer: não executamos exclusões
      // em cascata ou movimentações que ficariam irreversíveis.
      if (!batchId && mode !== "simple") {
        throw new Error("Não foi possível registrar a operação. Tente novamente.");
      }

      let affected = 0;
      let movedMatchIds: string[] = [];
      let movedSourceIds: string[] = [];

      if (mode === "move") {
        if (!targetId) throw new Error("Selecione o campeonato de destino.");
        const { data: moved, error } = await supabase
          .from("matches")
          .update({ competition_id: targetId })
          .eq("competition_id", id)
          .select("id");
        if (error) throw error;
        const { data: movedSources, error: sourceError } = await supabase
          .from("data_sources")
          .update({ competition_id: targetId })
          .eq("competition_id", id)
          .select("id");
        if (sourceError) throw sourceError;
        movedMatchIds = (moved ?? []).map((m) => m.id);
        movedSourceIds = (movedSources ?? []).map((s) => s.id);
        affected = movedMatchIds.length;
      }

      if (mode === "cascade") {
        const { data: removed, error } = await supabase
          .from("matches")
          .update({ deleted_at: now, deleted_by: userId, deletion_batch_id: batchId })
          .eq("competition_id", id)
          .is("deleted_at", null)
          .select("id");
        if (error) throw error;
        const { error: sourceError } = await supabase
          .from("data_sources")
          .update({ deleted_at: now, deleted_by: userId })
          .eq("competition_id", id)
          .is("deleted_at", null);
        if (sourceError) throw sourceError;
        affected = removed?.length ?? 0;
      }

      const { error: compError } = await supabase
        .from("competitions")
        .update({ deleted_at: now, deleted_by: userId })
        .eq("id", id);
      if (compError) throw compError;

      if (batchId) {
        await supabase
          .from("operation_batches")
          .update({
            affected_count: affected,
            // Guardamos os ids movidos para que o "Desfazer" recomponha os vínculos.
            metadata: {
              competition_id: id,
              mode,
              target_id: targetId ?? null,
              moved_match_ids: movedMatchIds,
              moved_source_ids: movedSourceIds,
            } as never,
          })
          .eq("id", batchId);
      }

      return { batchId, affected };
    },
    onSuccess: invalidate,
  });

  /** Desfaz a exclusão de um campeonato (e dos dados movidos ou removidos junto). */
  const restore = useMutation({
    mutationFn: async ({
      competitionId,
      batchId,
    }: {
      competitionId: string;
      batchId: string | null;
    }) => {
      if (batchId) {
        const { data } = await supabase
          .from("operation_batches")
          .select(
            "id, operation_type, entity_type, source_id, import_batch_id, description, affected_count, status, metadata, created_at, undone_at",
          )
          .eq("id", batchId)
          .maybeSingle();
        if (data) {
          await undoOperationBatch(data as unknown as OperationBatch);
          return;
        }
      }
      const { error } = await supabase
        .from("competitions")
        .update({ deleted_at: null, deleted_by: null })
        .eq("id", competitionId);
      if (error) throw error;
      await supabase
        .from("data_sources")
        .update({ deleted_at: null, deleted_by: null })
        .eq("competition_id", competitionId);
    },
    onSuccess: invalidate,
  });

  return { remove, restore };
}
