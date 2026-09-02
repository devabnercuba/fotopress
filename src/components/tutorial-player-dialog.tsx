import { Link } from "@tanstack/react-router";
import { ExternalLink, ArrowRight } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { youtubeEmbedUrl, type TutorialVideo } from "@/lib/tutorials";

/** Player do tutorial dentro do FotoPress (iframe só monta quando aberto). */
export function TutorialPlayerDialog({
  video,
  onOpenChange,
}: {
  video: TutorialVideo | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={!!video} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-4 p-4 sm:p-6">
        {video && (
          <>
            <DialogHeader className="text-left">
              <DialogTitle className="pr-6 text-base">{video.title}</DialogTitle>
              {video.description && (
                <DialogDescription className="text-xs leading-relaxed">
                  {video.description}
                </DialogDescription>
              )}
            </DialogHeader>

            <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
              <iframe
                key={video.id}
                src={youtubeEmbedUrl(video.youtube_video_id)}
                title={`Tutorial: ${video.title}`}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {video.related_route && (
                <Button asChild size="sm" variant="outline">
                  <Link to={video.related_route}>
                    Abrir funcionalidade
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              )}
              <Button asChild size="sm" variant="ghost" className="text-muted-foreground">
                <a
                  href={video.youtube_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Abrir tutorial no YouTube em nova aba"
                >
                  Abrir no YouTube
                  <ExternalLink className="size-3.5" />
                </a>
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
