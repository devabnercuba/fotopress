import {
  BadgeCheck,
  Bed,
  Briefcase,
  Bus,
  Camera,
  Car,
  Check,
  ChevronsUpDown,
  CircleParking,
  FileCheck,
  Fuel,
  Images,
  MoreHorizontal,
  Plus,
  Settings2,
  ShoppingBag,
  Tag,
  Utensils,
  type LucideIcon,
} from "lucide-react";
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
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  normalizeCategory,
  useFinancialEntries,
  type EntryType,
} from "@/lib/finance";
import { pickerCategories, useFinancialCategories } from "@/lib/finance-categories";
import { cn } from "@/lib/utils";

const EXPENSE_ICONS: Record<string, LucideIcon> = {
  Combustível: Fuel,
  Pedágio: Car,
  Estacionamento: CircleParking,
  Alimentação: Utensils,
  Hospedagem: Bed,
  Transporte: Bus,
  Credenciamento: BadgeCheck,
  Equipamento: Camera,
  Outros: MoreHorizontal,
};

const INCOME_ICONS: Record<string, LucideIcon> = {
  "Pacote de fotos": Images,
  "Venda de fotos": ShoppingBag,
  Cobertura: Camera,
  Serviço: Briefcase,
  Licenciamento: FileCheck,
  Outros: MoreHorizontal,
};

function iconsFor(type: EntryType) {
  return type === "income" ? INCOME_ICONS : EXPENSE_ICONS;
}

function categoriesFor(type: EntryType): readonly string[] {
  return type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

function iconForCategory(type: EntryType, value: string): LucideIcon {
  const icons = iconsFor(type);
  const match = Object.keys(icons).find(
    (key) => normalizeCategory(key) === normalizeCategory(value),
  );
  return match ? icons[match]! : Tag;
}

function CategoryList({
  type,
  value,
  own,
  suggested,
  historical,
  search,
  onSearchChange,
  onSelect,
  onManage,
}: {
  type: EntryType;
  value: string;
  own: string[];
  suggested: string[];
  historical: string[];
  search: string;
  onSearchChange: (value: string) => void;
  onSelect: (value: string) => void;
  onManage?: (() => void) | undefined;
}) {
  const icons = iconsFor(type);
  const term = search.trim();
  const hasExactMatch = [...own, ...suggested, ...historical].some(
    (c) => normalizeCategory(c) === normalizeCategory(term),
  );

  const renderItem = (c: string, fallbackIcon = false) => {
    const Icon = fallbackIcon ? Tag : (icons[c] ?? iconForCategory(type, c));
    return (
      <CommandItem key={c} value={c} onSelect={() => onSelect(c)}>
        <Icon className="size-4 text-muted-foreground" />
        <span className="flex-1 truncate">{c}</span>
        <Check
          className={cn(
            "size-4",
            normalizeCategory(value) === normalizeCategory(c) ? "opacity-100" : "opacity-0",
          )}
        />
      </CommandItem>
    );
  };

  return (
    <Command shouldFilter>
      <CommandInput
        placeholder="Buscar categoria..."
        value={search}
        onValueChange={onSearchChange}
      />
      <CommandList>
        <CommandEmpty>Nenhuma categoria encontrada.</CommandEmpty>
        {own.length > 0 && (
          <CommandGroup heading="Suas categorias">{own.map((c) => renderItem(c))}</CommandGroup>
        )}
        {suggested.length > 0 && (
          <CommandGroup heading="Sugestões">{suggested.map((c) => renderItem(c))}</CommandGroup>
        )}
        {historical.length > 0 && (
          <CommandGroup heading="Usadas por você">
            {historical.map((c) => renderItem(c, true))}
          </CommandGroup>
        )}
        {term && !hasExactMatch && (
          <CommandGroup>
            <CommandItem value={term} onSelect={() => onSelect(term)}>
              <Plus className="size-4 text-muted-foreground" />
              <span className="flex-1 truncate">Criar "{term}"</span>
            </CommandItem>
          </CommandGroup>
        )}
        {onManage && (
          <CommandGroup>
            <CommandItem value="__gerenciar" onSelect={onManage}>
              <Settings2 className="size-4 text-muted-foreground" />
              <span className="flex-1 truncate">Gerenciar categorias</span>
            </CommandItem>
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  );
}

export function FinanceCategoryPicker({
  type,
  value,
  onChange,
  onManage,
}: {
  type: EntryType;
  value: string;
  onChange: (value: string) => void;
  onManage?: () => void;
}) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const { data: categories = [] } = useFinancialCategories();
  const { data: entries = [] } = useFinancialEntries();
  const groups = useMemo(
    () => pickerCategories(type, categories, entries),
    [type, categories, entries],
  );

  const Icon = value ? iconForCategory(type, value) : Tag;

  const trigger = (
    <Button
      type="button"
      variant="outline"
      role="combobox"
      aria-expanded={open}
      className="w-full min-w-0 justify-between font-normal"
      onClick={() => setOpen(true)}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Icon className="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate">{value || "Escolha ou digite"}</span>
      </span>
      <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
    </Button>
  );

  function handleSelect(next: string) {
    onChange(next);
    setSearch("");
    setOpen(false);
  }

  function handleManage() {
    setOpen(false);
    onManage?.();
  }

  const list = (
    <CategoryList
      type={type}
      value={value}
      own={groups.own}
      suggested={groups.suggested}
      historical={groups.historical}
      search={search}
      onSearchChange={setSearch}
      onSelect={handleSelect}
      onManage={onManage ? handleManage : undefined}
    />
  );

  if (isMobile) {
    return (
      <>
        {trigger}
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Categoria</DrawerTitle>
            </DrawerHeader>
            <div className="px-1 pb-4">{list}</div>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        {list}
      </PopoverContent>
    </Popover>
  );
}
