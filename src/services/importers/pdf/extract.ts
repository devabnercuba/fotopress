import type { PdfLine } from "./types";

/**
 * Extração de conteúdo do PDF preservando a estrutura visual.
 *
 * Os itens de texto são agrupados por linha (coordenada vertical) e depois
 * divididos em células quando existe um espaço horizontal relevante entre
 * eles — é isso que permite reconstruir tabelas sem depender de posições
 * fixas de coluna.
 */

export const MAX_PDF_BYTES = 25 * 1024 * 1024;

export function validatePdfFile(file: File) {
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) throw new Error("Envie um arquivo PDF válido (.pdf).");
  if (file.size === 0) throw new Error("O arquivo está vazio.");
  if (file.size > MAX_PDF_BYTES) throw new Error("O PDF excede o limite de 25 MB.");
}

/** Identificação do arquivo, usada para detectar reimportação. */
export async function fileHash(file: File) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Item = { x: number; y: number; text: string; width: number };

function toLines(items: Item[], page: number): PdfLine[] {
  const rows = new Map<number, Item[]>();
  for (const item of items) {
    // tolerância vertical: itens quase alinhados pertencem à mesma linha
    const key = Math.round(item.y / 2) * 2;
    const bucket = rows.get(key) ?? [];
    bucket.push(item);
    rows.set(key, bucket);
  }

  return [...rows.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, bucket]) => {
      const sorted = bucket.sort((a, b) => a.x - b.x);
      const cells: string[] = [];
      let current = "";
      let previousEnd: number | null = null;
      for (const item of sorted) {
        const gap = previousEnd === null ? 0 : item.x - previousEnd;
        if (previousEnd !== null && gap > 12) {
          if (current.trim()) cells.push(current.trim());
          current = item.text;
        } else {
          current = current ? `${current}${gap > 1 ? " " : ""}${item.text}` : item.text;
        }
        previousEnd = item.x + item.width;
      }
      if (current.trim()) cells.push(current.trim());
      return {
        page,
        cells,
        text: cells.join(" ").replace(/\s+/g, " ").trim(),
      };
    })
    .filter((line) => line.text);
}

export async function extractPdfContent(file: File) {
  validatePdfFile(file);

  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const buffer = await file.arrayBuffer();
  const doc = await pdfjs.getDocument({ data: buffer }).promise;

  const lines: PdfLine[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    const items: Item[] = [];
    for (const raw of content.items as { str: string; width: number; transform: number[] }[]) {
      if (!("str" in raw) || !raw.str.trim()) continue;
      items.push({
        x: raw.transform[4],
        y: raw.transform[5],
        width: raw.width ?? raw.str.length * 4,
        text: raw.str.trim(),
      });
    }
    lines.push(...toLines(items, pageNumber));
  }

  return { lines, pages: doc.numPages, rawText: lines.map((l) => l.text).join("\n") };
}
