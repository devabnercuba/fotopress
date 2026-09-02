import type { Confidence, PdfDraftMatch, PdfLine, PdfParseResult } from "./types";

/**
 * Motor semântico de leitura de tabelas esportivas em PDF.
 *
 * Não depende de posição fixa de coluna: identifica datas, horários, o
 * separador de confronto, placares, categorias, locais e cabeçalhos de seção.
 *
 * Duas estratégias convivem no mesmo arquivo:
 * - TEXT_BLOCK: blocos "Jogo nº N" (tabelas de federação);
 * - TABLE: linhas com células (tabelas municipais/planilhas), onde a data
 *   vem de um cabeçalho acima dos jogos e é herdada.
 */

const DATE_BR = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/;
const DATE_ISO = /(\d{4})-(\d{2})-(\d{2})/;
const DATE_TBD = /_{2,}\s*[/.-]?\s*_{2,}|\bdata\s+a\s+definir\b|\ba\s+definir\b/i;
const TIME = /\b(\d{1,2})\s*[h:.]\s*(\d{2})\b/;
const TIME_TBD = /\bhor[áa]rio\s+a\s+definir\b|\ba\s+definir\b/i;
const SEPARATOR = /^(?:x|×|vs\.?)$/i;
const SEPARATOR_INLINE = /\s(?:x|×|vs\.?)\s/i;
const MATCH_NUMBER = /\bjogo\s*n?[º°o.]*\s*(\d{1,4})\b/i;
const ROUND_HEADER =
  /\b(\d{1,2})\s*[ªa]?\s*(semana|rodada)\b|\b(semana|rodada)\s*[:-]?\s*(\d{1,2})\b/i;
const UF_TOKEN =
  /\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/;

const WEEKDAY = /\b(segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo)(\s*-?\s*feira)?\b/i;

/** Palavras que nunca são nome de clube. */
const CATEGORY_WORDS =
  /^(s[ée]rie\s+[a-z]|feminino|masculino|veteranos?|sub[\s-]?\d{1,2}|livre|principal|aspirante|oitavas?|quartas?|semi(?:final)?|final(?:[íi]ssima)?|repescagem|grupo\s*\(?[a-z0-9]\)?|s\.?\s?b\.?\s*grupo\s*\(?[a-z]\)?|rodada|semana|categoria|classifica[çc][ãa]o|tabela|local|cidade|transmiss[ãa]o)$/i;

/** Participantes ainda indefinidos, mantidos literalmente. */
const PLACEHOLDER =
  /^(\d+\s*[º°o]?\s*colocad[oa]|ven\b|venc(?:edor)?\b|per\.?\b|perdedor\b|melhor\b|classificad)/i;

const NOISE =
  /^(p[áa]gina|page)\b|^\d{1,3}$|confedera[çc][ãa]o|regulamento|www\.|https?:|@|^cnpj|impress[oa] em|observa[çc][õo]es|legenda|coordena[çc][ãa]o|diretoria|arbitragem|s[uú]mula/i;

const COMPETITION_HINT = /\b(campeonato|copa|torneio|liga|ta[çc]a|circuito|festival)\b/i;

export const clean = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[-–|,;:.]+|[-–|,;:]+$/g, "")
    .trim();

export function toIsoDate(text: string): string | null {
  const iso = text.match(DATE_ISO);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = text.match(DATE_BR);
  if (!br) return null;
  const day = Number(br[1]);
  const month = Number(br[2]);
  if (day < 1 || day > 31 || month < 1 || month > 12) return null;
  const year = br[3].length === 2 ? `20${br[3]}` : br[3];
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function toTime(text: string): string | null {
  const m = text.match(TIME);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour > 23 || minute > 59) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** "S.B. Grupo(A)" → { category: "Série B", group: "Grupo A" } */
export function parseCategory(raw: string): {
  category: string | null;
  group: string | null;
  phase: string | null;
} {
  const value = clean(raw);
  if (!value) return { category: null, group: null, phase: null };

  let category: string | null = null;
  let group: string | null = null;
  let phase: string | null = null;

  const grouped = value.match(/grupo\s*\(?\s*([a-z0-9])\s*\)?/i);
  if (grouped) group = `Grupo ${grouped[1].toUpperCase()}`;

  const abbrev = value.match(/\bs\.?\s?([ab])\.?\b/i);
  const serie = value.match(/s[ée]rie\s+([a-z])/i);
  if (serie) category = `Série ${serie[1].toUpperCase()}`;
  else if (abbrev) category = `Série ${abbrev[1].toUpperCase()}`;
  else if (/feminino/i.test(value)) category = "Feminino";
  else if (/veterano/i.test(value)) category = "Veteranos";
  else if (/masculino/i.test(value)) category = "Masculino";
  else {
    const sub = value.match(/sub[\s-]?(\d{1,2})/i);
    if (sub) category = `Sub-${sub[1]}`;
  }

  const phases: [RegExp, string][] = [
    [/oitavas?/i, "Oitavas"],
    [/quartas?/i, "Quartas"],
    [/semi/i, "Semifinal"],
    [/final[íi]ssima|\bfinal\b/i, "Final"],
    [/repescagem/i, "Repescagem"],
  ];
  for (const [re, label] of phases) {
    if (re.test(value)) {
      phase = label;
      break;
    }
  }

  if (!category && !group && !phase) category = value;
  return { category, group, phase };
}

function isPlaceholder(name: string) {
  return PLACEHOLDER.test(clean(name));
}

function looksLikeTeam(name: string) {
  const value = clean(name);
  if (value.length < 2 || value.length > 60) return false;
  if (CATEGORY_WORDS.test(value)) return false;
  if (/^\d+$/.test(value)) return false;
  return /\p{L}/u.test(value);
}

/** Extrai placar colado ao nome: "Marília 1" → { name: "Marília", score: 1 } */
function splitScore(side: string, position: "home" | "away") {
  const value = clean(side);
  const re = position === "home" ? /\s(\d{1,3})$/ : /^(\d{1,3})\s/;
  const m = value.match(re);
  if (!m) return { name: value, score: null as number | null };
  const name = clean(position === "home" ? value.slice(0, m.index) : value.slice(m[0].length));
  if (!name) return { name: value, score: null };
  return { name, score: Number(m[1]) };
}

type Context = {
  date: string | null;
  dateTbd: boolean;
  roundLabel: string | null;
  category: string | null;
  group: string | null;
  phase: string | null;
  city: string | null;
  state: string | null;
};

function roundLabelOf(text: string): string | null {
  const m = text.match(ROUND_HEADER);
  if (!m) return null;
  const number = m[1] ?? m[4];
  const kind = (m[2] ?? m[3] ?? "").toLowerCase();
  if (!number) return null;
  const noun = kind.startsWith("sem") ? "Semana" : "Rodada";
  return noun === "Semana" ? `${number}ª Semana` : `Rodada ${number}`;
}

function confidenceOf(draft: PdfDraftMatch): Confidence {
  if (!draft.date || draft.participantsTbd) return "baixa";
  if (!draft.time || !draft.venue) return "media";
  return "alta";
}

function finish(draft: PdfDraftMatch): PdfDraftMatch {
  const warnings = [...draft.warnings];
  if (!draft.date) warnings.push("Data não encontrada");
  if (!draft.time) warnings.push("Horário não encontrado");
  if (!draft.venue && !draft.city) warnings.push("Local não encontrado");
  if (draft.participantsTbd) warnings.push("Participante ainda indefinido");
  const withWarnings = { ...draft, warnings: [...new Set(warnings)] };
  return { ...withWarnings, confidence: confidenceOf(withWarnings) };
}

let counter = 0;
const nextId = () => `pdf-${Date.now().toString(36)}-${(counter += 1)}`;

function baseDraft(context: Context, competition: string, raw: string): PdfDraftMatch {
  return {
    id: nextId(),
    matchNumber: null,
    date: context.date,
    dateStatus: context.date ? "defined" : "tbd",
    time: null,
    homeTeam: "",
    awayTeam: "",
    homeScore: null,
    awayScore: null,
    participantsTbd: false,
    competition,
    category: context.category,
    group: context.group,
    phase: context.phase,
    roundLabel: context.roundLabel,
    venue: null,
    city: null,
    state: null,
    stateInferred: false,
    broadcast: null,
    status: "scheduled",
    confidence: "media",
    warnings: [],
    raw,
  };
}

/** Divide uma linha/célula em mandante e visitante pelo separador. */
function splitDuel(cells: string[]): { home: string; away: string; rest: string[] } | null {
  const separatorIndex = cells.findIndex((cell) => SEPARATOR.test(clean(cell)));
  if (separatorIndex > 0 && separatorIndex < cells.length - 1) {
    return {
      home: clean(cells[separatorIndex - 1]),
      away: clean(cells[separatorIndex + 1]),
      rest: cells.filter((_, i) => i < separatorIndex - 1 || i > separatorIndex + 1),
    };
  }
  const inlineIndex = cells.findIndex((cell) => SEPARATOR_INLINE.test(cell));
  if (inlineIndex >= 0) {
    const [home = "", away = ""] = cells[inlineIndex].split(SEPARATOR_INLINE);
    return {
      home: clean(home),
      away: clean(away),
      rest: cells.filter((_, i) => i !== inlineIndex),
    };
  }
  return null;
}

function applyTeams(draft: PdfDraftMatch, homeRaw: string, awayRaw: string) {
  const home = splitScore(homeRaw, "home");
  const away = splitScore(awayRaw, "away");
  draft.homeTeam = home.name;
  draft.awayTeam = away.name;
  // "X" sozinho nunca é placar: só há placar quando há número dos dois lados.
  if (home.score !== null && away.score !== null) {
    draft.homeScore = home.score;
    draft.awayScore = away.score;
    draft.status = "completed";
  } else {
    draft.homeTeam = clean(homeRaw);
    draft.awayTeam = clean(awayRaw);
  }
  draft.participantsTbd = isPlaceholder(draft.homeTeam) || isPlaceholder(draft.awayTeam);
}

function detectCompetition(lines: PdfLine[]): string | null {
  const head = lines.slice(0, 25);
  const candidate = head.find(
    (line) => COMPETITION_HINT.test(line.text) && line.text.length > 12 && line.text.length < 140,
  );
  return candidate ? clean(candidate.text) : null;
}

/** Cabeçalho de documento com cidade/UF, usado apenas como sugestão. */
function detectPlaceHint(lines: PdfLine[]) {
  const head = lines
    .slice(0, 25)
    .map((l) => l.text)
    .join(" ");
  const uf = head.match(UF_TOKEN);
  return { state: uf ? uf[1].toUpperCase() : null };
}

export function parsePdfLines(
  lines: PdfLine[],
  options: { competition?: string; pages?: number; rawText?: string } = {},
): PdfParseResult {
  const usable = lines.filter((line) => clean(line.text) && !NOISE.test(clean(line.text)));
  const detectedCompetition = detectCompetition(usable);
  const competition = options.competition?.trim() || detectedCompetition || "Importação PDF";
  const hint = detectPlaceHint(usable);

  const context: Context = {
    date: null,
    dateTbd: false,
    roundLabel: null,
    category: null,
    group: null,
    phase: null,
    city: null,
    state: hint.state,
  };

  const matches: PdfDraftMatch[] = [];
  const unparsed: string[] = [];
  let blockMode = 0;
  let rowMode = 0;

  // Bloco aberto por "Jogo nº N" (tabelas de federação).
  let block: PdfDraftMatch | null = null;
  let pendingField: "venue" | "city" | "broadcast" | null = null;

  const closeBlock = () => {
    if (!block) return;
    if (block.homeTeam && block.awayTeam) matches.push(finish(block));
    else unparsed.push(block.raw);
    block = null;
    pendingField = null;
  };

  for (const line of usable) {
    const text = clean(line.text);
    const cells = line.cells.map(clean).filter(Boolean);

    const round = roundLabelOf(text);
    const duel = splitDuel(cells.length > 1 ? cells : [text]);
    const numberMatch = text.match(MATCH_NUMBER);

    if (numberMatch && !duel) {
      closeBlock();
      blockMode += 1;
      block = baseDraft(context, competition, text);
      block.matchNumber = numberMatch[1];
      continue;
    }

    if (block) {
      // Campos rotulados podem vir na mesma linha ou na linha seguinte.
      const labelled = text.match(
        /^(local|est[áa]dio|gin[áa]sio|cidade|transmiss[ãa]o)\b\s*:?\s*(.*)$/i,
      );
      // "Estádio Municipal X" (sem dois-pontos) é o valor, não um rótulo.
      const isLabel =
        !!labelled &&
        (!clean(labelled[2]) || new RegExp(`^${labelled[1]}\\s*:`, "i").test(line.text.trim()));
      if (labelled && isLabel) {
        const label = labelled[1].toLowerCase();
        const value = clean(labelled[2]);
        const field = label.startsWith("cidade")
          ? "city"
          : label.startsWith("transmiss")
            ? "broadcast"
            : "venue";
        if (value) {
          if (field === "city") block.city = value;
          else if (field === "broadcast") block.broadcast = value;
          else block.venue = value;
          pendingField = null;
        } else {
          pendingField = field;
        }
        continue;
      }
      if (pendingField) {
        if (pendingField === "city") block.city = text;
        else if (pendingField === "broadcast") block.broadcast = text;
        else block.venue = text;
        pendingField = null;
        continue;
      }

      if (!block.date) {
        const date = toIsoDate(text);
        if (date) {
          block.date = date;
          block.dateStatus = "defined";
          continue;
        }
        if (DATE_TBD.test(text)) {
          block.dateStatus = "tbd";
          continue;
        }
      }
      if (!block.time) {
        const time = toTime(text);
        if (time && !duel) {
          block.time = time;
          continue;
        }
      }
      if (duel) {
        applyTeams(block, duel.home, duel.away);
        const inlineTime = toTime(text);
        if (inlineTime && !block.time) block.time = inlineTime;
        continue;
      }
      if (round) block.roundLabel = round;
      continue;
    }

    // ---- modo tabela / linhas ----
    if (!duel) {
      const date = toIsoDate(text);
      if (date) {
        context.date = date;
        context.dateTbd = false;
        continue;
      }
      if (DATE_TBD.test(text) && WEEKDAY.test(text)) {
        context.date = null;
        context.dateTbd = true;
        continue;
      }
      if (round) {
        context.roundLabel = round;
        continue;
      }
      if (CATEGORY_WORDS.test(text)) {
        const parsed = parseCategory(text);
        context.category = parsed.category ?? context.category;
        context.group = parsed.group ?? context.group;
        context.phase = parsed.phase ?? context.phase;
      }
      continue;
    }

    rowMode += 1;
    const draft = baseDraft(context, competition, text);
    applyTeams(draft, duel.home, duel.away);

    // Data na própria linha tem prioridade sobre a herdada do cabeçalho.
    const lineDate = toIsoDate(text);
    if (lineDate) {
      draft.date = lineDate;
      draft.dateStatus = "defined";
    } else if (DATE_TBD.test(text)) {
      draft.date = null;
      draft.dateStatus = "tbd";
    }
    if (!draft.date && context.dateTbd) draft.dateStatus = "tbd";

    const rest = duel.rest;
    for (const cell of rest) {
      const time = toTime(cell);
      if (time && !draft.time) {
        draft.time = time;
        continue;
      }
      if (/^\d{1,4}$/.test(cell) && !draft.matchNumber) {
        draft.matchNumber = cell;
        continue;
      }
      if (toIsoDate(cell)) continue;
      const parsed = parseCategory(cell);
      if (parsed.category || parsed.group || parsed.phase) {
        draft.category = parsed.category ?? draft.category;
        draft.group = parsed.group ?? draft.group;
        draft.phase = parsed.phase ?? draft.phase;
      }
    }
    if (!draft.time) draft.time = toTime(text);
    if (draft.time && TIME_TBD.test(text) === false) {
      // horário lido literalmente
    }

    if (context.state && !draft.state) {
      draft.state = context.state;
      draft.stateInferred = true;
    }

    const validHome = draft.participantsTbd || looksLikeTeam(draft.homeTeam);
    const validAway = draft.participantsTbd || looksLikeTeam(draft.awayTeam);
    if (!validHome || !validAway) {
      unparsed.push(text);
      continue;
    }

    matches.push(finish(draft));
  }
  closeBlock();

  const strategy = blockMode && rowMode ? "MIXED" : blockMode ? "TEXT_BLOCK" : "TABLE";

  return {
    competition: detectedCompetition,
    matches,
    unparsed,
    rawText: options.rawText ?? usable.map((l) => l.text).join("\n"),
    report: {
      pages: options.pages ?? 1,
      strategy,
      detected: matches.length + unparsed.length,
      withDate: matches.filter((m) => m.date).length,
      tbdDate: matches.filter((m) => !m.date).length,
      withTime: matches.filter((m) => m.time).length,
      tbdParticipants: matches.filter((m) => m.participantsTbd).length,
      withVenue: matches.filter((m) => m.venue || m.city).length,
      warnings: matches.reduce((total, m) => total + m.warnings.length, 0),
    },
  };
}

/** Conveniência: interpreta texto puro (cada linha vira uma `PdfLine`). */
export function parsePdfText(text: string, options: { competition?: string; pages?: number } = {}) {
  const lines: PdfLine[] = text
    .split(/\r?\n/)
    .map((raw) => raw.replace(/\t/g, " | "))
    .filter((raw) => raw.trim())
    .map((raw) => ({
      page: 1,
      cells: raw.includes("|") ? raw.split("|").map(clean).filter(Boolean) : [clean(raw)],
      text: clean(raw.replace(/\s*\|\s*/g, " ")),
    }));
  return parsePdfLines(lines, { ...options, rawText: text });
}
