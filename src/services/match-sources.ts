/**
 * Camada de serviços de importação de jogos.
 *
 * Toda importação futura (CBF, FCF, Futsal, PDF, Excel, CSV) deve produzir
 * um `RawMatch[]` e ser gravada na tabela `matches`, que é a fonte única
 * de dados do aplicativo. Nenhuma API está implementada ainda — apenas a
 * estrutura para que as fontes possam ser plugadas sem refatoração.
 */

export type MatchSourceId =
  "cbf-api" | "fcf-api" | "futsal-api" | "pdf" | "excel" | "csv" | "manual";

export type RawMatch = {
  competitionName: string;
  homeTeam: string;
  awayTeam: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  venue?: string;
  city?: string;
  state?: string;
};

export type ImportResult = {
  source: MatchSourceId;
  matches: RawMatch[];
};

export interface MatchSource {
  id: MatchSourceId;
  label: string;
  /** Rótulo gravado na coluna `source` da tabela `matches`. */
  sourceTag: string;
  fetchMatches(): Promise<ImportResult>;
}

function notImplemented(source: MatchSource): Promise<ImportResult> {
  return Promise.reject(new Error(`Fonte "${source.label}" ainda não implementada.`));
}

export const matchSources: MatchSource[] = [
  {
    id: "cbf-api",
    label: "API da CBF",
    sourceTag: "CBF API",
    fetchMatches() {
      return notImplemented(this);
    },
  },
  {
    id: "fcf-api",
    label: "API da FCF",
    sourceTag: "FCF API",
    fetchMatches() {
      return notImplemented(this);
    },
  },
  {
    id: "futsal-api",
    label: "Federação Catarinense de Futsal",
    sourceTag: "Futsal API",
    fetchMatches() {
      return notImplemented(this);
    },
  },
  {
    id: "pdf",
    label: "Arquivo PDF",
    sourceTag: "PDF",
    fetchMatches() {
      return notImplemented(this);
    },
  },
  {
    id: "excel",
    label: "Arquivo Excel",
    sourceTag: "Excel",
    fetchMatches() {
      return notImplemented(this);
    },
  },
  {
    id: "csv",
    label: "Importação CSV",
    sourceTag: "CSV",
    fetchMatches() {
      return notImplemented(this);
    },
  },
];
