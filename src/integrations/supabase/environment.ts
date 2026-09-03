export type FotoPressDeployment = "development" | "staging" | "production";

type SupabaseTarget = {
  deployment: string | undefined;
  projectId: string | undefined;
  url: string;
  source: "browser" | "server";
};

const LEGACY_LOVABLE_PROJECT_FINGERPRINT = "0d480519";
const DEPLOYMENTS = new Set<FotoPressDeployment>(["development", "staging", "production"]);

function fingerprint(value: string) {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function projectRefFromUrl(value: string) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();

    if (!hostname.endsWith(".supabase.co")) {
      return null;
    }

    return hostname.slice(0, -".supabase.co".length);
  } catch {
    return null;
  }
}

export function assertSafeSupabaseTarget({ deployment, projectId, url, source }: SupabaseTarget) {
  const normalizedDeployment = deployment?.trim().toLowerCase() as FotoPressDeployment | undefined;

  const normalizedProjectId = projectId?.trim().toLowerCase();

  if (!normalizedDeployment || !DEPLOYMENTS.has(normalizedDeployment)) {
    throw new Error(
      `[Supabase:${source}] Ambiente FotoPress ausente ou inválido. ` +
        "Configure FOTOPRESS_DEPLOYMENT e VITE_FOTOPRESS_DEPLOYMENT.",
    );
  }

  if (!normalizedProjectId) {
    throw new Error(`[Supabase:${source}] Identificador do projeto Supabase ausente.`);
  }

  const urlProjectRef = projectRefFromUrl(url);

  if (urlProjectRef && urlProjectRef !== normalizedProjectId) {
    throw new Error(
      `[Supabase:${source}] A URL e o identificador não pertencem ao mesmo projeto Supabase.`,
    );
  }

  const targetProjectRef = urlProjectRef ?? normalizedProjectId;

  if (fingerprint(targetProjectRef) === LEGACY_LOVABLE_PROJECT_FINGERPRINT) {
    throw new Error(
      `[Supabase:${source}] Conexão bloqueada: este é o antigo banco de produção do Lovable.`,
    );
  }
}
