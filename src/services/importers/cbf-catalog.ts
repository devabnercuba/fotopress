import { APP_URL } from "@/lib/app-url";

/**
 * Catálogo oficial de competições da CBF.
 *
 * Uma única leitura do portal público de credenciamento
 * (https://credencial.cbf.com.br/competicoes/) para montar o seletor de
 * competições. O importador continua sendo o `cbf-source.ts` já existente —
 * aqui só descobrimos a URL certa para o usuário não precisar copiá-la.
 */

const UA = `Mozilla/5.0 (compatible; CoberturaBot/1.0; +${APP_URL})`;
const CATALOG_URL = "https://credencial.cbf.com.br/competicoes/";
const BASE = "https://credencial.cbf.com.br";

export type CbfCompetition = {
  /** `42-1` (identificadores presentes no path da URL oficial). */
  id: string;
  label: string;
  url: string;
};

const decode = (value: string) =>
  value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");

const clean = (value: string) =>
  decode(value.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

/** Alguns domínios da CBF recusam servidores; o espelho devolve o mesmo HTML. */
async function fetchHtml(url: string): Promise<string> {
  let response: Response | null = null;
  try {
    response = await fetch(url, {
      headers: {
        "user-agent": UA,
        accept: "text/html,application/xhtml+xml",
        "accept-language": "pt-BR,pt;q=0.9",
      },
    });
  } catch {
    response = null;
  }
  if (response?.ok) return response.text();

  const mirror = await fetch(`https://r.jina.ai/${url}`, {
    headers: { "user-agent": UA, "x-return-format": "html" },
  });
  if (!mirror.ok) throw new Error("Não foi possível acessar o portal oficial da CBF.");
  return mirror.text();
}

/** Extrai as competições publicadas (nome + URL + identificadores do path). */
export function parseCbfCompetitions(html: string): CbfCompetition[] {
  const found = new Map<string, CbfCompetition>();
  const pattern =
    /<a[^>]+href="(\/competicoes\/listar\/(\d+)\/(\d+)\/?)"[\s\S]{0,600}?<small[^>]*>([\s\S]*?)<\/small>/gi;

  for (const match of html.matchAll(pattern)) {
    const id = `${match[2]}-${match[3]}`;
    const label = clean(match[4]);
    if (!label || found.has(id)) continue;
    found.set(id, { id, label, url: new URL(match[1], BASE).toString() });
  }

  return [...found.values()].sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
}

export async function listCbfCompetitions(): Promise<CbfCompetition[]> {
  const competitions = parseCbfCompetitions(await fetchHtml(CATALOG_URL));
  if (competitions.length === 0) {
    throw new Error("Nenhuma competição foi publicada no portal oficial da CBF.");
  }
  return competitions;
}
