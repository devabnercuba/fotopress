import { parsePdfText } from "./pdf/engine";
import { draftsToMatches } from "./pdf/normalize";
import type { ImportIssue, NormalizedMatch } from "./types";

/**
 * Compatibilidade: leitura de tabelas de jogos a partir de texto puro.
 * A interpretação real vive em `pdf/engine.ts` (motor universal).
 */
export function parsePdfMatches(
  text: string,
  options: { competition?: string } = {},
): { matches: NormalizedMatch[]; errors: ImportIssue[]; found: number } {
  const result = parsePdfText(text, options);
  const { matches, errors } = draftsToMatches(result.matches);
  return {
    matches,
    errors: [
      ...errors,
      ...result.unparsed.map((line) => ({
        match: line.slice(0, 80),
        reason: "Não foi possível identificar os clubes.",
      })),
    ],
    found: result.report.detected,
  };
}
