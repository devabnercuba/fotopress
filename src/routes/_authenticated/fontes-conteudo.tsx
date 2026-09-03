import { createFileRoute } from "@tanstack/react-router";
import { Eraser, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { NewsFeed } from "@/components/news-feed";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SOURCE_TYPES,
  useContentSourceMutations,
  useContentSources,
  type ContentSource,
} from "@/lib/content-sources";
import { useCollectNews, useNewsItems } from "@/lib/news";
import { OgolActivateButton, OgolSourceCard } from "@/components/ogol-source-card";
import { OGOL_SOURCE_TYPE } from "@/lib/ogol";
import {
  ContentSourceClearNewsDialog,
  ContentSourceDeleteDialog,
} from "@/components/content-source-delete-dialog";

export const Route = createFileRoute("/_authenticated/fontes-conteudo")({
  head: () => ({
    meta: [
      { title: "Fontes de Notícias — Cobertura esportiva" },
      {
        name: "description",
        content:
          "Sites e portais varridos pelo sistema para encontrar notícias reais que alimentam o Radar da Partida.",
      },
      { property: "og:title", content: "Fontes de Notícias — Cobertura esportiva" },
      {
        property: "og:description",
        content: "Cadastre GE, CBF, FCF ou sites oficiais e colete notícias reais para o Radar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ContentSourcesPage,
});

const EMPTY = {
  id: "",
  name: "",
  type: "url",
  url: "",
  status: "active",
};

function ContentSourcesPage() {
  const { data: sources = [], isLoading } = useContentSources();
  const { data: news = [] } = useNewsItems(200);
  const { create, update } = useContentSourceMutations();
  const collect = useCollectNews();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [running, setRunning] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<ContentSource | null>(null);
  const [clearing, setClearing] = useState<ContentSource | null>(null);
  const newsCount = (id: string) => news.filter((n) => n.source_id === id).length;

  const set = (patch: Partial<typeof EMPTY>) => setForm((f) => ({ ...f, ...patch }));
  const ogol = sources.find((s) => s.type === OGOL_SOURCE_TYPE);
  const manualSources = sources.filter((s) => s.type !== OGOL_SOURCE_TYPE);

  function edit(source: ContentSource) {
    setForm({
      id: source.id,
      name: source.name,
      type: source.type,
      url: source.url ?? "",
      status: source.status,
    });
    setOpen(true);
  }

  function submit() {
    if (!form.name.trim() || !form.url.trim()) {
      toast.error("Informe nome e URL da fonte.");
      return;
    }
    const payload = {
      name: form.name.trim(),
      type: form.type,
      url: form.url.trim(),
      status: form.status,
    };
    const done = () => {
      toast.success(form.id ? "Fonte atualizada." : "Fonte cadastrada.");
      setForm(EMPTY);
      setOpen(false);
    };
    if (form.id) {
      update.mutate(
        { id: form.id, ...payload },
        { onSuccess: done, onError: () => toast.error("Não foi possível salvar.") },
      );
    } else {
      create.mutate(payload, {
        onSuccess: done,
        onError: () => toast.error("Não foi possível salvar."),
      });
    }
  }

  function runCollect(source: ContentSource) {
    setRunning(source.id);
    collect.mutate(source.id, {
      onSuccess: (result) => {
        setRunning(null);
        if (result.ok) {
          toast.success(result.message, {
            description: `Encontradas ${result.found} · novas ${result.inserted} · repetidas ${result.duplicated}`,
          });
        } else {
          toast.error(result.message);
        }
      },
      onError: () => {
        setRunning(null);
        toast.error("Falha ao coletar notícias desta fonte.");
      },
    });
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notícias</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Um portal com o que as suas fontes publicaram — e o painel para gerenciar essas fontes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!ogol && <OgolActivateButton />}
          <Button
            onClick={() => {
              setForm(EMPTY);
              setOpen(true);
            }}
          >
            <Plus className="size-4" /> Nova fonte
          </Button>
        </div>
      </header>

      <Tabs defaultValue="noticias" className="space-y-6">
        <TabsList>
          <TabsTrigger value="noticias">Notícias</TabsTrigger>
          <TabsTrigger value="fontes">Fontes ({sources.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="noticias" className="space-y-6">
          <NewsFeed news={news} sources={sources} />
        </TabsContent>

        <TabsContent value="fontes" className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Fontes de Notícias</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sites que o sistema varre para encontrar notícias reais. Não importam jogos e não são
              limitados a um campeonato — a IA identifica o contexto de cada notícia.
            </p>
          </div>

          {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}

          {!isLoading && sources.length === 0 && (
            <div className="rounded-xl border border-dashed border-border px-4 py-16 text-center text-sm text-muted-foreground">
              Nenhuma fonte de notícias cadastrada. Ex.: GE, GE Santa Catarina, CBF, FCF, site
              oficial do clube.
            </div>
          )}

          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {ogol && (
              <OgolSourceCard
                source={ogol}
                newsCount={news.filter((n) => n.source_id === ogol.id).length}
              />
            )}
            {manualSources.map((source) => (
              <article
                key={source.id}
                className="flex flex-col rounded-xl border border-border bg-card p-5"
              >
                <h3 className="truncate text-sm font-medium">{source.name}</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {SOURCE_TYPES.find((t) => t.value === source.type)?.label ?? source.type}
                </p>
                <a
                  href={source.url ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 truncate text-xs text-muted-foreground underline-offset-2 hover:underline"
                >
                  {source.url}
                </a>
                <div className="mt-4 flex items-center gap-3 text-xs">
                  <span className={source.status === "active" ? "text-comp-green" : ""}>
                    {source.status === "active" ? "Ativa" : "Inativa"}
                  </span>
                  <span className="text-muted-foreground">
                    {news.filter((n) => n.source_id === source.id).length} notícia(s)
                  </span>
                </div>
                <div className="mt-4 flex items-center gap-1 border-t border-border pt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={running === source.id || source.type !== "url"}
                    onClick={() => runCollect(source)}
                  >
                    <RefreshCw
                      className={`size-3.5 ${running === source.id ? "animate-spin" : ""}`}
                    />
                    Coletar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => edit(source)}>
                    <Pencil className="size-3.5" /> Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={newsCount(source.id) === 0}
                    onClick={() => setClearing(source)}
                  >
                    <Eraser className="size-3.5" /> Limpar
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto"
                    aria-label="Excluir fonte"
                    onClick={() => setDeleting(source)}
                  >
                    <Trash2 className="size-3.5 opacity-70" />
                  </Button>
                </div>
              </article>
            ))}
          </section>
        </TabsContent>
      </Tabs>

      <ContentSourceDeleteDialog
        source={deleting}
        newsCount={deleting ? newsCount(deleting.id) : 0}
        open={!!deleting}
        onOpenChange={(next) => !next && setDeleting(null)}
      />
      <ContentSourceClearNewsDialog
        source={clearing}
        newsCount={clearing ? newsCount(clearing.id) : 0}
        open={!!clearing}
        onOpenChange={(next) => !next && setClearing(null)}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar fonte" : "Nova fonte de notícias"}</DialogTitle>
            <DialogDescription>
              A URL é o ponto inicial da varredura (raiz do site), não uma notícia específica.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="content-name">Nome</Label>
              <Input
                id="content-name"
                maxLength={120}
                value={form.name}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="GE Santa Catarina, CBF, FCF, Site oficial do Brusque"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => set({ type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SOURCE_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value} disabled={t.value !== "url"}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => set({ status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativa</SelectItem>
                    <SelectItem value="inactive">Inativa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="content-url">URL</Label>
              <Input
                id="content-url"
                maxLength={500}
                value={form.url}
                onChange={(e) => set({ url: e.target.value })}
                placeholder="https://ge.globo.com/sc/"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={create.isPending || update.isPending}>
              Salvar fonte
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
