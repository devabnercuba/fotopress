import { Link } from "@tanstack/react-router";
import { Check, Circle, PartyPopper, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useOnboarding } from "@/lib/onboarding";

/**
 * Checklist de configuração inicial. O progresso vem sempre dos dados reais
 * do usuário — nenhum passo é marcado manualmente.
 */
export function OnboardingChecklist({
  variant = "card",
  onDismiss,
}: {
  variant?: "card" | "plain";
  onDismiss?: () => void;
}) {
  const { steps, completed, total, percent, allDone, dismiss } = useOnboarding();
  const next = steps.find((s) => !s.done);

  return (
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Configure seu FotoPress</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {completed} de {total} etapas concluídas · {percent}%
          </p>
        </div>
        {variant === "card" && (
          <Button
            size="icon"
            variant="ghost"
            aria-label="Ocultar checklist"
            onClick={() => {
              dismiss();
              onDismiss?.();
            }}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>

      <Progress value={percent} className="mt-4 h-2" />

      <ul className="mt-4 space-y-1.5">
        {steps.map((step) => (
          <li key={step.id}>
            <Link
              to={step.to}
              className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-accent/50"
            >
              {step.done ? (
                <Check className="size-4 shrink-0 text-primary" />
              ) : (
                <Circle className="size-4 shrink-0 text-muted-foreground/60" />
              )}
              <span
                className={`min-w-0 flex-1 truncate ${
                  step.done ? "text-muted-foreground line-through" : ""
                }`}
              >
                {step.title}
              </span>
              <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
                {step.action}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {allDone ? (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-surface p-4">
          <PartyPopper className="mt-0.5 size-4 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-medium">Seu FotoPress está pronto.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Agora você já possui a estrutura básica para organizar suas coberturas.
            </p>
          </div>
        </div>
      ) : (
        next && (
          <Button asChild className="mt-4">
            <Link to={next.to}>Continuar configuração</Link>
          </Button>
        )
      )}
    </section>
  );
}

/** Card do Dashboard — some sozinho quando tudo estiver concluído ou oculto. */
export function OnboardingCard() {
  const { showCard } = useOnboarding();
  if (!showCard) return null;
  return <OnboardingChecklist />;
}

/** Convite discreto para quem já tem tudo configurado. */
export function FirstStepsHint() {
  const { allDone } = useOnboarding();
  if (!allDone) return null;
  return (
    <Link
      to="/primeiros-passos"
      className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground hover:underline"
    >
      Conheça os Primeiros passos
    </Link>
  );
}
