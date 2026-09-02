import { APP_URL } from "@/lib/app-url";

import type { ImportIssue, NormalizedMatch } from "./types";

/**
 * Leitor da LNF (lnfoficial.com.br).
 *
 * Uma única requisição para a tabela pública da competição escolhida. A página
 * publica cada partida em uma linha da tabela, com classes estáveis:
 *
 *   <tr class="matches_table_stage">FASE CLASSIFICATÓRIA</tr>
 *   <tr class="matches_table_round">1ª RODADA</tr>
 *   <tr>
 *     <td class="match-date" data-real-id="2959"><span class="match-date">27/03/2026</span></td>
 *     <td class="match-hour">19:30</td>
 *     <td class="match-team home"><span class="team-shortname">Jaraguá</span><img src="…"></td>
 *     <td class="match-score"><a href="relatório"><span class="home">2</span>X<span class="away">2</span></a></td>
 *     <td class="match-team away"><img src="…"><span class="team-shortname">Campo Mourão</span></td>
 *     <td class="match-gym">…</td><td class="match-city">…</td><td class="match-state">SC</td>
 *     <td class="match-transmission"><img title="LNFTV"></td>
 *   </tr>
 *
 * Os valores são copiados exatamente como publicados. A única transformação é
 * reordenar `dd/mm/aaaa` para `aaaa-mm-dd` (exigência da coluna de data).
 * Nenhum horário é convertido por fuso.
 */

const UA = `Mozilla/5.0 (compatible; FotoPressBot/1.0; +${APP_URL})`;

export const LNF_HOST = "lnfoficial.com.br";

/** Competições oficiais suportadas pelo importador LNF. */
export const LNF_COMPETITIONS = [
  { id: "lnf", label: "LNF", url: "https://lnfoficial.com.br/tabela-de-jogos/" },
  {
    id: "silver",
    label: "LNF Silver",
    url: "https://lnfoficial.com.br/lnf-silver/tabela-de-jogos/",
  },
  { id: "copa", label: "Copa LNF", url: "https://lnfoficial.com.br/copa-lnf/tabela-de-jogos/" },
  {
    id: "talentos",
    label: "Talentos LNF",
    url: "https://lnfoficial.com.br/talentos-lnf/tabela-de-jogos/",
  },
] as const;

export type LnfResult = {
  ok: boolean;
  message: string;
  matches: NormalizedMatch[];
  errors: ImportIssue[];
  /** Total de linhas de partida encontradas na página. */
  found: number;
};

/** Aceita apenas as tabelas de jogos oficiais da LNF (HTTPS). */
export function validateLnfUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (host !== LNF_HOST) return false;
    return /^\/(lnf-silver\/|copa-lnf\/|talentos-lnf\/)?tabela-de-jogos\/?$/.test(parsed.pathname);
  } catch {
    return false;
  }
}

export function isLnfUrl(url: string) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "") === LNF_HOST;
  } catch {
    return false;
  }
}

/** Competição oficial correspondente à URL. */
export function detectLnfCompetition(url: string) {
  try {
    const path = new URL(url).pathname;
    if (path.startsWith("/lnf-silver/")) return LNF_COMPETITIONS[1];
    if (path.startsWith("/copa-lnf/")) return LNF_COMPETITIONS[2];
    if (path.startsWith("/talentos-lnf/")) return LNF_COMPETITIONS[3];
    return LNF_COMPETITIONS[0];
  } catch {
    return LNF_COMPETITIONS[0];
  }
}

const decode = (value: string) =>
  value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");

const clean = (value: string | undefined | null) =>
  decode(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

const stripTags = (value: string) => clean(value.replace(/<[^>]+>/g, " "));

/** Conteúdo do primeiro `<td>` cuja classe casa com o padrão. */
function cell(row: string, pattern: RegExp) {
  const cells = [...row.matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/gi)];
  for (const [, attrs, content] of cells) {
    const cls = attrs.match(/class="([^"]*)"/i)?.[1] ?? "";
    if (pattern.test(cls)) return content;
  }
  return "";
}

/** `dd/mm/aaaa` → `aaaa-mm-dd`. Sem `new Date` (evita fuso/ambiguidade). */
export function parseLnfDate(text: string) {
  const m = clean(text).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return "";
  const [, d, mo, y] = m;
  if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31) return "";
  return `${y}-${mo}-${d}`;
}

/** `19:30` ou `19h30` → `19:30`. "À definir" → vazio. */
export function parseLnfTime(text: string) {
  const m = clean(text).match(/(\d{1,2})\s*[:h]\s*(\d{2})/);
  if (!m) return "";
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** URL absoluta do escudo do clube dentro do bloco da própria partida. */
export function extractLnfTeamLogo(cellHtml: string, sourceUrl: string) {
  const tag = cellHtml.match(/<img[^>]*>/i)?.[0];
  if (!tag) return null;
  const raw =
    tag.match(/\sdata-src="([^"]+)"/i)?.[1] ??
    tag.match(/\ssrc="([^"]+)"/i)?.[1] ??
    tag.match(/\ssrcset="([^",\s]+)/i)?.[1] ??
    "";
  const value = clean(raw);
  if (!value || value.startsWith("data:")) return null;
  try {
    const absolute = new URL(decode(value), sourceUrl);
    if (absolute.protocol !== "https:" && absolute.protocol !== "http:") return null;
    return absolute.toString();
  } catch {
    return null;
  }
}

export type LnfGame = {
  externalId: string;
  date: string;
  time: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string | null;
  awayLogo: string | null;
  homeScore: number | null;
  awayScore: number | null;
  venue: string;
  city: string;
  state: string;
  phase: string;
  round: string;
  broadcast: string;
  reportUrl: string;
};

/** Lê a linha de uma partida da tabela. */
export function parseLnfMatch(
  row: string,
  context: { phase: string; round: string; sourceUrl: string },
): LnfGame {
  const dateCell = cell(row, /match-date/);
  const homeCell = cell(row, /match-team\s+home/);
  const awayCell = cell(row, /match-team\s+away/);
  const scoreCell = cell(row, /match-score/);
  const transmissionCell = cell(row, /match-transmission/);

  const scores = [...scoreCell.matchAll(/<span class="(home|away)\s*"[^>]*>([\s\S]*?)<\/span>/gi)];
  const score = (side: "home" | "away") => {
    const found = scores.find((s) => s[1].toLowerCase() === side);
    const text = clean(found?.[2] ?? "");
    return /^\d+$/.test(text) ? Number(text) : null;
  };

  const channels = [...transmissionCell.matchAll(/<img[^>]*>/gi)]
    .map((m) =>
      clean(m[0].match(/\stitle="([^"]*)"/i)?.[1] ?? m[0].match(/\salt="([^"]*)"/i)?.[1] ?? ""),
    )
    .filter(Boolean);

  const reportHref = clean(scoreCell.match(/<a[^>]+href="([^"]+)"/i)?.[1] ?? "");

  return {
    externalId: clean(row.match(/data-real-id="([^"]+)"/i)?.[1] ?? ""),
    date: parseLnfDate(dateCell),
    time: parseLnfTime(cell(row, /match-hour/)),
    homeTeam: stripTags(
      homeCell.match(/<span class="team-shortname"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "",
    ),
    awayTeam: stripTags(
      awayCell.match(/<span class="team-shortname"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? "",
    ),
    homeLogo: extractLnfTeamLogo(homeCell, context.sourceUrl),
    awayLogo: extractLnfTeamLogo(awayCell, context.sourceUrl),
    homeScore: score("home"),
    awayScore: score("away"),
    venue: stripTags(cell(row, /match-gym/)),
    city: stripTags(cell(row, /match-city/)),
    state: stripTags(cell(row, /match-state/)).toUpperCase(),
    phase: context.phase,
    round: context.round,
    broadcast: [...new Set(channels)].join(", "),
    reportUrl: /^https:\/\//i.test(reportHref) && isLnfUrl(reportHref) ? reportHref : "",
  };
}

/** Percorre a tabela mantendo fase e rodada herdadas dos cabeçalhos. */
export function parseLnfPage(html: string, sourceUrl: string): LnfGame[] {
  const text = html.replace(/\r?\n/g, " ");
  const rows = [...text.matchAll(/<tr([^>]*)>([\s\S]*?)<\/tr>/gi)];
  const games: LnfGame[] = [];
  let phase = "";
  let round = "";

  for (const [, attrs, body] of rows) {
    const cls = attrs.match(/class="([^"]*)"/i)?.[1] ?? "";
    if (/matches_table_stage/i.test(cls)) {
      phase = stripTags(body);
      continue;
    }
    if (/matches_table_round/i.test(cls)) {
      round = stripTags(body);
      continue;
    }
    if (/more_info/i.test(cls)) continue;
    // A página repete a tabela em versão móvel (só siglas): usamos a completa.
    if (!/<td[^>]*class="match-date"/i.test(body)) continue;
    if (!/team-shortname/i.test(body)) continue;
    games.push(parseLnfMatch(body, { phase, round, sourceUrl }));
  }

  return games;
}

export async function fetchLnfHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "user-agent": UA,
      accept: "text/html,application/xhtml+xml",
      "accept-language": "pt-BR,pt;q=0.9",
    },
  });
  if (!response.ok) throw new Error(`A página da LNF respondeu com status ${response.status}.`);
  return await response.text();
}

const isTbd = (name: string) =>
  !name || /^(a\s*definir|à\s*definir|vencedor|perdedor|classificado)/i.test(name);

/** URL da LNF → partidas normalizadas, sem tocar no banco. */
export async function fetchLnfMatches(
  url: string,
  options: { competition?: string; season?: string } = {},
): Promise<LnfResult> {
  if (!validateLnfUrl(url)) {
    return {
      ok: false,
      message: "Esta URL não é uma tabela de jogos oficial da LNF.",
      matches: [],
      errors: [],
      found: 0,
    };
  }

  const html = await fetchLnfHtml(url);
  const games = parseLnfPage(html, url);

  if (games.length === 0) {
    return {
      ok: false,
      message: "Não foi possível reconhecer a estrutura atual da página LNF.",
      matches: [],
      errors: [],
      found: 0,
    };
  }

  const detected = detectLnfCompetition(url);
  const competitionName = clean(options.competition) || detected.label;
  const season = clean(options.season);
  const matches: NormalizedMatch[] = [];
  const errors: ImportIssue[] = [];

  for (const game of games) {
    const title =
      game.homeTeam && game.awayTeam
        ? `${game.homeTeam} × ${game.awayTeam}`
        : `Partida ${game.externalId || "sem identificação"}`;

    if (isTbd(game.homeTeam) || isTbd(game.awayTeam)) {
      errors.push({ match: title, reason: "Partida aguardando definição dos participantes." });
      continue;
    }
    if (!game.date) {
      errors.push({ match: title, reason: "Data ainda não confirmada pela LNF." });
      continue;
    }
    if (season && !game.date.startsWith(`${season}-`)) continue;
    if (!game.time) {
      errors.push({ match: title, reason: "Horário ainda não definido pela LNF." });
      continue;
    }

    const played = game.homeScore !== null && game.awayScore !== null;

    matches.push({
      competition: competitionName,
      date: game.date,
      time: game.time,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      city: game.city,
      venue: game.venue,
      state: /^[A-Z]{2}$/.test(game.state) ? game.state : undefined,
      externalId: game.externalId ? `lnf-${detected.id}-${game.externalId}` : undefined,
      round: game.round || undefined,
      phase: game.phase || undefined,
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      broadcast: game.broadcast || undefined,
      matchStatus: played ? "CONCLUIDO" : "AGENDADO",
      notes: game.reportUrl ? `Relatório LNF: ${game.reportUrl}` : undefined,
      season: season || undefined,
      homeLogo: game.homeLogo,
      awayLogo: game.awayLogo,
    });
  }

  return {
    ok: matches.length > 0,
    message:
      matches.length > 0
        ? `Fonte válida. ${matches.length} jogos encontrados em ${detected.label}.`
        : "Nenhuma partida da temporada informada foi encontrada nesta tabela da LNF.",
    matches,
    errors,
    found: games.length,
  };
}
