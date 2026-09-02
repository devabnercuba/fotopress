import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { loadRoster } from "@/services/athletes/cbf-roster-fetch.server";

/** Lê o elenco publicado na URL informada (sem CORS, no servidor). */
export const fetchRoster = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z.object({ url: z.string().url("Informe uma URL válida.") }).parse(data),
  )
  .handler(async ({ data }) => loadRoster(data.url));
