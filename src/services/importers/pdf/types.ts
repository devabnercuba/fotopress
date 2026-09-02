/**
 * Modelo intermediário do importador universal de PDF.
 *
 * Cada partida detectada vira um rascunho editável (`PdfDraftMatch`) que o
 * usuário confirma na pré-visualização antes de virar `NormalizedMatch`.
 *
 * Regra de ouro: nada é inventado. Campo ausente no documento fica `null`.
 */

export type Confidence = "alta" | "media" | "baixa";

export type PdfLine = {
  /** Página (1-based) de onde a linha veio. */
  page: number;
  /** Células reconstruídas por posição horizontal. */
  cells: string[];
  /** Texto completo da linha. */
  text: string;
};

export type PdfDraftMatch = {
  id: string;
  /** Número do jogo publicado pela tabela ("Jogo nº 12" → "12"). */
  matchNumber: string | null;
  date: string | null; // YYYY-MM-DD
  dateStatus: "defined" | "tbd";
  time: string | null; // HH:mm
  homeTeam: string;
  awayTeam: string;
  homeScore: number | null;
  awayScore: number | null;
  /** Participantes ainda indefinidos ("1º colocado", "VEN Semi J01"). */
  participantsTbd: boolean;
  competition: string;
  category: string | null;
  group: string | null;
  phase: string | null;
  roundLabel: string | null;
  venue: string | null;
  city: string | null;
  state: string | null;
  /** Sugerido pelo cabeçalho do documento, não pelo jogo. */
  stateInferred: boolean;
  broadcast: string | null;
  status: "scheduled" | "completed";
  confidence: Confidence;
  warnings: string[];
  /** Trecho original do PDF que gerou a partida. */
  raw: string;
};

export type PdfParseReport = {
  pages: number;
  strategy: "TABLE" | "TEXT_BLOCK" | "MIXED";
  detected: number;
  withDate: number;
  tbdDate: number;
  withTime: number;
  tbdParticipants: number;
  withVenue: number;
  warnings: number;
};

export type PdfParseResult = {
  competition: string | null;
  matches: PdfDraftMatch[];
  report: PdfParseReport;
  /** Linhas que pareciam partidas mas não puderam ser lidas. */
  unparsed: string[];
  /** Texto bruto extraído, usado no modo de revisão manual. */
  rawText: string;
};
