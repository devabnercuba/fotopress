import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { fetchLnfMatches, validateLnfUrl } from "@/services/importers/lnf-source";

const input = z.object({
  url: z.string().url("Informe uma URL válida."),
  competition: z.string().optional(),
  season: z.string().optional(),
});

/**
 * Leitura da tabela oficial da LNF no servidor (sem CORS e sem expor o site
 * ao navegador do usuário). Aceita somente URLs de tabelas da LNF.
 */
export const fetchLnfSource = createServerFn({ method: "POST" })
  .inputValidator((data) => input.parse(data))
  .handler(async ({ data }) => {
    if (!validateLnfUrl(data.url)) {
      return {
        ok: false,
        message: "Esta URL não é uma tabela de jogos oficial da LNF.",
        matches: [],
        errors: [],
        found: 0,
      };
    }
    try {
      return await fetchLnfMatches(data.url, {
        competition: data.competition,
        season: data.season,
      });
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error ? error.message : "Não foi possível sincronizar a fonte LNF.",
        matches: [],
        errors: [],
        found: 0,
      };
    }
  });

/** Testa a conectividade e a estrutura da tabela da LNF. */
export const testLnfSource = createServerFn({ method: "POST" })
  .inputValidator((data) => input.parse(data))
  .handler(async ({ data }) => {
    if (!validateLnfUrl(data.url)) {
      return { ok: false, message: "Esta URL não é uma tabela de jogos oficial da LNF.", found: 0 };
    }
    try {
      const result = await fetchLnfMatches(data.url, {
        competition: data.competition,
        season: data.season,
      });
      return { ok: result.ok, message: result.message, found: result.found };
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error ? error.message : "Não foi possível acessar a tabela da LNF.",
        found: 0,
      };
    }
  });
