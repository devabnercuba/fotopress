/**
 * Origem pública oficial do FotoPress.
 * -------------------------------------
 * Fonte única de verdade para qualquer URL absoluta do próprio aplicativo
 * (SEO/canonical, endpoints exibidos no painel, user-agent dos importadores,
 * links enviados por e-mail).
 *
 * Para trocar de domínio no futuro (ex.: https://fotopress.com.br) basta
 * definir `VITE_APP_URL` — nenhum arquivo precisa ser editado.
 *
 * Navegação interna continua usando rotas relativas (`/dashboard`), nunca
 * URL absoluta.
 */
const FALLBACK_APP_URL = "https://pressbrief.lovable.app";

const strip = (value: string) => value.trim().replace(/\/+$/, "");

export const APP_URL = strip(
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_APP_URL) || FALLBACK_APP_URL,
);

/** URL absoluta canônica de um caminho interno: `appUrl("/obrigado")`. */
export function appUrl(path = "/") {
  return `${APP_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Origem em runtime: no browser usa o host realmente acessado (preview,
 * domínio próprio, etc.); no servidor cai para a URL oficial.
 */
export function publicOrigin() {
  return typeof window === "undefined" ? APP_URL : strip(window.location.origin);
}
