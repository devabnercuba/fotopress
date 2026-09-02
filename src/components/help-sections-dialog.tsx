import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, GripVertical } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { HELP_SECTION_LABELS, useSaveHelpSections, type HelpSection } from "@/lib/help-sections";

/** Editor administrativo da ordem dos blocos da página Primeiros passos. */
export function HelpSectionsDialog({
  open,
  sections,
  onOpenChange,
}: {
  open: boolean;
  sections: HelpSection[];
  onOpenChange: (open: boolean) => void;
}) {
  const [items, setItems] = useState<HelpSection[]>(sections);
  const [dragging, setDragging] = useState<number | null>(null);
  const save = useSaveHelpSections();

  useEffect(() => {
    if (open) setItems(sections);
  }, [open, sections]);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    setItems(next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Organizar Primeiros passos</DialogTitle>
          <DialogDescription>
            Arraste os blocos (ou use as setas) para definir a ordem em que aparecem para os
            usuários.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2">
          {items.map((item, index) => (
            <li
              key={item.section_key}
              draggable
              onDragStart={() => setDragging(index)}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragging !== null && dragging !== index) {
                  move(dragging, index);
                  setDragging(index);
                }
              }}
              onDragEnd={() => setDragging(null)}
              className="flex items-center gap-2 rounded-lg border border-border bg-card p-2.5"
            >
              <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" />
              <span className="min-w-0 flex-1 truncate text-sm">
                {HELP_SECTION_LABELS[item.section_key]}
              </span>
              <Switch
                checked={item.is_visible}
                aria-label={`Exibir ${HELP_SECTION_LABELS[item.section_key]}`}
                onCheckedChange={(checked) =>
                  setItems((prev) =>
                    prev.map((s, i) => (i === index ? { ...s, is_visible: checked } : s)),
                  )
                }
              />
              <Button
                size="icon"
                variant="ghost"
                aria-label="Mover para cima"
                disabled={index === 0}
                onClick={() => move(index, index - 1)}
              >
                <ChevronUp className="size-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Mover para baixo"
                disabled={index === items.length - 1}
                onClick={() => move(index, index + 1)}
              >
                <ChevronDown className="size-4" />
              </Button>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            disabled={save.isPending}
            onClick={() =>
              save.mutate(items, {
                onSuccess: () => {
                  toast.success("Ordem atualizada para todos os usuários.");
                  onOpenChange(false);
                },
                onError: () => toast.error("Não foi possível salvar a ordem."),
              })
            }
          >
            Salvar ordem
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
