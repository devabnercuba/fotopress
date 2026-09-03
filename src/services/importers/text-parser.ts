import type { NormalizedMatch } from "./types";

/**
 * Extrator genérico de partidas a partir de texto livre (PDF, HTML, TXT).
 *
 * Reconhece linhas no formato:
 *   12/08/2026 19:00 Avaí x Chapecoense - Ressacada, Florianópolis
 *   2026-08-12 19:00 | Avaí | Chapecoense | Ressacada | Florianópolis
 *
 * A função é pura e isomórfica: é usada tanto pelo PDFImporter (navegador)
 * quanto pelo URLImporter (servidor).
 */

const DATE_RE = /(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})|(\d{4})-(\d{2})-(\d{2})/;
const TIME_RE = /(\d{1,2})[h:](\d{2})/;
const VS_RE = /\s+(?:x|vs\.?|X)\s+/;

function toIsoDate(text: string): string {
  const m = text.match(DATE_RE);
  if (!m) return "";
  if (m[4]) return `${m[4]}-${m[5]}-${m[6]}`;
  const year = m[3].length === 2 ? `20${m[3]}` : m[3];
  return `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

function clean(value: string) {
  return value
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[-–|,;]+|[-–|,;]+$/g, "")
    .trim();
}

export function parseMatchesFromText(
  text: string,
  options: { competition?: string } = {},
): NormalizedMatch[] {
  const matches: NormalizedMatch[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((line) => clean(line))
    .filter(Boolean);

  let currentDate = "";

  for (const line of lines) {
    const date = toIsoDate(line);
    if (date) currentDate = date;
    if (!currentDate) continue;

    // remove data e hora da linha para sobrar os nomes
    const timeMatch = line.match(TIME_RE);
    const time = timeMatch ? `${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}` : "19:00";

    const rest = clean(line.replace(DATE_RE, " ").replace(TIME_RE, " "));
    const cells = rest.includes("|") ? rest.split("|").map(clean).filter(Boolean) : [rest];

    let homeTeam = "";
    let awayTeam = "";
    let venue = "";
    let city = "";

    if (cells.length >= 3 && !VS_RE.test(cells[0])) {
      [homeTeam, awayTeam] = [cells[0], cells[1]];
      venue = cells[2] ?? "";
      city = cells[3] ?? "";
    } else {
      const source = cells[0] ?? "";
      const parts = source.split(VS_RE);
      if (parts.length < 2) continue;
      homeTeam = clean(parts[0]);
      const tail = clean(parts.slice(1).join(" "));
      const tailParts = tail.split(/\s+[-–]\s+|,\s+/);
      awayTeam = clean(tailParts[0] ?? "");
      venue = clean(tailParts[1] ?? "");
      city = clean(tailParts[2] ?? "");
      if (cells.length > 1) {
        venue = venue || clean(cells[1] ?? "");
        city = city || clean(cells[2] ?? "");
      }
    }

    if (!homeTeam || !awayTeam) continue;
    if (homeTeam.length > 60 || awayTeam.length > 60) continue;

    matches.push({
      competition: options.competition?.trim() || "Importação",
      date: currentDate,
      time,
      homeTeam,
      awayTeam,
      city,
      venue,
    });
  }

  return matches;
}

/** Converte tabelas HTML em linhas de texto com células separadas por "|". */
export function htmlTablesToText(html: string): string {
  const withoutScripts = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ");

  const rows = withoutScripts.match(/<tr[\s\S]*?<\/tr>/gi) ?? [];
  const lines = rows.map((row) => {
    const cells = row.match(/<t[dh][\s\S]*?<\/t[dh]>/gi) ?? [];
    return cells
      .map((cell) =>
        cell
          .replace(/<[^>]+>/g, " ")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/\s+/g, " ")
          .trim(),
      )
      .filter(Boolean)
      .join(" | ");
  });

  if (lines.filter(Boolean).length > 0) return lines.join("\n");

  // fallback: texto puro da página
  return withoutScripts
    .replace(/<br\s*\/?>(\s*)/gi, "\n")
    .replace(/<\/(p|div|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}
