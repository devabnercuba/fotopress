import { Check, ChevronsUpDown, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { CompetitionFormDialog } from "@/components/competition-form-dialog";
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
import { compStyle } from "@/lib/competitions";
import { useCompetitions } from "@/lib/queries";
import { cn } from "@/lib/utils";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Seleção de campeonato com busca (sem acentos, sem diferenciar maiúsculas)
 * e criação rápida de um novo campeonato sem sair do formulário.
 */
export function SearchableCompetitionSelect({
  value,
  onChange,
  placeholder = "Selecione o campeonato",
  className,
  allowCreate = true,
}: {
  value: string | null;
  onChange: (competitionId: string) => void;
  placeholder?: string;
  className?: string;
  allowCreate?: boolean;
}) {
  const { data: competitions = [] } = useCompetitions();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const selected = competitions.find((c) => c.id === value) ?? null;

  const options = useMemo(() => {
    const term = normalize(query);
    if (!term) return competitions;
    return competitions.filter((c) =>
      normalize(`${c.name} ${c.short_name ?? ""} ${c.season} ${c.state ?? ""}`).includes(term),
    );
  }, [competitions, query]);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn("w-full justify-between font-normal", className)}
          >
            <span
              className={cn(
                "flex min-w-0 items-center gap-2",
                !selected && "text-muted-foreground",
              )}
            >
              {selected && (
                <span className={`size-2 rounded-full ${compStyle(selected.color).dot}`} />
              )}
              <span className="truncate">{selected ? selected.name : placeholder}</span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] min-w-[260px] p-0"
          align="start"
          onWheel={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
        >
          <Command shouldFilter={false}>
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="size-3.5 shrink-0 opacity-50" />
              <CommandInput
                value={query}
                onValueChange={setQuery}
                placeholder="Buscar campeonato…"
                className="h-11 border-0 px-0 focus:ring-0"
              />
            </div>
            <CommandList className="max-h-[min(60vh,20rem)] overflow-y-auto overscroll-contain">
              <CommandEmpty>Nenhum campeonato encontrado.</CommandEmpty>
              <CommandGroup>
                {options.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.id}
                    onSelect={() => {
                      onChange(c.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("size-4", value === c.id ? "opacity-100" : "opacity-0")} />
                    <span className={`size-2 shrink-0 rounded-full ${compStyle(c.color).dot}`} />
                    <span className="truncate">{c.name}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{c.season}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
              {allowCreate && (
                <CommandGroup className="border-t border-border">
                  <CommandItem
                    value="__create__"
                    onSelect={() => {
                      setOpen(false);
                      setCreating(true);
                    }}
                  >
                    <Plus className="size-4" />
                    {query.trim() ? `Criar “${query.trim()}”` : "Criar novo campeonato"}
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {allowCreate && (
        <CompetitionFormDialog
          open={creating}
          onOpenChange={setCreating}
          initialName={query.trim()}
          onCreated={(created) => {
            setQuery("");
            onChange(created.id);
          }}
        />
      )}
    </>
  );
}
