import { useState } from "react";
import { Eye, EyeOff, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  extractYoutubeId,
  TUTORIAL_CATEGORIES,
  useTutorialMutations,
  type TutorialVideo,
} from "@/lib/tutorials";

type FormState = {
  id?: string;
  title: string;
  description: string;
  youtube_url: string;
  category: string;
  related_route: string;
  sort_order: string;
  is_featured: boolean;
  is_published: boolean;
};

const EMPTY: FormState = {
  title: "",
  description: "",
  youtube_url: "",
  category: TUTORIAL_CATEGORIES[0],
  related_route: "",
  sort_order: "0",
  is_featured: false,
  is_published: true,
};

/** Painel administrativo para cadastrar, editar, ocultar e excluir tutoriais. */
export function TutorialManagerDialog({
  open,
  onOpenChange,
  videos,
  startInForm = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videos: TutorialVideo[];
  startInForm?: boolean;
}) {
  const { create, update, remove } = useTutorialMutations();
  const [form, setForm] = useState<FormState | null>(startInForm ? EMPTY : null);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));

  const edit = (video: TutorialVideo) =>
    setForm({
      id: video.id,
      title: video.title,
      description: video.description ?? "",
      youtube_url: video.youtube_url,
      category: video.category,
      related_route: video.related_route ?? "",
      sort_order: String(video.sort_order),
      is_featured: video.is_featured,
      is_published: video.is_published,
    });

  async function save() {
    if (!form) return;
    if (!form.title.trim()) {
      toast.error("Informe o título do vídeo.");
      return;
    }
    const videoId = extractYoutubeId(form.youtube_url);
    if (!videoId) {
      toast.error("Informe um link válido do YouTube.");
      return;
    }
    const route = form.related_route.trim();
    if (route && !/^\/[A-Za-z0-9\-/]*$/.test(route)) {
      toast.error("O link interno deve começar com / e ser uma rota do FotoPress.");
      return;
    }

    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      youtube_url: form.youtube_url.trim(),
      youtube_video_id: videoId,
      category: form.category.trim() || "Outros",
      related_route: route || null,
      sort_order: Number(form.sort_order) || 0,
      is_featured: form.is_featured,
      is_published: form.is_published,
    };

    try {
      if (form.id) await update.mutateAsync({ id: form.id, ...payload });
      else await create.mutateAsync(payload);
      toast.success(form.id ? "Tutorial atualizado." : "Tutorial publicado.");
      setForm(null);
    } catch {
      toast.error("Não foi possível salvar o tutorial.");
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setForm(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader className="text-left">
          <DialogTitle>Gerenciar vídeos</DialogTitle>
          <DialogDescription>
            Cole o link do YouTube — o FotoPress resolve miniatura e player automaticamente.
          </DialogDescription>
        </DialogHeader>

        {form ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="tut-title">Título *</Label>
              <Input
                id="tut-title"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tut-desc">Descrição</Label>
              <Textarea
                id="tut-desc"
                rows={3}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                maxLength={400}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tut-url">Link do YouTube *</Label>
              <Input
                id="tut-url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={form.youtube_url}
                onChange={(e) => set("youtube_url", e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="tut-cat">Categoria</Label>
                <Input
                  id="tut-cat"
                  list="tutorial-categories"
                  value={form.category}
                  onChange={(e) => set("category", e.target.value)}
                />
                <datalist id="tutorial-categories">
                  {TUTORIAL_CATEGORIES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tut-order">Ordem</Label>
                <Input
                  id="tut-order"
                  type="number"
                  value={form.sort_order}
                  onChange={(e) => set("sort_order", e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tut-route">Link dentro do FotoPress (opcional)</Label>
              <Input
                id="tut-route"
                placeholder="/jogos"
                value={form.related_route}
                onChange={(e) => set("related_route", e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-5">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.is_featured}
                  onCheckedChange={(v) => set("is_featured", v === true)}
                />
                Vídeo em destaque
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={form.is_published}
                  onCheckedChange={(v) => set("is_published", v === true)}
                />
                Publicado
              </label>
            </div>
            <DialogFooter className="gap-2 sm:justify-between">
              <Button variant="ghost" onClick={() => setForm(null)}>
                Cancelar
              </Button>
              <Button onClick={save} disabled={create.isPending || update.isPending}>
                Salvar
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-3">
            {videos.length === 0 && (
              <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Nenhum tutorial cadastrado ainda.
              </p>
            )}
            {videos.map((video) => (
              <div
                key={video.id}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{video.title}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary" className="text-[10px]">
                      {video.category}
                    </Badge>
                    <Badge
                      variant={video.is_published ? "default" : "outline"}
                      className="text-[10px]"
                    >
                      {video.is_published ? "Publicado" : "Oculto"}
                    </Badge>
                    {video.is_featured && (
                      <Badge variant="outline" className="gap-1 text-[10px]">
                        <Star className="size-3" /> Destaque
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Editar tutorial"
                    onClick={() => edit(video)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={video.is_published ? "Ocultar tutorial" : "Publicar tutorial"}
                    onClick={() =>
                      update.mutate({ id: video.id, is_published: !video.is_published })
                    }
                  >
                    {video.is_published ? (
                      <EyeOff className="size-4" />
                    ) : (
                      <Eye className="size-4" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label="Excluir tutorial"
                    onClick={() => {
                      if (confirm(`Excluir o tutorial "${video.title}"?`)) remove.mutate(video.id);
                    }}
                  >
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
            <Button className="w-full" variant="outline" onClick={() => setForm(EMPTY)}>
              <Plus className="size-4" />
              Adicionar vídeo
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
