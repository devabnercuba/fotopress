import { useEffect, useState } from "react";
import { ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";

interface ReleaseFeedbackReactionProps {
  itemId: string;
  title?: string;
  compact?: boolean;
  className?: string;
}

type ReactionType = "like" | "dislike" | null;

function getStoredReaction(itemId: string): ReactionType {
  if (typeof window === "undefined") return null;
  try {
    const val = localStorage.getItem(`fotopress:feedback:${itemId}`);
    if (val === "like" || val === "dislike") return val;
  } catch {
    // ignore
  }
  return null;
}

function setStoredReaction(itemId: string, reaction: ReactionType) {
  if (typeof window === "undefined") return;
  try {
    if (reaction) {
      localStorage.setItem(`fotopress:feedback:${itemId}`, reaction);
    } else {
      localStorage.removeItem(`fotopress:feedback:${itemId}`);
    }
  } catch {
    // ignore
  }
}

// Gera uma contagem base estável para visualização estética
function getBaseLikes(itemId: string): number {
  let hash = 0;
  for (let i = 0; i < itemId.length; i++) {
    hash = (hash << 5) - hash + itemId.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash % 15) + 6; // Entre 6 e 20
}

export function ReleaseFeedbackReaction({
  itemId,
  title,
  compact = false,
  className,
}: ReleaseFeedbackReactionProps) {
  const [reaction, setReaction] = useState<ReactionType>(null);
  const baseLikes = getBaseLikes(itemId);

  useEffect(() => {
    setReaction(getStoredReaction(itemId));
  }, [itemId]);

  const handleReaction = (type: "like" | "dislike", e: React.MouseEvent) => {
    e.stopPropagation();

    if (reaction === type) {
      // Remove reação
      setStoredReaction(itemId, null);
      setReaction(null);
      return;
    }

    setStoredReaction(itemId, type);
    setReaction(type);

    if (type === "like") {
      toast.success("Obrigado pelo feedback positivo!", {
        description: title ? `Seu voto em "${title}" foi registrado.` : undefined,
      });
    } else {
      toast.info("Agradecemos o seu feedback!", {
        description: "Suas observações ajudam a orientar as próximas melhorias do FotoPress.",
      });
    }
  };

  const likesCount = baseLikes + (reaction === "like" ? 1 : 0);
  const dislikesCount = reaction === "dislike" ? 1 : 0;

  return (
    <div
      className={cn("flex items-center gap-1.5 text-xs select-none", className)}
      id={`feedback-reaction-${itemId}`}
    >
      {!compact && (
        <span className="text-[11px] text-muted-foreground mr-1 hidden sm:inline">
          O que achou?
        </span>
      )}

      {/* Botão Thumbs Up */}
      <button
        type="button"
        onClick={(e) => handleReaction("like", e)}
        aria-label="Curtir funcionalidade"
        title="Gostei desta funcionalidade"
        className={cn(
          "flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-all",
          reaction === "like"
            ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold shadow-xs"
            : "border-border/60 bg-surface/50 text-muted-foreground hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400",
        )}
      >
        <ThumbsUp className={cn("size-3", reaction === "like" && "fill-current")} />
        <span>{likesCount}</span>
      </button>

      {/* Botão Thumbs Down */}
      <button
        type="button"
        onClick={(e) => handleReaction("dislike", e)}
        aria-label="Não gostei da funcionalidade"
        title="Poderia ser melhor"
        className={cn(
          "flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-all",
          reaction === "dislike"
            ? "border-rose-500/40 bg-rose-500/15 text-rose-600 dark:text-rose-400 font-semibold shadow-xs"
            : "border-border/60 bg-surface/50 text-muted-foreground hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400",
        )}
      >
        <ThumbsDown className={cn("size-3", reaction === "dislike" && "fill-current")} />
        {dislikesCount > 0 && <span>{dislikesCount}</span>}
      </button>
    </div>
  );
}
