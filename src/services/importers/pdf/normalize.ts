import type { ImportIssue, NormalizedMatch } from "../types";
import type { PdfDraftMatch } from "./types";

/**
 * Rascunho revisado pelo usuário → contrato único de importação.
 * Partidas sem data não podem ser gravadas (a coluna é obrigatória);
 * elas voltam como alerta para o usuário informar a data no preview.
 */
export function draftToMatch(draft: PdfDraftMatch): NormalizedMatch | null {
  if (!draft.date) return null;
  return {
    competition: draft.competition,
    date: draft.date,
    time: draft.time || "00:00",
    homeTeam: draft.homeTeam,
    awayTeam: draft.awayTeam,
    city: draft.city ?? "",
    venue: draft.venue ?? "",
    state: draft.state ?? undefined,
    round: draft.roundLabel ?? undefined,
    matchNumber: draft.matchNumber ?? undefined,
    category: draft.category ?? undefined,
    group: draft.group ?? undefined,
    phase: draft.phase ?? undefined,
    homeScore: draft.homeScore,
    awayScore: draft.awayScore,
    broadcast: draft.broadcast ?? undefined,
    participantsTbd: draft.participantsTbd,
    externalId: draft.matchNumber
      ? [draft.competition, draft.matchNumber, draft.date].join("|").toLowerCase()
      : undefined,
  };
}

export function draftsToMatches(drafts: PdfDraftMatch[]) {
  const matches: NormalizedMatch[] = [];
  const errors: ImportIssue[] = [];
  for (const draft of drafts) {
    const match = draftToMatch(draft);
    if (match) matches.push(match);
    else
      errors.push({
        match: `${draft.homeTeam} × ${draft.awayTeam}`.trim(),
        reason: "Data a definir — informe a data antes de importar.",
      });
  }
  return { matches, errors };
}
