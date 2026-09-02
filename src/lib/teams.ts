import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { cacheTeamLogo } from "./logos.functions";
import { uploadAsset } from "./storage";

/**
 * Entidade Teams
 * --------------
 * A identidade real de um clube é composta:
 * `user_id + normalized_name + sport_key + category + gender`.
 *
 * Isso permite que "Avaí" do futebol profissional, "Avaí" sub-20 e "Avaí"
 * futsal feminino coexistam como registros distintos — sem nunca recorrer a
 * nomes artificiais com número ("Avaí 2"). Relacionamentos internos usam
 * sempre o `id`, nunca o nome de exibição.
 */
export type Team = {
  id: string;
  name: string;
  short_name: string | null;
  abbreviation: string | null;
  slug: string;
  normalized_name: string;
  state: string | null;
  city: string | null;
  logo_url: string | null;
  logo_local: string | null;
  sport_key: string;
  category: string | null;
  gender: string | null;
};

export const TEAM_SELECT =
  "id, name, short_name, abbreviation, slug, normalized_name, state, city, logo_url, logo_local, sport_key, category, gender";

/** Modalidade padrão quando a origem não informa nada. */
export const DEFAULT_SPORT_KEY = "futebol";

/** Contexto que qualifica um clube dentro de uma modalidade/categoria. */
export type TeamContext = {
  sportKey?: string | null;
  category?: string | null;
  gender?: string | null;
};

/** Palavras genéricas que não identificam o clube. */
const NOISE = new Set([
  "fc",
  "ec",
  "sc",
  "ac",
  "af",
  "cf",
  "aa",
  "ad",
  "se",
  "cr",
  "clube",
  "club",
  "futebol",
  "futsal",
  "esporte",
  "esportes",
  "esportivo",
  "associacao",
  "associacaoo",
  "atletica",
  "sociedade",
  "recreativo",
  "recreativa",
  "regatas",
  "gremio",
  "de",
  "do",
  "da",
  "dos",
  "das",
  "e",
]);

export function stripAccents(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Normaliza o nome do clube para comparação.
 * "AVAÍ", "Avai", "Avaí FC" e "AVAI" → "avai".
 */
export function normalizeTeamName(name: string) {
  const base = stripAccents(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!base) return "";
  const tokens = base.split(" ").filter(Boolean);
  const meaningful = tokens.filter((t) => !NOISE.has(t));
  // "Grêmio" sozinho deve continuar existindo mesmo estando na lista de ruído.
  return (meaningful.length > 0 ? meaningful : tokens).join(" ");
}

/** Chave de comparação de qualquer atributo textual da identidade. */
export function identityToken(value: string | null | undefined) {
  if (!value) return "";
  return stripAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Chave completa de identidade do clube (a mesma usada pelo índice único). */
export function teamIdentityKey(name: string, context: TeamContext = {}) {
  return [
    normalizeTeamName(name),
    identityToken(context.sportKey || DEFAULT_SPORT_KEY),
    identityToken(context.category),
    identityToken(context.gender),
  ].join("|");
}

export function teamRowIdentityKey(team: Team) {
  return [
    identityToken(team.normalized_name || team.name),
    identityToken(team.sport_key || DEFAULT_SPORT_KEY),
    identityToken(team.category),
    identityToken(team.gender),
  ].join("|");
}

/** Identificador interno estável do clube. */
export function teamSlug(name: string) {
  return normalizeTeamName(name).replace(/\s+/g, "-") || "clube";
}

/** Sigla sugerida quando a origem não informa. */
export function teamAbbreviation(name: string) {
  const normalized = normalizeTeamName(name);
  const tokens = normalized.split(" ").filter(Boolean);
  if (tokens.length === 1) return tokens[0].slice(0, 3).toUpperCase();
  return tokens
    .map((t) => t[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

/** Nome de exibição limpo (mantém a grafia recebida, sem espaços duplicados). */
export function displayTeamName(name: string) {
  return name.replace(/\s+/g, " ").trim();
}

/**
 * Rótulo completo mostrado na interface. O nome NUNCA recebe sufixo numérico:
 * o que diferencia registros homônimos é a modalidade/categoria/gênero.
 */
export function teamLabel(team: Pick<Team, "name" | "sport_key" | "category" | "gender">) {
  const extras = [
    team.sport_key && identityToken(team.sport_key) !== DEFAULT_SPORT_KEY ? team.sport_key : null,
    team.category,
    team.gender,
  ]
    .map((v) => (v ? v.trim() : ""))
    .filter(Boolean);
  return extras.length > 0 ? `${team.name} · ${extras.join(" · ")}` : team.name;
}

export function useTeams() {
  return useQuery({
    queryKey: ["teams"],
    queryFn: async (): Promise<Team[]> => {
      const { data, error } = await supabase.from("teams").select(TEAM_SELECT).order("name");
      if (error) throw error;
      return (data ?? []) as unknown as Team[];
    },
    staleTime: 60_000,
  });
}

/** Índice por slug/nome normalizado para consultas rápidas na interface. */
export function teamIndex(teams: Team[]) {
  const map = new Map<string, Team>();
  for (const team of teams) {
    // O primeiro registro vence: escudos manuais tendem a estar no principal.
    if (team.slug && !map.has(team.slug)) map.set(team.slug, team);
    if (team.normalized_name && !map.has(team.normalized_name)) map.set(team.normalized_name, team);
  }
  return map;
}

export function findTeam(index: Map<string, Team>, name: string | null | undefined) {
  if (!name) return undefined;
  return index.get(teamSlug(name)) ?? index.get(normalizeTeamName(name));
}

export type EnsureTeamEntry = TeamContext & {
  name: string;
  state?: string | null;
  logoUrl?: string | null;
};

/**
 * Garante o cadastro dos clubes informados e devolve o mapa
 * identidade → clube. Nunca cria duplicados nem nomes com número:
 * a chave é `nome normalizado + modalidade + categoria + gênero`.
 */
export async function ensureTeams(
  entries: EnsureTeamEntry[],
): Promise<{ byIdentity: Map<string, Team>; bySlug: Map<string, Team>; created: number }> {
  const unique = new Map<string, EnsureTeamEntry>();
  for (const entry of entries) {
    const name = displayTeamName(entry.name ?? "");
    if (!name) continue;
    const key = teamIdentityKey(name, entry);
    const current = unique.get(key);
    unique.set(key, {
      name: current?.name ?? name,
      state: entry.state ?? current?.state ?? null,
      logoUrl: entry.logoUrl ?? current?.logoUrl ?? null,
      sportKey: entry.sportKey || current?.sportKey || DEFAULT_SPORT_KEY,
      category: entry.category ?? current?.category ?? null,
      gender: entry.gender ?? current?.gender ?? null,
    });
  }

  const { data: existing, error } = await supabase.from("teams").select(TEAM_SELECT);
  if (error) throw error;

  const rows = (existing ?? []) as unknown as Team[];
  const byIdentity = new Map<string, Team>();
  /** Registros antigos, sem contexto — servem para adotar em vez de duplicar. */
  const legacyByName = new Map<string, Team>();
  for (const team of rows) {
    byIdentity.set(teamRowIdentityKey(team), team);
    const nameKey = identityToken(team.normalized_name || team.name);
    if (
      !identityToken(team.category) &&
      !identityToken(team.gender) &&
      !legacyByName.has(nameKey)
    ) {
      legacyByName.set(nameKey, team);
    }
  }

  const bySlug = new Map<string, Team>();
  let created = 0;

  for (const [key, entry] of unique) {
    const sportKey = entry.sportKey || DEFAULT_SPORT_KEY;
    const nameKey = identityToken(normalizeTeamName(entry.name));
    let found = byIdentity.get(key);

    // Cadastro anterior sem modalidade/categoria: adota e completa o contexto,
    // em vez de criar um clone.
    if (!found) {
      const legacy = legacyByName.get(nameKey);
      if (
        legacy &&
        identityToken(legacy.sport_key || DEFAULT_SPORT_KEY) === identityToken(sportKey)
      ) {
        const patch = {
          sport_key: sportKey,
          category: entry.category ?? null,
          gender: entry.gender ?? null,
          slug: legacy.slug || teamSlug(entry.name),
          normalized_name: legacy.normalized_name || normalizeTeamName(entry.name),
        };
        await supabase.from("teams").update(patch).eq("id", legacy.id);
        found = Object.assign(legacy, patch) as Team;
        legacyByName.delete(nameKey);
        byIdentity.set(teamRowIdentityKey(found), found);
      }
    }

    if (found) {
      // Atualiza apenas o que faltava — nunca sobrescreve com vazio e
      // jamais substitui um escudo enviado manualmente.
      const patch: { state?: string; logo_url?: string; abbreviation?: string } = {};
      if (!found.state && entry.state) patch.state = entry.state;
      if (!found.logo_url && !found.logo_local && entry.logoUrl) patch.logo_url = entry.logoUrl;
      if (!found.abbreviation) patch.abbreviation = teamAbbreviation(entry.name);
      if (Object.keys(patch).length > 0) {
        await supabase.from("teams").update(patch).eq("id", found.id);
        Object.assign(found, patch);
      }
      byIdentity.set(key, found);
      if (!bySlug.has(found.slug)) bySlug.set(found.slug, found);
      continue;
    }

    const { data, error: insertError } = await supabase
      .from("teams")
      .insert({
        name: entry.name,
        short_name: entry.name,
        abbreviation: teamAbbreviation(entry.name),
        slug: teamSlug(entry.name),
        normalized_name: normalizeTeamName(entry.name),
        state: entry.state ?? null,
        logo_url: entry.logoUrl ?? null,
        sport_key: sportKey,
        category: entry.category ?? null,
        gender: entry.gender ?? null,
      })
      .select(TEAM_SELECT)
      .single();
    if (insertError) throw insertError;
    const team = data as unknown as Team;
    byIdentity.set(key, team);
    if (!bySlug.has(team.slug)) bySlug.set(team.slug, team);
    created += 1;
  }

  return { byIdentity, bySlug, created };
}

/**
 * Guarda no armazenamento do projeto os escudos publicados pelas origens
 * (FCF/CBF). Melhor esforço: se a origem bloquear o download, o clube segue
 * usando a URL remota. Escudo manual existente nunca é sobrescrito.
 */
export async function cacheTeamLogos(teams: Team[]) {
  const pending = teams.filter((t) => t.logo_url && !t.logo_local);
  let cached = 0;
  for (const team of pending) {
    try {
      const result = await cacheTeamLogo({ data: { url: team.logo_url!, slug: team.slug } });
      if (!result.ok || !result.url) continue;
      await supabase.from("teams").update({ logo_local: result.url }).eq("id", team.id);
      team.logo_local = result.url;
      cached += 1;
    } catch {
      // segue com a URL remota
    }
  }
  return cached;
}

export type TeamInput = {
  name: string;
  short_name: string | null;
  abbreviation: string | null;
  city: string | null;
  state: string | null;
  sport_key?: string;
  category?: string | null;
  gender?: string | null;
};

/** Edição manual de um clube, incluindo envio do escudo. */
export function useTeamMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["teams"] });
    qc.invalidateQueries({ queryKey: ["matches"] });
    qc.invalidateQueries({ queryKey: ["athletes"] });
  };

  const save = useMutation({
    mutationFn: async ({ id, logo, ...input }: TeamInput & { id: string; logo?: File | null }) => {
      const patch = {
        ...input,
        slug: teamSlug(input.name),
        normalized_name: normalizeTeamName(input.name),
        ...(logo ? { logo_local: await uploadAsset(logo, "teams") } : {}),
      };
      const { error } = await supabase.from("teams").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const removeLogo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("teams").update({ logo_local: null }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /** Mescla dois clubes equivalentes preservando jogos, atletas, fontes e escudo. */
  const merge = useMutation({
    mutationFn: async ({ keepId, dropId }: { keepId: string; dropId: string }) => {
      const { error } = await supabase.rpc("merge_teams", {
        p_keep_id: keepId,
        p_drop_id: dropId,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /**
   * Cadastro manual de clube. A identidade composta é verificada antes do
   * insert para evitar duplicata real (mesmo nome + modalidade + categoria +
   * gênero) sem impedir homônimos legítimos de outras categorias.
   */
  const create = useMutation({
    mutationFn: async ({ logo, ...input }: TeamInput & { logo?: File | null }) => {
      const { data: auth } = await supabase.auth.getUser();
      const userId = auth.user?.id;
      if (!userId) throw new Error("Não autenticado");

      const name = displayTeamName(input.name);
      const sportKey = input.sport_key || DEFAULT_SPORT_KEY;
      const identity = teamIdentityKey(name, {
        sportKey,
        category: input.category,
        gender: input.gender,
      });

      const { data: existing, error: readError } = await supabase.from("teams").select(TEAM_SELECT);
      if (readError) throw readError;
      const duplicate = ((existing ?? []) as unknown as Team[]).find(
        (t) => teamRowIdentityKey(t) === identity,
      );
      if (duplicate) throw new Error("DUPLICATE");

      const { error } = await supabase.from("teams").insert({
        user_id: userId,
        name,
        short_name: input.short_name,
        abbreviation: input.abbreviation || teamAbbreviation(name),
        city: input.city,
        state: input.state,
        sport_key: sportKey,
        category: input.category ?? null,
        gender: input.gender ?? null,
        slug: teamSlug(name),
        normalized_name: normalizeTeamName(name),
        ...(logo ? { logo_local: await uploadAsset(logo, "teams") } : {}),
      });
      // O índice único de identidade no banco é a garantia final contra
      // duplicatas criadas por dois envios simultâneos.
      if (error?.code === "23505") throw new Error("DUPLICATE");
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /**
   * Exclusão do clube. Só é permitida quando não existem vínculos — o
   * chamador verifica com `fetchTeamLinks` e orienta a mesclagem quando
   * houver dados dependentes.
   */
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const links = await fetchTeamLinks(id);
      if (links.total > 0) throw new Error("LINKED");
      const { error } = await supabase.from("teams").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { save, removeLogo, merge, create, remove };
}

export type TeamLinks = {
  matches: number;
  athletes: number;
  sources: number;
  total: number;
};

/** Conta os vínculos existentes de um clube antes de qualquer exclusão. */
export async function fetchTeamLinks(teamId: string): Promise<TeamLinks> {
  const count = async (p: PromiseLike<{ count: number | null }>) => (await p).count ?? 0;

  const [home, away, athletes, sources] = await Promise.all([
    count(
      supabase
        .from("matches")
        .select("id", { count: "exact", head: true })
        .eq("home_team_id", teamId),
    ),
    count(
      supabase
        .from("matches")
        .select("id", { count: "exact", head: true })
        .eq("away_team_id", teamId),
    ),
    count(
      supabase.from("athletes").select("id", { count: "exact", head: true }).eq("team_id", teamId),
    ),
    count(
      supabase
        .from("athlete_data_sources")
        .select("id", { count: "exact", head: true })
        .eq("team_id", teamId),
    ),
  ]);

  const matches = home + away;
  return { matches, athletes, sources, total: matches + athletes + sources };
}

/** Vínculos do clube selecionado (usado pelo diálogo de exclusão). */
export function useTeamLinks(teamId: string | null) {
  return useQuery({
    queryKey: ["team-links", teamId],
    enabled: !!teamId,
    queryFn: () => fetchTeamLinks(teamId!),
  });
}

export type DuplicateGroup = {
  key: string;
  teams: Team[];
  /** Mesma identidade completa: mesclagem é seguramente equivalente. */
  equivalent: boolean;
};

/**
 * Diagnóstico de duplicados. Só marca como equivalente quando modalidade,
 * categoria e gênero coincidem — clubes de categorias diferentes são apenas
 * homônimos legítimos e nunca devem ser mesclados automaticamente.
 */
export function duplicateGroups(teams: Team[]): DuplicateGroup[] {
  const byName = new Map<string, Team[]>();
  for (const team of teams) {
    const key = identityToken(team.normalized_name || team.name);
    if (!key) continue;
    byName.set(key, [...(byName.get(key) ?? []), team]);
  }
  const groups: DuplicateGroup[] = [];
  for (const [key, list] of byName) {
    if (list.length < 2) continue;
    const identities = new Set(list.map(teamRowIdentityKey));
    groups.push({ key, teams: list, equivalent: identities.size === 1 });
  }
  return groups.sort((a, b) => a.key.localeCompare(b.key));
}
