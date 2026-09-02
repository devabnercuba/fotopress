import { fetchFpfSource, testFpfSource } from "@/lib/fpf-import.functions";

import { ImportError, type Importer, type ParseInput } from "./types";

/**
 * FPF
 *
 * Competição oficial escolhida na fonte → leitura no servidor (todas as
 * rodadas de uma vez) → NormalizedMatch[] → ImportService.
 */
export const fpfImporter: Importer = {
  id: "fpf",
  label: "FPF",
  sourceTag: "FPF",

  async test({ url, competition }: ParseInput) {
    if (!url) throw new ImportError("Selecione a competição da FPF.");
    return testFpfSource({ data: { url, competition } });
  },

  async collect({ url, competition }: ParseInput) {
    if (!url) throw new ImportError("Selecione a competição da FPF.");
    const result = await fetchFpfSource({ data: { url, competition } });
    if (!result.ok && result.matches.length === 0) throw new ImportError(result.message);
    return {
      matches: result.matches,
      errors: result.errors ?? [],
      found: result.found ?? result.matches.length,
    };
  },

  async parse(input: ParseInput) {
    return (await fpfImporter.collect!(input)).matches;
  },
};
