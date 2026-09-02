import { useState } from "react";
import { Play } from "lucide-react";

import { cn } from "@/lib/utils";
import { youtubeThumbnails } from "@/lib/tutorials";

/** Thumbnail 16:9 do YouTube com fallback elegante e overlay de play. */
export function TutorialThumbnail({
  videoId,
  title,
  className,
}: {
  videoId: string;
  title: string;
  className?: string;
}) {
  const sources = youtubeThumbnails(videoId);
  const [index, setIndex] = useState(0);
  const failed = index >= sources.length;

  return (
    <div
      className={cn(
        "group/thumb relative aspect-video w-full overflow-hidden rounded-lg bg-surface",
        className,
      )}
    >
      {failed ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-surface to-accent/40">
          <Play className="size-8 text-muted-foreground" />
          <span className="text-[11px] uppercase tracking-widest text-muted-foreground">
            FotoPress Tutorial
          </span>
        </div>
      ) : (
        <img
          src={sources[index]}
          alt={`Miniatura do tutorial: ${title}`}
          loading="lazy"
          onError={() => setIndex((i) => i + 1)}
          className="h-full w-full object-cover transition-transform duration-300 group-hover/thumb:scale-[1.02]"
        />
      )}
      <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-90 transition-opacity group-hover/thumb:bg-black/30">
        <span className="flex size-12 items-center justify-center rounded-full bg-background/90 shadow-sm">
          <Play className="size-5 translate-x-[1px] fill-foreground text-foreground" />
        </span>
      </div>
    </div>
  );
}
