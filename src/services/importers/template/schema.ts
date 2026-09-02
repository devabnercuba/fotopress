/**
 * Modelo Oficial FotoPress — esquema único e compacto de importação por arquivo.
 *
 * O mesmo esquema é usado pelo XLSX (aba IMPORTAR_JOGOS) e pelo PDF exportado
 * a partir dele. Competição e temporada NÃO ficam no arquivo: vêm da Fonte de
 * Jogos selecionada. Se o arquivo não tiver os cabeçalhos obrigatórios, a
 * importação é recusada.
 */
import type { NormalizedMatch } from "../types";

export const TEMPLATE_XLSX = "/templates/Modelo_Oficial_FotoPress_Importacao_Jogos.xlsx";
export const TEMPLATE_PDF = "/templates/Modelo_Oficial_FotoPress_Importacao_Jogos.pdf";
export const TEMPLATE_SHEET = "IMPORTAR_JOGOS";
export const IGNORED_SHEETS = ["EXEMPLO", "INSTRUCOES"];

export type TemplateField =
  | "date"
  | "time"
  | "category"
  | "round"
  | "homeTeam"
  | "awayTeam"
  | "venue"
  | "city"
  | "state"
  | "notes";

export type TemplateColumn = {
  field: TemplateField;
  /** Cabeçalho oficial, sem o asterisco de obrigatoriedade. */
  header: string;
  label: string;
  required: boolean;
};

export const TEMPLATE_COLUMNS: TemplateColumn[] = [
  { field: "date", header: "DATA", label: "Data", required: true },
  { field: "time", header: "HORA", label: "Hora", required: true },
  { field: "category", header: "CATEGORIA", label: "Categoria", required: false },
  { field: "round", header: "RODADA", label: "Rodada", required: false },
  { field: "homeTeam", header: "MANDANTE", label: "Mandante", required: true },
  { field: "awayTeam", header: "VISITANTE", label: "Visitante", required: true },
  { field: "venue", header: "ESTADIO_LOCAL", label: "Estádio/Local", required: false },
  { field: "city", header: "CIDADE", label: "Cidade", required: false },
  { field: "state", header: "UF", label: "UF", required: false },
  { field: "notes", header: "OBSERVACOES", label: "Observações", required: false },
];

export const REQUIRED_HEADERS = TEMPLATE_COLUMNS.filter((c) => c.required).map((c) => c.header);

const UFS = [
  "AC",
  "AL",
  "AP",
  "AM",
  "BA",
  "CE",
  "DF",
  "ES",
  "GO",
  "MA",
  "MT",
  "MS",
  "MG",
  "PA",
  "PB",
  "PR",
  "PE",
  "PI",
  "RJ",
  "RN",
  "RS",
  "RO",
  "RR",
  "SC",
  "SP",
  "SE",
  "TO",
];

/** Cabeçalho normalizado: sem acentos, maiúsculas, sem asterisco nem pontuação. */
export function normalizeHeader(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/** Cabeçalho do arquivo → campo do modelo (null quando a coluna não é do modelo). */
export function fieldForHeader(value: string): TemplateField | null {
  const key = normalizeHeader(value);
  return TEMPLATE_COLUMNS.find((c) => normalizeHeader(c.header) === key)?.field ?? null;
}

export type TemplateValidation = {
  ok: boolean;
  missing: string[];
  /** Campos reconhecidos, na ordem em que aparecem no arquivo. */
  fields: (TemplateField | null)[];
};

/**
 * Verifica se a linha de cabeçalho corresponde ao modelo oficial.
 * Não tenta adivinhar colunas parecidas.
 */
export function validateFotoPressTemplate(headers: string[]): TemplateValidation {
  const fields = headers.map((h) => fieldForHeader(h));
  const present = new Set(fields.filter(Boolean) as TemplateField[]);
  const missing = TEMPLATE_COLUMNS.filter((c) => c.required && !present.has(c.field)).map(
    (c) => `${c.header}*`,
  );
  return { ok: missing.length === 0, missing, fields };
}

/** Uma linha do arquivo, ainda como texto, antes da validação. */
export type TemplateRawRow = Partial<Record<TemplateField, string>>;

/** Competição e temporada vêm da Fonte de Jogos, nunca do arquivo. */
export type TemplateContext = { competition: string; season: string };

export type TemplateDraft = {
  id: string;
  competition: string;
  season: string;
  /** ISO (YYYY-MM-DD) quando a data foi reconhecida. */
  date: string | null;
  dateRaw: string;
  time: string | null;
  timeRaw: string;
  category: string | null;
  round: string | null;
  homeTeam: string;
  awayTeam: string;
  venue: string | null;
  city: string | null;
  state: string | null;
  notes: string | null;
  errors: string[];
  selected: boolean;
};

const clean = (value: string | undefined) => (value ?? "").replace(/\s+/g, " ").trim();

/** dd/mm/aaaa (formato oficial) — aceita também ISO vindo de planilha. */
export function parseTemplateDate(value: string): string | null {
  const text = clean(value);
  if (!text) return null;
  const br = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (br) {
    const year = br[3].length === 2 ? `20${br[3]}` : br[3];
    const iso = `${year}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
    return isRealDate(iso) ? iso : null;
  }
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso && isRealDate(iso[0])) return iso[0];
  return null;
}

function isRealDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d || m > 12 || d > 31) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** hh:mm (aceita 19h30 e 19:30:00). Ausência nunca vira 00:00. */
export function parseTemplateTime(value: string): string | null {
  const text = clean(value).replace(/h/i, ":");
  if (!text) return null;
  const match = text.match(/^(\d{1,2})[:.](\d{2})/) ?? text.match(/^(\d{1,2})[:.]?$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2] ?? "0");
  if (!Number.isFinite(hour) || hour > 23 || minute > 59) return null;
  return `${`${hour}`.padStart(2, "0")}:${`${minute}`.padStart(2, "0")}`;
}

let counter = 0;

/** Linha crua do arquivo → rascunho editável do preview. */
export function normalizeImportedMatch(
  raw: TemplateRawRow,
  context: TemplateContext = { competition: "", season: "" },
): TemplateDraft {
  const dateRaw = clean(raw.date);
  const timeRaw = clean(raw.time);
  const uf = clean(raw.state).toUpperCase();
  counter += 1;
  const draft: TemplateDraft = {
    id: `tpl-${Date.now()}-${counter}`,
    competition: context.competition,
    season: context.season,
    date: parseTemplateDate(dateRaw),
    dateRaw,
    time: parseTemplateTime(timeRaw),
    timeRaw,
    category: clean(raw.category) || null,
    round: clean(raw.round) || null,
    homeTeam: clean(raw.homeTeam),
    awayTeam: clean(raw.awayTeam),
    venue: clean(raw.venue) || null,
    city: clean(raw.city) || null,
    state: uf || null,
    notes: clean(raw.notes) || null,
    errors: [],
    selected: true,
  };
  draft.errors = validateImportedMatch(draft);
  return draft;
}

/** Regras do modelo oficial. Campos ausentes nunca são inventados. */
export function validateImportedMatch(draft: TemplateDraft): string[] {
  const errors: string[] = [];
  if (!draft.date)
    errors.push(`Data inválida${draft.dateRaw ? ` (“${draft.dateRaw}”)` : ""} — use dd/mm/aaaa.`);
  if (!draft.time) errors.push("Informe o horário.");
  if (!draft.homeTeam) errors.push("Informe o mandante (MANDANTE).");
  if (!draft.awayTeam) errors.push("Informe o visitante (VISITANTE).");
  if (draft.state && !UFS.includes(draft.state)) errors.push(`UF “${draft.state}” não é válida.`);
  return errors;
}

/** Chave de duplicidade: competição + data + hora + mandante + visitante. */
export function duplicateKey(parts: {
  competition: string;
  date: string;
  time?: string | null;
  homeTeam: string;
  awayTeam: string;
}) {
  return [
    parts.competition.trim().toLowerCase(),
    parts.date,
    (parts.time ?? "").slice(0, 5),
    parts.homeTeam.trim().toLowerCase(),
    parts.awayTeam.trim().toLowerCase(),
  ].join("|");
}

/** Rascunho validado → contrato único de importação do FotoPress. */
export function draftToNormalizedMatch(
  draft: TemplateDraft,
  sourceFile?: string,
): NormalizedMatch | null {
  if (validateImportedMatch(draft).length > 0) return null;
  if (!draft.competition) return null;
  return {
    competition: draft.competition,
    date: draft.date!,
    time: draft.time!,
    homeTeam: draft.homeTeam,
    awayTeam: draft.awayTeam,
    city: draft.city ?? "",
    venue: draft.venue ?? "",
    state: draft.state ?? undefined,
    round: draft.round ?? undefined,
    category: draft.category ?? undefined,
    notes: draft.notes ?? undefined,
    season: draft.season,
    sourceFile,
  };
}
