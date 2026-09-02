import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import {
  ArrowRight,
  Bell,
  BellRing,
  Calendar,
  CheckCircle2,
  Heart,
  History,
  Megaphone,
  PanelRight,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Wrench,
  Zap,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/empty-state";
import { ReleaseFeedbackReaction } from "@/components/release-feedback-reaction";
import { ReleaseNotesLog } from "@/components/release-notes-log";
import { Button } from "@/components/ui/button";
import { APP_VERSION } from "@/lib/release-notes-data";
import { usePushNotifications } from "@/lib/push-notifications";
import { openNewsUpdatesPanel } from "@/lib/updates-panel-context";
import { cn } from "@/lib/utils";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useIsMasterAdmin } from "@/lib/admin";
import {
  categoryLabel,
  RELATED_ROUTES,
  safeRoute,
  UPDATE_CATEGORIES,
  useMarkUpdatesRead,
  useProductUpdateMutations,
  useProductUpdates,
  useProductUpdateReads,
  type ProductUpdate,
} from "@/lib/product-updates";

export const Route = createFileRoute("/_authenticated/novidades")({
  head: () => ({
    meta: [
      { title: "Novidades — FotoPress" },
      {
        name: "description",
        content: "Acompanhe as novidades, melhorias e correções lançadas no FotoPress.",
      },
      { property: "og:title", content: "Novidades — FotoPress" },
      {
        property: "og:description",
        content: "Acompanhe as novidades, melhorias e correções lançadas no FotoPress.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NovidadesPage,
});

const badgeTone: Record<string, string> = {
  novidade: "bg-primary/10 text-primary",
  melhoria: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  correcao: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

const emptyDraft = (): ProductUpdate => ({
  id: "",
  title: "",
  description: "",
  category: "novidade",
  icon: null,
  related_route: null,
  published_at: new Date().toISOString().slice(0, 10),
  is_published: true,
});

function NovidadesPage() {
  const { data: isAdmin } = useIsMasterAdmin();
  const { data: updates = [], isLoading } = useProductUpdates(!!isAdmin);
  const { data: reads = [] } = useProductUpdateReads();
  const markRead = useMarkUpdatesRead();
  const { save, remove } = useProductUpdateMutations();
  const [draft, setDraft] = useState<ProductUpdate | null>(null);
  const [pageTab, setPageTab] = useState<"timeline" | "releases">("timeline");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const {
    isSupported: isPushSupported,
    isEnabled: isPushEnabled,
    permission: pushPermission,
    isPending: isPushPending,
    requestPermission: requestPushPermission,
    sendTestNotification,
  } = usePushNotifications();

  const readSet = new Set(reads);
  const unread = updates.filter((u) => u.is_published && !readSet.has(u.id)).map((u) => u.id);

  // Filtragem por categoria
  const filteredUpdates = useMemo(() => {
    if (selectedCategory === "all") return updates;
    return updates.filter((u) => u.category === selectedCategory);
  }, [updates, selectedCategory]);

  // Ao abrir a página, tudo que estava pendente passa a ser considerado visto.
  useEffect(() => {
    if (unread.length > 0) markRead.mutate(unread);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unread.join(",")]);

  const submit = () => {
    if (!draft) return;
    if (!draft.title.trim() || !draft.description.trim()) {
      toast.error("Preencha título e descrição.");
      return;
    }
    save.mutate(
      { ...draft, id: draft.id || undefined },
      {
        onSuccess: () => {
          toast.success("Novidade salva.");
          setDraft(null);
        },
        onError: (e) => toast.error(e instanceof Error ? e.message : "Não foi possível salvar."),
      },
    );
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">Novidades do FotoPress</h1>
            <span className="rounded-md bg-primary/10 border border-primary/25 px-2 py-0.5 font-mono text-xs font-bold text-primary">
              {APP_VERSION}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Tudo o que foi lançado, melhorado e corrigido, em ordem cronológica.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => openNewsUpdatesPanel()}
            className="text-xs gap-1.5"
            title="Abrir painel lateral com novidades e marcações"
          >
            <PanelRight className="size-3.5" />
            <span className="hidden sm:inline">Painel Lateral</span>
          </Button>

          {isAdmin && (
            <Button size="sm" onClick={() => setDraft(emptyDraft())} className="text-xs">
              <Plus className="mr-1.5 size-4" /> Nova novidade
            </Button>
          )}
        </div>
      </header>

      {/* Seletor de visualização: Linha do Tempo vs Release Notes */}
      <div className="flex border-b border-border">
        <button
          type="button"
          onClick={() => setPageTab("timeline")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2 text-xs sm:text-sm font-semibold transition-colors",
            pageTab === "timeline"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <Sparkles className="size-4" />
          <span>Linha do Tempo de Novidades</span>
        </button>

        <button
          type="button"
          onClick={() => setPageTab("releases")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-4 py-2 text-xs sm:text-sm font-semibold transition-colors",
            pageTab === "releases"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground",
          )}
        >
          <History className="size-4" />
          <span>Histórico de Releases & Logs</span>
        </button>
      </div>

      {pageTab === "releases" ? (
        <ReleaseNotesLog />
      ) : (
        <div className="space-y-4">
          {/* Alertas em Segundo Plano / Service Worker */}
          {isPushSupported && (
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 transition-all">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary mt-0.5 sm:mt-0">
                    {isPushEnabled ? (
                      <BellRing className="size-4 text-primary" />
                    ) : (
                      <Bell className="size-4 text-primary" />
                    )}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs sm:text-sm font-semibold text-foreground">
                        Notificações em Segundo Plano (Service Worker)
                      </h4>
                      {isPushEnabled ? (
                        <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          Ativo
                        </span>
                      ) : (
                        <span className="rounded-full bg-muted px-2 py-0.2 text-[10px] font-medium text-muted-foreground">
                          Desativado
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Receba avisos de novas versões e melhorias no FotoPress mesmo com o navegador
                      fechado.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  {!isPushEnabled ? (
                    <Button
                      size="sm"
                      onClick={requestPushPermission}
                      disabled={isPushPending || pushPermission === "denied"}
                      className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
                    >
                      <BellRing className="size-3.5" />
                      <span>Ativar Notificações</span>
                    </Button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => sendTestNotification(0)}
                        className="h-8 text-xs gap-1"
                      >
                        <Bell className="size-3" />
                        <span>Testar agora</span>
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => sendTestNotification(5)}
                        className="h-8 text-xs gap-1"
                        title="Dispara notificação em 5s para você testar minimizando o navegador"
                      >
                        <span>Testar em 5s</span>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Barra de Filtros por Categoria */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <Button
              type="button"
              variant={selectedCategory === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory("all")}
              className="h-7 text-xs shrink-0"
            >
              Todas ({updates.length})
            </Button>
            <Button
              type="button"
              variant={selectedCategory === "novidade" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory("novidade")}
              className="h-7 text-xs shrink-0 gap-1"
            >
              <Sparkles className="size-3 text-primary" />
              <span>New Feature</span>
            </Button>
            <Button
              type="button"
              variant={selectedCategory === "melhoria" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory("melhoria")}
              className="h-7 text-xs shrink-0 gap-1"
            >
              <CheckCircle2 className="size-3 text-emerald-500" />
              <span>Improvement</span>
            </Button>
            <Button
              type="button"
              variant={selectedCategory === "correcao" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory("correcao")}
              className="h-7 text-xs shrink-0 gap-1"
            >
              <Wrench className="size-3 text-amber-500" />
              <span>Fix</span>
            </Button>
          </div>

          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : filteredUpdates.length === 0 ? (
            <EmptyState
              icon={Sparkles}
              title="Nenhuma novidade encontrada"
              description="Nenhum item publicado corresponde à categoria selecionada."
            />
          ) : (
            <ol className="relative space-y-4 border-l border-border pl-5">
              {filteredUpdates.map((item) => {
                const route = safeRoute(item.related_route);
                const isBuiltin = item.id.startsWith("update-");
                const tagLabel =
                  item.category === "novidade"
                    ? "New Feature"
                    : item.category === "melhoria"
                      ? "Improvement"
                      : "Fix";

                return (
                  <li
                    key={item.id}
                    className="relative rounded-xl border border-border bg-card p-5 transition-shadow hover:shadow-xs"
                  >
                    <span className="absolute -left-[26px] top-6 size-2.5 rounded-full bg-primary ring-4 ring-background" />
                    <div className="flex flex-wrap items-center gap-2">
                      {/* Tag de categoria padronizada */}
                      <span
                        className={`rounded-md px-2 py-0.5 text-[10px] font-bold border ${
                          badgeTone[item.category] ?? badgeTone.novidade
                        }`}
                      >
                        {tagLabel}
                      </span>
                      <span className="text-xs text-muted-foreground font-medium">
                        {formatDate(item.published_at)}
                      </span>
                      {!item.is_published && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground font-medium">
                          Rascunho
                        </span>
                      )}
                      {isAdmin && !isBuiltin && (
                        <span className="ml-auto flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => setDraft(item)}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("Excluir esta novidade?")) remove.mutate(item.id);
                            }}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </span>
                      )}
                    </div>
                    <h2 className="mt-2.5 text-base font-semibold text-foreground tracking-tight">
                      {item.title}
                    </h2>
                    <p className="mt-1.5 whitespace-pre-line text-sm text-muted-foreground leading-relaxed">
                      {item.description}
                    </p>

                    <div className="mt-3 pt-2.5 border-t border-border/40 flex items-center justify-between gap-2">
                      <ReleaseFeedbackReaction itemId={item.id} title={item.title} />

                      {route && (
                        <Link
                          to={route}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        >
                          <span>Conferir no FotoPress</span>
                          <ArrowRight className="size-3.5" />
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      )}

      <Dialog open={!!draft} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Editar novidade" : "Nova novidade"}</DialogTitle>
            <DialogDescription>
              Publicações ficam visíveis para todos os usuários do FotoPress.
            </DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Título</Label>
                <Input
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Descrição</Label>
                <Textarea
                  rows={4}
                  value={draft.description}
                  onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Categoria</Label>
                  <Select
                    value={draft.category}
                    onValueChange={(v) => setDraft({ ...draft, category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {UPDATE_CATEGORIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={draft.published_at.slice(0, 10)}
                    onChange={(e) => setDraft({ ...draft, published_at: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Link relacionado</Label>
                <Select
                  value={draft.related_route ?? ""}
                  onValueChange={(v) => setDraft({ ...draft, related_route: v || null })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sem link" />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATED_ROUTES.filter((r) => r.value).map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                <div>
                  <p className="text-sm font-medium">Publicada</p>
                  <p className="text-xs text-muted-foreground">
                    Rascunhos ficam visíveis apenas para você.
                  </p>
                </div>
                <Switch
                  checked={draft.is_published}
                  onCheckedChange={(v) => setDraft({ ...draft, is_published: v })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDraft(null)}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={save.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
