import { fetchUrlMatches, testUrlSource } from "@/lib/url-import.functions";

import { ImportError, type Importer, type ParseInput } from "./types";

/**
 * URLImporter
 *
 * URL → lê a origem no servidor (sem CORS) → NormalizedMatch[] → ImportService.
 *
 * O servidor escolhe o parser pela origem da URL:
 *   cbf.com.br → cbf-source.ts
 *   fcf.com.br (SisGol) → fcf-source.ts
 *   demais URLs → parser genérico de tabelas HTML.
 *
 * Em todos os casos os dados publicados (data, hora, estádio, cidade e UF)
 * são gravados sem qualquer conversão.
 */
export const urlImporter: Importer = {
  id: "url",
  label: "URL de tabela",
  sourceTag: "URL",

  async test({ url, competition }: ParseInput) {
    if (!url) throw new ImportError("Informe a URL da tabela.");
    return testUrlSource({ data: { url, competition } });
  },

  async collect({ url, competition }: ParseInput) {
    if (!url) throw new ImportError("Informe a URL da tabela.");
    const result = await fetchUrlMatches({ data: { url, competition } });
    if (!result.ok && result.matches.length === 0) throw new ImportError(result.message);
    return {
      matches: result.matches,
      errors: result.errors ?? [],
      found: result.found ?? result.matches.length,
    };
  },

  async parse(input: ParseInput) {
    return (await urlImporter.collect!(input)).matches;
  },
};
