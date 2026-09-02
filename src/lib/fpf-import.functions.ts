import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { fetchFpfMatches, listFpfCompetitions, parseFpfUrl } from "@/services/importers/fpf-source";

const seasonInput = z.object({
  season: z.string().regex(/^\d{4}$/, "Informe a temporada com 4 dígitos."),
});

const sourceInput = z.object({
  url: z.string().min(1, "Informe a competição da FPF."),
  competition: z.string().optional(),
});

const empty = (message: string) => ({
  ok: false,
  message,
  matches: [],
  errors: [],
  found: 0,
  rounds: 0,
});

/** Competições publicadas pela FPF na temporada escolhida. */
export const listFpfCompetitionsFn = createServerFn({ method: "POST" })
  .inputValidator((data) => seasonInput.parse(data))
  .handler(async ({ data }) => {
    try {
      return { ok: true, message: "", competitions: await listFpfCompetitions(data.season) };
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível carregar as competições da FPF.",
        competitions: [],
      };
    }
  });

/** Calendário completo (todas as rodadas) da competição FPF selecionada. */
export const fetchFpfSource = createServerFn({ method: "POST" })
  .inputValidator((data) => sourceInput.parse(data))
  .handler(async ({ data }) => {
    const target = parseFpfUrl(data.url);
    if (!target) return empty("Esta URL não é uma tabela de jogos oficial da FPF.");
    try {
      return await fetchFpfMatches(target, { competition: data.competition });
    } catch (error) {
      return empty(
        error instanceof Error ? error.message : "Não foi possível sincronizar a fonte FPF.",
      );
    }
  });

/** Testa a conectividade e a estrutura da tabela da FPF. */
export const testFpfSource = createServerFn({ method: "POST" })
  .inputValidator((data) => sourceInput.parse(data))
  .handler(async ({ data }) => {
    const target = parseFpfUrl(data.url);
    if (!target) {
      return { ok: false, message: "Esta URL não é uma tabela de jogos oficial da FPF.", found: 0 };
    }
    try {
      const result = await fetchFpfMatches(target, { competition: data.competition });
      return { ok: result.ok, message: result.message, found: result.found };
    } catch (error) {
      return {
        ok: false,
        message:
          error instanceof Error ? error.message : "Não foi possível acessar a tabela da FPF.",
        found: 0,
      };
    }
  });
