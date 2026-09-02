import { Check, ChevronsUpDown, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { stripAccents, teamLabel, useTeams } from "@/lib/teams";

/**
 * Seleção de clube com busca.
 * ---------------------------
 * Componente único usado em Novo atleta, Editar atleta e no filtro da página.
 * Nunca cria clubes: apenas seleciona um `team_id` já existente em `teams`.
 */
const NONE = "__none__";
/** Sem digitação, mostramos apenas os primeiros clubes — a lista nunca é gigante. */
const INITIAL = 12;
const MAX = 50;

function normalize(value: string) {
  return stripAccents(value).toLowerCase().trim();
}

export function SearchableTeamSelect({
  value,
  onChange,
  placeholder = "Selecione o clube",
  noneLabel = "Sem clube",
  className,
}: {
  value: string | null;
  onChange: (teamId: string | null) => void;
  placeholder?: string;
  noneLabel?: string;
  className?: string;
}) {
  const { data: teams = [] } = useTeams();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const selected = teams.find((t) => t.id === value) ?? null;

  const options = useMemo(() => {
    const term = normalize(query);
    if (!term) return teams.slice(0, INITIAL);
    return teams
      .filter((t) =>
        normalize(
          `${t.name} ${t.short_name ?? ""} ${t.city ?? ""} ${t.category ?? ""} ${t.sport_key ?? ""} ${t.gender ?? ""}`,
        ).includes(term),
      )
      .slice(0, MAX);
  }, [teams, query]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? teamLabel(selected) : value === null ? noneLabel : placeholder}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[240px] p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="size-3.5 shrink-0 opacity-50" />
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Buscar clube…"
              className="h-11 border-0 px-0 focus:ring-0"
            />
          </div>
          <CommandList className="max-h-64">
            <CommandEmpty>Nenhum clube encontrado.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value={NONE}
                onSelect={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                <Check className={cn("size-4", value ? "opacity-0" : "opacity-100")} />
                {noneLabel}
              </CommandItem>
              {options.map((team) => (
                <CommandItem
                  key={team.id}
                  value={team.id}
                  onSelect={() => {
                    onChange(team.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("size-4", value === team.id ? "opacity-100" : "opacity-0")}
                  />
                  <span className="truncate">{teamLabel(team)}</span>
                  {team.state && (
                    <span className="ml-auto text-xs text-muted-foreground">{team.state}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
            {!query && teams.length > INITIAL && (
              <p className="px-3 py-2 text-[11px] text-muted-foreground">
                Mostrando {INITIAL} de {teams.length} clubes. Digite para buscar.
              </p>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
