import { Check, CheckCircle2, ChevronDown, Clock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CredentialStatus } from "@/lib/coverages";

export type SimpleCoverageStatus = "confirmed" | "exempt" | "pending" | "cancelled";

export const COVERAGE_STATUS_CONFIG: Record<
  SimpleCoverageStatus,
  {
    label: string;
    description: string;
    badgeClass: string;
    dotClass: string;
    icon: typeof CheckCircle2;
  }
> = {
  confirmed: {
    label: "Confirmado",
    description: "Cobertura e credenciamento confirmados",
    badgeClass:
      "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25",
    dotClass: "bg-emerald-500",
    icon: CheckCircle2,
  },
  exempt: {
    label: "Credenciamento dispensado",
    description: "Cobertura com credenciamento dispensado",
    badgeClass:
      "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30 hover:bg-sky-500/25",
    dotClass: "bg-sky-500",
    icon: CheckCircle2,
  },
  pending: {
    label: "Pendente",
    description: "Aguardando confirmação ou credenciamento",
    badgeClass:
      "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/25",
    dotClass: "bg-amber-500",
    icon: Clock,
  },
  cancelled: {
    label: "Cancelado",
    description: "Cobertura ou credenciamento cancelado",
    badgeClass:
      "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/25",
    dotClass: "bg-rose-500",
    icon: XCircle,
  },
};

/**
 * Converte status do banco de dados (credential_status ou status) para o enum simples ('confirmed' | 'exempt' | 'pending' | 'cancelled')
 */
export function toCoverageStatus(
  credentialStatus?: string | null,
  rawStatus?: string | null,
): SimpleCoverageStatus {
  if (rawStatus === "cancelled" || credentialStatus === "denied") {
    return "cancelled";
  }
  if (credentialStatus === "exempt" || rawStatus === "exempt") {
    return "exempt";
  }
  if (rawStatus === "confirmed" || credentialStatus === "approved") {
    return "confirmed";
  }
  return "pending";
}

/**
 * Converte o enum simples de volta para o formato de credential_status do banco
 */
export function toCredentialStatus(status: SimpleCoverageStatus): CredentialStatus {
  switch (status) {
    case "confirmed":
      return "approved";
    case "exempt":
      return "exempt";
    case "cancelled":
      return "denied";
    case "pending":
    default:
      return "requested";
  }
}

interface CoverageStatusBadgeProps {
  status: SimpleCoverageStatus;
  onChange?: (newStatus: SimpleCoverageStatus) => void;
  disabled?: boolean;
  className?: string;
  size?: "sm" | "default";
}

export function CoverageStatusBadge({
  status,
  onChange,
  disabled = false,
  className = "",
  size = "sm",
}: CoverageStatusBadgeProps) {
  const config = COVERAGE_STATUS_CONFIG[status] ?? COVERAGE_STATUS_CONFIG.pending;
  const Icon = config.icon;

  const badgeContent = (
    <Badge
      variant="outline"
      className={`inline-flex items-center gap-1.5 font-medium transition-colors ${config.badgeClass} ${
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs"
      } ${onChange && !disabled ? "cursor-pointer select-none" : ""} ${className}`}
    >
      <Icon className="size-3 shrink-0" />
      <span>{config.label}</span>
      {onChange && !disabled && <ChevronDown className="size-2.5 opacity-60 ml-0.5" />}
    </Badge>
  );

  if (!onChange || disabled) {
    return badgeContent;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{badgeContent}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        {(Object.keys(COVERAGE_STATUS_CONFIG) as SimpleCoverageStatus[]).map((key) => {
          const itemConfig = COVERAGE_STATUS_CONFIG[key];
          const ItemIcon = itemConfig.icon;
          const isSelected = key === status;

          return (
            <DropdownMenuItem
              key={key}
              onClick={() => onChange(key)}
              className="flex items-center justify-between text-xs cursor-pointer py-1.5"
            >
              <div className="flex items-center gap-2">
                <span className={`size-2 rounded-full ${itemConfig.dotClass}`} />
                <ItemIcon className="size-3.5 text-muted-foreground" />
                <span
                  className={isSelected ? "font-semibold text-foreground" : "text-muted-foreground"}
                >
                  {itemConfig.label}
                </span>
              </div>
              {isSelected && <Check className="size-3.5 text-primary ml-2" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
