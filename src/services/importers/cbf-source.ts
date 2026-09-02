import { APP_URL } from "@/lib/app-url";

import type { NormalizedMatch } from "./types";

/**
 * Leitor da CBF baseado **apenas** no HTML público da URL cadastrada.
 *
 * Uma única requisição é feita para a página informada pelo usuário. Nenhuma
 * API interna, nenhum id de competição, nenhuma descoberta de rodadas.
 *
 * Cada card da página publica os dados já formatados:
 *   <strong title="Mandante">…  <strong title="Visitante">…
 *   <p> 25/07/2026 - 17:00<br> Araraquara - SP<br>Fonte Luminosa </p>
 *
 * Os textos são copiados exatamente como exibidos. A única transformação é
 * reordenar `dd/mm/aaaa` para `aaaa-mm-dd`, formato exigido pela coluna de
 * data do banco — dia, mês e ano permanecem idênticos, sem fuso horário.
 */

const UA = `Mozilla/5.0 (compatible; CoberturaBot/1.0; +${APP_URL})`;

export type CbfGameError = { match: string; reason: string };

export type CbfResult = {
  ok: boolean;
  message: string;
  matches: NormalizedMatch[];
  errors: CbfGameError[];
  found: number;
};

export function isCbfUrl(url: string) {
  try {
    return /(^|\.)cbf\.com\.br$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

const decode = (value: string) =>
  value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

const clean = (value: string | undefined | null) =>
  decode(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

const stripTags = (value: string) => clean(value.replace(/<[^>]+>/g, " "));

/** `dd/mm/aaaa` → `aaaa-mm-dd`, sem qualquer conversão de fuso ou calendário. */
function literalDate(text: string) {
  const m = clean(text).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

/** Mantém exatamente o horário publicado (`HH:mm`). */
function literalTime(text: string) {
  const m = clean(text).match(/(\d{1,2})[h:](\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : "";
}

/** Divide os cards de partida presentes no HTML da página. */
function splitCards(html: string): string[] {
  const marker = /class="[^"]*gameCard[^"]*"/gi;
  const starts: number[] = [];
  for (const hit of html.matchAll(marker)) starts.push(hit.index ?? 0);
  if (starts.length === 0) return [];
  return starts.map((start, i) => html.slice(start, starts[i + 1] ?? start + 4000));
}

type CardData = {
  homeTeam: string;
  awayTeam: string;
  date: string;
  time: string;
  city: string;
  state: string;
  venue: string;
  rawDate: string;
  rawTime: string;
  homeLogo?: string;
  awayLogo?: string;
};

/** Imagens que nunca representam um escudo de clube. */
const NOT_A_CREST =
  /sprite|icon|logo-cbf|brand-cbf|placeholder|banner|patrocinador|sponsor|bandeira|flag|logo_competicoes|favicon/i;

/** Todas as URLs de imagem de um trecho de HTML, já absolutas. */
function imageUrls(fragment: string, base: string): string[] {
  const raw: string[] = [];
  for (const tag of fragment.matchAll(/<(?:img|source)\b[^>]*>/gi)) {
    const el = tag[0];
    const attr = (name: string) =>
      el.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1] ?? "";
    const srcset = attr("srcset");
    const candidates = [
      attr("src"),
      attr("data-src"),
      attr("data-original"),
      srcset.split(",")[0]?.trim().split(/\s+/)[0] ?? "",
    ].filter(Boolean);
    const alt = `${attr("alt")} ${attr("title")} ${attr("class")}`;
    for (const candidate of candidates) {
      if (NOT_A_CREST.test(candidate) || NOT_A_CREST.test(alt)) continue;
      try {
        raw.push(new URL(decode(candidate), base).toString());
      } catch {
        /* ignora caminhos inválidos */
      }
      break;
    }
  }
  return raw;
}

/** Escudos publicados no card (informação complementar). */
function cardLogos(card: string, base: string) {
  const absolute = imageUrls(card, base);
  return { homeLogo: absolute[0] || undefined, awayLogo: absolute[1] || undefined };
}

function readCard(card: string, base = "https://www.cbf.com.br"): CardData {
  const teams = [...card.matchAll(/<strong[^>]*title="([^"]*)"[^>]*>/gi)].map((m) => clean(m[1]));

  // bloco de informações: data - hora <br> cidade - UF <br> estádio
  const info = card.match(/<p[^>]*>([\s\S]*?)<\/p>/i)?.[1] ?? "";
  const lines = info
    .split(/<br\s*\/?>/i)
    .map((line) => stripTags(line))
    .filter(Boolean);

  const dateTime = lines.find((line) => /\d{2}\/\d{2}\/\d{4}/.test(line)) ?? "";
  const rest = lines.filter((line) => line !== dateTime);

  const placeLine = rest.find((line) => /\s-\s*[A-Z]{2}$/.test(line)) ?? rest[0] ?? "";
  const venueLine = rest.find((line) => line !== placeLine) ?? "";

  const placeParts = placeLine
    .split(/\s+-\s+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const state =
    placeParts.length > 1 && /^[A-Za-z]{2}$/.test(placeParts[placeParts.length - 1])
      ? placeParts.pop()!.toUpperCase()
      : "";
  const city = placeParts.join(" - ");

  const [rawDate, rawTime] = (() => {
    const parts = dateTime.split(/\s+-\s+/);
    return [parts[0] ?? "", parts[1] ?? dateTime];
  })();

  return {
    homeTeam: teams[0] ?? "",
    awayTeam: teams[1] ?? "",
    date: literalDate(rawDate || dateTime),
    time: literalTime(rawTime || dateTime),
    city,
    state,
    venue: venueLine,
    rawDate: clean(rawDate),
    rawTime: clean(rawTime),
    ...cardLogos(card, base),
  };
}

/** Nome do campeonato a partir da própria URL pública. */
function pageCompetition(url: string) {
  try {
    const parts = new URL(url).pathname
      .split("/")
      .filter(Boolean)
      .filter((p) => !["futebol-brasileiro", "tabelas", "jogos"].includes(p))
      .filter((p) => !/^(19|20)\d{2}$/.test(p));
    const name = parts
      .join(" ")
      .split("-")
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\b\p{L}/gu, (c) => c.toUpperCase());
    return name || "CBF";
  } catch {
    return "CBF";
  }
}

/**
 * Lê o HTML público. Alguns domínios da CBF (ex.: credencial.cbf.com.br)
 * bloqueiam requisições vindas de servidores; nesse caso usamos um leitor
 * público que devolve o mesmo HTML original.
 */
async function fetchHtml(url: string): Promise<string> {
  const direct = async () =>
    fetch(url, {
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml",
        "accept-language": "pt-BR,pt;q=0.9",
      },
    });

  let response: Response | null = null;
  try {
    response = await direct();
  } catch {
    response = null;
  }

  if (!response || !response.ok) {
    const mirror = await fetch(`https://r.jina.ai/${url}`, {
      headers: { "user-agent": UA, "x-return-format": "html" },
    });
    if (!mirror.ok) {
      throw new Error(
        response
          ? `A página da CBF respondeu com status ${response.status}.`
          : "Não foi possível acessar a página da CBF.",
      );
    }
    return mirror.text();
  }

  return response.text();
}

/** Cards do portal de credenciamento (credencial.cbf.com.br). */
function readCredencialCards(html: string, base = "https://credencial.cbf.com.br"): CardData[] {
  const blocks = [
    ...html.matchAll(
      /<div class="ConfrontoLiberadoGR">([\s\S]*?)<\/div>[\s\S]*?<div class="LocalEventoLiberado">([\s\S]*?)<\/div>[\s\S]*?<div class="DataHoraEventoLiberado">([\s\S]*?)<\/div>/gi,
    ),
  ];

  let previousEnd = 0;

  return blocks.map((block) => {
    const confronto = stripTags(block[1]);
    const local = stripTags(block[2]);
    const dateTime = stripTags(block[3]);

    // Os escudos ficam logo acima do confronto, dentro do mesmo card visual.
    // O trecho considerado começa no fim do card anterior, evitando misturar jogos.
    const start = block.index ?? previousEnd;
    const above = html.slice(previousEnd, start);
    previousEnd = start + block[0].length;
    const crests = imageUrls(above, base).slice(-2);

    const [rawHome = "", rawAway = ""] = confronto.split(/\s+[xX×]\s+/);
    const teamName = (value: string) => clean(value.replace(/\s*\/\s*[A-Za-z]{2}\s*$/, ""));

    // "Estádio - Cidade, UF"
    const placeMatch = local.match(/^(.*?)\s*-\s*(.*?),\s*([A-Za-z]{2})\s*$/);
    const venue = clean(placeMatch?.[1] ?? local);
    const city = clean(placeMatch?.[2] ?? "");
    const state = (placeMatch?.[3] ?? "").toUpperCase();

    const [rawDate = "", rawTime = ""] = dateTime.split(/\s+às\s+/i);

    const data: CardData = {
      homeTeam: teamName(rawHome),
      awayTeam: teamName(rawAway),
      date: literalDate(rawDate),
      time: literalTime(rawTime || dateTime),
      city,
      state,
      venue,
      rawDate: clean(rawDate),
      rawTime: clean(rawTime),
      homeLogo: crests[0],
      awayLogo: crests[1],
    };

    if (import.meta.env.DEV) {
      console.debug(
        `CBF logo: ${data.homeTeam} → ${data.homeLogo ?? "escudo não localizado no HTML"} | ` +
          `${data.awayTeam} → ${data.awayLogo ?? "escudo não localizado no HTML"}`,
      );
    }

    return data;
  });
}

export async function fetchCbfMatches(url: string, competition?: string): Promise<CbfResult> {
  // Uma única requisição para a URL pública informada pelo usuário.
  const html = await fetchHtml(url);

  const credencial = readCredencialCards(html, url);
  const cards = credencial.length > 0 ? [] : splitCards(html);
  if (credencial.length === 0 && cards.length === 0) {
    return {
      ok: false,
      message: "Nenhum card de partida foi encontrado nesta página da CBF.",
      matches: [],
      errors: [],
      found: 0,
    };
  }

  const competitionName = clean(competition) || pageCompetition(url);
  const matches: NormalizedMatch[] = [];
  const errors: CbfGameError[] = [];
  const seen = new Set<string>();

  const entries: CardData[] =
    credencial.length > 0 ? credencial : cards.map((card) => readCard(card, url));

  for (const data of entries) {
    const label = `${data.homeTeam || "?"} × ${data.awayTeam || "?"}`;

    if (!data.homeTeam || !data.awayTeam) {
      errors.push({ match: label, reason: "Mandante ou visitante não informado na página." });
      continue;
    }
    if (!data.date) {
      errors.push({
        match: label,
        reason: `Data não informada na página (“${data.rawDate || "vazio"}”).`,
      });
      continue;
    }
    if (!data.time) {
      errors.push({
        match: label,
        reason: `Horário não informado na página (“${data.rawTime || "vazio"}”).`,
      });
      continue;
    }
    if (!data.venue) {
      errors.push({ match: `${label} — aviso`, reason: "Estádio não informado na página." });
    }
    if (!data.state) {
      errors.push({ match: `${label} — aviso`, reason: "Estado não informado na página." });
    }

    const key = `${data.date}|${data.time}|${data.homeTeam}|${data.awayTeam}`;
    if (seen.has(key)) continue;
    seen.add(key);

    matches.push({
      competition: competitionName,
      date: data.date,
      time: data.time,
      homeTeam: data.homeTeam,
      awayTeam: data.awayTeam,
      city: data.city,
      venue: data.venue,
      state: data.state,
      homeLogo: data.homeLogo ?? null,
      awayLogo: data.awayLogo ?? null,
    });
  }

  const found = entries.length;
  return {
    ok: matches.length > 0,
    message:
      matches.length > 0
        ? `Página da CBF lida. ${found} partidas encontradas, ${matches.length} prontas para importar.`
        : "A página da CBF foi lida, mas nenhuma partida possui dados completos.",
    matches,
    errors,
    found,
  };
}
