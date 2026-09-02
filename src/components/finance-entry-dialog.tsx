import { format, parseISO } from "date-fns";
import { Check, ChevronsUpDown } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FinanceCategoryPicker } from "@/components/finance-category-picker";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import {
  ENTRY_TYPE_LABEL,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  customCategories,
  normalizeCategory,
  parseCoverageKey,
  useFinanceMutations,
  useFinancialEntries,
  type EntryType,
  type FinancialEntry,
} from "@/lib/finance";
import { cn } from "@/lib/utils";

export type CoverageOption = {
  key: string;
  label: string;
  date: string;
  kind: "PARTIDA" | "EVENTO";
};

const todayKey = () => format(new Date(), "yyyy-MM-dd");

function CoveragePicker({
  options,
  value,
  onChange,
}: {
  options: CoverageOption[];
  value: string;
  onChange: (key: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.key === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
          <span className="truncate">{selected ? selected.label : "Selecionar cobertura"}</span>
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
        <Command>
          <CommandInput placeholder="Buscar partida ou evento..." />
          <CommandList>
            <CommandEmpty>Nenhuma cobertura encontrada.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.key}
                  value={`${option.label} ${option.kind}`}
                  onSelect={() => {
                    onChange(option.key);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("size-4", option.key === value ? "opacity-100" : "opacity-0")}
                  />
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {format(parseISO(option.date), "dd/MM/yyyy")} · {option.kind}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function FinanceEntryDialog({
  open,
  onOpenChange,
  options,
  entry,
  defaultCoverage,
  onManageCategories,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  options: CoverageOption[];
  entry?: FinancialEntry | null;
  defaultCoverage?: string;
  onManageCategories?: () => void;
}) {
  const { create, update } = useFinanceMutations();
  const [type, setType] = useState<EntryType>("expense");
  const [coverage, setCoverage] = useState("");
  const [category, setCategory] = useState("");
  const [amount, setAmount] = useState("");
  const [occurredAt, setOccurredAt] = useState(todayKey());
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    if (entry) {
      setType(entry.type);
      // Cobertura já excluída: não inventa uma chave inválida — o usuário
      // escolhe outra cobertura antes de salvar.
      setCoverage(
        entry.match_id
          ? `match:${entry.match_id}`
          : entry.event_id
            ? `event:${entry.event_id}`
            : "",
      );

      setCategory(entry.category ?? "");
      setAmount(String(entry.amount).replace(".", ","));
      setOccurredAt(entry.occurred_at);
      setDescription(entry.description ?? "");
      setNotes(entry.notes ?? "");
    } else {
      setType("expense");
      setCoverage(defaultCoverage ?? "");
      setCategory("");
      setAmount("");
      setOccurredAt(todayKey());
      setDescription("");
      setNotes("");
    }
  }, [open, entry, defaultCoverage]);

  const { data: entries = [] } = useFinancialEntries();

  function handleTypeChange(next: EntryType) {
    setType(next);
    const nextCategories = next === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    const stillValid =
      !category ||
      nextCategories.some((c) => normalizeCategory(c) === normalizeCategory(category)) ||
      customCategories(entries, next).some(
        (c) => normalizeCategory(c) === normalizeCategory(category),
      );
    if (!stillValid) setCategory("");
  }

  function submit() {
    const value = Number(amount.replace(/\./g, "").replace(",", "."));
    if (!coverage) return toast.error("Selecione a cobertura.");
    if (!Number.isFinite(value) || value <= 0) return toast.error("Informe um valor válido.");
    if (!occurredAt) return toast.error("Informe a data.");

    const picked = options.find((o) => o.key === coverage);
    const payload = {
      type,
      amount: value,
      category: category.trim() || null,
      description: description.trim() || null,
      occurred_at: occurredAt,
      notes: notes.trim() || null,
      // Resumo gravado junto: o histórico continua legível mesmo se a
      // partida/evento for excluído no futuro.
      coverage_label: picked?.label ?? entry?.coverage_label ?? null,
      coverage_date: picked?.date ?? entry?.coverage_date ?? null,
      coverage_type: picked
        ? picked.kind === "PARTIDA"
          ? "match"
          : "event"
        : (entry?.coverage_type ?? null),
      ...parseCoverageKey(coverage),
    };

    const done = () => {
      toast.success(entry ? "Movimentação atualizada." : "Movimentação registrada.");
      onOpenChange(false);
    };
    const fail = () => toast.error("Não foi possível salvar a movimentação.");

    if (entry) update.mutate({ id: entry.id, ...payload }, { onSuccess: done, onError: fail });
    else create.mutate(payload, { onSuccess: done, onError: fail });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{entry ? "Editar movimentação" : "Nova movimentação"}</DialogTitle>
          <DialogDescription>
            Receitas e despesas sempre ligadas a uma partida ou evento que você cobriu.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label id="fin-type-label">Tipo *</Label>
            <div
              role="radiogroup"
              aria-labelledby="fin-type-label"
              className="flex w-full items-center gap-0.5 rounded-md border bg-surface p-0.5"
            >
              {(["income", "expense"] as EntryType[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={type === option}
                  onClick={() => handleTypeChange(option)}
                  className={cn(
                    "flex-1 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors",
                    type === option
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {ENTRY_TYPE_LABEL[option]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Cobertura *</Label>
            <CoveragePicker options={options} value={coverage} onChange={setCoverage} />
          </div>

          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <FinanceCategoryPicker
              type={type}
              value={category}
              onChange={setCategory}
              {...(onManageCategories ? { onManage: onManageCategories } : {})}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="fin-amount">Valor (R$) *</Label>
              <Input
                id="fin-amount"
                inputMode="decimal"
                placeholder="150,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fin-date">Data *</Label>
              <Input
                id="fin-date"
                type="date"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fin-desc">Descrição</Label>
            <Input
              id="fin-desc"
              maxLength={160}
              placeholder="Pacote João, combustível ida e volta…"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="fin-notes">Observações</Label>
            <Textarea
              id="fin-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={create.isPending || update.isPending}>
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
