/**
 * Contrato único de importação de atletas.
 *
 * Qualquer provider (CBF, site oficial de clube…) devolve exatamente esta
 * forma. O restante do sistema não sabe de onde os dados vieram — apenas
 * recebe uma lista normalizada com **informação pública**.
 *
 * Campos privados/comerciais (telefone, WhatsApp, e-mail, Instagram,
 * relacionamento, notas, status) NUNCA são preenchidos por importação.
 */
export type NormalizedAthlete = {
  /** Identificador estável do atleta na origem, quando publicado. */
  externalId?: string | null;
  provider: AthleteProviderId;
  sourceUrl: string;
  /** Nome de exibição (apelido quando a fonte prioriza o apelido). */
  name: string;
  fullName?: string | null;
  nickname?: string | null;
  /** Clube da página consultada. */
  teamName?: string | null;
  /** Clube atual informado pela fonte (pode divergir do clube da página). */
  currentTeamName?: string | null;
  position?: string | null;
  shirtNumber?: number | null;
  sport?: string | null;
  category?: string | null;
  photoUrl?: string | null;
};

/**
 * Providers históricos permanecem no tipo para não invalidar registros já
 * gravados. Novas importações aceitam somente `cbf`.
 */
export type AthleteProviderId = "cbf" | "avai" | "sport" | "barra" | "figueirense";

/** Estado estruturado: a UI decide o que mostrar sem interpretar mensagens. */
export type RosterErrorCode =
  "CBF_ACCESS_BLOCKED" | "INVALID_CBF_URL" | "CBF_PARSE_FAILED" | "NETWORK_ERROR";

export type RosterResult = {
  ok: boolean;
  message: string;
  errorCode?: RosterErrorCode | null;
  /** Diagnóstico interno da aquisição automática/manual. Não é exibido na UI. */
  acquisitionMode?: "direct" | "reader" | "paste" | null;
  provider: AthleteProviderId | null;
  providerLabel: string;
  /** Clube identificado na página. */
  teamName: string | null;
  teamState: string | null;
  athletes: NormalizedAthlete[];
};

export const ATHLETE_PROVIDERS: {
  id: AthleteProviderId;
  label: string;
  hostPattern: RegExp;
  example: string;
}[] = [
  {
    id: "cbf",
    label: "CBF",
    hostPattern: /(^|\.)cbf\.com\.br$/i,
    example: "https://www.cbf.com.br/futebol-brasileiro/times/…",
  },
  {
    id: "avai",
    label: "Avaí — Site oficial",
    hostPattern: /(^|\.)avai\.com\.br$/i,
    example: "https://avai.com.br/futebol/profissional/",
  },
  {
    id: "sport",
    label: "Sport Recife — Site oficial",
    hostPattern: /(^|\.)sportrecife\.com\.br$/i,
    example: "https://sportrecife.com.br/jogadores/",
  },
  {
    id: "barra",
    label: "Barra FC — Site oficial",
    hostPattern: /(^|\.)barrafc\.com\.br$/i,
    example: "https://www.barrafc.com.br/elenco-profissional",
  },
  {
    id: "figueirense",
    label: "Figueirense — Site oficial",
    hostPattern: /(^|\.)figueirense\.com\.br$/i,
    example: "https://figueirense.com.br/#atletas",
  },
];

/** Detecta o provider pela URL. Nunca "adivinha" sites desconhecidos. */
export function detectAthleteProvider(url: string): AthleteProviderId | null {
  try {
    const host = new URL(url).hostname;
    return ATHLETE_PROVIDERS.find((p) => p.hostPattern.test(host))?.id ?? null;
  } catch {
    return null;
  }
}

export function providerLabel(id: AthleteProviderId | null | undefined) {
  return ATHLETE_PROVIDERS.find((p) => p.id === id)?.label ?? "Fonte";
}

/** Modalidade padrão das fontes atuais. */
export const DEFAULT_ATHLETE_SPORT = "futebol";

/**
 * Provider aceito em NOVAS importações: somente páginas públicas de clube
 * da CBF. Sites de clubes não são mais oferecidos.
 */
export function detectRosterImportProvider(url: string): "cbf" | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    const allowedHost = host === "cbf.com.br" || host === "www.cbf.com.br";
    return allowedHost && parsed.pathname.startsWith("/futebol-brasileiro/times/") ? "cbf" : null;
  } catch {
    return null;
  }
}
