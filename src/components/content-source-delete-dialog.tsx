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
import { useContentSourceMutations, type ContentSource } from "@/lib/content-sources";

/**
 * Confirmação de exclusão de Fonte de Notícias — mesmo conceito das Fontes de
 * Jogos: o usuário decide se as notícias já sincronizadas ficam ou saem.
 */
export function ContentSourceDeleteDialog({
  source,
  newsCount,
  open,
  onOpenChange,
}: {
  source: ContentSource | null;
  newsCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { remove } = useContentSourceMutations();

  if (!source) return null;

  const run = (deleteNews: boolean) =>
    remove.mutate(
      { id: source.id, deleteNews },
      {
        onSuccess: (removed) => {
          toast.success(
            deleteNews
              ? `Fonte excluída. ${removed} notícia(s) removida(s).`
              : `Fonte excluída. ${newsCount} notícia(s) foram mantidas.`,
          );
          onOpenChange(false);
        },
        onError: () => toast.error("Não foi possível excluir a fonte."),
      },
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Excluir “{source.name}”?</DialogTitle>
          <DialogDescription>
            {newsCount > 0
              ? `Esta fonte possui ${newsCount} item(ns) sincronizado(s). O que deseja fazer?`
              : "Esta fonte não possui notícias sincronizadas."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={remove.isPending}>
            Cancelar
          </Button>
          {newsCount > 0 && (
            <Button variant="outline" onClick={() => run(false)} disabled={remove.isPending}>
              Excluir fonte e manter notícias
            </Button>
          )}
          <Button variant="destructive" onClick={() => run(true)} disabled={remove.isPending}>
            {newsCount > 0 ? "Excluir fonte e notícias" : "Excluir fonte"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Limpa apenas as notícias, mantendo a fonte configurada e ativa. */
export function ContentSourceClearNewsDialog({
  source,
  newsCount,
  open,
  onOpenChange,
}: {
  source: ContentSource | null;
  newsCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { clearNews } = useContentSourceMutations();

  if (!source) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Limpar {newsCount} notícia(s) de “{source.name}”?
          </DialogTitle>
          <DialogDescription>
            A fonte continuará ativa e poderá ser sincronizada novamente.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={clearNews.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={() =>
              clearNews.mutate(source.id, {
                onSuccess: (removed) => {
                  toast.success(`${removed} notícia(s) removida(s).`);
                  onOpenChange(false);
                },
                onError: () => toast.error("Não foi possível limpar as notícias desta fonte."),
              })
            }
            disabled={clearNews.isPending}
          >
            Limpar notícias
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
