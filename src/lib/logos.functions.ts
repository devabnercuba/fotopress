import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const input = z.object({
  url: z.string().url(),
  slug: z.string().min(1),
});

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

function extensionOf(url: string, contentType: string) {
  if (contentType.includes("svg")) return "svg";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("gif")) return "gif";
  const guess = url.split("?")[0].split(".").pop()?.toLowerCase();
  return guess && guess.length <= 4 ? guess : "png";
}

/**
 * Baixa o escudo publicado pela origem e guarda no armazenamento do projeto.
 * A URL externa continua salva em `logo_url`; se o download falhar, devolve o
 * motivo e a importação segue normalmente.
 */
export const cacheTeamLogo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => input.parse(data))
  .handler(async ({ data, context }): Promise<{ ok: boolean; url?: string; reason?: string }> => {
    try {
      const response = await fetch(data.url, {
        headers: { "user-agent": "Mozilla/5.0 (compatible; CoberturaBot/1.0)" },
      });
      if (!response.ok) return { ok: false, reason: `status ${response.status}` };

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.startsWith("image/")) return { ok: false, reason: "conteúdo não é imagem" };

      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength < 100) return { ok: false, reason: "imagem vazia" };

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      // Cada conta guarda o próprio escudo: nada é compartilhado entre usuários.
      const path = `teams/${context.userId}/${data.slug}.${extensionOf(data.url, contentType)}`;

      const { error } = await supabaseAdmin.storage
        .from("assets")
        .upload(path, bytes, { upsert: true, contentType });
      if (error) return { ok: false, reason: error.message };

      const { data: signed, error: signError } = await supabaseAdmin.storage
        .from("assets")
        .createSignedUrl(path, TEN_YEARS);
      if (signError || !signed) return { ok: false, reason: signError?.message ?? "sem URL" };

      return { ok: true, url: signed.signedUrl };
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : "falha no download" };
    }
  });
