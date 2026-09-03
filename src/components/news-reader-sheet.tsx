import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { coverImageOf, newsBody, newsTitle, type NewsItem } from "@/lib/news";

/**
 * Leitor de notícias — exibição direta da matéria coletada.
 * Apresenta imagem, título, fonte, data, resumo original (se houver) e link externo.
 */
export function NewsReaderSheet({
  item,
  open,
  onOpenChange,
}: {
  item: NewsItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const published = item ? (item.published_at ?? item.created_at) : null;
  const image = item ? coverImageOf(item) : null;
  const sourceName = item?.source?.name ?? item?.entities?.source_name ?? "Fonte";
  const title = item ? newsTitle(item) : "";
  const sourceSummary = newsBody(item?.summary);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
        {item && (
          <>
            <SheetHeader className="space-y-2 text-left">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className="text-[10px]">
                  {sourceName}
                </Badge>
                {published && (
                  <span>· {format(parseISO(published), "dd MMM yyyy", { locale: ptBR })}</span>
                )}
              </div>
              <SheetTitle className="text-xl leading-snug">{title}</SheetTitle>
              <SheetDescription className="sr-only">{sourceSummary || title}</SheetDescription>
            </SheetHeader>

            <div className="space-y-5 px-4 pb-8">
              {image && (
                <img
                  src={image}
                  alt={title}
                  loading="lazy"
                  className="aspect-video w-full rounded-xl border border-border object-cover"
                />
              )}

              {sourceSummary ? (
                <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                  {sourceSummary}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Leia a matéria completa no site da fonte.
                </p>
              )}

              <div className="border-t border-border pt-4">
                <Button asChild variant="outline" size="sm">
                  <a href={item.url} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-3.5" /> Abrir matéria original
                  </a>
                </Button>
                <p className="mt-2 text-[11px] text-muted-foreground">Fonte: {sourceName}</p>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
