import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, Calendar, Megaphone, Sparkles, Trophy, Users, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { categoryLabel, useLatestUnreadUpdate } from "@/lib/product-updates";
import { cn } from "@/lib/utils";

const SESSION_NOTIFIED_KEY = "fotopress:notified_update_session";

const badgeTone: Record<string, string> = {
  novidade: "bg-primary/10 text-primary border-primary/20",
  melhoria: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
  correcao: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
};

const iconMap: Record<string, typeof Sparkles> = {
  calendar: Calendar,
  sparkles: Sparkles,
  trophy: Trophy,
  users: Users,
  zap: Zap,
};

/**
 * Notifica automaticamente os usuários ao acessarem o aplicativo
 * sempre que novas funcionalidades ou melhorias forem implementadas.
 */
export function WhatsNewNotifier() {
  const navigate = useNavigate();
  const { latest, unreadList, totalUnread } = useLatestUnreadUpdate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!latest || totalUnread === 0) return;

    // Verifica se já notificamos o usuário nesta sessão para esta versão de novidades
    const lastNotified = window.sessionStorage.getItem(SESSION_NOTIFIED_KEY);
    if (lastNotified !== latest.id) {
      // Pequeno atraso para não competir com a renderização inicial
      const timer = setTimeout(() => {
        setOpen(true);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [latest, totalUnread]);

  function handleDismiss() {
    if (latest) {
      window.sessionStorage.setItem(SESSION_NOTIFIED_KEY, latest.id);
    }
    setOpen(false);
  }

  function handleOpenNovidades() {
    if (latest) {
      window.sessionStorage.setItem(SESSION_NOTIFIED_KEY, latest.id);
    }
    setOpen(false);
    navigate({ to: "/novidades" });
  }

  if (!latest || totalUnread === 0) return null;

  const previewItems = unreadList.slice(0, 3);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => (!isOpen ? handleDismiss() : setOpen(true))}>
      <DialogContent className="max-w-lg p-0 overflow-hidden border-border bg-card">
        {/* Top decorative banner */}
        <div className="relative bg-gradient-to-br from-primary/15 via-primary/5 to-transparent px-6 pt-6 pb-4 border-b border-border/60">
          <div className="flex items-center gap-2 mb-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Megaphone className="size-4" />
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/25 px-2.5 py-0.5 text-xs font-semibold text-primary">
              <Sparkles className="size-3" />
              Novidades no FotoPress
            </span>
          </div>

          <DialogHeader className="text-left space-y-1">
            <DialogTitle className="text-lg sm:text-xl font-bold tracking-tight">
              Novas funcionalidades e melhorias disponíveis!
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
              Implementamos novos recursos para otimizar suas coberturas e agilizar sua rotina.
              Confira os destaques recém-lançados:
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Lista de novidades recentes */}
        <div className="max-h-[320px] overflow-y-auto p-5 space-y-3">
          {previewItems.map((item) => {
            const Icon = (item.icon && iconMap[item.icon]) || Sparkles;
            return (
              <div
                key={item.id}
                className="flex items-start gap-3 rounded-xl border border-border/80 bg-surface/50 p-3.5 transition-colors hover:bg-surface"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary mt-0.5">
                  <Icon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full border px-2 py-0.2 text-[10px] font-semibold",
                        badgeTone[item.category] ?? badgeTone.novidade,
                      )}
                    >
                      {categoryLabel(item.category)}
                    </span>
                    <h4 className="text-sm font-semibold text-foreground truncate">{item.title}</h4>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {item.description}
                  </p>
                </div>
              </div>
            );
          })}

          {totalUnread > 3 && (
            <p className="text-center text-xs font-medium text-muted-foreground pt-1">
              +{totalUnread - 3} outra{totalUnread - 3 > 1 ? "s" : ""} novidade
              {totalUnread - 3 > 1 ? "s" : ""} disponível no menu Novidades
            </p>
          )}
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row items-center justify-between gap-2 border-t border-border bg-muted/20 px-5 py-3.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="w-full sm:w-auto text-xs text-muted-foreground"
          >
            Lembrar mais tarde
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleOpenNovidades}
            className="w-full sm:w-auto text-xs font-medium gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <span>Acessar menu Novidades</span>
            <ArrowRight className="size-3.5" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
