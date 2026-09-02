import * as XLSX from "xlsx";

import { ImportError, type Importer, type NormalizedMatch, type ParseInput } from "./types";

const COLUMNS = {
  date: ["data", "date"],
  time: ["hora", "horario", "horário", "time"],
  homeTeam: ["mandante", "casa", "time a", "home", "hometeam"],
  awayTeam: ["visitante", "fora", "time b", "away", "awayteam"],
  competition: ["competicao", "competição", "campeonato", "competition"],
  city: ["cidade", "city"],
  venue: ["local", "estadio", "estádio", "ginasio", "ginásio", "venue"],
} as const;

const REQUIRED: (keyof typeof COLUMNS)[] = ["date", "time", "homeTeam", "awayTeam", "competition"];

const LABELS: Record<keyof typeof COLUMNS, string> = {
  date: "Data",
  time: "Hora",
  homeTeam: "Mandante",
  awayTeam: "Visitante",
  competition: "Competição",
  city: "Cidade",
  venue: "Local",
};

function normalizeKey(key: string) {
  return key
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function mapHeaders(headers: string[]) {
  const map = new Map<keyof typeof COLUMNS, string>();
  for (const header of headers) {
    const normalized = normalizeKey(header);
    for (const [field, aliases] of Object.entries(COLUMNS) as [
      keyof typeof COLUMNS,
      readonly string[],
    ][]) {
      if (!map.has(field) && aliases.some((alias) => normalizeKey(alias) === normalized)) {
        map.set(field, header);
      }
    }
  }
  return map;
}

function toText(value: unknown) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function parseDate(value: unknown): string {
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = `${value.getMonth() + 1}`.padStart(2, "0");
    const d = `${value.getDate()}`.padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  const text = toText(value);
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (br) {
    const year = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${year}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  }
  return "";
}

function parseTime(value: unknown): string {
  if (value instanceof Date) {
    return `${`${value.getHours()}`.padStart(2, "0")}:${`${value.getMinutes()}`.padStart(2, "0")}`;
  }
  if (typeof value === "number" && value > 0 && value < 1) {
    const total = Math.round(value * 24 * 60);
    return `${`${Math.floor(total / 60)}`.padStart(2, "0")}:${`${total % 60}`.padStart(2, "0")}`;
  }
  const text = toText(value).replace("h", ":").replace(/\s/g, "");
  const match = text.match(/^(\d{1,2})[:.]?(\d{2})?/);
  if (!match) return "";
  return `${match[1].padStart(2, "0")}:${(match[2] ?? "00").padStart(2, "0")}`;
}

export async function parseSpreadsheet(file: File): Promise<NormalizedMatch[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { cellDates: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw new ImportError("Não foi possível ler nenhuma aba do arquivo.");

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (rows.length === 0) throw new ImportError("O arquivo não contém linhas de dados.");

  const headerMap = mapHeaders(Object.keys(rows[0]));
  const missing = REQUIRED.filter((field) => !headerMap.has(field));
  if (missing.length > 0) {
    throw new ImportError(
      `Colunas obrigatórias ausentes: ${missing.map((f) => LABELS[f]).join(", ")}.`,
    );
  }

  const get = (row: Record<string, unknown>, field: keyof typeof COLUMNS) => {
    const key = headerMap.get(field);
    return key ? row[key] : "";
  };

  const matches: NormalizedMatch[] = [];
  rows.forEach((row, index) => {
    const homeTeam = toText(get(row, "homeTeam"));
    const awayTeam = toText(get(row, "awayTeam"));
    if (!homeTeam && !awayTeam) return; // linha vazia — ignora

    const date = parseDate(get(row, "date"));
    const time = parseTime(get(row, "time"));
    if (!date) throw new ImportError(`Data inválida na linha ${index + 2}.`);

    matches.push({
      competition: toText(get(row, "competition")),
      date,
      time: time || "19:00",
      homeTeam,
      awayTeam,
      city: toText(get(row, "city")),
      venue: toText(get(row, "venue")),
    });
  });

  if (matches.length === 0) throw new ImportError("Nenhuma partida encontrada no arquivo.");
  return matches;
}

export const excelImporter: Importer = {
  id: "excel",
  label: "Excel (.xlsx)",
  sourceTag: "Excel",
  async parse({ file }: ParseInput) {
    if (!file) throw new ImportError("Selecione um arquivo .xlsx.");
    return parseSpreadsheet(file);
  },
};

export const csvImporter: Importer = {
  id: "csv",
  label: "CSV",
  sourceTag: "CSV",
  async parse({ file }: ParseInput) {
    if (!file) throw new ImportError("Selecione um arquivo .csv.");
    return parseSpreadsheet(file);
  },
};
