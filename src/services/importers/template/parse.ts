/**
 * Leitura do Modelo Oficial FotoPress a partir de XLSX ou PDF.
 *
 * Os cabeçalhos são a chave do formato: encontramos a linha de cabeçalho e
 * lemos cada linha seguinte como uma partida. Não há tentativa de interpretar
 * arquivos fora do modelo.
 */
import * as XLSX from "xlsx";

import { ImportError } from "../types";
import {
  IGNORED_SHEETS,
  TEMPLATE_COLUMNS,
  TEMPLATE_SHEET,
  fieldForHeader,
  normalizeHeader,
  normalizeImportedMatch,
  validateFotoPressTemplate,
  type TemplateContext,
  type TemplateDraft,
  type TemplateField,
  type TemplateRawRow,
} from "./schema";

export const TEMPLATE_MISMATCH = "Este arquivo não corresponde ao modelo oficial do FotoPress.";

export type TemplateParseResult = {
  fileName: string;
  fileHash: string;
  kind: "xlsx" | "pdf";
  drafts: TemplateDraft[];
  /** Linhas ignoradas por estarem vazias. */
  emptyRows: number;
};

const MAX_BYTES = 25 * 1024 * 1024;

export async function fileHash(file: File) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function templateKind(file: File): "xlsx" | "pdf" {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv")) return "xlsx";
  throw new ImportError("Envie o modelo oficial em PDF ou XLSX.");
}

function toDrafts(rows: TemplateRawRow[], context: TemplateContext) {
  const drafts: TemplateDraft[] = [];
  let emptyRows = 0;
  for (const row of rows) {
    const filled = Object.values(row).some((v) => (v ?? "").trim());
    if (!filled) {
      emptyRows += 1;
      continue;
    }
    drafts.push(normalizeImportedMatch(row, context));
  }
  return { drafts, emptyRows };
}

/** Converte uma matriz (cabeçalho + linhas) em rascunhos do modelo. */
export function parseFotoPressTemplate(matrix: string[][], context: TemplateContext) {
  const headerIndex = matrix.findIndex((row) => validateFotoPressTemplate(row).ok);
  if (headerIndex < 0) {
    const partial = matrix.find((row) => row.some((cell) => fieldForHeader(cell) !== null));
    const missing = partial ? validateFotoPressTemplate(partial).missing : [];
    throw new ImportError(
      missing.length > 0
        ? `${TEMPLATE_MISMATCH} Colunas obrigatórias ausentes: ${missing.join(", ")}.`
        : TEMPLATE_MISMATCH,
    );
  }

  const fields = matrix[headerIndex].map((h) => fieldForHeader(h));
  const rows: TemplateRawRow[] = [];
  for (const line of matrix.slice(headerIndex + 1)) {
    // Um novo cabeçalho no meio do arquivo (quebra de página do PDF) é ignorado.
    if (validateFotoPressTemplate(line).ok) continue;
    const row: TemplateRawRow = {};
    fields.forEach((field, i) => {
      if (field) row[field] = (line[i] ?? "").toString();
    });
    rows.push(row);
  }
  return toDrafts(rows, context);
}

function cellText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) {
    const d = value;
    if (d.getUTCHours() || d.getUTCMinutes()) {
      // célula de hora
      return `${`${d.getHours()}`.padStart(2, "0")}:${`${d.getMinutes()}`.padStart(2, "0")}`;
    }
    return `${`${d.getDate()}`.padStart(2, "0")}/${`${d.getMonth() + 1}`.padStart(2, "0")}/${d.getFullYear()}`;
  }
  return String(value).trim();
}

export async function readTemplateXlsx(file: File, context: TemplateContext) {
  if (file.size > MAX_BYTES) throw new ImportError("O arquivo excede o limite de 25 MB.");
  const workbook = XLSX.read(await file.arrayBuffer(), { cellDates: true });
  const names = workbook.SheetNames;
  const target =
    names.find((n) => normalizeHeader(n) === TEMPLATE_SHEET) ??
    names.find((n) => !IGNORED_SHEETS.includes(normalizeHeader(n)));
  if (!target) throw new ImportError(TEMPLATE_MISMATCH);

  const sheet = workbook.Sheets[target];
  const matrix = XLSX.utils
    .sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false, blankrows: true })
    .map((row) => row.map(cellText));
  return parseFotoPressTemplate(matrix, context);
}

type Item = { x: number; y: number; width: number; text: string };

/**
 * PDF do modelo oficial: as colunas são descobertas pela posição horizontal
 * dos cabeçalhos, então a leitura não depende de pixels exatos.
 */
export async function readTemplatePdf(file: File, context: TemplateContext) {
  if (file.size > MAX_BYTES) throw new ImportError("O PDF excede o limite de 25 MB.");

  const pdfjs = await import("pdfjs-dist");
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;

  let columns: { field: TemplateField; x: number }[] | null = null;
  const rows: TemplateRawRow[] = [];

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

    const lines = groupLines(items);
    for (const line of lines) {
      const header = headerColumns(line);
      if (header) {
        columns = header;
        continue;
      }
      if (!columns) continue;
      const row = rowFromLine(line, columns);
      if (row) rows.push(row);
    }
  }

  if (!columns) throw new ImportError(TEMPLATE_MISMATCH);
  return toDrafts(rows, context);
}

function groupLines(items: Item[]) {
  const buckets = new Map<number, Item[]>();
  for (const item of items) {
    const key = Math.round(item.y / 3) * 3;
    buckets.set(key, [...(buckets.get(key) ?? []), item]);
  }
  return [...buckets.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, bucket]) => bucket.sort((a, b) => a.x - b.x));
}

/** Reconhece a linha de cabeçalho e devolve a posição de cada coluna. */
function headerColumns(line: Item[]) {
  const found: { field: TemplateField; x: number }[] = [];
  for (const item of line) {
    const key = normalizeHeader(item.text);
    if (!key) continue;
    const column = TEMPLATE_COLUMNS.find((c) => {
      const header = normalizeHeader(c.header);
      return header === key || (key.length >= 4 && header.startsWith(key));
    });
    if (column && !found.some((f) => f.field === column.field)) {
      found.push({ field: column.field, x: item.x });
    }
  }
  const fields = new Set(found.map((f) => f.field));
  const complete = TEMPLATE_COLUMNS.filter((c) => c.required).every((c) => fields.has(c.field));
  return complete ? found.sort((a, b) => a.x - b.x) : null;
}

function rowFromLine(line: Item[], columns: { field: TemplateField; x: number }[]) {
  const row: TemplateRawRow = {};
  for (const item of line) {
    let index = 0;
    for (let i = 0; i < columns.length; i += 1) {
      if (item.x + 4 >= columns[i].x) index = i;
    }
    const field = columns[index].field;
    row[field] = `${row[field] ? `${row[field]} ` : ""}${item.text}`.trim();
  }
  const hasContent = Object.values(row).some((v) => (v ?? "").trim());
  return hasContent ? row : null;
}

/** Leitura completa de um arquivo enviado pelo usuário. */
export async function readTemplateFile(
  file: File,
  context: TemplateContext,
): Promise<TemplateParseResult> {
  const kind = templateKind(file);
  const { drafts, emptyRows } =
    kind === "pdf" ? await readTemplatePdf(file, context) : await readTemplateXlsx(file, context);
  if (drafts.length === 0) {
    throw new ImportError(
      `${TEMPLATE_MISMATCH} Nenhuma partida foi encontrada abaixo do cabeçalho.`,
    );
  }
  return { fileName: file.name, fileHash: await fileHash(file), kind, drafts, emptyRows };
}
