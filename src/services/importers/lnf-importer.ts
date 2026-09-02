import { fetchLnfSource, testLnfSource } from "@/lib/lnf-import.functions";

import { ImportError, type Importer, type ParseInput } from "./types";

/**
 * LNF
 *
 * URL oficial da tabela de jogos → leitura no servidor → NormalizedMatch[] →
 * ImportService. Uma única fonte cobre LNF, LNF Silver, Copa LNF e Talentos
 * LNF: a competição é identificada pela própria URL.
 */
export const lnfImporter: Importer = {
  id: "lnf",
  label: "LNF",
  sourceTag: "LNF",

  async test({ url, competition, season }: ParseInput) {
    if (!url) throw new ImportError("Informe a URL da tabela da LNF.");
    return testLnfSource({ data: { url, competition, season } });
  },

  async collect({ url, competition, season }: ParseInput) {
    if (!url) throw new ImportError("Informe a URL da tabela da LNF.");
    const result = await fetchLnfSource({ data: { url, competition, season } });
    if (!result.ok && result.matches.length === 0) throw new ImportError(result.message);
    return {
      matches: result.matches,
      errors: result.errors ?? [],
      found: result.found ?? result.matches.length,
    };
  },

  async parse(input: ParseInput) {
    return (await lnfImporter.collect!(input)).matches;
  },
};
