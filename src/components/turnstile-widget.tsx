import { useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile — proteção antispam do cadastro.
 * A Site Key é pública e vem de VITE_TURNSTILE_SITE_KEY. A Secret Key fica
 * apenas na configuração de autenticação do backend.
 */
const isDevelopment = import.meta.env["VITE_FOTOPRESS_DEPLOYMENT"] === "development";

export const TURNSTILE_SITE_KEY = isDevelopment
  ? undefined
  : (import.meta.env["VITE_TURNSTILE_SITE_KEY"] as string | undefined);

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id?: string) => void;
};

function loadScript(): Promise<TurnstileApi | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  const w = window as unknown as { turnstile?: TurnstileApi };
  if (w.turnstile) return Promise.resolve(w.turnstile);

  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`);
    const script = existing ?? document.createElement("script");
    const done = () => resolve(w.turnstile ?? null);
    script.addEventListener("load", done);
    script.addEventListener("error", () => resolve(null));
    if (!existing) {
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    } else if (w.turnstile) {
      done();
    }
  });
}

export function TurnstileWidget({
  onToken,
  resetKey = 0,
}: {
  onToken: (token: string | null) => void;
  /** Alterar este valor força um novo desafio (ex.: após erro no cadastro). */
  resetKey?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !ref.current) return;
    let widgetId: string | undefined;
    let api: TurnstileApi | null = null;
    let cancelled = false;

    loadScript().then((loaded) => {
      if (cancelled || !loaded || !ref.current) return;
      api = loaded;
      widgetId = loaded.render(ref.current, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (token: string) => onToken(token),
        "expired-callback": () => onToken(null),
        "error-callback": () => onToken(null),
      });
    });

    return () => {
      cancelled = true;
      onToken(null);
      if (api && widgetId) api.remove(widgetId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  if (!TURNSTILE_SITE_KEY) return null;

  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted-foreground">Verificação de segurança</p>
      <div ref={ref} />
    </div>
  );
}
