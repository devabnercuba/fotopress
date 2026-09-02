import { APP_URL } from "@/lib/app-url";

import type { ImportIssue, NormalizedMatch } from "./types";

/**
 * Leitor da Federação Catarinense de Futebol (sistema SisGol).
 *
 * Uma única requisição para a URL pública cadastrada pelo usuário. O relatório
 * do SisGol publica cada partida no formato:
 *
 *   Jogo: 1 - 29/08/2026 - Sáb / 17:00 - Estádio: Complexo Esportivo Bernardo Werner / Blumenau
 *   [escudo] x [escudo]
 *   BLUMENAU SAF        SANTA CATARINA
 *
 * Os valores são copiados exatamente como publicados. A única transformação é
 * reordenar `dd/mm/aaaa` para `aaaa-mm-dd` (exigência da coluna de data);
 * dia, mês, ano e horário permanecem idênticos, sem fuso horário.
 */

const UA = `Mozilla/5.0 (compatible; CoberturaBot/1.0; +${APP_URL})`;

export type FcfResult = {
  ok: boolean;
  message: string;
  matches: NormalizedMatch[];
  errors: ImportIssue[];
  /** Total de partidas encontradas na página, completas ou não. */
  found: number;
  /** Partidas sem clubes definidos ainda (ex.: "| x |"). */
  incomplete: number;
};

export function isFcfUrl(url: string) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return /(^|\.)fcf\.com\.br$/.test(host);
  } catch {
    return false;
  }
}

const decode = (value: string) =>
  value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");

const clean = (value: string | undefined | null) =>
  decode(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

const stripTags = (value: string) => clean(value.replace(/<[^>]+>/g, " "));

/** `dd/mm/aaaa` → `aaaa-mm-dd`. Nunca usa `new Date` (evita fuso/ambiguidade). */
export function parseFcfDate(text: string) {
  const m = clean(text).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

/** `17:00` ou `17h00` → `17:00`. Nenhuma conversão de fuso. */
export function parseFcfTime(text: string) {
  const m = clean(text).match(/(\d{1,2})\s*[:h]\s*(\d{2})/);
  if (!m) return "";
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

/** `Estádio: Nome / Cidade` → estádio e cidade, ambos podendo estar vazios. */
export function parseFcfVenue(headline: string) {
  const m = headline.match(/Est[áa]dio:\s*([^/<]*)/i);
  return clean(m?.[1] ?? "");
}

export function parseFcfCity(headline: string) {
  const m = headline.match(/Est[áa]dio:\s*[^/]*\/\s*([^<]*)/i);
  return clean(m?.[1] ?? "");
}

/** Clubes de um bloco: nomes exibidos abaixo dos escudos. */
export function parseFcfTeams(block: string) {
  const cells = [...block.matchAll(/<td[^>]*width="10%"[^>]*>([\s\S]*?)<\/td>/gi)].map((m) =>
    stripTags(m[1]),
  );
  const named = cells.filter((c) => c.length > 0);
  const logos = [...block.matchAll(/<img[^>]+src="([^"]+)"/gi)].map((m) =>
    encodeURI(decode(m[1]).split("?")[0]),
  );
  return {
    homeTeam: named[0] ?? "",
    awayTeam: named[1] ?? "",
    homeLogo: logos[0] ?? null,
    awayLogo: logos[1] ?? null,
  };
}

export type FcfGame = {
  number: string;
  headline: string;
  date: string;
  time: string;
  venue: string;
  city: string;
  homeTeam: string;
  awayTeam: string;
  homeLogo: string | null;
  awayLogo: string | null;
  round: string;
};

/** Lê um bloco (do "Jogo:" até o próximo) e devolve os dados literais. */
export function parseFcfGameBlock(headline: string, block: string): FcfGame {
  const number = clean(headline.match(/Jogo:\s*([\w.-]+)/i)?.[1] ?? "");
  const round = clean(
    [...block.matchAll(/>([^<>]*RODADA[^<>]*|SEMIFINAIS?|FINAIS?|QUARTAS[^<>]*)</gi)]
      .map((m) => clean(m[1]))
      .find((value) => value.length > 0) ?? "",
  );
  return {
    number,
    headline,
    date: parseFcfDate(headline),
    time: parseFcfTime(headline.replace(/\d{2}\/\d{2}\/\d{4}/, "")),
    venue: parseFcfVenue(headline),
    city: parseFcfCity(headline),
    round,
    ...parseFcfTeams(block),
  };
}

/** Divide o relatório do SisGol em blocos independentes por partida. */
export function parseFcfGames(html: string): FcfGame[] {
  const text = html.replace(/\r?\n/g, " ");
  const marks = [...text.matchAll(/Jogo:\s*[\w.-]+\s*-\s*\d{2}\/\d{2}\/\d{4}/gi)];
  return marks.map((mark, i) => {
    const start = mark.index ?? 0;
    const end = i + 1 < marks.length ? (marks[i + 1].index ?? text.length) : text.length;
    const block = text.slice(start, end);
    const headline = stripTags(block.slice(0, block.indexOf("</td>") + 1 || 400));
    return parseFcfGameBlock(headline, block);
  });
}

/**
 * Baixa o HTML respeitando o charset publicado (o SisGol usa ISO-8859-1).
 */
export async function fetchFcfHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "user-agent": UA,
      accept: "text/html,application/xhtml+xml",
      "accept-language": "pt-BR,pt;q=0.9",
    },
  });
  if (!response.ok) throw new Error(`A página da FCF respondeu com status ${response.status}.`);

  const buffer = await response.arrayBuffer();
  const header = response.headers.get("content-type") ?? "";
  const sniff = new TextDecoder("iso-8859-1").decode(buffer.slice(0, 2048));
  const charset =
    header.match(/charset=([\w-]+)/i)?.[1] ?? sniff.match(/charset=([\w-]+)/i)?.[1] ?? "utf-8";
  try {
    return new TextDecoder(charset.toLowerCase()).decode(buffer);
  } catch {
    return new TextDecoder("iso-8859-1").decode(buffer);
  }
}

/** URL da FCF → partidas normalizadas, sem tocar no banco. */
export async function fetchFcfMatches(url: string, competition?: string): Promise<FcfResult> {
  const html = await fetchFcfHtml(url);
  const games = parseFcfGames(html);

  if (games.length === 0) {
    return {
      ok: false,
      message: "Não foi possível identificar jogos nesta página da FCF.",
      matches: [],
      errors: [],
      found: 0,
      incomplete: 0,
    };
  }

  const competitionName = clean(competition) || "Federação Catarinense de Futebol";
  const category = competitionName.match(/sub\s*-?\s*(\d{2})/i)?.[1]
    ? `Sub-${competitionName.match(/sub\s*-?\s*(\d{2})/i)![1]}`
    : "";
  const matches: NormalizedMatch[] = [];
  const errors: ImportIssue[] = [];

  for (const game of games) {
    const missing: string[] = [];
    if (!game.homeTeam || !game.awayTeam) missing.push("clubes ainda não definidos");
    if (!game.date) missing.push("data ausente");
    if (!game.time) missing.push("horário ausente");

    if (missing.length > 0) {
      errors.push({
        match: `Jogo ${game.number || "?"}${game.date ? ` — ${game.date}` : ""}`,
        reason: missing.join(", "),
      });
      continue;
    }

    matches.push({
      competition: competitionName,
      date: game.date,
      time: game.time,
      homeTeam: game.homeTeam,
      awayTeam: game.awayTeam,
      city: game.city,
      venue: game.venue,
      state: "SC",
      // A rodada já era lida no bloco do SisGol; agora chega ao jogo importado.
      ...(game.round ? { round: game.round } : {}),
      // Categoria só quando publicada explicitamente no nome da competição.
      ...(category ? { category } : {}),
      ...(game.number ? { matchNumber: game.number } : {}),
      homeLogo: game.homeLogo,
      awayLogo: game.awayLogo,
      externalId: game.number
        ? `fcf|${competitionName.toLowerCase()}|${game.number}`
        : `fcf|${competitionName.toLowerCase()}|${game.date}|${game.homeTeam}|${game.awayTeam}`.toLowerCase(),
    });
  }

  const incomplete = games.length - matches.length;
  return {
    ok: matches.length > 0,
    message: [
      "Fonte FCF válida",
      `${games.length} jogos encontrados`,
      `${matches.length} jogos completos`,
      `${incomplete} jogos com informações pendentes`,
    ].join(" · "),
    matches,
    errors,
    found: games.length,
    incomplete,
  };
}
