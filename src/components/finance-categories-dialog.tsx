import { Check, Pencil, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  defaultCategoriesFor,
  usageCount,
  useCategoryMutations,
  useFinancialCategories,
  type FinancialCategory,
} from "@/lib/finance-categories";
import {
  ENTRY_TYPE_LABEL,
  normalizeCategory,
  useFinancialEntries,
  type EntryType,
} from "@/lib/finance";
import { cn } from "@/lib/utils";

/**
 * Gerenciamento de categorias financeiras.
 * Renomear ou remover uma categoria NUNCA altera lançamentos já registrados —
 * o histórico guarda o texto da época.
 */
export function FinanceCategoriesDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data: categories = [], isLoading } = useFinancialCategories();
  const { data: entries = [] } = useFinancialEntries();
  const { create, update, remove } = useCategoryMutations();

  const [type, setType] = useState<EntryType>("expense");
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [toDelete, setToDelete] = useState<FinancialCategory | null>(null);

  const ofType = categories.filter((c) => c.type === type);
  const known = new Set(ofType.map((c) => normalizeCategory(c.name)));
  const missingDefaults = defaultCategoriesFor(type).filter(
    (c) => !known.has(normalizeCategory(c)),
  );

  function add(name: string) {
    const value = name.trim();
    if (!value) return;
    if (known.has(normalizeCategory(value))) {
      toast.error("Já existe uma categoria com esse nome.");
      return;
    }
    create.mutate(
      { type, name: value },
      {
        onSuccess: () => {
          setNewName("");
          toast.success("Categoria criada.");
        },
        onError: () => toast.error("Não foi possível criar a categoria."),
      },
    );
  }

  function saveRename(category: FinancialCategory) {
    const value = editingName.trim();
    if (!value) return;
    if (
      normalizeCategory(value) !== normalizeCategory(category.name) &&
      known.has(normalizeCategory(value))
    ) {
      toast.error("Já existe uma categoria com esse nome.");
      return;
    }
    update.mutate(
      { id: category.id, name: value },
      {
        onSuccess: () => {
          setEditingId(null);
          toast.success("Categoria renomeada. O histórico foi preservado.");
        },
        onError: () => toast.error("Não foi possível renomear."),
      },
    );
  }

  function confirmDelete() {
    if (!toDelete) return;
    const id = toDelete.id;
    setToDelete(null);
    remove.mutate(id, {
      onSuccess: () => toast.success("Categoria removida do catálogo."),
      onError: () => toast.error("Não foi possível remover."),
    });
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Categorias financeiras</DialogTitle>
            <DialogDescription>
              Organize suas categorias de receita e despesa. Renomear ou remover não altera as
              movimentações já lançadas.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={type} onValueChange={(v) => setType(v as EntryType)}>
            <TabsList className="w-full">
              <TabsTrigger value="expense" className="flex-1">
                {ENTRY_TYPE_LABEL.expense}s
              </TabsTrigger>
              <TabsTrigger value="income" className="flex-1">
                {ENTRY_TYPE_LABEL.income}s
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex items-center gap-2">
            <Input
              placeholder="Nova categoria"
              value={newName}
              maxLength={40}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add(newName);
                }
              }}
            />
            <Button onClick={() => add(newName)} disabled={create.isPending || !newName.trim()}>
              <Plus className="size-4" /> Adicionar
            </Button>
          </div>

          <div className="max-h-[42vh] space-y-4 overflow-y-auto pr-1">
            <section className="space-y-1.5">
              <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Suas categorias
              </h4>
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Carregando…</p>
              ) : ofType.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma categoria própria ainda. Adicione acima ou use as sugestões.
                </p>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border">
                  {ofType.map((category) => {
                    const used = usageCount(entries, type, category.name);
                    const editing = editingId === category.id;
                    return (
                      <li key={category.id} className="flex items-center gap-2 px-3 py-2">
                        {editing ? (
                          <>
                            <Input
                              autoFocus
                              value={editingName}
                              maxLength={40}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveRename(category);
                                if (e.key === "Escape") setEditingId(null);
                              }}
                              className="h-8"
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Salvar nome"
                              onClick={() => saveRename(category)}
                            >
                              <Check className="size-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Cancelar edição"
                              onClick={() => setEditingId(null)}
                            >
                              <X className="size-4" />
                            </Button>
                          </>
                        ) : (
                          <>
                            <span
                              className={cn(
                                "min-w-0 flex-1 truncate text-sm",
                                !category.is_active && "text-muted-foreground line-through",
                              )}
                            >
                              {category.name}
                            </span>
                            {used > 0 && (
                              <Badge variant="outline" className="shrink-0 text-[10px]">
                                {used} uso{used > 1 ? "s" : ""}
                              </Badge>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label={
                                category.is_active ? "Desativar categoria" : "Reativar categoria"
                              }
                              onClick={() =>
                                update.mutate({ id: category.id, is_active: !category.is_active })
                              }
                            >
                              {category.is_active ? (
                                <X className="size-3.5 opacity-70" />
                              ) : (
                                <RotateCcw className="size-3.5 opacity-70" />
                              )}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Renomear categoria"
                              onClick={() => {
                                setEditingId(category.id);
                                setEditingName(category.name);
                              }}
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              aria-label="Excluir categoria"
                              onClick={() => setToDelete(category)}
                            >
                              <Trash2 className="size-3.5 opacity-70" />
                            </Button>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {missingDefaults.length > 0 && (
              <section className="space-y-1.5">
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Sugestões do FotoPress
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {missingDefaults.map((name) => (
                    <Button
                      key={name}
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => add(name)}
                    >
                      <Plus className="size-3" /> {name}
                    </Button>
                  ))}
                </div>
              </section>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(next) => !next && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir “{toDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              A categoria sai do catálogo, mas as movimentações já lançadas continuam com o nome
              atual e não serão alteradas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
