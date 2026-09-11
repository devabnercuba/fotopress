import { useState } from "react";
import { Check, FileText, Loader2, NotebookPen, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CoverageNotesEditorProps {
  coverageId: string;
  initialNotes?: string | null;
  onSave: (notes: string | null) => Promise<void> | void;
  title?: string;
  variant?: "card" | "sheet" | "inline";
  className?: string;
}

export function CoverageNotesEditor({
  initialNotes,
  onSave,
  title = "Notas da Cobertura",
  variant = "card",
  className = "",
}: CoverageNotesEditorProps) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [isSaving, setIsSaving] = useState(false);

  // Sincroniza se a prop mudar
  const handleOpen = () => {
    setNotes(initialNotes ?? "");
    setOpen(true);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const cleanNotes = notes.trim() ? notes.trim() : null;
      await onSave(cleanNotes);
      toast.success(cleanNotes ? "Nota da cobertura salva!" : "Nota removida!");
      setOpen(false);
    } catch (error) {
      console.error("Erro ao salvar nota:", error);
      toast.error("Não foi possível salvar a nota.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    try {
      setIsSaving(true);
      await onSave(null);
      setNotes("");
      toast.success("Nota removida com sucesso!");
      setOpen(false);
    } catch (error) {
      console.error("Erro ao limpar nota:", error);
      toast.error("Erro ao remover nota.");
    } finally {
      setIsSaving(false);
    }
  };

  if (variant === "sheet") {
    return (
      <div className={`space-y-2 rounded-lg border border-border bg-card/60 p-3.5 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
            <NotebookPen className="size-3.5 text-primary" />
            <span>{title}</span>
          </div>
          {initialNotes && <span className="text-[11px] text-muted-foreground">Salva</span>}
        </div>
        <Textarea
          placeholder="Ex: Retirar credencial no portão 4, falar com assessor de imprensa, levar lente 70-200mm..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="text-xs resize-none bg-background"
        />
        <div className="flex items-center justify-between pt-1">
          {initialNotes ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              disabled={isSaving}
              className="h-7 text-xs text-destructive hover:bg-destructive/10 gap-1 px-2"
            >
              <Trash2 className="size-3" />
              <span>Remover nota</span>
            </Button>
          ) : (
            <span />
          )}
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isSaving || notes === (initialNotes ?? "")}
            className="h-7 text-xs gap-1 px-3"
          >
            {isSaving ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
            <span>Salvar nota</span>
          </Button>
        </div>
      </div>
    );
  }

  // Card view: preview compacto ou botão discreto
  const hasNote = Boolean(initialNotes?.trim());

  return (
    <>
      <div className={`inline-flex items-center ${className}`}>
        {hasNote ? (
          <button
            type="button"
            onClick={handleOpen}
            title="Clique para ver ou editar esta nota"
            className="group flex max-w-[260px] sm:max-w-[340px] items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-left text-[11px] text-amber-800 dark:text-amber-300 transition-colors hover:bg-amber-500/20"
          >
            <FileText className="size-3 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="truncate italic font-normal">{initialNotes}</span>
            <NotebookPen className="size-2.5 opacity-0 transition-opacity group-hover:opacity-100 ml-0.5 shrink-0" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleOpen}
            className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            title="Adicionar nota ou lembrete livre para esta cobertura"
          >
            <NotebookPen className="size-3" />
            <span className="hidden sm:inline">Nota</span>
          </button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <NotebookPen className="size-4 text-primary" />
              <span>{title}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              Adicione lembretes e notas livres para auxiliar no dia da cobertura (portão de acesso,
              instruções de credenciamento, equipamentos específicos, etc).
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <Textarea
              placeholder="Digite aqui as notas ou lembretes da cobertura..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              autoFocus
              className="text-xs leading-relaxed"
            />
            <p className="mt-1 text-[11px] text-muted-foreground text-right">
              Salvo no banco de dados e incluído no arquivo .ics do calendário.
            </p>
          </div>

          <DialogFooter className="flex flex-row items-center justify-between sm:justify-between">
            {hasNote ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                disabled={isSaving}
                className="text-xs text-destructive hover:bg-destructive/10 gap-1"
              >
                <Trash2 className="size-3.5" />
                <span>Excluir nota</span>
              </Button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={isSaving}
                className="text-xs"
              >
                <X className="size-3.5 mr-1" />
                <span>Cancelar</span>
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSave}
                disabled={isSaving}
                className="text-xs gap-1"
              >
                {isSaving ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Check className="size-3.5" />
                )}
                <span>Salvar nota</span>
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
