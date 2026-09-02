/**
 * Contrato único de importação.
 *
 * Qualquer origem de dados (Excel, CSV, URL, PDF, API…) deve entregar
 * exatamente este objeto. O restante do sistema não sabe de onde os dados
 * vieram — apenas recebe uma lista de partidas normalizadas.
 */
export type NormalizedMatch = {
  competition: string;
  date: string; // YYYY-MM-DD (mesmo dia/mês/ano publicado pela origem)
  time: string; // HH:mm exatamente como publicado
  homeTeam: string;
  awayTeam: string;
  city: string;
  venue: string;
  /** UF publicada pela origem, quando existir. Nunca inferida. */
  state?: string;
  /** Identificador estável da partida na origem (ex.: id da CBF). */
  externalId?: string;
  /** Rodada publicada pela origem, quando existir. Nunca inferida. */
  round?: string;
  /** Número do jogo na tabela publicada ("Jogo nº 12"). */
  matchNumber?: string;
  /** Categoria, grupo e fase publicados pela origem. */
  category?: string;
  group?: string;
  phase?: string;
  /** Placar quando a tabela já traz o resultado. */
  homeScore?: number | null;
  awayScore?: number | null;
  /** Transmissão informada pela tabela (metadado opcional). */
  broadcast?: string;
  /** Situação publicada (AGENDADO, CONCLUIDO, ADIADO, CANCELADO, A DEFINIR). */
  matchStatus?: string;
  /** Observações publicadas pela origem. */
  notes?: string;
  /** Temporada publicada pela origem. */
  season?: string;
  /** Participantes ainda indefinidos ("1º colocado"). */
  participantsTbd?: boolean;
  /** Arquivo de onde a partida veio. */
  sourceFile?: string;

  /** Escudos publicados pela origem (informação complementar). */
  homeLogo?: string | null;
  awayLogo?: string | null;
};

/** Falha de uma partida específica durante a leitura/gravação. */
export type ImportIssue = { match: string; reason: string };


/** Alias público do contrato (mesma forma, nome pedido na especificação). */
export type ImportedMatch = NormalizedMatch;

export type SourceType = "excel" | "csv" | "url" | "lnf" | "fpf" | "pdf" | "manual";

export type ParseInput = {
  file?: File;
  url?: string;
  /** Competição padrão quando a origem não traz o nome do campeonato. */
  competition?: string;
  /** Temporada da fonte: origens com histórico só importam o ano escolhido. */
  season?: string;
};

export type CollectResult = {
  matches: NormalizedMatch[];
  errors: ImportIssue[];
  /** Total encontrado na origem, incluindo partidas com problema. */
  found: number;
};

export interface Importer {
  id: SourceType;
  label: string;
  /** Rótulo gravado na coluna `source` da tabela `matches`. */
  sourceTag: string;
  /** Origens que aceitam um teste de conectividade/estrutura antes de sincronizar. */
  test?(input: ParseInput): Promise<{ ok: boolean; message: string; found: number }>;
  /** Leitura detalhada (com o que foi encontrado e o que falhou). */
  collect?(input: ParseInput): Promise<CollectResult>;
  parse(input: ParseInput): Promise<NormalizedMatch[]>;
}


export class ImportError extends Error {}
