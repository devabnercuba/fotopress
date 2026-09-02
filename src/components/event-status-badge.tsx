import React from "react";
import { AlertCircle, CheckCircle2, Clock, Radio, XCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { normalizeSportEventStatus, type SportEventStatus } from "@/schemas/sport-event";

export interface EventStatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: SportEventStatus | string;
  label?: string;
  language?: "pt" | "en";
  showDot?: boolean;
  showIcon?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "solid" | "subtle" | "outline";
}

interface StatusConfig {
  labelPt: string;
  labelEn: string;
  subtleClass: string;
  solidClass: string;
  outlineClass: string;
  dotColor: string;
  pulse?: boolean;
  icon: React.ComponentType<{ className?: string }>;
}

const STATUS_CONFIGS: Record<SportEventStatus, StatusConfig> = {
  scheduled: {
    labelPt: "Agendado",
    labelEn: "Scheduled",
    subtleClass: "bg-comp-blue/15 text-comp-blue border-comp-blue/30",
    solidClass: "bg-comp-blue text-white border-transparent",
    outlineClass: "bg-transparent text-comp-blue border-comp-blue/50",
    dotColor: "bg-comp-blue",
    icon: Clock,
  },
  in_progress: {
    labelPt: "Em Andamento",
    labelEn: "In Progress",
    subtleClass: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
    solidClass: "bg-amber-500 text-white border-transparent",
    outlineClass: "bg-transparent text-amber-600 dark:text-amber-400 border-amber-500/50",
    dotColor: "bg-amber-500",
    pulse: true,
    icon: Radio,
  },
  completed: {
    labelPt: "Concluído",
    labelEn: "Completed",
    subtleClass: "bg-comp-green/15 text-comp-green border-comp-green/30",
    solidClass: "bg-comp-green text-white border-transparent",
    outlineClass: "bg-transparent text-comp-green border-comp-green/50",
    dotColor: "bg-comp-green",
    icon: CheckCircle2,
  },
  cancelled: {
    labelPt: "Cancelado",
    labelEn: "Cancelled",
    subtleClass: "bg-destructive/15 text-destructive border-destructive/30",
    solidClass: "bg-destructive text-destructive-foreground border-transparent",
    outlineClass: "bg-transparent text-destructive border-destructive/50",
    dotColor: "bg-destructive",
    icon: XCircle,
  },
  postponed: {
    labelPt: "Adiado",
    labelEn: "Postponed",
    subtleClass: "bg-comp-orange/15 text-comp-orange border-comp-orange/30",
    solidClass: "bg-comp-orange text-white border-transparent",
    outlineClass: "bg-transparent text-comp-orange border-comp-orange/50",
    dotColor: "bg-comp-orange",
    icon: AlertCircle,
  },
};

const SIZE_CLASSES = {
  sm: "text-[11px] px-2 py-0.5 gap-1",
  md: "text-xs px-2.5 py-1 gap-1.5 font-medium",
  lg: "text-sm px-3 py-1.5 gap-2 font-medium",
};

const ICON_SIZE_CLASSES = {
  sm: "size-3",
  md: "size-3.5",
  lg: "size-4",
};

/**
 * Componente reutilizável de badge de status de eventos esportivos.
 * Exibe o progresso do evento (ex: 'Scheduled', 'In Progress', 'Completed')
 * com cores temáticas personalizadas e acessibilidade visual.
 */
export function EventStatusBadge({
  status,
  label,
  language = "pt",
  showDot = true,
  showIcon = false,
  size = "md",
  variant = "subtle",
  className,
  id,
  ...props
}: EventStatusBadgeProps) {
  const normalizedStatus = normalizeSportEventStatus(status);
  const config = STATUS_CONFIGS[normalizedStatus];
  const IconComponent = config.icon;

  const displayLabel = label ?? (language === "en" ? config.labelEn : config.labelPt);

  const variantClass =
    variant === "solid"
      ? config.solidClass
      : variant === "outline"
        ? config.outlineClass
        : config.subtleClass;

  const badgeId = id ?? `status-badge-${normalizedStatus}`;

  return (
    <span
      id={badgeId}
      role="status"
      aria-label={`Status: ${displayLabel}`}
      className={cn(
        "inline-flex items-center rounded-full border whitespace-nowrap transition-colors",
        SIZE_CLASSES[size],
        variantClass,
        className,
      )}
      {...props}
    >
      {showDot && (
        <span className="relative flex size-1.5 items-center justify-center shrink-0">
          {config.pulse && (
            <span
              className={cn(
                "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                config.dotColor,
              )}
            />
          )}
          <span className={cn("relative inline-flex size-1.5 rounded-full", config.dotColor)} />
        </span>
      )}

      {showIcon && <IconComponent className={cn("shrink-0", ICON_SIZE_CLASSES[size])} />}

      <span>{displayLabel}</span>
    </span>
  );
}
