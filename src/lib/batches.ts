import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Lotes de operação (`operation_batches`) — toda operação destrutiva ou de
 * importação de jogos cria um lote, permitindo desfazer/restaurar depois.
 *
 * Escopo do undo: apenas jogos, importações e fontes. Nunca operações
 * financeiras (Kiwify), de autenticação ou externas.
 */
export type OperationType =
  | "pdf_import"
  | "cbf_import"
  | "fcf_import"
  | "manual_import"
  | "bulk_delete"
  | "bulk_update"
  | "source_reprocess";

export type OperationBatch = {
  id: string;
  operation_type: OperationType | string;
  entity_type: string;
  source_id: string | null;
  import_batch_id: string | null;
  description: string | null;
  affected_count: number;
  status: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  undone_at: string | null;
};

export const OPERATION_LABEL: Record<string, string> = {
  pdf_import: "Importação PDF",
  cbf_import: "Importação CBF",
  fcf_import: "Importação FCF",
  manual_import: "Importação manual",
  url_import: "Importação por URL",
  excel_import: "Importação Excel",
  csv_import: "Importação CSV",
  bulk_delete: "Exclusão em lote",
  bulk_update: "Atualização em lote",
  source_reprocess: "Reprocessamento de fonte",
  source_cleanup: "Limpeza de fonte",
  source_delete: "Exclusão de fonte",
  competition_delete: "Exclusão de campeonato",
  template_import: "Importação (modelo oficial)",
  athlete_import: "Importação de atletas",
  athlete_cleanup: "Limpeza de atletas importados",
};

const BATCH_SELECT =
  "id, operation_type, entity_type, source_id, import_batch_id, description, affected_count, status, metadata, created_at, undone_at";

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/** Cria o registro do lote. Falhas aqui nunca interrompem a operação principal. */
export async function createOperationBatch(input: {
  operation_type: string;
  description?: string | null;
  affected_count?: number;
  source_id?: string | null;
  import_batch_id?: string | null;
  metadata?: Record<string, unknown>;
  /** Entidade principal afetada: matches, data_sources, competitions… */
  entity_type?: string;
}): Promise<string | null> {
  const user_id = await currentUserId();
  if (!user_id) return null;
  const { data, error } = await supabase
    .from("operation_batches")
    .insert({
      user_id,
      operation_type: input.operation_type,
      entity_type: input.entity_type ?? "matches",
      description: input.description ?? null,
      affected_count: input.affected_count ?? 0,
      source_id: input.source_id ?? null,
      import_batch_id: input.import_batch_id ?? null,
      metadata: (input.metadata ?? {}) as never,
    })
    .select("id")
    .single();
  if (error) return null;
  return data.id;
}

export async function updateOperationBatch(
  id: string,
  patch: { affected_count?: number; description?: string | null; status?: string },
) {
  await supabase.from("operation_batches").update(patch).eq("id", id);
}

export function useOperationBatches() {
  return useQuery({
    queryKey: ["operation-batches"],
    queryFn: async (): Promise<OperationBatch[]> => {
      const { data, error } = await supabase
        .from("operation_batches")
        .select(BATCH_SELECT)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as unknown as OperationBatch[];
    },
  });
}

/** Jogos na lixeira (soft delete). */
export function useTrashedMatches() {
  return useQuery({
    queryKey: ["matches", "trash"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select(
          "id, competition_id, home_team, away_team, home_team_id, away_team_id, date, time, venue, city, state, notes, source, source_id, import_type, deleted_at, deletion_batch_id, competition:competitions(id, name, category, color, season)",
        )
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as (import("./queries").Match & {
        deleted_at: string;
        deletion_batch_id: string | null;
      })[];
    },
  });
}

function invalidator(qc: ReturnType<typeof useQueryClient>) {
  return () => {
    qc.invalidateQueries({ queryKey: ["matches"] });
    qc.invalidateQueries({ queryKey: ["operation-batches"] });
    qc.invalidateQueries({ queryKey: ["agenda"] });
    qc.invalidateQueries({ queryKey: ["coverages"] });
  };
}

export async function softDeleteMatches(ids: string[], batchId: string) {
  const deleted_by = await currentUserId();
  const { error } = await supabase
    .from("matches")
    .update({ deleted_at: new Date().toISOString(), deleted_by, deletion_batch_id: batchId })
    .in("id", ids);
  if (error) throw error;
}

export type RestoreOutcome = { restored: number; conflicts: number };

const FIXTURE_SELECT = "id, competition_id, date, time, home_team, away_team";

type FixtureRow = {
  id: string;
  competition_id: string | null;
  date: string;
  time: string | null;
  home_team: string;
  away_team: string;
};

function fixtureKey(m: FixtureRow) {
  return [m.competition_id ?? "", m.date, (m.time ?? "").slice(0, 8), m.home_team, m.away_team]
    .join("|")
    .toLowerCase();
}

/**
 * Restaura apenas as partidas que não conflitam com um jogo ativo equivalente.
 * Um conflito nunca derruba o lote inteiro: os demais jogos voltam normalmente.
 */
async function restoreMatchesSafely(candidates: FixtureRow[]): Promise<RestoreOutcome> {
  if (candidates.length === 0) return { restored: 0, conflicts: 0 };

  const dates = [...new Set(candidates.map((m) => m.date))];
  const { data: active, error } = await supabase
    .from("matches")
    .select(FIXTURE_SELECT)
    .is("deleted_at", null)
    .in("date", dates);
  if (error) throw error;

  const taken = new Set((active ?? []).map((m) => fixtureKey(m as FixtureRow)));
  const allowed: string[] = [];
  let conflicts = 0;
  for (const m of candidates) {
    const key = fixtureKey(m);
    if (taken.has(key)) {
      conflicts += 1;
      continue;
    }
    taken.add(key);
    allowed.push(m.id);
  }

  if (allowed.length > 0) {
    const { error: updateError } = await supabase
      .from("matches")
      .update({ deleted_at: null, deleted_by: null, deletion_batch_id: null })
      .in("id", allowed);
    if (updateError) throw updateError;
  }
  return { restored: allowed.length, conflicts };
}

export async function restoreMatchesByIds(ids: string[]): Promise<RestoreOutcome> {
  const { data, error } = await supabase
    .from("matches")
    .select(FIXTURE_SELECT)
    .in("id", ids)
    .not("deleted_at", "is", null);
  if (error) throw error;
  return restoreMatchesSafely((data ?? []) as FixtureRow[]);
}

export async function restoreDeletionBatch(batchId: string): Promise<RestoreOutcome> {
  const { data, error } = await supabase
    .from("matches")
    .select(FIXTURE_SELECT)
    .eq("deletion_batch_id", batchId)
    .not("deleted_at", "is", null);
  if (error) throw error;
  return restoreMatchesSafely((data ?? []) as FixtureRow[]);
}

/**
 * Desfaz uma importação: remove logicamente apenas os jogos daquele
 * `import_batch_id`, preservando importações anteriores.
 */
export async function undoImportBatch(importBatchId: string, operationBatchId?: string | null) {
  const deleted_by = await currentUserId();
  const { data, error } = await supabase
    .from("matches")
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by,
      deletion_batch_id: operationBatchId ?? null,
    })
    .eq("import_batch_id", importBatchId)
    .is("deleted_at", null)
    .select("id");
  if (error) throw error;
  if (operationBatchId) {
    await supabase
      .from("operation_batches")
      .update({ status: "undone", undone_at: new Date().toISOString(), undone_by: deleted_by })
      .eq("id", operationBatchId);
  }
  return data?.length ?? 0;
}

/**
 * Reversão completa de um lote, incluindo as entidades vinculadas.
 *
 * Cada tipo de operação guarda no `metadata` o necessário para voltar ao
 * estado anterior: ids das partidas, vínculos originais de fonte e de
 * campeonato. Nada é recriado por adivinhação.
 */
export async function undoOperationBatch(batch: OperationBatch): Promise<RestoreOutcome> {
  const userId = await currentUserId();
  const meta = batch.metadata ?? {};
  const type = batch.operation_type;
  let outcome: RestoreOutcome = { restored: 0, conflicts: 0 };

  if (type === "bulk_delete") {
    outcome = await restoreDeletionBatch(batch.id);
  } else if (type === "source_reprocess" || type === "bulk_update") {
    const snapshots = (meta["snapshots"] ?? []) as { id: string; patch: Record<string, unknown> }[];
    for (const snap of snapshots) {
      await supabase
        .from("matches")
        .update(snap.patch as never)
        .eq("id", snap.id);
    }
  } else if (type === "source_delete" || type === "source_cleanup") {
    const sourceId = (meta["source_id"] as string | undefined) ?? batch.source_id;
    if (sourceId) {
      // A própria fonte volta para a lista de Fontes de Jogos.
      await supabase
        .from("data_sources")
        .update({ deleted_at: null, deleted_by: null })
        .eq("id", sourceId);
    }
    // Jogos removidos junto com a fonte (apenas os que não conflitam).
    outcome = await restoreDeletionBatch(batch.id);
    // Jogos que foram apenas desvinculados ("manter os jogos").
    const detached = (meta["detached_match_ids"] ?? []) as string[];
    if (sourceId && detached.length > 0) {
      await supabase.from("matches").update({ source_id: sourceId }).in("id", detached);
    }
  } else if (type === "competition_delete") {
    const competitionId = meta["competition_id"] as string | undefined;
    if (competitionId) {
      await supabase
        .from("competitions")
        .update({ deleted_at: null, deleted_by: null })
        .eq("id", competitionId);
      await supabase
        .from("data_sources")
        .update({ deleted_at: null, deleted_by: null })
        .eq("competition_id", competitionId);
    }
    outcome = await restoreDeletionBatch(batch.id);
    // Modo "mover": devolve jogos e fontes ao campeonato original.
    if (meta["mode"] === "move" && competitionId) {
      const movedMatches = (meta["moved_match_ids"] ?? []) as string[];
      const movedSources = (meta["moved_source_ids"] ?? []) as string[];
      if (movedMatches.length > 0) {
        await supabase
          .from("matches")
          .update({ competition_id: competitionId })
          .in("id", movedMatches);
      }
      if (movedSources.length > 0) {
        await supabase
          .from("data_sources")
          .update({ competition_id: competitionId })
          .in("id", movedSources);
      }
    }
  } else {
    // Importações: remove logicamente apenas os jogos daquele import_batch_id.
    if (!batch.import_batch_id) throw new Error("Lote sem identificador de importação.");
    const { error } = await supabase
      .from("matches")
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: userId,
        deletion_batch_id: batch.id,
      })
      .eq("import_batch_id", batch.import_batch_id)
      .is("deleted_at", null);
    if (error) throw error;
  }

  await supabase
    .from("operation_batches")
    .update({ status: "undone", undone_at: new Date().toISOString(), undone_by: userId })
    .eq("id", batch.id);

  return outcome;
}

/**
 * Remove apenas o registro de auditoria. Nenhuma partida é alterada: os jogos
 * na Lixeira continuam lá, apenas deixam de apontar para este lote.
 */
export async function deleteOperationBatch(batchId: string) {
  return deleteOperationBatches([batchId]);
}

/** Versão em lote: remove vários registros de auditoria de uma só vez. */
export async function deleteOperationBatches(batchIds: string[]) {
  if (batchIds.length === 0) return;
  await supabase
    .from("matches")
    .update({ deletion_batch_id: null })
    .in("deletion_batch_id", batchIds);
  const { error } = await supabase.from("operation_batches").delete().in("id", batchIds);
  if (error) throw error;
}

export function useBatchMutations() {
  const qc = useQueryClient();
  const invalidate = invalidator(qc);

  /** Exclusão em lote reversível. Retorna o lote criado. */
  const bulkDelete = useMutation({
    mutationFn: async ({ ids, description }: { ids: string[]; description?: string }) => {
      const batchId = await createOperationBatch({
        operation_type: "bulk_delete",
        description: description ?? `${ids.length} jogos removidos`,
        affected_count: ids.length,
        metadata: { match_ids: ids },
      });
      if (!batchId) throw new Error("Não foi possível registrar o lote de exclusão.");
      await softDeleteMatches(ids, batchId);
      return { batchId, count: ids.length };
    },
    onSuccess: invalidate,
  });

  /** Desfaz/reverte um lote (exclusão, importação, fonte ou campeonato). */
  const undoBatch = useMutation({
    mutationFn: async (batch: OperationBatch) => undoOperationBatch(batch),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["data_sources"] });
      qc.invalidateQueries({ queryKey: ["competitions"] });
    },
  });

  /** Restaura jogos individuais da lixeira, ignorando conflitos com jogos ativos. */
  const restore = useMutation({
    mutationFn: async (ids: string[]) => restoreMatchesByIds(ids),
    onSuccess: invalidate,
  });

  /** Remove o registro do histórico sem tocar nos jogos. */
  const removeBatch = useMutation({
    mutationFn: async (batchId: string) => deleteOperationBatch(batchId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["operation-batches"] });
      qc.invalidateQueries({ queryKey: ["matches"] });
    },
  });

  /** Remove vários registros do histórico de uma vez. */
  const removeBatches = useMutation({
    mutationFn: async (batchIds: string[]) => deleteOperationBatches(batchIds),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["operation-batches"] });
      qc.invalidateQueries({ queryKey: ["matches"] });
    },
  });

  /** Exclusão definitiva — disponível apenas na Lixeira. */
  const purge = useMutation({
    mutationFn: async (ids: string[]) => {
      await supabase.from("match_radar").delete().in("match_id", ids);
      await supabase.from("coverages").delete().in("match_id", ids);
      await supabase.from("agenda").delete().in("match_id", ids);
      const { error } = await supabase.from("matches").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { bulkDelete, undoBatch, restore, purge, removeBatch, removeBatches };
}
