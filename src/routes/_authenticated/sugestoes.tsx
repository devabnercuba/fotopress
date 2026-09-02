import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Lightbulb, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuthUser } from "@/lib/profile";

import {
  SUGGESTION_CATEGORIES,
  statusLabel,
  useSuggestionMutations,
  useSuggestions,
} from "@/lib/suggestions";

export const Route = createFileRoute("/_authenticated/sugestoes")({
  head: () => ({
    meta: [
      { title: "Sugestões — FotoPress" },
      {
        name: "description",
        content: "Envie ideias de novas funcionalidades e acompanhe o status de cada sugestão.",
      },
      { property: "og:title", content: "Sugestões — FotoPress" },
      {
        property: "og:description",
        content: "Canal direto para sugerir melhorias no FotoPress.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SuggestionsPage,
});

function NewSuggestionDialog() {
  const { create } = useSuggestionMutations();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", category: "geral" });

  function submit() {
    if (!form.title.trim() || !form.description.trim()) {
      toast.error("Preencha título e descrição.");
      return;
    }
    create.mutate(
      { ...form, title: form.title.trim(), description: form.description.trim() },
      {
        onSuccess: () => {
          toast.success("Sugestão enviada. Obrigado!");
          setForm({ title: "", description: "", category: "geral" });
          setOpen(false);
        },
        onError: () => toast.error("Não foi possível enviar a sugestão."),
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Nova sugestão
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova sugestão</DialogTitle>
          <DialogDescription>Conte o que faria o FotoPress melhor para você.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sug-title">Título</Label>
            <Input
              id="sug-title"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select
              value={form.category}
              onValueChange={(category) => setForm((f) => ({ ...f, category }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUGGESTION_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sug-desc">Descrição</Label>
            <Textarea
              id="sug-desc"
              rows={5}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={create.isPending}>
            Enviar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MySuggestionsList() {
  const { data: user } = useAuthUser();
  const { data: suggestions = [], isLoading } = useSuggestions();
  const { remove } = useSuggestionMutations();
  const mine = suggestions.filter((s) => s.user_id === user?.id);

  return (
    <>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : mine.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center">
          <Lightbulb className="mx-auto mb-2 size-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhuma sugestão enviada ainda. Use “Nova sugestão” para começar.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {mine.map((s) => (
            <article key={s.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-medium">{s.title}</h2>
                    <span className="rounded bg-surface px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      {statusLabel(s.status)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{s.category}</span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-line text-sm text-muted-foreground">
                    {s.description}
                  </p>
                  {s.admin_note && (
                    <p className="mt-2 rounded-md bg-surface p-2 text-xs text-muted-foreground">
                      <strong className="text-foreground">Resposta:</strong> {s.admin_note}
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Excluir sugestão"
                  onClick={() =>
                    remove.mutate(s.id, { onSuccess: () => toast.success("Sugestão excluída.") })
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function SuggestionsPage() {
  return (
    <div className="space-y-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">Sugestões</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Suas ideias para novas funcionalidades do FotoPress.
          </p>
        </div>
        <NewSuggestionDialog />
      </header>

      <MySuggestionsList />
    </div>
  );
}
