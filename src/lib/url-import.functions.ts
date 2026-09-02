import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { APP_URL } from "@/lib/app-url";
import { fetchCbfMatches, isCbfUrl } from "@/services/importers/cbf-source";
import { fetchFcfMatches, isFcfUrl } from "@/services/importers/fcf-source";
import { htmlTablesToText, parseMatchesFromText } from "@/services/importers/text-parser";
import type { ImportIssue, NormalizedMatch } from "@/services/importers/types";

const input = z.object({
  url: z.string().url("Informe uma URL válida."),
  competition: z.string().optional(),
});

export type UrlFetchResult = {
  ok: boolean;
  message: string;
  matches: NormalizedMatch[];
  /** Partidas que a origem publicou mas que não puderam ser importadas. */
  errors: ImportIssue[];
  /** Total de partidas encontradas na origem, incluindo as com problema. */
  found: number;
};

async function loadUrl(url: string, competition?: string): Promise<UrlFetchResult> {
  // Origem oficial da FCF (SisGol): leitura literal do relatório público.
  if (isFcfUrl(url)) {
    try {
      return await fetchFcfMatches(url, competition);
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Não foi possível ler a tabela da FCF.",
        matches: [],
        errors: [],
        found: 0,
      };
    }
  }

  // Origem oficial da CBF: leitura direta dos dados publicados, sem conversões.
  if (isCbfUrl(url)) {
    try {
      return await fetchCbfMatches(url, competition);
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Não foi possível ler a tabela da CBF.",
        matches: [],
        errors: [],
        found: 0,
      };
    }
  }

  let html = "";
  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": `Mozilla/5.0 (compatible; CoberturaBot/1.0; +${APP_URL})`,
        accept: "text/html,application/xhtml+xml",
      },
    });
    if (!response.ok) {
      return {
        ok: false,
        message: `A página respondeu com status ${response.status}.`,
        matches: [],
        errors: [],
        found: 0,
      };
    }
    html = await response.text();
  } catch {
    return {
      ok: false,
      message: "Não foi possível acessar esta URL.",
      matches: [],
      errors: [],
      found: 0,
    };
  }

  const text = htmlTablesToText(html);
  const matches = parseMatchesFromText(text, { competition });

  if (matches.length === 0) {
    return {
      ok: false,
      message: "Não foi possível interpretar esta URL.",
      matches: [],
      errors: [],
      found: 0,
    };
  }

  return {
    ok: true,
    message: `Fonte válida. Estrutura reconhecida. ${matches.length} jogos encontrados.`,
    matches,
    errors: [],
    found: matches.length,
  };
}

/** Testa a conectividade e a estrutura da página. */
export const testUrlSource = createServerFn({ method: "POST" })
  .inputValidator((data) => input.parse(data))
  .handler(async ({ data }) => {
    const result = await loadUrl(data.url, data.competition);
    return { ok: result.ok, message: result.message, found: result.found };
  });

/** Lê a página e devolve as partidas normalizadas. */
export const fetchUrlMatches = createServerFn({ method: "POST" })
  .inputValidator((data) => input.parse(data))
  .handler(async ({ data }) => loadUrl(data.url, data.competition));
