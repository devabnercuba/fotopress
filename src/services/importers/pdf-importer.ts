import { parsePdfLines } from "./pdf/engine";
import { extractPdfContent, fileHash, validatePdfFile } from "./pdf/extract";
import { draftsToMatches } from "./pdf/normalize";
import type { PdfParseResult } from "./pdf/types";
import {
  ImportError,
  type CollectResult,
  type Importer,
  type NormalizedMatch,
  type ParseInput,
} from "./types";

/**
 * PDFImporter universal.
 *
 * UPLOAD → EXTRAÇÃO (texto + posição) → DETECÇÃO DE ESTRUTURA →
 * IDENTIFICAÇÃO DE PARTIDAS → NORMALIZAÇÃO → PREVIEW → IMPORTAÇÃO.
 *
 * A interpretação é feita por `pdf/engine.ts`, que reconhece tanto tabelas de
 * federação (blocos "Jogo nº N") quanto tabelas municipais em linhas com a
 * data no cabeçalho da seção.
 */
export type PdfDocumentResult = PdfParseResult & {
  fileName: string;
  fileHash: string;
};

export async function readPdfDocument(
  file: File,
  competition?: string,
  onProgress?: (stage: string) => void,
): Promise<PdfDocumentResult> {
  validatePdfFile(file);

  onProgress?.("Lendo PDF…");
  let extracted: Awaited<ReturnType<typeof extractPdfContent>>;
  try {
    extracted = await extractPdfContent(file);
  } catch (error) {
    if (error instanceof Error && /limite|válido|vazio/i.test(error.message)) throw error;
    throw new ImportError(
      "Não foi possível ler este PDF. Verifique se o arquivo não está protegido.",
    );
  }

  if (!extracted.rawText.trim()) {
    throw new ImportError(
      "Este PDF não contém texto selecionável (provavelmente é uma imagem digitalizada).",
    );
  }

  onProgress?.("Identificando jogos…");
  const parsed = parsePdfLines(extracted.lines, {
    competition,
    pages: extracted.pages,
    rawText: extracted.rawText,
  });

  onProgress?.("Normalizando dados…");
  const hash = await fileHash(file);

  return { ...parsed, fileName: file.name, fileHash: hash };
}

/** Leitura detalhada usada pelo fluxo antigo (sem preview editável). */
export async function collectPdf(file: File, competition?: string): Promise<CollectResult> {
  const document = await readPdfDocument(file, competition);
  const { matches, errors } = draftsToMatches(document.matches);
  if (matches.length === 0) {
    throw new ImportError(
      "Não conseguimos interpretar automaticamente esta tabela. Revise o conteúdo detectado antes de importar.",
    );
  }
  return {
    matches,
    errors: [
      ...errors,
      ...document.unparsed.map((line) => ({
        match: line.slice(0, 80),
        reason: "Linha não interpretada.",
      })),
    ],
    found: document.report.detected,
  };
}

export async function parsePdf(file: File, competition?: string): Promise<NormalizedMatch[]> {
  return (await collectPdf(file, competition)).matches;
}

export const pdfImporter: Importer = {
  id: "pdf",
  label: "PDF",
  sourceTag: "PDF",
  async collect({ file, competition }: ParseInput) {
    if (!file) throw new ImportError("Selecione um arquivo .pdf.");
    return collectPdf(file, competition);
  },
  async parse({ file, competition }: ParseInput) {
    if (!file) throw new ImportError("Selecione um arquivo .pdf.");
    return parsePdf(file, competition);
  },
};
