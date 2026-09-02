import { Link } from "@tanstack/react-router";
import { format, parseISO } from "date-fns";
import { Crown, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  FOUNDER_PRICE_LABEL,
  FOUNDER_PRODUCT,
  accessLabel,
  isFullAccess,
  useCheckoutEmail,
  useCheckoutUrl,
  useMyAccess,
} from "@/lib/billing";

/** Link de compra. Usa a configuração central; sem URL, leva ao contato. */
export function CheckoutButton({
  children,
  size,
  variant,
  className,
}: {
  children: React.ReactNode;
  size?: "sm" | "lg" | "default";
  variant?: "default" | "outline" | "secondary";
  className?: string;
}) {
  const { url, isLoading } = useCheckoutUrl();
  if (isLoading || !url) {
    return (
      <Button size={size} variant={variant} className={className} disabled>
        {isLoading ? "Preparando checkout..." : children}
      </Button>
    );
  }
  return (
    <Button asChild size={size} variant={variant} className={className}>
      <a href={url} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    </Button>
  );
}

/**
 * Aviso discreto de qual conta receberá o acesso. Só aparece para usuários
 * autenticados — o e-mail é apenas informativo, não libera acesso.
 */
export function CheckoutAccountHint({ className }: { className?: string }) {
  const email = useCheckoutEmail();
  if (!email) return null;
  return (
    <p className={`text-xs leading-relaxed text-muted-foreground ${className ?? ""}`}>
      Seu acesso será vinculado à conta:{" "}
      <span className="font-medium text-foreground">{email}</span>
      <br />
      <span className="text-muted-foreground/80">
        Use este mesmo e-mail no checkout para que seu acesso seja ativado automaticamente.
      </span>
    </p>
  );
}

/** Aviso discreto na Dashboard com a situação do acesso. */
export function AccessBanner() {
  const { data: access } = useMyAccess();
  if (!access) return null;

  const info = accessLabel(access);

  if (isFullAccess(access)) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs">
        <Crown className="size-3.5 text-primary" />
        <span className="font-medium">{info.plan}</span>
        <span className="text-muted-foreground">{info.detail} ✓</span>
      </div>
    );
  }

  if (access.access_status === "expired" || access.access_status === "cancelled") {
    return (
      <div className="rounded-lg border border-border bg-card px-4 py-3">
        <div className="text-sm font-medium">Seu período de teste terminou.</div>
        <p className="mt-1 text-xs text-muted-foreground">
          Adquira o Acesso Fundador para continuar usando o FotoPress.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <CheckoutButton size="sm">Adquirir acesso</CheckoutButton>
          <Button asChild size="sm" variant="outline">
            <Link to="/configuracoes">Ver plano</Link>
          </Button>
        </div>
        <CheckoutAccountHint className="mt-3" />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border bg-card px-3 py-2 text-xs">
      <Sparkles className="size-3.5 text-primary" />
      <span className="font-medium">Teste gratuito</span>
      <span className="text-muted-foreground">{info.detail}</span>
      <span className="text-muted-foreground">
        · Seu período de teste termina em {access.days_left}{" "}
        {access.days_left === 1 ? "dia" : "dias"}.
      </span>
      <Button asChild size="sm" variant="outline" className="ml-auto h-7 px-2 text-xs">
        <Link to="/configuracoes">Conhecer acesso fundador</Link>
      </Button>
    </div>
  );
}

/** Bloco "Meu plano" das Configurações. */
export function PlanCard() {
  const { data: access, isLoading } = useMyAccess();
  const info = accessLabel(access);
  const founder = isFullAccess(access);

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="text-sm font-medium">Meu plano</div>
      {isLoading ? (
        <p className="mt-3 text-xs text-muted-foreground">Carregando…</p>
      ) : (
        <>
          <dl className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Plano</dt>
              <dd className="mt-1 text-sm font-medium">{info.plan}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Status</dt>
              <dd className="mt-1 text-sm font-medium">{info.status}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">
                {founder ? "Acesso" : "Teste termina"}
              </dt>
              <dd className="mt-1 text-sm font-medium">
                {founder
                  ? info.detail || "Vitalício"
                  : access
                    ? format(parseISO(access.trial_ends_at), "dd/MM/yyyy")
                    : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Valor</dt>
              <dd className="mt-1 text-sm font-medium">{FOUNDER_PRICE_LABEL}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Pagamento</dt>
              <dd className="mt-1 text-sm font-medium">Único</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Fonte</dt>
              <dd className="mt-1 text-sm font-medium">{FOUNDER_PRODUCT.provider}</dd>
            </div>
          </dl>
          {!founder && (
            <>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <CheckoutButton size="sm">Conhecer Acesso Fundador</CheckoutButton>
                <span className="text-xs text-muted-foreground">
                  Pagamento único de {FOUNDER_PRICE_LABEL} — acesso vitalício.
                </span>
              </div>
              <CheckoutAccountHint className="mt-3" />
            </>
          )}
        </>
      )}
    </section>
  );
}
