import { formatDistanceToNow, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, ExternalLink, Newspaper, TrendingUp, Trophy } from "lucide-react";
import { useMemo, useState } from "react";

import { NewsReaderSheet } from "@/components/news-reader-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ContentSource } from "@/lib/content-sources";
import {
  coverImageOf,
  NEWS_FEED_TYPE_LABEL,
  newsSummary,
  newsTitle,
  type NewsFeedType,
  type NewsItem,
} from "@/lib/news";

const ALL = "todas";
const ALL_TYPES = "todos";

function whenOf(item: NewsItem) {
  return item.published_at ?? item.created_at;
}

function sourceNameOf(item: NewsItem) {
  return item.source?.name ?? item.entities?.source_name ?? "Fonte";
}

function NewsArticleCard({ item, onOpen }: { item: NewsItem; onOpen: () => void }) {
  const when = whenOf(item);
  const subjects = (item.entities?.subjects ?? []).slice(0, 3);
  const image = coverImageOf(item);
  const title = newsTitle(item);
  const summary = newsSummary(item);

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-foreground/20">
      <button type="button" onClick={onOpen} className="text-left">
        {image ? (
          <img src={image} alt={title} loading="lazy" className="h-40 w-full object-cover" />
        ) : (
          <div className="flex h-40 w-full items-center justify-center bg-surface">
            <Newspaper className="size-6 text-muted-foreground/60" />
          </div>
        )}
        <div className="space-y-2 p-4">
          <Badge variant="secondary" className="text-[10px]">
            {sourceNameOf(item)}
          </Badge>
          <h3 className="line-clamp-3 text-sm font-medium leading-snug">{title}</h3>
          {summary && (
            <p className="line-clamp-3 text-xs leading-relaxed text-muted-foreground">{summary}</p>
          )}
        </div>
      </button>

      <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border px-4 py-3 text-[11px] text-muted-foreground">
        <span>{formatDistanceToNow(parseISO(when), { locale: ptBR, addSuffix: true })}</span>
        {subjects.map((s) => (
          <span key={s} className="rounded bg-surface px-1.5 py-0.5">
            {s}
          </span>
        ))}
        <Button size="sm" variant="ghost" className="ml-auto h-7 px-2 text-xs" onClick={onOpen}>
          Leia no FotoPress
        </Button>
      </div>
    </article>
  );
}

function MatchCard({ item, onOpen }: { item: NewsItem; onOpen: () => void }) {
  const when = whenOf(item);
  const e = item.entities;
  const isResult = item.feed_type === "result";
  const hasScore = e?.home_score != null && e?.away_score != null;

  return (
    <article className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <Badge className="gap-1 text-[10px]" variant={isResult ? "default" : "secondary"}>
          {isResult ? <Trophy className="size-3" /> : <CalendarClock className="size-3" />}
          {isResult ? "RESULTADO" : "PRÓXIMO JOGO"}
        </Badge>
        <span className="text-[11px] text-muted-foreground">
          {formatDistanceToNow(parseISO(when), { locale: ptBR, addSuffix: true })}
        </span>
      </div>

      <div className="flex items-center justify-center gap-3 py-1 text-center">
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{e?.home_team ?? "—"}</span>
        <span className="shrink-0 rounded-md bg-surface px-2 py-1 text-sm font-semibold">
          {hasScore ? `${e?.home_score} - ${e?.away_score}` : "x"}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{e?.away_team ?? "—"}</span>
      </div>

      {e?.competition && (
        <p className="truncate text-center text-xs text-muted-foreground">{e.competition}</p>
      )}

      <div className="mt-2 flex items-center justify-between border-t border-border pt-3 text-[11px] text-muted-foreground">
        <span className="truncate">Fonte: {sourceNameOf(item)}</span>
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex shrink-0 items-center gap-1 text-foreground/70 underline-offset-2 hover:underline"
        >
          Abrir original <ExternalLink className="size-3" />
        </button>
      </div>
    </article>
  );
}

function TransferCard({ item, onOpen }: { item: NewsItem; onOpen: () => void }) {
  const when = whenOf(item);
  const summary = newsSummary(item);
  return (
    <article className="flex flex-col gap-2 rounded-xl border border-border bg-gradient-to-br from-surface to-card p-4">
      <div className="flex items-center justify-between gap-2">
        <Badge className="text-[10px]">MERCADO</Badge>
        <span className="text-[11px] text-muted-foreground">
          {formatDistanceToNow(parseISO(when), { locale: ptBR, addSuffix: true })}
        </span>
      </div>
      <button type="button" onClick={onOpen} className="text-left">
        <h3 className="line-clamp-3 text-sm font-medium leading-snug">{newsTitle(item)}</h3>
        {summary && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {summary}
          </p>
        )}
      </button>
      <div className="mt-2 flex items-center justify-between border-t border-border pt-3 text-[11px] text-muted-foreground">
        <span className="truncate">Fonte: {sourceNameOf(item)}</span>
        <button
          type="button"
          onClick={onOpen}
          className="inline-flex shrink-0 items-center gap-1 text-foreground/70 underline-offset-2 hover:underline"
        >
          <TrendingUp className="size-3" /> Detalhes
        </button>
      </div>
    </article>
  );
}

function NewsCard({ item, onOpen }: { item: NewsItem; onOpen: () => void }) {
  if (item.feed_type === "result" || item.feed_type === "upcoming_match") {
    return <MatchCard item={item} onOpen={onOpen} />;
  }
  if (item.feed_type === "transfer") {
    return <TransferCard item={item} onOpen={onOpen} />;
  }
  return <NewsArticleCard item={item} onOpen={onOpen} />;
}

/** Aba "Notícias": experiência de portal sobre os dados já coletados. */
export function NewsFeed({ news, sources }: { news: NewsItem[]; sources: ContentSource[] }) {
  const [search, setSearch] = useState("");
  const [sourceId, setSourceId] = useState(ALL);
  const [period, setPeriod] = useState(ALL);
  const [feedType, setFeedType] = useState<NewsFeedType | typeof ALL_TYPES>(ALL_TYPES);
  const [reading, setReading] = useState<NewsItem | null>(null);

  const items = useMemo(() => {
    const term = search.trim().toLowerCase();
    const limit = period === ALL ? 0 : Date.now() - Number(period) * 24 * 60 * 60 * 1000;
    return news
      .filter((item) => {
        if (feedType !== ALL_TYPES && item.feed_type !== feedType) return false;
        if (sourceId !== ALL && item.source_id !== sourceId) return false;
        if (limit && parseISO(whenOf(item)).getTime() < limit) return false;
        if (term && !`${newsTitle(item)} ${newsSummary(item)}`.toLowerCase().includes(term))
          return false;
        return true;
      })
      .sort((a, b) => whenOf(b).localeCompare(whenOf(a)));
  }, [news, search, sourceId, period, feedType]);

  return (
    <div className="space-y-5">
      <header>
        <h2 className="text-lg font-semibold tracking-tight">Notícias</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Informações recentes das fontes que você acompanha.
        </p>
      </header>

      <Tabs
        value={feedType}
        onValueChange={(v) => setFeedType(v as NewsFeedType | typeof ALL_TYPES)}
      >
        <TabsList className="flex-wrap">
          <TabsTrigger value={ALL_TYPES}>Todos</TabsTrigger>
          <TabsTrigger value="news">{NEWS_FEED_TYPE_LABEL.news}s</TabsTrigger>
          <TabsTrigger value="transfer">{NEWS_FEED_TYPE_LABEL.transfer}</TabsTrigger>
          <TabsTrigger value="result">{NEWS_FEED_TYPE_LABEL.result}s</TabsTrigger>
          <TabsTrigger value="upcoming_match">{NEWS_FEED_TYPE_LABEL.upcoming_match}s</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar notícia..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-[240px]"
        />
        <Select value={sourceId} onValueChange={setSourceId}>
          <SelectTrigger className="w-full sm:w-[200px]" aria-label="Filtrar fonte">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Todas as fontes</SelectItem>
            {sources.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-full sm:w-[180px]" aria-label="Filtrar período">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Mais recentes</SelectItem>
            <SelectItem value="1">Últimas 24 horas</SelectItem>
            <SelectItem value="7">Últimos 7 dias</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <Newspaper className="mx-auto mb-2 size-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhuma notícia por aqui. Colete conteúdo na aba “Fontes”.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <NewsCard key={item.id} item={item} onOpen={() => setReading(item)} />
          ))}
        </div>
      )}

      <NewsReaderSheet
        item={reading}
        open={!!reading}
        onOpenChange={(open) => !open && setReading(null)}
      />
    </div>
  );
}
