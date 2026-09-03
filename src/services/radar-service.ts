import { supabase } from "@/integrations/supabase/client";
import type { Match } from "@/lib/queries";
import { mentionsClub, OGOL_SOURCE_TYPE } from "@/lib/ogol";

/**
 * Radar da Partida
 * ----------------
 * Arquitetura preparada para IA. O fluxo é sempre o mesmo:
 *
 *   Fontes de Conteúdo → coleta → consolidação → provedor de IA → resumo salvo
 *
 * Hoje o provedor padrão é um rascunho local (`draftProvider`). Para plugar um
 * modelo (ChatGPT ou compatível) basta implementar `RadarProvider` e registrá-lo
 * com `setRadarProvider(...)` — nenhum outro arquivo precisa mudar.
 */

export type RadarContent = {
  summary: string;
  news: string[];
  attention: string[];
  photos: string[];
};

export type RadarSourceDigest = {
  id: string;
  name: string;
  url: string | null;
};

export type RadarNews = {
  id: string;
  title: string;
  summary: string | null;
  url: string;
  published_at: string | null;
  source: { name: string } | null;
};

export type RadarContext = {
  match: Match;
  sources: RadarSourceDigest[];
  prompt: string;
  news?: RadarNews[];
};

export interface RadarProvider {
  id: string;
  generate(context: RadarContext): Promise<RadarContent>;
}

/**
 * Coleta as fontes de notícias ativas. Fontes são portais gerais (GE, CBF,
 * FCF) — não pertencem a um campeonato específico.
 */
export async function collectSources(_match: Match): Promise<RadarSourceDigest[]> {
  const { data, error } = await supabase
    .from("content_sources")
    .select("id, name, url, status")
    .eq("status", "active")
    .order("name");
  if (error) throw error;
  return (data ?? []).map((s) => ({ id: s.id, name: s.name, url: s.url }));
}

/**
 * Notícias reais já coletadas e relacionadas a esta partida (ou aos seus
 * clubes). A IA nunca inventa fatos: só trabalha em cima destes registros.
 */
export async function collectNewsForMatch(match: Match) {
  const teamIds = [match.home_team_id, match.away_team_id].filter(Boolean) as string[];
  const filters = [`related_match_ids.cs.{${match.id}}`];
  for (const id of teamIds) filters.push(`related_team_ids.cs.{${id}}`);

  const { data, error } = await supabase
    .from("news_items")
    .select("id, title, summary, url, published_at, source:content_sources(name)")
    .or(filters.join(","))
    .order("published_at", { ascending: false })
    .limit(15);
  if (error) return [];
  return (data ?? []) as unknown as Array<{
    id: string;
    title: string;
    summary: string | null;
    url: string;
    published_at: string | null;
    source: { name: string } | null;
  }>;
}

/**
 * Conteúdo de fontes integradas (oGol) relacionado aos clubes da partida.
 * Só entram itens que realmente mencionam um dos clubes — evita ruído e
 * reduz o contexto enviado ao resumo.
 */
export async function collectIntegratedNewsForMatch(match: Match) {
  const { data, error } = await supabase
    .from("news_items")
    .select("id, title, summary, url, published_at, source:content_sources(name, type, status)")
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(200);
  if (error) return [];

  const clubs = [match.home_team, match.away_team].filter(Boolean) as string[];
  return (
    (data ?? []) as unknown as Array<{
      id: string;
      title: string;
      summary: string | null;
      url: string;
      published_at: string | null;
      source: { name: string; type: string; status: string } | null;
    }>
  )
    .filter((n) => n.source?.type === OGOL_SOURCE_TYPE && n.source.status === "active")
    .filter((n) => clubs.some((club) => mentionsClub(`${n.title} ${n.summary ?? ""}`, club)))
    .slice(0, 8)
    .map((n) => ({
      id: n.id,
      title: n.title,
      summary: n.summary,
      url: n.url,
      published_at: n.published_at,
      source: n.source ? { name: n.source.name } : null,
    }));
}

/** Consolida partida + fontes + notícias reais no texto enviado à IA. */
export function buildPrompt(
  match: Match,
  sources: RadarSourceDigest[],
  news: Array<{ title: string; url: string; source: { name: string } | null }> = [],
) {
  const lines = [
    "Você é um assistente de pauta para fotógrafos esportivos.",
    "Gere um resumo operacional, curto e objetivo, com leitura em menos de dois minutos.",
    "Use APENAS as notícias reais listadas abaixo. Nunca invente fatos, jogadores ou lesões.",
    "",
    `Partida: ${match.home_team} x ${match.away_team}`,
    `Competição: ${match.competition?.name ?? "não informada"}`,
    `Data: ${match.date} ${match.time.slice(0, 5)}`,
    `Local: ${[match.venue, match.city, match.state].filter(Boolean).join(" · ") || "a definir"}`,
    "",
    "Fontes de notícias monitoradas:",
    ...(sources.length
      ? sources.map((s) => `- ${s.name}${s.url ? ` (${s.url})` : ""}`)
      : ["- nenhuma fonte de notícias cadastrada"]),
    "",
    "Notícias reais coletadas:",
    ...(news.length
      ? news.map((n) => `- ${n.title} [${n.source?.name ?? "fonte"}] (${n.url})`)
      : ["- nenhuma notícia coletada para esta partida"]),
    "",
    "Responda com: resumo, principais notícias, pontos de atenção e fotos sugeridas.",
  ];
  return lines.join("\n");
}

/** Provedor padrão: rascunho local, sem IA. Substituível por um modelo real. */
const draftProvider: RadarProvider = {
  id: "rascunho-local",
  async generate({ match, sources, news = [] }) {
    const local = [match.venue, match.city, match.state].filter(Boolean).join(" · ");
    return {
      summary:
        `${match.home_team} x ${match.away_team} pelo ${match.competition?.name ?? "campeonato"}` +
        `, às ${match.time.slice(0, 5)}${local ? ` em ${local}` : ""}. ` +
        (news.length
          ? `${news.length} notícia(s) real(is) relacionada(s) foram coletadas. `
          : "Nenhuma notícia real coletada ainda para esta partida. ") +
        (sources.length
          ? `Fontes monitoradas: ${sources.map((s) => s.name).join(", ")}. `
          : "Nenhuma fonte de notícias cadastrada. ") +
        "Resumo gerado por IA será exibido aqui quando o modelo for conectado.",
      news: news.length
        ? news.map((n) => `${n.title}${n.url ? ` — ${n.url}` : ""}`)
        : sources.map((s) => `${s.name}${s.url ? ` — ${s.url}` : ""}`),

      attention: [
        "Confirmar horário e portão de acesso na véspera.",
        "Verificar previsão do tempo e iluminação do estádio.",
        "Checar credenciamento junto à organização da competição.",
      ],
      photos: [
        "Chegada e aquecimento das equipes",
        "Entrada em campo e perfilamento",
        "Torcida e mosaicos",
        "Lances decisivos e comemorações",
      ],
    };
  },
};

let provider: RadarProvider = draftProvider;

export function setRadarProvider(next: RadarProvider) {
  provider = next;
}

export function getRadarProvider() {
  return provider;
}

/** Fluxo completo: coleta → consolida → IA → salva para consulta offline. */
export async function syncRadar(match: Match, coverageId?: string) {
  const sources = await collectSources(match);
  const [related, integrated] = await Promise.all([
    collectNewsForMatch(match),
    collectIntegratedNewsForMatch(match),
  ]);
  const seen = new Set<string>();
  const news = [...related, ...integrated].filter((n) =>
    seen.has(n.url) ? false : (seen.add(n.url), true),
  );
  const prompt = buildPrompt(match, sources, news);
  const content = await provider.generate({ match, sources, prompt, news });

  const row = {
    match_id: match.id,
    coverage_id: coverageId ?? null,
    summary: content.summary,
    news: content.news,
    attention_points: content.attention,
    photo_suggestions: content.photos,
    sources_used: sources,
    status: provider.id === draftProvider.id ? "draft" : "ready",
    last_synced_at: new Date().toISOString(),
  };

  const { error } = await supabase.from("match_radar").upsert(row, { onConflict: "match_id" });
  if (error) throw error;
  return { sourcesUsed: sources.length, status: row.status };
}
