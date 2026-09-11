import { supabase } from "@/integrations/supabase/client";

import { createOperationBatch } from "@/lib/batches";
import { DEFAULT_SPORT_KEY, cacheTeamLogos, ensureTeams, teamIdentityKey } from "@/lib/teams";
import { mapConcurrent, chunk } from "@/lib/async-pool";

import { fpfImporter } from "./importers/fpf-importer";
import { lnfImporter } from "./importers/lnf-importer";
import { pdfImporter } from "./importers/pdf-importer";
import { csvImporter, excelImporter } from "./importers/spreadsheet-importer";
import { urlImporter } from "./importers/url-importer";
import type {
  Importer,
  ImportIssue,
  NormalizedMatch,
  SourceType,
  OnImportProgress,
} from "./importers/types";

/**
 * Traduz erros técnicos de persistência para mensagens compreensíveis.
 * O texto original permanece disponível no console para diagnóstico.
 */
function friendlyPersistError(message: string) {
  console.warn("[import] falha ao gravar jogo:", message);
  if (/duplicate key|matches_unique_fixture|unique constraint/i.test(message)) {
    return "Já existe um jogo ativo idêntico no calendário.";
  }
  if (/permission|row-level security/i.test(message)) {
    return "Sem permissão para gravar este jogo.";
  }
  return "Não foi possível salvar este jogo.";
}

export type { NormalizedMatch, ImportedMatch, SourceType, ImportIssue } from "./importers/types";
export { ImportError } from "./importers/types";

const importers: Record<string, Importer> = {
  excel: excelImporter,
  csv: csvImporter,
  url: urlImporter,
  lnf: lnfImporter,
  fpf: fpfImporter,
  pdf: pdfImporter,
};

export function getImporter(type: SourceType | string): Importer {
  const importer = importers[type];
  if (!importer) throw new Error(`Fonte "${type}" não suportada.`);
  return importer;
}

/** Rótulo de origem gravado em cada jogo (`import_type`). */
export function importTypeLabel(type: string, url?: string | null) {
  if (type === "lnf") return "LNF";
  if (type === "fpf") return "FPF";
  if (type === "url" && url && /(^|\.)cbf\.com\.br/i.test(url)) return "CBF";
  if (type === "url" && url && /(^|\.)fcf\.com\.br/i.test(url)) return "FCF";
  return (
    { url: "URL", excel: "Excel", csv: "CSV", pdf: "PDF", manual: "Manual" }[type] ??
    type.toUpperCase()
  );
}

export type PersistResult = {
  /** Partidas entregues pela origem. */
  found: number;
  imported: number;
  updated: number;
  /** Sem alteração em relação ao que já estava no banco. */
  skipped: number;
  errors: ImportIssue[];
  competitionsCreated: number;
  teamsCreated: number;
  batch: string;
  /** UUID da operação de importação (permite desfazer só este lote). */
  importBatchId: string;
  /** Lote registrado em `operation_batches`, quando criado. */
  operationBatchId: string | null;
};

const COLORS = ["green", "blue", "orange", "yellow", "gray"] as const;

async function ensureCompetitions(
  names: string[],
  season: string,
  context: { sportKey: string; category?: string | null; gender?: string | null },
) {
  const unique = [...new Set(names.filter(Boolean))];
  const { data: existing } = await supabase
    .from("competitions")
    .select("id, name")
    .is("deleted_at", null);

  const map = new Map((existing ?? []).map((c) => [c.name.toLowerCase(), c.id]));

  const toCreate = unique
    .filter((name) => !map.has(name.toLowerCase()))
    .map((name, index) => ({
      name,
      season,
      color: COLORS[(map.size + index) % COLORS.length],
      sport_key: context.sportKey,
      category: context.category || "Futebol",
      gender: context.gender ?? null,
    }));

  let created = 0;
  if (toCreate.length > 0) {
    const { data: inserted, error } = await supabase
      .from("competitions")
      .insert(toCreate)
      .select("id, name");

    if (!error && inserted) {
      for (const comp of inserted) {
        map.set(comp.name.toLowerCase(), comp.id);
        created += 1;
      }
    } else {
      // Fallback seguro individual
      for (const item of toCreate) {
        const { data, error: singleError } = await supabase
          .from("competitions")
          .insert(item)
          .select("id, name")
          .single();
        if (!singleError && data) {
          map.set(data.name.toLowerCase(), data.id);
          created += 1;
        }
      }
    }
  }

  return { map, created };
}

type MatchKeyParts = {
  competition_id: string | null;
  date: string;
  home_team: string;
  away_team: string;
};

const matchKey = (m: MatchKeyParts) =>
  [m.competition_id, m.date, m.home_team.toLowerCase(), m.away_team.toLowerCase()].join("|");

const label = (m: NormalizedMatch) => `${m.homeTeam} × ${m.awayTeam} — ${m.date} ${m.time}`.trim();

/**
 * ImportService — recebe partidas normalizadas de qualquer origem (Excel, CSV,
 * PDF, URL, CBF…) e grava em `matches`, criando campeonatos e clubes
 * inexistentes. Jogos já existentes são atualizados; nunca duplicados.
 *
 * Nenhum valor é inventado ou convertido: data, hora, estádio e estado são
 * gravados exatamente como a origem os publicou.
 */
export async function persistMatches(
  matches: NormalizedMatch[],
  options: {
    sourceTag: string;
    season?: string;
    sourceId?: string | null;
    importType?: string;
    /** Problemas detectados na leitura da origem, repassados ao relatório. */
    issues?: ImportIssue[];
    /** Total encontrado na origem, incluindo os que falharam na leitura. */
    found?: number;
    /** Nome do arquivo de origem (PDF, planilha…). */
    sourceFile?: string | null;
    /** Tipo de operação registrado em `operation_batches`. */
    operationType?: string;
    /** Descrição legível do lote (competição, arquivo…). */
    operationDescription?: string | null;
    /** Reconhece partidas já existentes pelo identificador oficial da origem. */
    matchByExternalId?: boolean;
    /** Modalidade do lote (identidade dos clubes criados). */
    sportKey?: string;
    /** Categoria padrão quando a origem não informa por partida. */
    category?: string | null;
    /** Gênero da competição, quando aplicável. */
    gender?: string | null;
    /** Callback de progresso em tempo real por etapa. */
    onProgress?: OnImportProgress;
  },
): Promise<PersistResult> {
  const season = options.season || String(new Date().getFullYear());
  const batch = `${options.sourceTag.toLowerCase()}-${Date.now()}`;
  const importBatchId = crypto.randomUUID();
  const importedAt = new Date().toISOString();
  const importType = options.importType ?? options.sourceTag;
  const errors: ImportIssue[] = [...(options.issues ?? [])];

  // Contexto esportivo do lote: qualifica competições e clubes criados.
  const sportKey = options.sportKey || DEFAULT_SPORT_KEY;
  const gender = options.gender ?? null;
  const teamContext = (m: NormalizedMatch) => ({
    sportKey,
    category: m.category || options.category || null,
    gender,
  });

  options.onProgress?.({
    step: "entities",
    message: "Validando competições e clubes participantes...",
  });

  const { map: competitionMap, created: competitionsCreated } = await ensureCompetitions(
    matches.map((m) => m.competition),
    season,
    { sportKey, category: options.category ?? matches[0]?.category ?? null, gender },
  );

  const { byIdentity, created: teamsCreated } = await ensureTeams(
    matches.flatMap((m) => [
      { name: m.homeTeam, state: m.state ?? null, logoUrl: m.homeLogo ?? null, ...teamContext(m) },
      { name: m.awayTeam, state: null, logoUrl: m.awayLogo ?? null, ...teamContext(m) },
    ]),
  );

  // Guarda os escudos publicados pela origem no armazenamento do projeto (concorrência limitada).
  options.onProgress?.({
    step: "logos",
    message: "Verificando escudos dos clubes...",
  });

  await cacheTeamLogos([...byIdentity.values()], {
    concurrency: 4,
    onProgress: (cur, tot) => {
      options.onProgress?.({
        step: "logos",
        message: `Otimizando escudos dos clubes (${cur}/${tot})...`,
        current: cur,
        total: tot,
      });
    },
  });

  const { data: existingMatches } = await supabase
    .from("matches")
    .select(
      "id, competition_id, date, time, home_team, away_team, city, venue, state, external_id, home_score, away_score, phase, round, broadcast, match_status",
    )
    .is("deleted_at", null);

  const existingByKey = new Map((existingMatches ?? []).map((m) => [matchKey(m), m]));
  /** Índice por identificador oficial: a mesma partida mesmo se data/hora mudarem. */
  const existingByExternalId = new Map(
    (existingMatches ?? []).filter((m) => !!m.external_id).map((m) => [m.external_id as string, m]),
  );

  /** Valores anteriores das partidas alteradas — permitem desfazer o reprocessamento. */
  const snapshots: { id: string; patch: Record<string, unknown> }[] = [];
  const inserts: Record<string, unknown>[] = [];

  const updates: { id: string; label: string; patch: Record<string, unknown> }[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  for (const match of matches) {
    const competitionId = competitionMap.get(match.competition.toLowerCase()) ?? null;
    const row = {
      competition_id: competitionId,
      date: match.date,
      time: match.time,
      home_team: match.homeTeam,
      away_team: match.awayTeam,
      home_team_id: byIdentity.get(teamIdentityKey(match.homeTeam, teamContext(match)))?.id ?? null,
      away_team_id: byIdentity.get(teamIdentityKey(match.awayTeam, teamContext(match)))?.id ?? null,

      city: match.city || null,
      venue: match.venue || null,
      state: match.state || null,
      round: match.round || null,
      category: match.category || null,
      group_name: match.group || null,
      phase: match.phase || null,
      match_number: match.matchNumber || null,
      home_score: match.homeScore ?? null,
      away_score: match.awayScore ?? null,
      broadcast: match.broadcast || null,
      match_status: match.matchStatus || null,
      ...(match.notes ? { notes: match.notes } : {}),
      participants_tbd: match.participantsTbd ?? false,
      source_file: match.sourceFile || options.sourceFile || null,

      source: options.sourceTag,
      source_id: options.sourceId ?? null,
      import_type: importType,
      imported_at: importedAt,
      external_id:
        match.externalId ??
        [match.competition, match.date, match.homeTeam, match.awayTeam].join("|").toLowerCase(),
      import_batch: batch,
      import_batch_id: importBatchId,
    };

    const key = matchKey(row);
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);

    // Origens com identificador oficial (ex.: LNF) reconhecem a mesma partida
    // mesmo quando a data ou o horário mudam.
    const byExternalId =
      options.matchByExternalId && match.externalId
        ? existingByExternalId.get(row.external_id)
        : undefined;
    const existing = byExternalId ?? existingByKey.get(key);
    if (existing) {
      const officialChanged =
        !!byExternalId &&
        (existing.date !== row.date ||
          (existing.home_score ?? null) !== (row.home_score ?? null) ||
          (existing.away_score ?? null) !== (row.away_score ?? null) ||
          (!!row.phase && (existing.phase ?? "") !== row.phase) ||
          (!!row.round && (existing.round ?? "") !== row.round) ||
          (!!row.broadcast && (existing.broadcast ?? "") !== row.broadcast) ||
          (!!row.match_status && (existing.match_status ?? "") !== row.match_status));
      const changed =
        officialChanged ||
        existing.time?.slice(0, 5) !== match.time ||
        (!!match.city && (existing.city ?? "") !== match.city) ||
        (!!match.venue && (existing.venue ?? "") !== match.venue) ||
        (!!match.state && (existing.state ?? "") !== match.state);
      if (changed) {
        snapshots.push({
          id: existing.id,
          patch: {
            time: existing.time,
            city: existing.city,
            venue: existing.venue,
            state: existing.state,
            ...(byExternalId
              ? {
                  date: existing.date,
                  home_score: existing.home_score,
                  away_score: existing.away_score,
                  phase: existing.phase,
                  round: existing.round,
                  broadcast: existing.broadcast,
                  match_status: existing.match_status,
                }
              : {}),
          },
        });
        updates.push({
          id: existing.id,
          label: label(match),
          patch: {
            time: row.time,
            // Só sobrescreve quando a origem realmente trouxer o valor.
            ...(row.city ? { city: row.city } : {}),
            ...(row.venue ? { venue: row.venue } : {}),
            ...(row.state ? { state: row.state } : {}),
            ...(row.round ? { round: row.round } : {}),
            ...(byExternalId
              ? {
                  date: row.date,
                  home_score: row.home_score,
                  away_score: row.away_score,
                  ...(row.phase ? { phase: row.phase } : {}),
                  ...(row.broadcast ? { broadcast: row.broadcast } : {}),
                  ...(row.match_status ? { match_status: row.match_status } : {}),
                }
              : {}),
            home_team_id: row.home_team_id,
            away_team_id: row.away_team_id,
            source: row.source,
            source_id: row.source_id,
            import_type: importType,
            imported_at: importedAt,
            import_batch: batch,
            import_batch_id: importBatchId,
          },
        });
      } else {
        skipped += 1;
      }
      continue;
    }

    inserts.push(row);
  }

  options.onProgress?.({
    step: "persist",
    message: `Gravando partidas (${inserts.length} novas, ${updates.length} atualizadas)...`,
  });

  let imported = 0;
  if (inserts.length > 0) {
    const insertBatches = chunk(inserts, 100);
    for (const batchRows of insertBatches) {
      const { error } = await supabase.from("matches").insert(batchRows as never);
      if (!error) {
        imported += batchRows.length;
      } else {
        // Grava um a um para identificar exatamente qual jogo falhou.
        for (const row of batchRows) {
          const { error: rowError } = await supabase.from("matches").insert(row as never);
          if (rowError) {
            errors.push({
              match: `${row.home_team} × ${row.away_team} — ${row.date} ${row.time}`,
              reason: friendlyPersistError(rowError.message),
            });
          } else {
            imported += 1;
          }
        }
      }
    }
  }

  let updated = 0;
  if (updates.length > 0) {
    await mapConcurrent(updates, 6, async (update) => {
      const { error } = await supabase
        .from("matches")
        .update(update.patch as never)
        .eq("id", update.id);
      if (error) {
        errors.push({ match: update.label, reason: friendlyPersistError(error.message) });
      } else {
        updated += 1;
      }
    });
  }

  // Registra o lote para permitir "Desfazer importação" no Histórico.
  let operationBatchId: string | null = null;
  if (imported > 0 || updated > 0) {
    operationBatchId = await createOperationBatch({
      operation_type: options.operationType ?? `${options.sourceTag.toLowerCase()}_import`,
      description:
        options.operationDescription ??
        `${imported} novos e ${updated} atualizados via ${options.sourceTag}`,
      affected_count: imported + updated,
      source_id: options.sourceId ?? null,
      import_batch_id: importBatchId,
      metadata: { batch, imported, updated, snapshots, source_file: options.sourceFile ?? null },
    });
  }

  return {
    found: options.found ?? matches.length + (options.issues?.length ?? 0),
    imported,
    updated,
    skipped,
    errors,
    competitionsCreated,
    teamsCreated,
    batch,
    importBatchId,
    operationBatchId,
  };
}

/** Resumo legível de uma sincronização. */
export function summarize(result: PersistResult) {
  return [
    `${result.found} encontrados`,
    `${result.imported} importados`,
    `${result.updated} atualizados`,
    `${result.skipped} ignorados`,
    `${result.errors.length} com erro`,
  ].join(" · ");
}

/** Registra o histórico de uma sincronização e atualiza a fonte. */
export async function recordImport(params: {
  dataSourceId: string | null;
  sourceType: string;
  status: "success" | "error";
  result?: PersistResult;
  message?: string;
  fileName?: string | null;
  fileHash?: string | null;
}) {
  const { dataSourceId, sourceType, status, result, message, fileName, fileHash } = params;

  await supabase.from("import_history").insert({
    data_source_id: dataSourceId,
    source_type: sourceType,
    status,
    imported: result?.imported ?? 0,
    updated: result?.updated ?? 0,
    skipped: result?.skipped ?? 0,
    found: result?.found ?? 0,
    file_name: fileName ?? null,
    file_hash: fileHash ?? null,
    message: message ?? (result ? summarize(result) : null),
    batch: result?.batch ?? null,
  });

  if (!dataSourceId) return;

  if (status === "error") {
    await supabase
      .from("data_sources")
      .update({ last_error: message ?? "Falha na sincronização." })
      .eq("id", dataSourceId);
    return;
  }

  const { count } = await supabase
    .from("matches")
    .select("id", { count: "exact", head: true })
    .eq("source_id", dataSourceId)
    .is("deleted_at", null);

  await supabase
    .from("data_sources")
    .update({
      last_sync: new Date().toISOString(),
      last_update: new Date().toISOString(),
      games_count: count ?? result?.imported ?? 0,
      last_error:
        result && result.errors.length > 0 ? "Alguns jogos não puderam ser importados." : null,
    })
    .eq("id", dataSourceId);
}

/** Leitura de uma origem, com detalhamento de encontrados e falhas. */
export async function collectMatches(params: {
  type: string;
  file?: File;
  url?: string | null;
  competition?: string;
  season?: string;
  onProgress?: OnImportProgress;
}) {
  const importer = getImporter(params.type);
  const input = {
    file: params.file,
    url: params.url ?? undefined,
    competition: params.competition,
    season: params.season,
    onProgress: params.onProgress,
  };
  if (importer.collect) return importer.collect(input);
  const matches = await importer.parse(input);
  return { matches, errors: [] as ImportIssue[], found: matches.length };
}

/** Fluxo completo: importador → partidas → banco → histórico. */
export async function runImport(params: {
  dataSourceId: string | null;
  type: string;
  file?: File;
  url?: string | null;
  competition?: string;
  season?: string;
  onProgress?: OnImportProgress;
}): Promise<PersistResult> {
  const importer = getImporter(params.type);
  try {
    params.onProgress?.({
      step: "fetch",
      message:
        params.type === "url" && params.url?.includes("cbf")
          ? "Conectando à CBF e baixando tabela..."
          : "Lendo dados da origem...",
    });
    const collected = await collectMatches(params);
    params.onProgress?.({
      step: "parse",
      message: `Identificados ${collected.matches.length} confrontos para processar...`,
    });
    const result = await persistMatches(collected.matches, {
      sourceTag: importer.sourceTag,
      season: params.season,
      sourceId: params.dataSourceId,
      importType: importTypeLabel(params.type, params.url),
      issues: collected.errors,
      found: collected.found,
      matchByExternalId: params.type === "lnf" || params.type === "fpf",
      onProgress: params.onProgress,
    });
    await recordImport({
      dataSourceId: params.dataSourceId,
      sourceType: params.type,
      status: "success",
      result,
    });
    params.onProgress?.({
      step: "done",
      message: "Importação concluída com sucesso!",
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha na importação.";
    await recordImport({
      dataSourceId: params.dataSourceId,
      sourceType: params.type,
      status: "error",
      message,
    });
    throw error;
  }
}
