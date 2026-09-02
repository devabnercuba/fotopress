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
import {
  CATEGORY_SUGGESTIONS,
  formatCategoryLabel,
  normalizeCategory,
  useAthletes,
} from "@/lib/athletes";

/**
 * Seleção de categoria (Sub-15, Principal, Master…).
 * Lista sugestões + categorias já usadas pelo usuário e permite criar novas.
 */
export function CategorySelect({
  value,
  onChange,
  noneLabel = "Sem categoria",
  className,
}: {
  value: string | null;
  onChange: (category: string | null) => void;
  noneLabel?: string;
  className?: string;
}) {
  const { data: athletes = [] } = useAthletes();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const options = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of CATEGORY_SUGGESTIONS) map.set(normalizeCategory(c)!, c);
    for (const a of athletes) {
      const key = normalizeCategory(a.category);
      if (key && !map.has(key)) map.set(key, formatCategoryLabel(a.category)!);
    }
    return [...map.values()];
  }, [athletes]);

  const term = query.trim().toLowerCase();
  const filtered = term ? options.filter((o) => o.toLowerCase().includes(term)) : options;

  const exists = options.some((o) => normalizeCategory(o) === normalizeCategory(query));
  const custom = query.trim() && !exists ? formatCategoryLabel(query)! : null;

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
            {value ? formatCategoryLabel(value) : noneLabel}
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
              placeholder="Buscar ou criar categoria…"
              className="h-11 border-0 px-0 focus:ring-0"
            />
          </div>
          <CommandList className="max-h-64">
            <CommandEmpty>Digite para criar uma nova categoria.</CommandEmpty>
            <CommandGroup>
              <CommandItem value="__none__" onSelect={() => pick(null)}>
                <Check className={cn("size-4", value ? "opacity-0" : "opacity-100")} />
                {noneLabel}
              </CommandItem>
              {custom && (
                <CommandItem value={`__new__${custom}`} onSelect={() => pick(custom)}>
                  <Plus className="size-4" />
                  Nova categoria “{custom}”
                </CommandItem>
              )}
              {filtered.map((option) => (
                <CommandItem key={option} value={option} onSelect={() => pick(option)}>
                  <Check
                    className={cn(
                      "size-4",
                      normalizeCategory(value) === normalizeCategory(option)
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
