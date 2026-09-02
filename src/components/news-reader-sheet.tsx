import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, ExternalLink, Newspaper, Trophy } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  coverImageOf,
  newsBody,
  newsHighlights,
  newsTitle,
  useEnrichNewsItem,
  type NewsItem,
} from "@/lib/news";
import { useEffect } from "react";

/**
 * Leitor interno de notícias — visual editorial.
 * Para matérias (feed_type "news") não enriquecidas, dispara o enriquecimento
 * sob demanda na primeira abertura; o resultado fica em cache no item (não
 * chama de novo). Resultados/próximos jogos/mercado mostram o card
 * informativo sem acionar IA.
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
  const enrich = useEnrichNewsItem();
  const published = item ? (item.published_at ?? item.created_at) : null;
  const image = item ? coverImageOf(item) : null;
  const sourceName = item?.source?.name ?? item?.entities?.source_name ?? "Fonte";
  const title = item ? newsTitle(item) : "";
  const fotopress = newsBody(item?.article_summary);
  const sourceSummary = newsBody(item?.summary);
  const highlights = item ? newsHighlights(item) : [];

  const needsEnrichment = !!item && item.feed_type === "news" && !item.article_enriched_at;

  useEffect(() => {
    if (open && needsEnrichment && item && !enrich.isPending) {
      enrich.mutate(item.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, item?.id, needsEnrichment]);

  const isMatch = item?.feed_type === "result" || item?.feed_type === "upcoming_match";
  const isTransfer = item?.feed_type === "transfer";
  const enriching = needsEnrichment && enrich.isPending;

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
              <SheetDescription className="sr-only">
                {fotopress || sourceSummary || title}
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-5 px-4 pb-8">
              {isMatch ? (
                <div className="space-y-3 rounded-xl border border-border bg-card p-4">
                  <Badge className="gap-1 text-[10px]">
                    {item.feed_type === "result" ? (
                      <Trophy className="size-3" />
                    ) : (
                      <CalendarClock className="size-3" />
                    )}
                    {item.feed_type === "result" ? "RESULTADO" : "PRÓXIMO JOGO"}
                  </Badge>
                  <div className="flex items-center justify-center gap-3 py-2 text-center">
                    <span className="min-w-0 flex-1 truncate text-base font-medium">
                      {item.entities?.home_team ?? "—"}
                    </span>
                    <span className="shrink-0 rounded-md bg-surface px-3 py-1.5 text-base font-semibold">
                      {item.entities?.home_score != null && item.entities?.away_score != null
                        ? `${item.entities.home_score} - ${item.entities.away_score}`
                        : "x"}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-base font-medium">
                      {item.entities?.away_team ?? "—"}
                    </span>
                  </div>
                  {item.entities?.competition && (
                    <p className="text-center text-xs text-muted-foreground">
                      {item.entities.competition}
                    </p>
                  )}
                  <div className="border-t border-border pt-3 text-center">
                    <Button asChild variant="outline" size="sm">
                      <a href={item.url} target="_blank" rel="noreferrer">
                        <ExternalLink className="size-3.5" /> Abrir no oGol
                      </a>
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {image ? (
                    <img
                      src={image}
                      alt={title}
                      loading="lazy"
                      className="aspect-video w-full rounded-xl border border-border object-cover"
                    />
                  ) : (
                    <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-border bg-surface">
                      <Newspaper className="size-6 text-muted-foreground" />
                    </div>
                  )}

                  {isTransfer ? (
                    <div className="space-y-3">
                      <Badge className="text-[10px]">MERCADO</Badge>
                      {sourceSummary && (
                        <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                          {sourceSummary}
                        </p>
                      )}
                    </div>
                  ) : enriching ? (
                    <div className="space-y-3">
                      <div className="h-4 w-32 animate-pulse rounded bg-surface" />
                      <div className="h-3 w-full animate-pulse rounded bg-surface" />
                      <div className="h-3 w-full animate-pulse rounded bg-surface" />
                      <div className="h-3 w-2/3 animate-pulse rounded bg-surface" />
                      <p className="text-xs text-muted-foreground">Preparando resumo...</p>
                    </div>
                  ) : item.article_content_available && fotopress ? (
                    <div className="space-y-5">
                      <div className="space-y-2">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          Resumo FotoPress
                        </h4>
                        <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                          {fotopress}
                        </p>
                      </div>
                      {highlights.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Pontos principais
                          </h4>
                          <ul className="list-disc space-y-1 pl-5 text-sm leading-relaxed text-foreground">
                            {highlights.map((h, i) => (
                              <li key={i}>{h}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Esta fonte disponibilizou apenas um resumo.
                      </p>
                      {sourceSummary && (
                        <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                          {sourceSummary}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="border-t border-border pt-4">
                    <Button asChild variant="outline" size="sm">
                      <a href={item.url} target="_blank" rel="noreferrer">
                        <ExternalLink className="size-3.5" /> Abrir matéria original
                      </a>
                    </Button>
                    <p className="mt-2 text-[11px] text-muted-foreground">Fonte: {sourceName}</p>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
