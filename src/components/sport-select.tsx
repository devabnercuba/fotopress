import { Check, ChevronsUpDown, Plus, Search } from "lucide-react";
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
import { useSportLabelPriority } from "@/lib/sport-preferences";
import { SPORT_SUGGESTIONS, formatSportLabel, normalizeSport } from "@/lib/sports";

/**
 * Seleção de modalidade (Futebol, Corrida, Beach Tennis…).
 * Lista sugestões + modalidades já usadas e permite criar novas.
 */
export function SportSelect({
  value,
  onChange,
  extra = [],
  noneLabel = "Sem modalidade",
  className,
}: {
  value: string | null;
  onChange: (sport: string | null) => void;
  /** Modalidades já cadastradas pelo usuário (eventos/atletas). */
  extra?: (string | null | undefined)[];
  noneLabel?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Modalidades escolhidas em Configurações aparecem primeiro (nada é escondido).
  const priority = useSportLabelPriority();

  const options = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of SPORT_SUGGESTIONS) map.set(normalizeSport(s)!, s);
    for (const s of extra) {
      const key = normalizeSport(s);
      if (key && !map.has(key)) map.set(key, formatSportLabel(s)!);
    }
    const rank = (label: string) => {
      const index = priority.indexOf(normalizeSport(label)!);
      return index === -1 ? priority.length : index;
    };
    return [...map.values()].sort((a, b) => rank(a) - rank(b));
  }, [extra, priority]);

  const term = query.trim().toLowerCase();
  const filtered = term ? options.filter((o) => o.toLowerCase().includes(term)) : options;

  const exists = options.some((o) => normalizeSport(o) === normalizeSport(query));
  const custom = query.trim() && !exists ? formatSportLabel(query)! : null;

  const pick = (next: string | null) => {
    onChange(next);
    setQuery("");
    setOpen(false);
  };

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
          <span className={cn("truncate", !value && "text-muted-foreground")}>
            {value ? formatSportLabel(value) : noneLabel}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[220px] p-0"
        align="start"
      >
        <Command shouldFilter={false}>
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search className="size-3.5 shrink-0 opacity-50" />
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder="Buscar ou criar modalidade…"
              className="h-11 border-0 px-0 focus:ring-0"
            />
          </div>
          <CommandList className="max-h-64">
            <CommandEmpty>Digite para criar uma nova modalidade.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="__none__" onSelect={() => pick(null)}>
                <Check className={cn("size-4", value ? "opacity-0" : "opacity-100")} />
                {noneLabel}
              </CommandItem>
              {custom && (
                <CommandItem value={`__new__${custom}`} onSelect={() => pick(custom)}>
                  <Plus className="size-4" />
                  Nova modalidade “{custom}”
                </CommandItem>
              )}
              {filtered.map((option) => (
                <CommandItem key={option} value={option} onSelect={() => pick(option)}>
                  <Check
                    className={cn(
                      "size-4",
                      normalizeSport(value) === normalizeSport(option)
                        ? "opacity-100"
                        : "opacity-0",
                    )}
                  />
                  <span className="truncate">{option}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
