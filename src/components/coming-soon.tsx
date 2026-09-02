import type { LucideIcon } from "lucide-react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useFeatureInterest } from "@/lib/billing";

/**
 * Tela padrão "Em breve" — usada por Relatórios, Orçamentos e Produtos.
 * Segue o mesmo visual do restante do app (cards, ícones, textos curtos).
 */
export function ComingSoon({
  icon: Icon,
  title,
  tagline,
  message,
  items,
  feature,
  notifyLabel = "Avise-me quando estiver disponível",
}: {
  icon: LucideIcon;
  title: string;
  tagline: string;
  message: string;
  items: { icon: LucideIcon; title: string; text: string }[];
  feature?: string;
  notifyLabel?: string;
}) {
  return (
    <div className="space-y-6 pb-10">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon className="size-5" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{tagline}</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          <Sparkles className="size-3" />
          Em breve
        </span>
      </header>

      <section className="rounded-xl border border-border bg-card p-6">
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{message}</p>
        {feature && <NotifyButton feature={feature} label={notifyLabel} />}
      </section>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <article
            key={item.title}
            className="rounded-xl border border-dashed border-border bg-card p-5"
          >
            <span className="flex size-9 items-center justify-center rounded-lg bg-surface text-foreground">
              <item.icon className="size-4" />
            </span>
            <h2 className="mt-4 text-sm font-medium">{item.title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.text}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function NotifyButton({ feature, label }: { feature: string; label: string }) {
  const { registered, register } = useFeatureInterest(feature);

  return (
    <div className="mt-5">
      <Button
        disabled={registered || register.isPending}
        onClick={() =>
          register.mutate(undefined, {
            onSuccess: () => toast.success("Combinado! Avisaremos assim que estiver disponível."),
            onError: () => toast.error("Não foi possível registrar seu interesse."),
          })
        }
      >
        {registered ? "Interesse registrado ✓" : label}
      </Button>
      {registered && (
        <p className="mt-2 text-xs text-muted-foreground">
          Você será avisado quando esta funcionalidade for liberada.
        </p>
      )}
    </div>
  );
}
