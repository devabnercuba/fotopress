import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Check, Eraser, Power, Rss, Settings2, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

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
import { Label } from "@/components/ui/label";
import {
  ContentSourceClearNewsDialog,
  ContentSourceDeleteDialog,
} from "@/components/content-source-delete-dialog";
import { useContentSourceMutations, type ContentSource } from "@/lib/content-sources";
import {
  DEFAULT_OGOL_CONFIG,
  OGOL_FEEDS,
  OGOL_FEED_LABEL,
  OGOL_SOURCE_NAME,
  OGOL_SOURCE_TYPE,
  readOgolConfig,
  useOgolSync,
  type OgolFeedType,
} from "@/lib/ogol";
import type { Json } from "@/integrations/supabase/types";

export function OgolActivateButton({ onActivated }: { onActivated?: (id: string) => void }) {
  const { create } = useContentSourceMutations();
  const sync = useOgolSync();

  return (
    <Button
      variant="outline"
      disabled={create.isPending || sync.isPending}
      onClick={() =>
        create.mutate(
          {
            name: OGOL_SOURCE_NAME,
            type: OGOL_SOURCE_TYPE,
            url: null,
            status: "active",
            config: DEFAULT_OGOL_CONFIG as unknown as Json,
          },
          {
            onSuccess: (id) => {
              toast.success("oGol ativado. Sincronizando feeds…");
              onActivated?.(id);
              sync.mutate(id, {
                onSuccess: (result) =>
                  result.ok ? toast.success(result.message) : toast.error(result.message),
                onError: () => toast.error("Falha na primeira sincronização do oGol."),
              });
            },
            onError: () => toast.error("Não foi possível ativar o oGol."),
          },
        )
      }
    >
      <Rss className="size-4" /> Fonte integrada: oGol
    </Button>
  );
}

export function OgolSourceCard({
  source,
  newsCount,
}: {
  source: ContentSource;
  newsCount: number;
}) {
  const { update } = useContentSourceMutations();
  const sync = useOgolSync();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const config = readOgolConfig(source.config);
  const [feeds, setFeeds] = useState<Record<OgolFeedType, boolean>>(config.feeds);
  const active = source.status === "active";

  function runSync() {
    sync.mutate(source.id, {
      onSuccess: (result) => {
        const detail = result.feeds
          .map((f) => `${OGOL_FEED_LABEL[f.feed]} ${f.ok ? "✓" : "✕"}`)
          .join(" · ");
        if (result.ok) toast.success(result.message, { description: detail });
        else toast.error(result.message, { description: detail });
      },
      onError: () => toast.error("Falha ao sincronizar o oGol."),
    });
  }

  function saveConfig() {
    update.mutate(
      {
        id: source.id,
        name: source.name,
        type: source.type,
        url: null,
        status: source.status,
        config: { feeds } as unknown as Json,
      },
      {
        onSuccess: () => {
          toast.success("Feeds atualizados.");
          setOpen(false);
        },
        onError: () => toast.error("Não foi possível salvar."),
      },
    );
  }

  function toggleActive() {
    update.mutate({
      id: source.id,
      name: source.name,
      type: source.type,
      url: null,
      status: active ? "inactive" : "active",
      config: source.config,
    });
  }

  return (
    <article className="flex flex-col rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2">
        <span className="flex size-8 items-center justify-center rounded-lg bg-surface">
          <Rss className="size-4" />
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-sm font-medium">oGol</h2>
          <p className="text-xs text-muted-foreground">Fonte integrada (RSS oficial)</p>
        </div>
      </div>

      <ul className="mt-4 space-y-1 text-xs text-muted-foreground">
        {OGOL_FEEDS.filter((f) => config.feeds[f.type]).map((f) => (
          <li key={f.type} className="flex items-center gap-1.5">
            <Check className="size-3.5 text-comp-green" /> {f.label}
          </li>
        ))}
      </ul>

      <div className="mt-4 space-y-1 text-xs">
        <p className="text-muted-foreground">
          Última atualização:{" "}
          {source.last_synced_at
            ? format(parseISO(source.last_synced_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
            : "nunca sincronizada"}
        </p>
        <p className={active ? "text-comp-green" : "text-muted-foreground"}>
          Status: {source.last_error ? "Erro de sincronização" : active ? "Ativa" : "Desativada"}
        </p>
        {source.last_error && (
          <p className="text-muted-foreground">Falhou em: {source.last_error}</p>
        )}
        <p className="text-muted-foreground">{newsCount} item(ns) coletado(s)</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1 border-t border-border pt-4">
        <Button variant="ghost" size="sm" disabled={sync.isPending || !active} onClick={runSync}>
          <RefreshCw className={`size-3.5 ${sync.isPending ? "animate-spin" : ""}`} /> Sincronizar
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
          <Settings2 className="size-3.5" /> Configurar
        </Button>
        <Button variant="ghost" size="sm" onClick={toggleActive}>
          <Power className="size-3.5" /> {active ? "Desativar" : "Ativar"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={newsCount === 0}
          onClick={() => setClearing(true)}
        >
          <Eraser className="size-3.5" /> Limpar notícias
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto"
          aria-label="Excluir fonte integrada"
          onClick={() => setDeleting(true)}
        >
          <Trash2 className="size-3.5 opacity-70" />
        </Button>
      </div>

      <ContentSourceDeleteDialog
        source={source}
        newsCount={newsCount}
        open={deleting}
        onOpenChange={setDeleting}
      />
      <ContentSourceClearNewsDialog
        source={source}
        newsCount={newsCount}
        open={clearing}
        onOpenChange={setClearing}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Configurar oGol</DialogTitle>
            <DialogDescription>
              Escolha quais feeds oficiais serão usados como contexto no Radar. As URLs são
              definidas internamente pelo FotoPress.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {OGOL_FEEDS.map((f) => (
              <label key={f.type} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={feeds[f.type]}
                  onCheckedChange={(v) => setFeeds((prev) => ({ ...prev, [f.type]: v === true }))}
                />
                <Label className="cursor-pointer font-normal">Usar {f.label}</Label>
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={saveConfig} disabled={update.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}
