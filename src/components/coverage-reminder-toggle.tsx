import { useState } from "react";
import { Bell, BellOff, Check, Clock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LEAD_TIME_OPTIONS,
  getLeadTimeShortLabel,
  useCoverageReminders,
  type ReminderLeadTime,
} from "@/lib/coverage-reminders";
import { cn } from "@/lib/utils";

interface CoverageReminderToggleProps {
  coverageId: string;
  className?: string;
  variant?: "icon" | "badge" | "row";
  /** Optional formatted target date/time for tooltip */
  eventTimeDescription?: string;
  /** Estado de lembrete vindo do banco de dados (reminder_enabled) */
  reminderEnabled?: boolean | null;
  /** Tipo de cobertura: partida ou evento */
  kind?: "match" | "event";
}

export function CoverageReminderToggle({
  coverageId,
  className,
  variant = "icon",
  eventTimeDescription,
  reminderEnabled,
  kind = "match",
}: CoverageReminderToggleProps) {
  const {
    isCoverageReminderActive,
    getCoverageLeadTime,
    toggleCoverageReminder,
    setCoverageLeadTime,
    permission,
    requestNotificationPermission,
  } = useCoverageReminders();

  const [open, setOpen] = useState(false);
  const isEnabled = isCoverageReminderActive(coverageId, reminderEnabled);
  const currentLeadTime = getCoverageLeadTime(coverageId);

  // Alterna o status do lembrete com apenas um clique
  const handleDirectClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isEnabled && permission !== "granted") {
      const ok = await requestNotificationPermission();
      if (!ok) return;
    }

    await toggleCoverageReminder(coverageId, isEnabled, kind);
  };

  const handleSelectLeadTime = async (leadTime: ReminderLeadTime) => {
    if (permission !== "granted") {
      const ok = await requestNotificationPermission();
      if (!ok) return;
    }
    if (!isEnabled) {
      await toggleCoverageReminder(coverageId, false, kind);
    }
    setCoverageLeadTime(coverageId, leadTime);
    setOpen(false);
  };

  if (variant === "badge") {
    return (
      <div
        id={`reminder-badge-group-${coverageId}`}
        className={cn(
          "inline-flex items-center gap-0.5 rounded-full border transition-all",
          isEnabled
            ? "bg-primary/10 border-primary/30 text-primary"
            : "bg-surface/80 border-border text-muted-foreground hover:border-border/80",
          className,
        )}
      >
        <button
          id={`btn-toggle-reminder-${coverageId}`}
          type="button"
          onClick={handleDirectClick}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium transition-colors hover:opacity-85"
          title={
            isEnabled
              ? `Lembrete ativo (${getLeadTimeShortLabel(currentLeadTime)}). Clique para desativar.`
              : "Lembrete desativado. Clique para ativar alerta push 30m antes."
          }
        >
          {isEnabled ? (
            <Bell className="size-3.5 fill-primary/20 text-primary transition-transform duration-200" />
          ) : (
            <BellOff className="size-3.5 text-muted-foreground/60" />
          )}
          <span>{isEnabled ? getLeadTimeShortLabel(currentLeadTime) : "Lembrete"}</span>
        </button>

        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <button
              id={`btn-open-reminder-menu-${coverageId}`}
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="px-1.5 py-1 text-[10px] text-muted-foreground hover:text-foreground border-l border-border/50"
              title="Ajustar antecedência do lembrete"
            >
              ▾
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 text-xs">
            <DropdownMenuLabel className="flex items-center justify-between text-xs">
              <span>Lembrete Push</span>
              <span className="font-normal text-[10px] text-muted-foreground">
                {isEnabled ? "Ativo" : "Desativado"}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuItem
              onClick={handleDirectClick}
              className="cursor-pointer gap-2 font-medium"
            >
              {isEnabled ? (
                <>
                  <BellOff className="size-3.5 text-muted-foreground" />
                  <span>Desativar lembrete</span>
                </>
              ) : (
                <>
                  <Bell className="size-3.5 text-primary" />
                  <span>Ativar lembrete</span>
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Antecedência do aviso
            </DropdownMenuLabel>
            {LEAD_TIME_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onClick={() => handleSelectLeadTime(opt.value)}
                className="cursor-pointer flex items-center justify-between text-xs"
              >
                <span
                  className={cn(
                    currentLeadTime === opt.value && isEnabled && "font-medium text-primary",
                  )}
                >
                  {opt.label}
                </span>
                {currentLeadTime === opt.value && isEnabled && (
                  <Check className="size-3 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  if (variant === "row") {
    return (
      <div
        id={`reminder-row-${coverageId}`}
        className={cn(
          "flex items-center justify-between gap-3 rounded-lg border border-border p-3 bg-surface/50",
          className,
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={handleDirectClick}
            className={cn(
              "flex size-8 shrink-0 items-center justify-center rounded-lg border transition-colors",
              isEnabled
                ? "bg-primary/10 border-primary/25 text-primary hover:bg-primary/20"
                : "bg-surface border-border text-muted-foreground hover:text-foreground",
            )}
            title={isEnabled ? "Clique para desativar lembrete" : "Clique para ativar lembrete"}
          >
            {isEnabled ? (
              <Bell className="size-4 fill-primary/20 text-primary" />
            ) : (
              <BellOff className="size-4" />
            )}
          </button>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <span>Lembrete Push antes do evento</span>
              {isEnabled && (
                <span className="rounded bg-primary/15 px-1.5 py-0.2 text-[10px] font-medium text-primary">
                  {getLeadTimeShortLabel(currentLeadTime)}
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground truncate">
              {isEnabled
                ? `Você será avisado no navegador ${getLeadTimeShortLabel(currentLeadTime)}.`
                : "Notificação push desativada para esta cobertura."}
            </p>
          </div>
        </div>

        <DropdownMenu open={open} onOpenChange={setOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              variant={isEnabled ? "secondary" : "outline"}
              className="h-8 gap-1.5 text-xs"
            >
              <Clock className="size-3.5" />
              <span>Ajustar</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 text-xs">
            <DropdownMenuItem
              onClick={handleDirectClick}
              className="cursor-pointer gap-2 font-medium"
            >
              {isEnabled ? (
                <>
                  <BellOff className="size-3.5 text-muted-foreground" />
                  <span>Desativar lembrete</span>
                </>
              ) : (
                <>
                  <Bell className="size-3.5 text-primary" />
                  <span>Ativar lembrete</span>
                </>
              )}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Escolher antecedência
            </DropdownMenuLabel>
            {LEAD_TIME_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onClick={() => handleSelectLeadTime(opt.value)}
                className="cursor-pointer flex items-center justify-between text-xs"
              >
                <span
                  className={cn(
                    currentLeadTime === opt.value && isEnabled && "font-medium text-primary",
                  )}
                >
                  {opt.label}
                </span>
                {currentLeadTime === opt.value && isEnabled && (
                  <Check className="size-3 text-primary" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  // Default "icon" variant: alternância com 1 clique direto no ícone de sino
  return (
    <Button
      id={`btn-reminder-icon-${coverageId}`}
      type="button"
      variant="ghost"
      size="icon"
      onClick={handleDirectClick}
      className={cn(
        "relative size-8 rounded-md transition-all",
        isEnabled
          ? "text-primary bg-primary/10 hover:bg-primary/20 hover:text-primary"
          : "text-muted-foreground/60 hover:text-foreground hover:bg-surface",
        className,
      )}
      title={
        isEnabled
          ? `Lembrete ativo (${getLeadTimeShortLabel(currentLeadTime)}). Clique para desativar.`
          : "Lembrete desativado. Clique para ativar alerta push 30m antes."
      }
    >
      {isEnabled ? (
        <Bell className="size-4 fill-primary/25 text-primary" />
      ) : (
        <BellOff className="size-4" />
      )}
      {isEnabled && (
        <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary" />
      )}
    </Button>
  );
}
