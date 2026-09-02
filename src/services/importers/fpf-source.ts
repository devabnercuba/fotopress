import type { ImportIssue, NormalizedMatch } from "./types";

/**
 * Leitor da FPF (futebolpaulista.com.br).
 *
 * A página oficial `/Competicoes/Tabela.aspx` é dinâmica: ela consome os
 * mesmos handlers públicos usados aqui.
 *
 *   ListarCampeonatosExercicio.ashx?anoExercicio=2026
 *     → competições publicadas na temporada (IdCampeonato + categoria).
 *
 *   ListarTabela.ashx?IdCampeonato=..&Ano=..&Rodada=0&IdClube=0
 *     → `Rodada=0` devolve o CALENDÁRIO COMPLETO da competição (todas as
 *       rodadas e fases já publicadas) em uma única consulta.
 *
 * Somente a tabela de jogos é lida. Súmula, boletim financeiro, arbitragem,
 * retificações e alterações vêm na resposta e são ignorados de propósito.
 */

const FPF_ORIGIN = "https://www.futebolpaulista.com.br";
export const FPF_HOSTS = ["futebolpaulista.com.br", "www.futebolpaulista.com.br"];

const HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  accept: "application/json, text/javascript, */*; q=0.01",
  "x-requested-with": "XMLHttpRequest",
  "accept-language": "pt-BR,pt;q=0.9",
  referer: `${FPF_ORIGIN}/Competicoes/Tabela.aspx`,
  origin: FPF_ORIGIN,
  // A FPF fica atrás de proteção anti-bot: sem estes cabeçalhos a resposta
  // vira um desafio HTML em vez do JSON público.
  "sec-fetch-site": "same-origin",
  "sec-fetch-mode": "cors",
  "sec-fetch-dest": "empty",
};

export type FpfCompetition = {
  /** Identificador interno da competição na FPF. */
  idCampeonato: number;
  season: string;
  /** Rótulo apresentado ao usuário ("Paulista - SUB20 - Série A"). */
  label: string;
  /** URL oficial equivalente, usada como endereço da fonte. */
  url: string;
};

/** Aceita apenas endereços do domínio oficial da FPF. */
export function isFpfUrl(url: string) {
  try {
    return FPF_HOSTS.includes(new URL(url).hostname.toLowerCase());
  } catch {
    return false;
  }
}

/** URL canônica de uma competição FPF (guardada na fonte de dados). */
export function buildFpfUrl(idCampeonato: number, season: string) {
  return `${FPF_ORIGIN}/Competicoes/Tabela.aspx?ano=${encodeURIComponent(
    season,
  )}&idCampeonato=${idCampeonato}`;
}

/** Lê `idCampeonato` e `ano` de uma URL oficial da FPF. */
export function parseFpfUrl(url: string): { idCampeonato: number; season: string } | null {
  try {
    const parsed = new URL(url);
    if (!FPF_HOSTS.includes(parsed.hostname.toLowerCase())) return null;
    const params = new URLSearchParams(parsed.search.toLowerCase());
    const id = Number(params.get("idcampeonato"));
    const season = params.get("ano") ?? "";
    if (!Number.isFinite(id) || id <= 0) return null;
    if (!/^\d{4}$/.test(season)) return null;
    return { idCampeonato: id, season };
  } catch {
    return null;
  }
}

/**
 * A proteção anti-bot da FPF só responde em HTTP/2. Quando o runtime atual
 * negocia HTTP/1.1 (servidor de desenvolvimento em Node) a resposta vem 403,
 * e aí repetimos a mesma consulta por HTTP/2.
 */
async function fpfText(path: string): Promise<string> {
  try {
    const response = await fetch(`${FPF_ORIGIN}${path}`, { headers: HEADERS });
    if (response.ok) return await response.text();
    if (response.status !== 403 && response.status !== 503) {
      throw new Error(`A FPF respondeu com status ${response.status}.`);
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("A FPF respondeu")) throw error;
  }
  const { fpfHttp2Get } = await import("@/lib/fpf-http2.server");
  return await fpfHttp2Get(FPF_ORIGIN, path, { ...HEADERS, ":authority": "" });
}

async function fpfJson<T>(path: string): Promise<T> {
  const raw = await fpfText(path);
  let body: { Sucesso?: boolean; Mensagem?: string; Retorno?: T };
  try {
    body = JSON.parse(raw) as { Sucesso?: boolean; Mensagem?: string; Retorno?: T };
  } catch {
    throw new Error("A FPF não devolveu a tabela de jogos nesta consulta.");
  }
  if (body?.Sucesso === false) {
    throw new Error(body.Mensagem || "A FPF recusou a consulta.");
  }
  return (body?.Retorno ?? null) as T;
}

type RawCompetition = {
  Exercicio: string;
  IdCampeonato: number;
  Categoria: string | null;
  Campeonato: string | null;
};

/** Competições publicadas pela FPF na temporada informada. */
export async function listFpfCompetitions(season: string): Promise<FpfCompetition[]> {
  const rows = await fpfJson<RawCompetition[]>(
    `/Handlers/Competicoes/ListarCampeonatosExercicio.ashx?anoExercicio=${encodeURIComponent(season)}`,
  );
  const seen = new Set<number>();
  const list: FpfCompetition[] = [];
  for (const row of rows ?? []) {
    if (!row?.IdCampeonato || seen.has(row.IdCampeonato)) continue;
    seen.add(row.IdCampeonato);
    const name = (row.Campeonato ?? "").trim();
    const category = (row.Categoria ?? "").trim();
    const label = [name, category].filter(Boolean).join(" - ") || `Competição ${row.IdCampeonato}`;
    list.push({
      idCampeonato: row.IdCampeonato,
      season: row.Exercicio || season,
      label,
      url: buildFpfUrl(row.IdCampeonato, row.Exercicio || season),
    });
  }
  return list.sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

type RawGame = {
  IdJogo?: number;
  Numero?: number | null;
  Data?: string | null;
  Horario?: string | null;
  NomePopularMandante?: string | null;
  NomePopularVisitante?: string | null;
  EscudoMandante?: string | null;
  EscudoVisitante?: string | null;
  ResultadoMandante?: number | null;
  ResultadoVisitante?: number | null;
  Estadio?: string | null;
  NomePopularEstadio?: string | null;
  Municipio?: string | null;
  Rodada?: number | null;
  Grupo?: string | null;
  Fase?: string | null;
  IdCampeonato?: number | null;
  IdCategoria?: number | null;
  CanaisTransmissao?: string | null;
  Adiado?: boolean | null;
};

const clean = (value: unknown) =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";

/** `dd/mm/aaaa` → `aaaa-mm-dd`. "A definir" devolve vazio. */
export function parseFpfDate(text: string | null | undefined) {
  const m = clean(text).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return "";
  const [, d, mo, y] = m;
  if (Number(mo) < 1 || Number(mo) > 12 || Number(d) < 1 || Number(d) > 31) return "";
  return `${y}-${mo}-${d}`;
}

/** `15h00`, `15:00` → `15:00`. "HORÁRIO A DEFINIR" devolve vazio. */
export function parseFpfTime(text: string | null | undefined) {
  const value = clean(text);
  if (/definir/i.test(value)) return "";
  const m = value.match(/(\d{1,2})\s*[:h]\s*(\d{2})/);
  if (!m) return "";
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return "";
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/**
 * Escudo do clube publicado pela própria FPF.
 * Somente as imagens da API oficial de filiação são aceitas — ícones da
 * interface (icon_clubes.png, logos, patrocinadores) são descartados.
 */
export function parseFpfCrest(value: string | null | undefined) {
  const url = clean(value);
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    if (!/(^|\.)fpf\.org\.br$/i.test(parsed.hostname)) return null;
    if (!/escudo/i.test(parsed.pathname)) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

const isTbd = (name: string) =>
  !name || /^(a\s*definir|à\s*definir|vencedor|perdedor|classificado|\d+[ºo]\s)/i.test(name);

export type FpfResult = {
  ok: boolean;
  message: string;
  matches: NormalizedMatch[];
  errors: ImportIssue[];
  found: number;
  /** Rodadas distintas processadas nesta leitura. */
  rounds: number;
};

/**
 * Calendário completo de uma competição da FPF, já normalizado.
 * Uma única consulta (`Rodada=0`) cobre todas as rodadas e fases publicadas.
 */
export async function fetchFpfMatches(
  target: { idCampeonato: number; season: string },
  options: { competition?: string } = {},
): Promise<FpfResult> {
  const payload = await fpfJson<{
    listTabela?: RawGame[];
    listData?: { Competicao?: string | null }[];
  }>(
    `/Handlers/Competicoes/ListarTabela.ashx?IdCampeonato=${target.idCampeonato}&Ano=${encodeURIComponent(
      target.season,
    )}&Rodada=0&IdClube=0`,
  );
  const rows = payload?.listTabela ?? [];

  if (rows.length === 0) {
    return {
      ok: false,
      message: "Não foi possível reconhecer os jogos da FPF nesta sincronização.",
      matches: [],
      errors: [],
      found: 0,
      rounds: 0,
    };
  }

  const fallbackName = clean(payload?.listData?.[0]?.Competicao) || `FPF ${target.idCampeonato}`;
  const competitionName = clean(options.competition) || fallbackName;
  const matches: NormalizedMatch[] = [];
  const errors: ImportIssue[] = [];
  const rounds = new Set<number>();
  const seen = new Set<string>();

  for (const game of rows) {
    const home = clean(game.NomePopularMandante);
    const away = clean(game.NomePopularVisitante);
    const number = game.Numero ?? game.IdJogo ?? null;
    const title = home && away ? `${home} × ${away}` : `Jogo ${number ?? "sem número"}`;
    if (game.Rodada) rounds.add(game.Rodada);

    if (isTbd(home) || isTbd(away)) {
      errors.push({ match: title, reason: "Partida aguardando definição dos participantes." });
      continue;
    }

    const date = parseFpfDate(game.Data);
    if (!date) {
      errors.push({ match: title, reason: "Data ainda não definida pela FPF." });
      continue;
    }
    const time = parseFpfTime(game.Horario);
    if (!time) {
      errors.push({ match: title, reason: "Horário ainda não definido pela FPF." });
      continue;
    }

    // Identificador oficial: competição + categoria + temporada + nº do jogo.
    const externalId = [
      "fpf",
      target.idCampeonato,
      game.IdCategoria ?? 0,
      target.season,
      number ?? `${date}-${home}-${away}`,
    ]
      .join("-")
      .toLowerCase();
    if (seen.has(externalId)) continue;
    seen.add(externalId);

    const played =
      typeof game.ResultadoMandante === "number" &&
      typeof game.ResultadoVisitante === "number" &&
      game.ResultadoMandante + game.ResultadoVisitante > 0;

    matches.push({
      competition: competitionName,
      date,
      time,
      homeTeam: home,
      awayTeam: away,
      city: clean(game.Municipio),
      venue: clean(game.Estadio) || clean(game.NomePopularEstadio),
      state: "SP",
      externalId,
      round: game.Rodada ? `Rodada ${game.Rodada}` : undefined,
      matchNumber: number ? String(number) : undefined,
      group: clean(game.Grupo) || undefined,
      phase: clean(game.Fase) || undefined,
      homeScore: played ? (game.ResultadoMandante ?? null) : null,
      awayScore: played ? (game.ResultadoVisitante ?? null) : null,
      broadcast: clean(game.CanaisTransmissao) || undefined,
      matchStatus: game.Adiado ? "ADIADO" : played ? "CONCLUIDO" : "AGENDADO",
      season: target.season,
      homeLogo: parseFpfCrest(game.EscudoMandante),
      awayLogo: parseFpfCrest(game.EscudoVisitante),
    });
  }

  return {
    ok: matches.length > 0,
    message:
      matches.length > 0
        ? `Fonte válida. ${rounds.size} rodadas e ${matches.length} jogos encontrados na FPF.`
        : "Não foi possível reconhecer os jogos da FPF nesta sincronização.",
    matches,
    errors,
    found: rows.length,
    rounds: rounds.size,
  };
}
