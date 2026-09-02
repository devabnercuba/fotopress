import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

/**
 * Estado vazio padrão: explica o que fazer e oferece a ação principal
 * mais um atalho para os Primeiros passos.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  learnTo = "/primeiros-passos",
  learnLabel = "Ver primeiros passos",
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  learnTo?: string;
  learnLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center">
      <span className="flex size-11 items-center justify-center rounded-xl bg-surface text-foreground">
        <Icon className="size-5" />
      </span>
      <h3 className="mt-4 text-sm font-medium">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        {action}
        <Button asChild variant="outline" size="sm">
          <Link to={learnTo}>{learnLabel}</Link>
        </Button>
      </div>
    </div>
  );
}
