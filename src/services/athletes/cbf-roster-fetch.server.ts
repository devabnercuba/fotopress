import {
  extractCbfRosterTableText,
  isCbfChallenge,
  isCbfTeamPage,
  parseCbfHtml,
  parseCbfRosterText,
} from "./providers";
import {
  detectRosterImportProvider,
  providerLabel,
  type RosterErrorCode,
  type RosterResult,
} from "./types";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36";

const CBF_HEADERS = {
  accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
  "cache-control": "no-cache",
  referer: "https://www.cbf.com.br/",
  "user-agent": UA,
};

const READER_HEADERS = (apiKey: string) => ({
  accept: "text/plain",
  authorization: `Bearer ${apiKey}`,
  "x-no-cache": "true",
});

const DIRECT_TIMEOUT_MS = 15_000;
const READER_TIMEOUT_MS = 25_000;
const BLOCKED_MESSAGE = "Não conseguimos ler automaticamente a CBF neste momento.";

type AcquisitionDiagnostics = {
  direct_status: number | null;
  direct_error: string | null;
  reader_used: boolean;
  reader_status: number | null;
  reader_error: string | null;
  acquisition_mode: RosterResult["acquisitionMode"];
  url: string;
};

export type CbfRosterContent =
  | {
      ok: true;
      acquisitionMode: "direct";
      url: string;
      html: string;
      diagnostics: AcquisitionDiagnostics;
    }
  | {
      ok: true;
      acquisitionMode: "reader";
      url: string;
      tableText: string;
      teamName: string | null;
      teamState: string | null;
      diagnostics: AcquisitionDiagnostics;
    }
  | {
      ok: false;
      errorCode: RosterErrorCode;
      message: string;
      diagnostics: AcquisitionDiagnostics;
    };

function canonicalizeCbfRosterUrl(value: string): string | null {
  try {
    const parsed = new URL(value);
    const allowedHost = parsed.hostname === "cbf.com.br" || parsed.hostname === "www.cbf.com.br";
    if (parsed.protocol !== "https:" || !allowedHost) return null;
    if (!parsed.pathname.startsWith("/futebol-brasileiro/times/")) return null;
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

function logCbfAcquisition(diagnostics: AcquisitionDiagnostics) {
  console.info("Aquisição de elenco CBF", {
    provider: "CBF",
    direct_status: diagnostics.direct_status,
    direct_error: diagnostics.direct_error,
    reader_used: diagnostics.reader_used,
    reader_status: diagnostics.reader_status,
    reader_error: diagnostics.reader_error,
    acquisition_mode: diagnostics.acquisition_mode,
    url: diagnostics.url,
  });
}

async function requestCbfPage(url: string) {
  let currentUrl = url;
  for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
    if (!canonicalizeCbfRosterUrl(currentUrl)) {
      throw new Error("redirect_not_allowed");
    }

    const response = await fetch(currentUrl, {
      headers: CBF_HEADERS,
      redirect: "manual",
      signal: AbortSignal.timeout(DIRECT_TIMEOUT_MS),
    });
    if (response.status < 300 || response.status >= 400) return response;

    const location = response.headers.get("location");
    if (!location) throw new Error("redirect_without_location");
    currentUrl = new URL(location, currentUrl).toString();
  }
  throw new Error("too_many_redirects");
}

function failure(
  url: string,
  errorCode: RosterErrorCode,
  message: string,
  diagnostics: Omit<AcquisitionDiagnostics, "acquisition_mode" | "url">,
): CbfRosterContent {
  const result = {
    ok: false as const,
    errorCode,
    message,
    diagnostics: { ...diagnostics, acquisition_mode: null, url },
  };
  logCbfAcquisition(result.diagnostics);
  return result;
}

async function tryDirect(url: string) {
  const response = await requestCbfPage(url);
  const status = response.status;
  if (status === 403 || status === 429) {
    return { ok: false as const, status, error: `status_${status}` };
  }
  if (!response.ok) {
    return { ok: false as const, status, error: `status_${status}` };
  }

  const html = await response.text();
  if (isCbfChallenge(html)) return { ok: false as const, status, error: "challenge" };
  if (!isCbfTeamPage(html)) return { ok: false as const, status, error: "invalid_team_page" };
  return { ok: true as const, status, html };
}

async function tryReader(url: string, apiKey: string) {
  const response = await fetch(`https://r.jina.ai/${url}`, {
    headers: READER_HEADERS(apiKey),
    signal: AbortSignal.timeout(READER_TIMEOUT_MS),
  });
  const status = response.status;
  if (!response.ok) return { ok: false as const, status, error: `status_${status}` };

  const body = await response.text();
  if (isCbfChallenge(body)) return { ok: false as const, status, error: "challenge" };
  const extracted = extractCbfRosterTableText(body);
  if (!extracted) return { ok: false as const, status, error: "roster_table_not_found" };
  return { ok: true as const, status, ...extracted };
}

/** Aquisição server-side: CBF direta; se bloquear, Reader autenticado; sem loops. */
export async function fetchCbfRosterContent(inputUrl: string): Promise<CbfRosterContent> {
  const url = canonicalizeCbfRosterUrl(inputUrl);
  if (!url) {
    return failure(inputUrl, "INVALID_CBF_URL", "Utilize uma página oficial de clube da CBF.", {
      direct_status: null,
      direct_error: "invalid_url",
      reader_used: false,
      reader_status: null,
      reader_error: null,
    });
  }

  let directStatus: number | null = null;
  let directError: string | null = null;
  let readerStatus: number | null = null;
  let readerError: string | null = null;

  try {
    const direct = await tryDirect(url);
    directStatus = direct.status;
    if (direct.ok) {
      const diagnostics = {
        direct_status: directStatus,
        direct_error: null,
        reader_used: false,
        reader_status: null,
        reader_error: null,
        acquisition_mode: "direct" as const,
        url,
      };
      logCbfAcquisition(diagnostics);
      return { ok: true, acquisitionMode: "direct", url, html: direct.html, diagnostics };
    }
    directError = direct.error;
  } catch (error) {
    directError = error instanceof Error ? error.message : "request_failed";
  }

  const apiKey = process.env["JINA_API_KEY"];
  if (!apiKey) {
    return failure(url, "CBF_ACCESS_BLOCKED", BLOCKED_MESSAGE, {
      direct_status: directStatus,
      direct_error: directError,
      reader_used: false,
      reader_status: null,
      reader_error: "missing_api_key",
    });
  }

  try {
    const reader = await tryReader(url, apiKey);
    readerStatus = reader.status;
    if (reader.ok) {
      const diagnostics = {
        direct_status: directStatus,
        direct_error: directError,
        reader_used: true,
        reader_status: readerStatus,
        reader_error: null,
        acquisition_mode: "reader" as const,
        url,
      };
      logCbfAcquisition(diagnostics);
      return {
        ok: true,
        acquisitionMode: "reader",
        url,
        tableText: reader.tableText,
        teamName: reader.teamName,
        teamState: reader.teamState,
        diagnostics,
      };
    }
    readerError = reader.error;
  } catch (error) {
    readerError = error instanceof Error ? error.message : "request_failed";
  }

  return failure(url, "CBF_ACCESS_BLOCKED", BLOCKED_MESSAGE, {
    direct_status: directStatus,
    direct_error: directError,
    reader_used: true,
    reader_status: readerStatus,
    reader_error: readerError,
  });
}

function rosterFailure(
  provider: "cbf" | null,
  errorCode: RosterErrorCode,
  message: string,
): RosterResult {
  return {
    ok: false,
    message,
    errorCode,
    acquisitionMode: null,
    provider,
    providerLabel: providerLabel(provider),
    teamName: null,
    teamState: null,
    athletes: [],
  };
}

/** Ponto de entrada das novas importações automáticas: somente CBF. */
export async function loadRoster(url: string): Promise<RosterResult> {
  const provider = detectRosterImportProvider(url);
  if (!provider)
    return rosterFailure(null, "INVALID_CBF_URL", "Utilize uma página oficial de clube da CBF.");

  const content = await fetchCbfRosterContent(url);
  if (!content.ok) return rosterFailure(provider, content.errorCode, content.message);

  try {
    if (content.acquisitionMode === "direct") return parseCbfHtml(content.html, content.url);

    const roster = parseCbfRosterText(content.tableText, {
      url: content.url,
      teamName: content.teamName,
      teamState: content.teamState,
      acquisitionMode: "reader",
    });
    if (!roster.ok) return rosterFailure(provider, "CBF_ACCESS_BLOCKED", BLOCKED_MESSAGE);
    return {
      ...roster,
      message: `${roster.athletes.length} atletas encontrados na página da CBF.`,
      acquisitionMode: "reader",
    };
  } catch {
    return rosterFailure(
      provider,
      "CBF_PARSE_FAILED",
      "Não foi possível interpretar o elenco desta página.",
    );
  }
}
