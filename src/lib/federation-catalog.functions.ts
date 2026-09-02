import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { listCbfCompetitions } from "@/services/importers/cbf-catalog";
import { listFcfCompetitions, resolveFcfTableUrl } from "@/services/importers/fcf-catalog";

const seasonInput = z.object({
  season: z.string().regex(/^\d{4}$/, "Informe a temporada com 4 dígitos."),
});

const pageInput = z.object({ url: z.string().url("Informe a página oficial da competição.") });

const failure = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

/** Competições publicadas no portal oficial de credenciamento da CBF. */
export const listCbfCompetitionsFn = createServerFn({ method: "POST" }).handler(async () => {
  try {
    return { ok: true, message: "", competitions: await listCbfCompetitions() };
  } catch (error) {
    return {
      ok: false,
      message: failure(error, "Não foi possível carregar as competições oficiais."),
      competitions: [],
    };
  }
});

/** Competições publicadas pela FCF na temporada escolhida. */
export const listFcfCompetitionsFn = createServerFn({ method: "POST" })
  .inputValidator((data) => seasonInput.parse(data))
  .handler(async ({ data }) => {
    try {
      return { ok: true, message: "", competitions: await listFcfCompetitions(data.season) };
    } catch (error) {
      return {
        ok: false,
        message: failure(error, "Não foi possível carregar as competições oficiais."),
        competitions: [],
      };
    }
  });

/** Resolve o endereço da tabela (eGol/SisGol) da competição escolhida. */
export const resolveFcfTableFn = createServerFn({ method: "POST" })
  .inputValidator((data) => pageInput.parse(data))
  .handler(async ({ data }) => {
    try {
      return { ok: true, message: "", url: await resolveFcfTableUrl(data.url) };
    } catch (error) {
      return {
        ok: false,
        message: failure(error, "Não foi possível localizar a tabela desta competição."),
        url: "",
      };
    }
  });
