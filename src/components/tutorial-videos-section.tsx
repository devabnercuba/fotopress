import { useMemo, useState } from "react";
import { Play, Settings2, Sparkles, Video } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TutorialManagerDialog } from "@/components/tutorial-manager-dialog";
import { TutorialPlayerDialog } from "@/components/tutorial-player-dialog";
import { TutorialThumbnail } from "@/components/tutorial-thumbnail";
import { useIsTutorialAdmin, useTutorialVideos, type TutorialVideo } from "@/lib/tutorials";

/** Seção "Aprenda com vídeos" da página Primeiros passos. */
export function TutorialVideosSection() {
  const { data: videos = [], isLoading } = useTutorialVideos();
  const { data: isAdmin = false } = useIsTutorialAdmin();
  const [playing, setPlaying] = useState<TutorialVideo | null>(null);
  const [manager, setManager] = useState<false | "list" | "new">(false);

  const published = useMemo(
    () =>
      videos
        .filter((v) => v.is_published)
        .sort(
          (a, b) => a.category.localeCompare(b.category, "pt-BR") || a.sort_order - b.sort_order,
        ),
    [videos],
  );

  const featured = published.find((v) => v.is_featured) ?? published[0] ?? null;
  const others = published.filter((v) => v.id !== featured?.id);

  const grouped = useMemo(() => {
    const map = new Map<string, TutorialVideo[]>();
    for (const v of others) map.set(v.category, [...(map.get(v.category) ?? []), v]);
    return [...map.entries()];
  }, [others]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Aprenda com vídeos
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Tutoriais rápidos para você configurar e aproveitar melhor o FotoPress.
          </p>
        </div>
        {isAdmin && (
          <Button variant="ghost" size="sm" onClick={() => setManager("list")}>
            <Settings2 className="size-3.5" />
            Gerenciar vídeos
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-xl border border-border bg-card" />
      ) : !featured ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border p-6">
          <Video className="size-5 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Novos tutoriais serão disponibilizados em breve.
          </p>
          {isAdmin && (
            <Button variant="outline" size="sm" onClick={() => setManager("new")}>
              Adicionar primeiro vídeo
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <article className="grid gap-5 overflow-hidden rounded-xl border border-border bg-card p-5 md:grid-cols-2 md:items-center">
            <button
              type="button"
              onClick={() => setPlaying(featured)}
              aria-label={`Assistir tutorial: ${featured.title}`}
              className="group/thumb w-full rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <TutorialThumbnail videoId={featured.youtube_video_id} title={featured.title} />
            </button>
            <div>
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <Sparkles className="size-3" />
                Comece por aqui
              </Badge>
              <h3 className="mt-3 text-lg font-semibold tracking-tight">{featured.title}</h3>
              {featured.description && (
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {featured.description}
                </p>
              )}
              <Button className="mt-4" size="sm" onClick={() => setPlaying(featured)}>
                <Play className="size-3.5" />
                Assistir tutorial
              </Button>
            </div>
          </article>

          {grouped.map(([category, items]) => (
            <div key={category} className="space-y-3">
              <h3 className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
                {category}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((video) => (
                  <article
                    key={video.id}
                    className="flex flex-col rounded-xl border border-border bg-card p-3 transition-colors hover:bg-accent/30"
                  >
                    <button
                      type="button"
                      onClick={() => setPlaying(video)}
                      aria-label={`Assistir tutorial: ${video.title}`}
                      className="group/thumb rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <TutorialThumbnail videoId={video.youtube_video_id} title={video.title} />
                    </button>
                    <Badge variant="secondary" className="mt-3 w-fit text-[10px]">
                      {video.category}
                    </Badge>
                    <h4 className="mt-2 text-sm font-medium">{video.title}</h4>
                    {video.description && (
                      <p className="mt-1 line-clamp-2 flex-1 text-xs leading-relaxed text-muted-foreground">
                        {video.description}
                      </p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 w-fit"
                      onClick={() => setPlaying(video)}
                    >
                      <Play className="size-3.5" />
                      Assistir
                    </Button>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <TutorialPlayerDialog video={playing} onOpenChange={(open) => !open && setPlaying(null)} />
      {isAdmin && manager && (
        <TutorialManagerDialog
          open
          startInForm={manager === "new"}
          videos={videos}
          onOpenChange={(open) => !open && setManager(false)}
        />
      )}
    </section>
  );
}
