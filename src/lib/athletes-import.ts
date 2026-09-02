import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { fetchRoster } from "@/lib/athletes-import.functions";
import { createOperationBatch } from "@/lib/batches";
import { ensureTeams, teamSlug } from "@/lib/teams";
import type { NormalizedAthlete, RosterResult } from "@/services/athletes/types";
import { providerLabel } from "@/services/athletes/types";

/**
 * Importação de atletas (enriquecimento).
 * --------------------------------------
 * A fonte de atletas **complementa** o CRM: ela pode criar atletas novos e
 * preencher lacunas públicas (posição, número, foto, nome completo).
 *
 * Nunca toca em dado do usuário: telefone, WhatsApp, e-mail, Instagram,
 * relacionamento comercial, notas, status, categoria escolhida à mão,
 * engajamentos por jogo/evento e histórico permanecem intactos.
 *
 * Nada é gravado sem o usuário confirmar o preview.
 */

export type AthleteSource = {
  id: string;
  name: string;
  provider: string;
  url: string;
  team_id: string | null;
  sport: string | null;
  category: string | null;
  status: string;
  last_sync_at: string | null;
  last_error: string | null;
  created_at: string;
  team: { id: string; name: string } | null;
};

const SOURCE_SELECT =
  "id, name, provider, url, team_id, sport, category, status, last_sync_at, last_error, created_at, team:teams(id, name)";

export type SourceLink = {
  id: string;
  source_id: string;
  athlete_id: string;
  external_player_id: string | null;
  created_by_source: boolean;
  source_full_name: string | null;
  source_team_name: string | null;
  last_seen_at: string | null;
};

/* ------------------------------------------------------------- comparação */

const plain = (value: string | null | undefined) =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export type PreviewAction = "create" | "update" | "unchanged";

export type PreviewRow = {
  key: string;
  athlete: NormalizedAthlete;
  action: PreviewAction;
  /** Atleta já existente no CRM, quando houver correspondência. */
  existingId: string | null;
  existingName: string | null;
  /** Campos públicos que serão preenchidos (nunca sobrescritos). */
  fills: string[];
  /** Campos preservados porque já têm valor do usuário. */
  preserved: string[];
  /** Motivo do vínculo encontrado (transparência no preview). */
  matchedBy: "externo" | "nome completo + clube" | "nome completo" | null;
  /**
   * Correspondência apenas por apelido: NUNCA é mesclada automaticamente.
   * A UI mostra como "possível correspondência" e o usuário decide.
   */
  suggestion: { id: string; name: string; nickname: string | null } | null;
};

type ExistingAthlete = {
  id: string;
  name: string;
  full_name: string | null;
  nickname: string | null;
  team_id: string | null;
  position: string | null;
  number: number | null;
  photo_url: string | null;
  photo_manual: boolean;
  category: string | null;
  sport: string | null;
  relationship: string;
  notes: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  instagram: string | null;
};

const EXISTING_SELECT =
  "id, name, full_name, nickname, team_id, position, number, photo_url, photo_manual, category, sport, relationship, notes, phone, whatsapp, email, instagram";

/**
 * Compara o elenco lido com o banco do usuário.
 *
 * Identidade: id externo → nome completo + clube → nome completo.
 * O apelido NUNCA decide sozinho: quando é a única coincidência, a linha vira
 * "criar" com uma sugestão de possível correspondência para o usuário decidir.
 */
export function buildPreview(
  athletes: NormalizedAthlete[],
  existing: ExistingAthlete[],
  links: SourceLink[],
  teamId: string | null,
): PreviewRow[] {
  const byId = new Map(existing.map((a) => [a.id, a]));
  const byExternal = new Map<string, ExistingAthlete>();
  for (const link of links) {
    if (!link.external_player_id) continue;
    const found = byId.get(link.athlete_id);
    if (found) byExternal.set(link.external_player_id, found);
  }

  const byNameTeam = new Map<string, ExistingAthlete>();
  const byName = new Map<string, ExistingAthlete>();
  const byNicknameTeam = new Map<string, ExistingAthlete>();
  for (const a of existing) {
    // Identidade: apenas nomes completos (name e full_name).
    for (const label of [a.full_name, a.name]) {
      const key = plain(label);
      if (!key) continue;
      if (!byName.has(key)) byName.set(key, a);
      if (a.team_id) {
        const scoped = `${a.team_id}::${key}`;
        if (!byNameTeam.has(scoped)) byNameTeam.set(scoped, a);
      }
    }
    const nick = plain(a.nickname);
    if (nick && a.team_id) {
      const scoped = `${a.team_id}::${nick}`;
      if (!byNicknameTeam.has(scoped)) byNicknameTeam.set(scoped, a);
    }
  }

  return athletes.map((athlete, index) => {
    let match: ExistingAthlete | undefined;
    let matchedBy: PreviewRow["matchedBy"] = null;
    const fullNames = [athlete.fullName, athlete.name];

    if (athlete.externalId && byExternal.has(athlete.externalId)) {
      match = byExternal.get(athlete.externalId);
      matchedBy = "externo";
    }
    if (!match && teamId) {
      for (const label of fullNames) {
        const key = plain(label);
        if (!key) continue;
        const found = byNameTeam.get(`${teamId}::${key}`);
        if (found) {
          match = found;
          matchedBy = "nome completo + clube";
          break;
        }
      }
    }
    if (!match) {
      for (const label of fullNames) {
        const key = plain(label);
        if (!key) continue;
        const found = byName.get(key);
        if (found) {
          match = found;
          matchedBy = "nome completo";
          break;
        }
      }
    }

    const key = `${athlete.externalId ?? plain(athlete.fullName ?? athlete.name)}-${index}`;
    if (!match) {
      // Só apelido bate: sugerimos, nunca mesclamos automaticamente.
      const nick = plain(athlete.nickname);
      const possible = nick && teamId ? byNicknameTeam.get(`${teamId}::${nick}`) : undefined;
      return {
        key,
        athlete,
        action: "create",
        existingId: null,
        existingName: null,
        fills: [],
        preserved: [],
        matchedBy: null,
        suggestion: possible
          ? { id: possible.id, name: possible.name, nickname: possible.nickname }
          : null,
      };
    }

    const { fills, preserved } = computeChanges(athlete, match, teamId, matchedBy);
    return {
      key,
      athlete,
      action: fills.length > 0 ? "update" : "unchanged",
      existingId: match.id,
      existingName: match.name,
      fills,
      preserved,
      matchedBy,
      suggestion: null,
    };
  });
}

/** Quais campos públicos serão preenchidos (lacunas) e quais serão preservados. */
function computeChanges(
  athlete: NormalizedAthlete,
  match: ExistingAthlete,
  teamId: string | null,
  matchedBy: PreviewRow["matchedBy"],
) {
  const fills: string[] = [];
  const preserved: string[] = [];
  const consider = (
    label: string,
    incoming: string | number | null | undefined,
    current: string | number | null | undefined,
    locked = false,
  ) => {
    if (incoming === null || incoming === undefined || incoming === "") return;
    if (locked) {
      preserved.push(label);
      return;
    }
    if (current === null || current === undefined || current === "") fills.push(label);
    else preserved.push(label);
  };

  consider("Nome completo", athlete.fullName, match.full_name);
  consider("Apelido", athlete.nickname, match.nickname);
  consider("Posição", athlete.position, match.position);
  consider("Número", athlete.shirtNumber, match.number);
  consider("Foto", athlete.photoUrl, match.photo_url, match.photo_manual);
  consider("Clube", teamId, match.team_id);
  consider("Modalidade", athlete.sport, match.sport);

  // Atleta antigo salvo só com o apelido: com id externo confiável, completa
  // o nome principal com o nome completo publicado.
  if (
    matchedBy === "externo" &&
    athlete.fullName &&
    plain(match.name) === plain(athlete.nickname) &&
    plain(match.name) !== plain(athlete.fullName)
  ) {
    fills.push("Nome");
  }

  return { fills, preserved };
}

/**
 * Decisão manual do usuário no preview: vincular a linha a um atleta já
 * existente (correspondência sugerida por apelido). Nada é mesclado sozinho.
 */
export async function linkPreviewRow(
  row: PreviewRow,
  existingId: string,
  teamId: string | null,
): Promise<PreviewRow> {
  const { data } = await supabase
    .from("athletes")
    .select(EXISTING_SELECT)
    .eq("id", existingId)
    .maybeSingle();
  if (!data) return row;
  const match = data as ExistingAthlete;
  const { fills, preserved } = computeChanges(row.athlete, match, teamId, null);
  return {
    ...row,
    action: fills.length > 0 ? "update" : "unchanged",
    existingId: match.id,
    existingName: match.name,
    fills,
    preserved,
    matchedBy: null,
    suggestion: null,
  };
}

/* ----------------------------------------------------------------- leitura */

/** Lê a URL informada e devolve o elenco publicado (sem gravar nada). */
export async function analyzeRosterUrl(url: string): Promise<RosterResult> {
  return fetchRoster({ data: { url } });
}

export function useAthleteSources() {
  return useQuery({
    queryKey: ["athlete_data_sources"],
    queryFn: async (): Promise<AthleteSource[]> => {
      const { data, error } = await supabase
        .from("athlete_data_sources")
        .select(SOURCE_SELECT)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AthleteSource[];
    },
  });
}

export function useSourceLinks(sourceId?: string | null) {
  return useQuery({
    queryKey: ["athlete_source_links", sourceId ?? "all"],
    queryFn: async (): Promise<SourceLink[]> => {
      let query = supabase
        .from("athlete_source_links")
        .select(
          "id, source_id, athlete_id, external_player_id, created_by_source, source_full_name, source_team_name, last_seen_at",
        );
      if (sourceId) query = query.eq("source_id", sourceId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as SourceLink[];
    },
  });
}

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

async function loadExisting(): Promise<ExistingAthlete[]> {
  const { data, error } = await supabase
    .from("athletes")
    .select(EXISTING_SELECT)
    .is("deleted_at", null);
  if (error) throw error;
  return (data ?? []) as ExistingAthlete[];
}

/** Prepara o preview completo de uma leitura: clube resolvido + comparação. */
export async function prepareImport(result: RosterResult, sourceId?: string | null) {
  const teamName = result.teamName ?? result.athletes[0]?.teamName ?? null;
  let teamId: string | null = null;
  if (teamName) {
    const { bySlug } = await ensureTeams([{ name: teamName, state: result.teamState }]);
    teamId = bySlug.get(teamSlug(teamName))?.id ?? null;
  }

  const [existing, links] = await Promise.all([
    loadExisting(),
    (async () => {
      let query = supabase
        .from("athlete_source_links")
        .select(
          "id, source_id, athlete_id, external_player_id, created_by_source, source_full_name, source_team_name, last_seen_at",
        );
      if (sourceId) query = query.eq("source_id", sourceId);
      const { data } = await query;
      return (data ?? []) as SourceLink[];
    })(),
  ]);

  return { teamId, teamName, rows: buildPreview(result.athletes, existing, links, teamId) };
}

/* ---------------------------------------------------------------- gravação */

export type ImportOutcome = {
  created: number;
  updated: number;
  skipped: number;
  batchId: string | null;
};

export function useAthleteImport() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["athletes"] });
    qc.invalidateQueries({ queryKey: ["athlete_data_sources"] });
    qc.invalidateQueries({ queryKey: ["athlete_source_links"] });
    qc.invalidateQueries({ queryKey: ["teams"] });
    qc.invalidateQueries({ queryKey: ["operation-batches"] });
  };

  /** Cria (ou reaproveita) a fonte e grava apenas as linhas confirmadas. */
  const run = useMutation({
    mutationFn: async ({
      result,
      rows,
      teamId,
      sourceId,
      category,
    }: {
      result: RosterResult;
      rows: PreviewRow[];
      teamId: string | null;
      sourceId?: string | null;
      category?: string | null;
    }): Promise<ImportOutcome> => {
      const userId = await currentUserId();
      const provider = result.provider ?? "cbf";
      const sourceUrl = rows[0]?.athlete.sourceUrl ?? "";
      const label = `${providerLabel(provider)}${result.teamName ? ` — ${result.teamName}` : ""}`;

      let source = sourceId ?? null;
      if (!source) {
        const { data: existingSource } = await supabase
          .from("athlete_data_sources")
          .select("id")
          .eq("url", sourceUrl)
          .is("deleted_at", null)
          .maybeSingle();
        source = existingSource?.id ?? null;
      }
      if (!source) {
        const { data, error } = await supabase
          .from("athlete_data_sources")
          .insert({
            name: label,
            provider,
            url: sourceUrl,
            team_id: teamId,
            sport: rows[0]?.athlete.sport ?? "futebol",
            category: category ?? null,
            status: "active",
          })
          .select("id")
          .single();
        if (error) throw error;
        source = data.id;
      }

      const batchId = await createOperationBatch({
        operation_type: "athlete_import",
        entity_type: "athletes",
        description: `Importação de atletas — ${label}`,
        metadata: { source_id: source, provider, url: sourceUrl },
      });

      const selected = rows.filter((row) => row.action !== "unchanged");
      let created = 0;
      let updated = 0;
      const now = new Date().toISOString();

      for (const row of rows) {
        const a = row.athlete;
        if (row.action === "create") {
          const { data, error } = await supabase
            .from("athletes")
            .insert({
              name: a.name,
              full_name: a.fullName ?? null,
              nickname: a.nickname ?? null,
              team_id: teamId,
              position: a.position ?? null,
              number: a.shirtNumber ?? null,
              photo_url: a.photoUrl ?? null,
              sport: a.sport ?? "futebol",
              category: category ?? a.category ?? null,
              relationship: "unclassified",
              status: "active",
            })
            .select("id")
            .single();
          if (error) throw error;
          created += 1;
          await linkAthlete(source, data.id, a, userId, batchId, true, now);
          continue;
        }

        if (row.action === "update" && row.existingId) {
          // Preenche somente lacunas: nada do usuário é sobrescrito.
          const patch: {
            name?: string;
            full_name?: string | null;
            nickname?: string | null;
            position?: string | null;
            number?: number | null;
            photo_url?: string | null;
            team_id?: string | null;
            sport?: string | null;
          } = {};
          const has = (label: string) => row.fills.includes(label);
          if (has("Nome") && a.fullName) patch.name = a.fullName;
          if (has("Nome completo")) patch.full_name = a.fullName;
          if (has("Apelido")) patch.nickname = a.nickname;
          if (has("Posição")) patch.position = a.position;
          if (has("Número")) patch.number = a.shirtNumber;
          if (has("Foto")) patch.photo_url = a.photoUrl;
          if (has("Clube")) patch.team_id = teamId;
          if (has("Modalidade")) patch.sport = a.sport;
          if (Object.keys(patch).length > 0) {
            const { error } = await supabase
              .from("athletes")
              .update(patch)
              .eq("id", row.existingId);
            if (error) throw error;
            updated += 1;
          }
          await linkAthlete(source, row.existingId, a, userId, batchId, false, now);
        }
      }

      await supabase
        .from("athlete_data_sources")
        .update({ last_sync_at: now, last_error: null, status: "active" })
        .eq("id", source);

      if (batchId) {
        await supabase
          .from("operation_batches")
          .update({ affected_count: created + updated })
          .eq("id", batchId);
      }

      return { created, updated, skipped: rows.length - selected.length, batchId };
    },
    onSuccess: invalidate,
  });

  /**
   * Limpeza segura: remove (soft delete) apenas atletas criados por esta fonte
   * que continuam "cru" — sem relacionamento comercial, contato, notas ou
   * engajamento. Clientes e histórico ficam preservados.
   */
  const clearAthletes = useMutation({
    mutationFn: async (sourceId: string) => {
      const userId = await currentUserId();
      const { data: links } = await supabase
        .from("athlete_source_links")
        .select("athlete_id, created_by_source")
        .eq("source_id", sourceId);

      const candidates = (links ?? []).filter((l) => l.created_by_source).map((l) => l.athlete_id);
      if (candidates.length === 0) return { removed: 0, preserved: 0, batchId: null };

      const [{ data: athletes }, { data: matchEng }, { data: eventEng }] = await Promise.all([
        supabase
          .from("athletes")
          .select(EXISTING_SELECT)
          .in("id", candidates)
          .is("deleted_at", null),
        supabase
          .from("athlete_match_engagements")
          .select("athlete_id")
          .in("athlete_id", candidates),
        supabase
          .from("athlete_event_engagements")
          .select("athlete_id")
          .in("athlete_id", candidates),
      ]);

      const busy = new Set([
        ...(matchEng ?? []).map((e) => e.athlete_id),
        ...(eventEng ?? []).map((e) => e.athlete_id),
      ]);

      const safe = ((athletes ?? []) as ExistingAthlete[]).filter(
        (a) =>
          !busy.has(a.id) &&
          (a.relationship === "unclassified" || a.relationship === "contact") &&
          !a.phone &&
          !a.whatsapp &&
          !a.email &&
          !a.instagram &&
          !a.notes,
      );
      const preserved = (athletes ?? []).length - safe.length;
      if (safe.length === 0) return { removed: 0, preserved, batchId: null };

      const batchId = await createOperationBatch({
        operation_type: "athlete_cleanup",
        entity_type: "athletes",
        description: "Limpeza de atletas importados (clientes preservados)",
        metadata: { source_id: sourceId },
      });

      const ids = safe.map((a) => a.id);
      const { error } = await supabase
        .from("athletes")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: userId,
          deletion_batch_id: batchId,
        })
        .in("id", ids);
      if (error) throw error;

      await supabase
        .from("athlete_source_links")
        .delete()
        .eq("source_id", sourceId)
        .in("athlete_id", ids);
      if (batchId) {
        await supabase
          .from("operation_batches")
          .update({ affected_count: ids.length })
          .eq("id", batchId);
      }

      return { removed: ids.length, preserved, batchId };
    },
    onSuccess: invalidate,
  });

  /** Exclui a fonte (os atletas continuam no CRM). */
  const removeSource = useMutation({
    mutationFn: async (sourceId: string) => {
      const { error } = await supabase
        .from("athlete_data_sources")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", sourceId);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { run, clearAthletes, removeSource };
}

async function linkAthlete(
  sourceId: string,
  athleteId: string,
  athlete: NormalizedAthlete,
  userId: string | null,
  batchId: string | null,
  createdBySource: boolean,
  now: string,
) {
  const payload = {
    source_id: sourceId,
    athlete_id: athleteId,
    external_player_id: athlete.externalId ?? null,
    source_name: athlete.name,
    source_full_name: athlete.fullName ?? null,
    source_team_name: athlete.currentTeamName ?? athlete.teamName ?? null,
    created_by_source: createdBySource,
    created_batch_id: batchId,
    last_seen_at: now,
    ...(userId ? { user_id: userId } : {}),
  };
  await supabase
    .from("athlete_source_links")
    .upsert(payload, { onConflict: "source_id,athlete_id" });
}
