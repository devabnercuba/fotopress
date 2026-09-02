import React, { useCallback } from "react";
import { Search, Shield, Trophy, X } from "lucide-react";

import { cn } from "@/lib/utils";

export type SearchScope = "all" | "team" | "competition";

export interface EventSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  scope?: SearchScope;
  onScopeChange?: (scope: SearchScope) => void;
  placeholder?: string;
  resultsCount?: number;
  totalCount?: number;
  className?: string;
  id?: string;
  autoFocus?: boolean;
}

/**
 * Componente de busca para filtrar eventos esportivos por nome do time ou competição.
 * Oferece ícone de busca, botão de limpeza rápida e filtros rápidos por escopo.
 */
export function EventSearchInput({
  value,
  onChange,
  scope = "all",
  onScopeChange,
  placeholder,
  resultsCount,
  totalCount,
  className,
  id = "event-search-input",
  autoFocus = false,
}: EventSearchInputProps) {
  const handleClear = useCallback(() => {
    onChange("");
  }, [onChange]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Escape") {
        handleClear();
      }
    },
    [handleClear],
  );

  const defaultPlaceholder =
    scope === "team"
      ? "Buscar por nome do time..."
      : scope === "competition"
        ? "Buscar por campeonato ou torneio..."
        : "Filtrar por time ou competição...";

  return (
    <div className={cn("flex flex-col gap-2 w-full", className)}>
      <div className="relative flex items-center w-full">
        {/* Ícone de Busca */}
        <div className="pointer-events-none absolute left-3 flex items-center text-muted-foreground">
          <Search className="size-4" aria-hidden="true" />
        </div>

        {/* Input de Texto */}
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          autoFocus={autoFocus}
          placeholder={placeholder ?? defaultPlaceholder}
          aria-label="Filtrar eventos esportivos por time ou competição"
          className={cn(
            "h-10 w-full rounded-lg border border-input bg-card pl-9 pr-20 text-sm shadow-xs transition-colors",
            "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
          )}
        />

        {/* Lado direito: contador de resultados ou botão de limpar */}
        <div className="absolute right-2.5 flex items-center gap-1.5">
          {typeof resultsCount === "number" && value.trim().length > 0 && (
            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              {resultsCount} {resultsCount === 1 ? "resultado" : "resultados"}
            </span>
          )}

          {value.length > 0 && (
            <button
              type="button"
              onClick={handleClear}
              id={`${id}-clear-button`}
              title="Limpar busca (Esc)"
              aria-label="Limpar busca"
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Seletor rápido de escopo (opcional caso `onScopeChange` seja fornecido) */}
      {onScopeChange && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="text-[11px]">Foco:</span>
          <button
            type="button"
            id={`${id}-scope-all`}
            onClick={() => onScopeChange("all")}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-0.5 transition-colors text-[11px]",
              scope === "all"
                ? "bg-primary text-primary-foreground font-medium"
                : "bg-surface hover:bg-muted text-foreground",
            )}
          >
            Todos
          </button>
          <button
            type="button"
            id={`${id}-scope-team`}
            onClick={() => onScopeChange("team")}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-0.5 transition-colors text-[11px]",
              scope === "team"
                ? "bg-primary text-primary-foreground font-medium"
                : "bg-surface hover:bg-muted text-foreground",
            )}
          >
            <Shield className="size-3" /> Time
          </button>
          <button
            type="button"
            id={`${id}-scope-competition`}
            onClick={() => onScopeChange("competition")}
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-0.5 transition-colors text-[11px]",
              scope === "competition"
                ? "bg-primary text-primary-foreground font-medium"
                : "bg-surface hover:bg-muted text-foreground",
            )}
          >
            <Trophy className="size-3" /> Competição
          </button>

          {typeof totalCount === "number" && (
            <span className="ml-auto text-[11px] text-muted-foreground">
              {totalCount} {totalCount === 1 ? "evento no total" : "eventos no total"}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
