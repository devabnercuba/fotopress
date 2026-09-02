import { ArrowRight, Megaphone, Sparkles } from "lucide-react";

import { categoryLabel, useProductUpdateReads, useProductUpdates } from "@/lib/product-updates";
import { openNewsUpdatesPanel } from "@/lib/updates-panel-context";

/**
 * Aviso chamativo na Dashboard quando existem novidades ainda não vistas.
 * Permite abrir o painel lateral de novidades diretamente.
 */
export function UpdatesBanner() {
  const { data: updates = [] } = useProductUpdates();
  const { data: reads = [] } = useProductUpdateReads();

  const read = new Set(reads);
  const unread = updates.filter((u) => !read.has(u.id));
  if (unread.length === 0) return null;

  const latest = unread[0];

  return (
    <button
      type="button"
      onClick={() => openNewsUpdatesPanel("updates")}
      className="group relative flex w-full text-left items-center justify-between gap-3 overflow-hidden rounded-xl border border-primary/35 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-4 py-3.5 transition-all hover:border-primary/50 hover:bg-primary/15 cursor-pointer shadow-xs"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm group-hover:scale-105 transition-transform">
          <Megaphone className="size-4.5" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/20 px-2 py-0.2 text-[10px] font-bold text-primary">
              <Sparkles className="size-2.5" />
              {categoryLabel(latest.category)}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              {unread.length === 1 ? "1 novidade recente" : `${unread.length} novidades no app`}
            </span>
          </div>
          <p className="truncate text-sm font-semibold text-foreground mt-0.5">{latest.title}</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary group-hover:translate-x-0.5 transition-transform">
        <span className="hidden sm:inline">Ver novidades</span>
        <ArrowRight className="size-4" />
      </div>
    </button>
  );
}
