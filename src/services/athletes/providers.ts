/**
 * Provider de elenco — CBF.
 *
 * A única fonte automática de importação de atletas é a página pública de
 * clube da CBF (`cbf.com.br/futebol-brasileiro/times/...`). Este módulo fica
 * focado em parsing/normalização; aquisição externa server-side fica em
 * `cbf-roster-fetch.server.ts`.
 */
import { sanitizeExternalContent } from "@/lib/external-content";

import {
  DEFAULT_ATHLETE_SPORT,
  providerLabel,
  type AthleteProviderId,
  type NormalizedAthlete,
  type RosterErrorCode,
  type RosterResult,
} from "./types";

const text = (value: string | null | undefined) =>
  sanitizeExternalContent((value ?? "").replace(/<!--[\s\S]*?-->/g, " "));

export function isCbfChallenge(html: string) {
  return /captcha|cf-chl-|cloudflare challenge|access denied|verify (?:that )?you are human|enable javascript and cookies/i.test(
    html,
  );
}

export function isCbfTeamPage(html: string) {
  return (
    /<h1[^>]*>[\s\S]*?\s-\s[A-Z]{2}[\s\S]*?<\/h1>/i.test(html) &&
    />\s*Atletas\s*</i.test(html) &&
    />\s*Nome\s*</i.test(html) &&
    />\s*Apelido\s*</i.test(html) &&
    />\s*Clube Atual\s*</i.test(html) &&
    /<tbody\b/i.test(html)
  );
}

/** O HTML atual da CBF traz os IDs dos atletas no payload serializado da página. */
function enrichCbfAthleteLinks(html: string) {
  const idsByName = new Map<string, string>();
  const athleteDataRe =
    /\\?"atleta_id\\?":\\?"(\d+)\\?"[\s\S]{0,120}?\\?"atleta_nome\\?":\\?"([^"\\]+)\\?"/g;
  let dataMatch: RegExpExecArray | null;
  while ((dataMatch = athleteDataRe.exec(html))) {
    idsByName.set(text(dataMatch[2]).toLocaleLowerCase("pt-BR"), dataMatch[1]);
  }
  if (idsByName.size === 0) return html;

  return html.replace(/<tr([^>]*)>([\s\S]*?)<\/tr>/gi, (row, attrs: string, body: string) => {
    if (/\/futebol-brasileiro\/atletas\//i.test(body)) return row;
    const firstCell = /<td[^>]*>([\s\S]*?)<\/td>/i.exec(body)?.[1] ?? "";
    const fullName = text(firstCell.replace(/<[^>]+>/g, " ")).toLocaleLowerCase("pt-BR");
    const athleteId = idsByName.get(fullName);
    if (!athleteId) return row;
    return `<tr${attrs}>${body}<td hidden><a href="/futebol-brasileiro/atletas/${athleteId}">${athleteId}</a></td></tr>`;
  });
}

/* ------------------------------------------------------------------ CBF */

/**
 * Página oficial de time da CBF: tabela `Nome | Apelido | Clube Atual`.
 * O clube atual pode divergir do clube da página — a comparação é feita
 * depois, no preview.
 */
export function parseCbfHtml(rawHtml: string, url: string): RosterResult {
  const html = enrichCbfAthleteLinks(rawHtml);
  const h1 = /<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html);
  const heading = text(h1?.[1] ?? "");
  const stateMatch = /\s-\s([A-Z]{2})$/.exec(heading);
  const teamName = stateMatch ? heading.replace(/\s-\s[A-Z]{2}$/, "").trim() : heading || null;

  const athletes: NormalizedAthlete[] = [];
  const rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let row: RegExpExecArray | null;
  while ((row = rowRe.exec(html))) {
    const externalId =
      /href=["'][^"']*\/atletas\/(?:[^/"']+\/)*(\d+)\/?(?:[?#][^"']*)?["']/i.exec(row[1])?.[1] ??
      null;
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((c) =>
      text(c[1].replace(/<[^>]+>/g, " ")),
    );
    if (cells.length < 3) continue;
    const [fullName, nickname, currentTeam] = cells;
    if (!fullName || fullName.length < 3) continue;
    if (/hist[óo]rico|estat[íi]stica/i.test(fullName)) continue;
    athletes.push({
      provider: "cbf",
      sourceUrl: url,
      externalId,
      name: fullName,
      fullName,
      nickname: nickname || null,
      teamName,
      currentTeamName: currentTeam || null,
      sport: DEFAULT_ATHLETE_SPORT,
    });
  }

  return {
    ok: athletes.length > 0,
    message: athletes.length
      ? `${athletes.length} atletas encontrados na página da CBF.`
      : "Não foi possível ler a lista de atletas desta página da CBF.",
    errorCode: athletes.length ? null : "CBF_PARSE_FAILED",
    acquisitionMode: "direct",
    provider: "cbf",
    providerLabel: providerLabel("cbf"),
    teamName,
    teamState: stateMatch?.[1] ?? null,
    athletes,
  };
}

/* ------------------------------------------------- colagem manual da CBF */

const HEADER_RE = /^\s*nome\b/i;

function splitRosterLine(line: string): string[] {
  const cell = (value: string) => text(value).trim();
  if (line.includes("\t")) return line.split("\t").map(cell);
  if (line.includes("|")) {
    return line
      .replace(/^\||\|$/g, "")
      .split("|")
      .map(cell);
  }
  if (/\s{2,}/.test(line)) return line.split(/\s{2,}/).map(cell);
  return [cell(line)];
}

const looksLikeName = (value: string) =>
  value.length >= 3 && value.length <= 80 && /[a-zà-ú]/i.test(value);

function cleanMarkdownText(value: string) {
  return text(
    value
      .replace(/^\s{0,3}#{1,6}\s+/, "")
      .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
      .replace(/[*_`]/g, " "),
  );
}

function hasCbfRosterHeader(line: string) {
  const cleaned = cleanMarkdownText(line).toLocaleLowerCase("pt-BR");
  return /\bnome\b/.test(cleaned) && /\bapelido\b/.test(cleaned) && /clube atual/.test(cleaned);
}

function isMarkdownHeading(line: string) {
  return /^\s{0,3}#{1,6}\s+\S/.test(line);
}

function isMarkdownTableSeparator(line: string) {
  return /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
}

function findTeamFromReaderHeading(lines: string[], headerIndex: number) {
  for (let index = headerIndex - 1; index >= Math.max(0, headerIndex - 30); index -= 1) {
    const heading = cleanMarkdownText(lines[index]);
    const match = /^(.{2,80}?)\s+-\s*([A-Z]{2})$/.exec(heading);
    if (!match) continue;
    if (/^(home|menu|atletas|nome|apelido|clube atual)$/i.test(match[1])) continue;
    return { teamName: match[1].trim(), teamState: match[2] };
  }
  return { teamName: null, teamState: null };
}

export type ExtractedCbfRosterTable = {
  tableText: string;
  teamName: string | null;
  teamState: string | null;
};

/** Extrai apenas a tabela `Nome | Apelido | Clube Atual` do texto/Markdown do Reader. */
export function extractCbfRosterTableText(raw: string): ExtractedCbfRosterTable | null {
  const lines = raw.split(/\r?\n/).map((line) => line.trim());
  const headerIndex = lines.findIndex((line, index) => {
    if (hasCbfRosterHeader(line)) return true;
    const trio = [line, lines[index + 1] ?? "", lines[index + 2] ?? ""].map(cleanMarkdownText);
    return HEADER_RE.test(trio[0]) && /apelido/i.test(trio[1]) && /clube atual/i.test(trio[2]);
  });
  if (headerIndex < 0) return null;

  const team = findTeamFromReaderHeading(lines, headerIndex);
  const headerLine = lines[headerIndex];
  const tableLines: string[] = [];
  let rosterRows = 0;

  if (hasCbfRosterHeader(headerLine)) {
    tableLines.push(headerLine);
    for (let index = headerIndex + 1; index < lines.length; index += 1) {
      const line = lines[index];
      if (!line) {
        if (rosterRows > 0) break;
        continue;
      }
      if (isMarkdownHeading(line) && rosterRows > 0) break;
      if (isMarkdownTableSeparator(line)) {
        tableLines.push(line);
        continue;
      }
      const cells = splitRosterLine(line).filter((cell) => cell.length > 0);
      if (cells.length >= 3) {
        tableLines.push(line);
        rosterRows += 1;
        continue;
      }
      if (rosterRows > 0) break;
    }
  } else {
    tableLines.push(lines[headerIndex], lines[headerIndex + 1] ?? "", lines[headerIndex + 2] ?? "");
    for (let index = headerIndex + 3; index < lines.length;) {
      const trio = [lines[index] ?? "", lines[index + 1] ?? "", lines[index + 2] ?? ""].map(
        cleanMarkdownText,
      );
      if (trio.some((line) => !line)) {
        if (rosterRows > 0) break;
        index += 1;
        continue;
      }
      if (trio.some(isMarkdownHeading)) break;
      if (trio.every((value) => looksLikeName(value))) {
        tableLines.push(...trio);
        rosterRows += 1;
        index += 3;
        continue;
      }
      if (rosterRows > 0) break;
      index += 1;
    }
  }

  if (rosterRows === 0) return null;
  return { tableText: tableLines.join("\n"), ...team };
}

/**
 * Interpreta a tabela de atletas copiada da página da CBF.
 * Aceita TSV, colunas separadas por `|`, espaços múltiplos ou linhas
 * sucessivas (Nome, Apelido, Clube Atual).
 */
export function parseCbfRosterText(
  raw: string,
  options: {
    url: string;
    teamName: string | null;
    teamState?: string | null;
    acquisitionMode?: "reader" | "paste";
  },
): RosterResult {
  // Separadores (tab, pipe) são preservados; a limpeza acontece por célula.
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !/^[-|\s]+$/.test(line));

  const rows: string[][] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    const cells = splitRosterLine(line).filter((cell) => cell.length > 0);
    if (cells.length >= 3) {
      if (!HEADER_RE.test(cells[0]) || !/apelido/i.test(cells[1] ?? "")) rows.push(cells);
      index += 1;
      continue;
    }
    // Colagem em linhas sucessivas: Nome / Apelido / Clube Atual.
    if (HEADER_RE.test(line) && /apelido/i.test(lines[index + 1] ?? "")) {
      index += 3;
      continue;
    }
    const trio = [line, lines[index + 1], lines[index + 2]].map((value) =>
      typeof value === "string" ? text(value).trim() : "",
    );
    if (trio.every((value) => looksLikeName(value))) {
      rows.push(trio);
      index += 3;
      continue;
    }
    index += 1;
  }

  const athletes: NormalizedAthlete[] = [];
  for (const [fullName, nickname, currentTeam] of rows) {
    if (!looksLikeName(fullName)) continue;
    athletes.push({
      provider: "cbf",
      sourceUrl: options.url,
      externalId: null,
      name: fullName,
      fullName,
      nickname: nickname || null,
      teamName: options.teamName,
      currentTeamName: currentTeam || null,
      sport: DEFAULT_ATHLETE_SPORT,
    });
  }

  if (athletes.length === 0) {
    return failure(
      "cbf",
      "CBF_PARSE_FAILED",
      "Não foi possível reconhecer a lista da CBF. Copie a tabela completa com Nome, Apelido e Clube Atual.",
      options.acquisitionMode ?? "paste",
    );
  }

  return {
    ok: true,
    message: `${athletes.length} atletas reconhecidos na lista colada da CBF.`,
    errorCode: null,
    acquisitionMode: options.acquisitionMode ?? "paste",
    provider: "cbf",
    providerLabel: providerLabel("cbf"),
    teamName: options.teamName,
    teamState: options.teamState ?? null,
    athletes,
  };
}

function failure(
  provider: AthleteProviderId | null,
  errorCode: RosterErrorCode,
  message: string,
  acquisitionMode?: RosterResult["acquisitionMode"],
): RosterResult {
  return {
    ok: false,
    message,
    errorCode,
    acquisitionMode: acquisitionMode ?? null,
    provider,
    providerLabel: providerLabel(provider),
    teamName: null,
    teamState: null,
    athletes: [],
  };
}
