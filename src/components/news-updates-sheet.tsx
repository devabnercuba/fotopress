import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  ArrowDownUp,
  ArrowRight,
  Bell,
  BellRing,
  Check,
  CheckCheck,
  Circle,
  ExternalLink,
  History,
  Megaphone,
  Search,
  Sparkles,
  Wrench,
  CheckCircle2,
} from "lucide-react";

import { ReleaseFeedbackReaction } from "@/components/release-feedback-reaction";
import { ReleaseNotesLog } from "@/components/release-notes-log";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { usePushNotifications } from "@/lib/push-notifications";
import {
  categoryLabel,
  safeRoute,
  useMarkAllUpdatesRead,
  useProductUpdateReads,
  useProductUpdates,
  useToggleUpdateReadStatus,
  type ProductUpdate,
} from "@/lib/product-updates";
import { useUpdatesPanel } from "@/lib/updates-panel-context";
import { cn } from "@/lib/utils";

const badgeTone: Record<string, { bg: string; text: string; border: string; tag: string }> = {
  novidade: {
    bg: "bg-primary/10",
    text: "text-primary",
    border: "border-primary/25",
    tag: "New Feature",
  },
  melhoria: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-500/25",
    tag: "Improvement",
  },
  correcao: {
    bg: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-500/25",
    tag: "Fix",
  },
};

function formatUpdateDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function NewsUpdatesSheet() {
  const { isOpen, closePanel, activeTab, setActiveTab } = useUpdatesPanel();
  const { data: updates = [], isLoading } = useProductUpdates();
  const { data: reads = [] } = useProductUpdateReads();
  const { markAll } = useMarkAllUpdatesRead();
  const toggleStatus = useToggleUpdateReadStatus();

  // Push notifications hook
  const {
    isSupported: isPushSupported,
    permission: pushPermission,
    isEnabled: isPushEnabled,
    isPending: isPushPending,
    requestPermission: requestPushPermission,
    sendTestNotification,
  } = usePushNotifications();

  // Filtros locais da aba de novidades
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterReadStatus, setFilterReadStatus] = useState<"all" | "unread">("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "category">("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [releasesSearch, setReleasesSearch] = useState("");
  const [showPushCard, setShowPushCard] = useState(true);

  const readSet = useMemo(() => new Set(reads), [reads]);
  const publishedUpdates = useMemo(() => updates.filter((u) => u.is_published), [updates]);

  const totalUpdatesCount = publishedUpdates.length;
  const readUpdatesCount = useMemo(
    () => publishedUpdates.filter((u) => readSet.has(u.id)).length,
    [publishedUpdates, readSet],
  );
  const unreadCount = useMemo(
    () => Math.max(0, totalUpdatesCount - readUpdatesCount),
    [totalUpdatesCount, readUpdatesCount],
  );
  const readPercentage =
    totalUpdatesCount > 0 ? Math.round((readUpdatesCount / totalUpdatesCount) * 100) : 100;

  // Contagens por categoria
  const categoryCounts = useMemo(() => {
    const counts = { all: publishedUpdates.length, novidade: 0, melhoria: 0, correcao: 0 };
    publishedUpdates.forEach((u) => {
      if (u.category === "novidade") counts.novidade += 1;
      else if (u.category === "melhoria") counts.melhoria += 1;
      else if (u.category === "correcao") counts.correcao += 1;
    });
    return counts;
  }, [publishedUpdates]);

  // Lista filtrada e ordenada
  const displayedUpdates = useMemo(() => {
    let list = [...publishedUpdates];

    // Filtro de leitura
    if (filterReadStatus === "unread") {
      list = list.filter((u) => !readSet.has(u.id));
    }

    // Filtro por tipo/categoria
    if (filterCategory !== "all") {
      list = list.filter((u) => u.category === filterCategory);
    }

    // Filtro por termo de busca
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (u) =>
          u.title.toLowerCase().includes(q) ||
          u.description.toLowerCase().includes(q) ||
          categoryLabel(u.category).toLowerCase().includes(q),
      );
    }

    // Ordenação
    list.sort((a, b) => {
      if (sortOrder === "newest") {
        return new Date(b.published_at).getTime() - new Date(a.published_at).getTime();
      }
      if (sortOrder === "oldest") {
        return new Date(a.published_at).getTime() - new Date(b.published_at).getTime();
      }
      if (sortOrder === "category") {
        return a.category.localeCompare(b.category);
      }
      return 0;
    });

    return list;
  }, [publishedUpdates, filterReadStatus, filterCategory, searchQuery, sortOrder, readSet]);

  const handleToggleRead = (item: ProductUpdate, e: React.MouseEvent) => {
    e.stopPropagation();
    const isRead = readSet.has(item.id);
    const nextRead = !isRead;
    toggleStatus.mutate(
      { id: item.id, shouldMarkRead: nextRead },
      {
        onSuccess: () => {
          if (nextRead) {
            toast.success("Atualização marcada como lida!", {
              description: "Status salvo localmente no seu dispositivo.",
            });
          } else {
            toast.info("Atualização marcada como não lida.", {
              description: "Status atualizado localmente.",
            });
          }
        },
      },
    );
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => (!open ? closePanel() : null)}>
      <SheetContent
        side="right"
        className="flex w-full flex-col p-0 sm:max-w-lg md:max-w-xl z-50 overflow-hidden bg-background"
      >
        {/* Header com Abas e Ações */}
        <div className="border-b border-border bg-card px-5 py-4 shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-xs">
                <Megaphone className="size-4.5" />
              </span>
              <div>
                <SheetTitle className="text-base font-bold tracking-tight">
                  Central de Atualizações
                </SheetTitle>
                <SheetDescription className="text-xs text-muted-foreground">
                  Novas funcionalidades, tags de categoria e histórico de releases
                </SheetDescription>
              </div>
            </div>

            {unreadCount > 0 && (
              <Badge variant="default" className="gap-1 font-bold text-xs px-2 py-0.5">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-foreground opacity-75" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-primary-foreground" />
                </span>
                {unreadCount} nova{unreadCount > 1 ? "s" : ""}
              </Badge>
            )}
          </div>

          {/* Seletor de Abas */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex rounded-lg bg-muted p-0.5">
              <button
                type="button"
                onClick={() => setActiveTab("updates")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-all",
                  activeTab === "updates"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Sparkles className="size-3.5" />
                <span>Novidades</span>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                    {unreadCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("releases")}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-all",
                  activeTab === "releases"
                    ? "bg-card text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <History className="size-3.5" />
                <span>Histórico de Releases</span>
              </button>
            </div>

            {activeTab === "updates" && unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAll()}
                className="h-7 text-xs text-muted-foreground hover:text-primary gap-1 px-2"
                title="Marcar todas as novidades como lidas"
              >
                <CheckCheck className="size-3.5" />
                <span className="hidden sm:inline">Marcar todas como lidas</span>
              </Button>
            )}
          </div>

          {/* Barra de Progresso de Leitura */}
          {activeTab === "updates" && totalUpdatesCount > 0 && (
            <div className="mt-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
                  <CheckCheck className="size-3.5 text-primary" />
                  <span>Progresso de leitura</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-foreground">
                    {readUpdatesCount} de {totalUpdatesCount} lida{totalUpdatesCount > 1 ? "s" : ""}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.2 text-[10px] font-bold",
                      readPercentage === 100
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                        : "bg-primary/10 text-primary border border-primary/25",
                    )}
                  >
                    {readPercentage}%
                  </span>
                </div>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full transition-all duration-300 rounded-full",
                    readPercentage === 100 ? "bg-emerald-500" : "bg-primary",
                  )}
                  style={{ width: `${readPercentage}%` }}
                />
              </div>
            </div>
          )}

          {/* Barra de Busca rápida no Histórico de Releases */}
          {activeTab === "releases" && (
            <div className="mt-3 space-y-2 border-t border-border/60 pt-2.5">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  value={releasesSearch}
                  onChange={(e) => setReleasesSearch(e.target.value)}
                  placeholder="Buscar histórico de releases por título ou conteúdo..."
                  className="pl-8 h-8 text-xs bg-surface/50"
                />
                {releasesSearch && (
                  <button
                    type="button"
                    onClick={() => setReleasesSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>
          )}

          {/* BARRA DE FILTROS E ORDENAÇÃO NA CENTRAL DE ATUALIZAÇÕES */}
          {activeTab === "updates" && (
            <div className="mt-3 space-y-2 border-t border-border/60 pt-2.5">
              {/* Barra de Busca rápida */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filtrar novidades por palavra-chave..."
                  className="pl-8 h-7 text-xs bg-surface/50"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    Limpar
                  </button>
                )}
              </div>

              {/* Barra de Filtros por Categoria / Tipo */}
              <div className="flex flex-wrap items-center justify-between gap-1.5">
                <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setFilterCategory("all")}
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors shrink-0",
                      filterCategory === "all"
                        ? "bg-secondary text-secondary-foreground font-semibold"
                        : "text-muted-foreground hover:bg-muted/50",
                    )}
                  >
                    Todas ({categoryCounts.all})
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterCategory("novidade")}
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors flex items-center gap-1 shrink-0",
                      filterCategory === "novidade"
                        ? "bg-primary/15 text-primary font-semibold border border-primary/30"
                        : "text-muted-foreground hover:bg-muted/50",
                    )}
                  >
                    <Sparkles className="size-2.5 text-primary" />
                    <span>New Feature ({categoryCounts.novidade})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterCategory("melhoria")}
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors flex items-center gap-1 shrink-0",
                      filterCategory === "melhoria"
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold border border-emerald-500/30"
                        : "text-muted-foreground hover:bg-muted/50",
                    )}
                  >
                    <CheckCircle2 className="size-2.5 text-emerald-500" />
                    <span>Improvement ({categoryCounts.melhoria})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterCategory("correcao")}
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors flex items-center gap-1 shrink-0",
                      filterCategory === "correcao"
                        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/30"
                        : "text-muted-foreground hover:bg-muted/50",
                    )}
                  >
                    <Wrench className="size-2.5 text-amber-500" />
                    <span>Fix ({categoryCounts.correcao})</span>
                  </button>
                </div>

                {/* Filtro Lido / Não Lido & Ordenação */}
                <div className="flex items-center gap-1.5 ml-auto text-xs">
                  <div className="flex rounded-md bg-muted/60 p-0.5">
                    <button
                      type="button"
                      onClick={() => setFilterReadStatus("all")}
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                        filterReadStatus === "all"
                          ? "bg-card text-foreground font-semibold shadow-xs"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      Todas
                    </button>
                    <button
                      type="button"
                      onClick={() => setFilterReadStatus("unread")}
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors flex items-center gap-1",
                        filterReadStatus === "unread"
                          ? "bg-primary/20 text-primary font-semibold shadow-xs"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      <span className="size-1.5 rounded-full bg-primary" />
                      Não lidas ({unreadCount})
                    </button>
                  </div>

                  {/* Seletor de Ordenação */}
                  <div className="flex items-center gap-1">
                    <ArrowDownUp className="size-3 text-muted-foreground" />
                    <select
                      value={sortOrder}
                      onChange={(e) =>
                        setSortOrder(e.target.value as "newest" | "oldest" | "category")
                      }
                      className="bg-transparent text-[10px] font-medium text-muted-foreground focus:text-foreground cursor-pointer outline-none border-none py-0.5"
                    >
                      <option value="newest">Mais recentes</option>
                      <option value="oldest">Mais antigas</option>
                      <option value="category">Por tipo</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Conteúdo rolável */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {activeTab === "updates" ? (
            <div className="space-y-3.5">
              {/* Card de Notificações em Segundo Plano (Push & Service Worker) */}
              {showPushCard && isPushSupported && (
                <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 transition-all">
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2.5">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary mt-0.5">
                        {isPushEnabled ? (
                          <BellRing className="size-3.5 text-primary" />
                        ) : (
                          <Bell className="size-3.5 text-primary" />
                        )}
                      </span>
                      <div className="space-y-0.5 min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <h5 className="text-xs font-semibold text-foreground">
                            Alertas em Segundo Plano (Service Worker)
                          </h5>
                          {isPushEnabled ? (
                            <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                              Ativo
                            </span>
                          ) : pushPermission === "denied" ? (
                            <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 text-[9px] font-bold text-amber-600 dark:text-amber-400">
                              Bloqueado no navegador
                            </span>
                          ) : (
                            <span className="rounded-full bg-muted px-1.5 py-0.2 text-[9px] font-medium text-muted-foreground">
                              Desativado
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          Receba avisos de novas funcionalidades mesmo quando o app ou a aba estiver
                          fechada. O clique abre este painel automaticamente.
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowPushCard(false)}
                      className="text-muted-foreground hover:text-foreground text-xs p-1"
                      title="Ocultar painel de push"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-primary/15 flex flex-wrap items-center justify-between gap-2 text-xs">
                    {!isPushEnabled ? (
                      <Button
                        type="button"
                        size="sm"
                        onClick={requestPushPermission}
                        disabled={isPushPending || pushPermission === "denied"}
                        className="h-7 text-xs bg-primary text-primary-foreground hover:bg-primary/90 gap-1.5"
                      >
                        <BellRing className="size-3" />
                        <span>Ativar Notificações Push</span>
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => sendTestNotification(0)}
                          className="h-7 text-[11px] gap-1"
                        >
                          <Bell className="size-3" />
                          <span>Testar agora</span>
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => sendTestNotification(5)}
                          className="h-7 text-[11px] gap-1"
                          title="Dispara notificação em 5s para você testar minimizando o navegador"
                        >
                          <span>Testar em 5s (minimize a aba)</span>
                        </Button>
                      </div>
                    )}

                    <span className="text-[10px] text-muted-foreground font-mono">
                      Service Worker: /sw.js
                    </span>
                  </div>
                </div>
              )}

              {isLoading ? (
                <div className="space-y-3 p-4">
                  <div className="h-16 rounded-xl bg-muted/60 animate-pulse" />
                  <div className="h-16 rounded-xl bg-muted/60 animate-pulse" />
                  <div className="h-16 rounded-xl bg-muted/60 animate-pulse" />
                </div>
              ) : displayedUpdates.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-8 text-center">
                  <CheckCircleIcon className="size-8 mx-auto text-emerald-500/70 mb-2" />
                  <p className="text-sm font-medium text-foreground">
                    {filterReadStatus === "unread"
                      ? "Você já leu todas as novidades desta categoria!"
                      : "Nenhuma novidade encontrada para este filtro."}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {filterReadStatus === "unread"
                      ? "Alterne para 'Todas' para rever melhorias anteriores."
                      : "Tente remover os filtros ou buscar por outro termo."}
                  </p>
                  {(filterCategory !== "all" || filterReadStatus === "unread" || searchQuery) && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setFilterCategory("all");
                        setFilterReadStatus("all");
                        setSearchQuery("");
                      }}
                      className="mt-3 text-xs"
                    >
                      Redefinir filtros
                    </Button>
                  )}
                </div>
              ) : (
                displayedUpdates.map((item) => {
                  const isRead = readSet.has(item.id);
                  const route = safeRoute(item.related_route);
                  const tone = badgeTone[item.category] ?? badgeTone.novidade;

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "relative rounded-xl border p-4 transition-all",
                        !isRead
                          ? "border-primary/40 bg-primary/5 shadow-xs"
                          : "border-border bg-card/80 hover:bg-card",
                      )}
                    >
                      {/* Topo do card: Categoria com tag, Data, Indicador Lido/Não Lido */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Indicador Lido/Não Lido */}
                          {!isRead ? (
                            <span className="flex items-center gap-1 rounded-full bg-primary/15 border border-primary/30 px-2 py-0.2 text-[10px] font-bold text-primary">
                              <span className="relative flex size-1.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                                <span className="relative inline-flex size-1.5 rounded-full bg-primary" />
                              </span>
                              Não lida
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.2 text-[10px] font-medium text-muted-foreground">
                              <Check className="size-3" />
                              Lida
                            </span>
                          )}

                          {/* Tag de Categoria Padronizada (ex: New Feature, Improvement, Fix) */}
                          <span
                            className={cn(
                              "rounded-md border px-2 py-0.2 text-[10px] font-bold tracking-tight",
                              tone.bg,
                              tone.border,
                              tone.text,
                            )}
                          >
                            {tone.tag}
                          </span>

                          <span className="text-[10px] text-muted-foreground font-medium">
                            {categoryLabel(item.category)}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[11px] text-muted-foreground font-medium">
                            {formatUpdateDate(item.published_at)}
                          </span>

                          {/* Botão de alternar leitura individual */}
                          <button
                            type="button"
                            onClick={(e) => handleToggleRead(item, e)}
                            className={cn(
                              "size-6 flex items-center justify-center rounded-md border text-xs transition-colors",
                              !isRead
                                ? "border-primary/30 text-primary hover:bg-primary/10"
                                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                            )}
                            title={!isRead ? "Marcar como lida" : "Marcar como não lida"}
                          >
                            {!isRead ? (
                              <Check className="size-3" />
                            ) : (
                              <Circle className="size-2.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Título e Descrição */}
                      <h4 className="text-sm font-semibold text-foreground tracking-tight">
                        {item.title}
                      </h4>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                        {item.description}
                      </p>

                      {/* Barra de Ações do Card: Marcar como lida, Reação e Link */}
                      <div className="mt-3 pt-2.5 border-t border-border/40 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          {!isRead ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={(e) => handleToggleRead(item, e)}
                              className="h-7 text-[11px] font-semibold border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary gap-1 px-2.5"
                            >
                              <Check className="size-3.5" />
                              <span>Marcar como lida</span>
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={(e) => handleToggleRead(item, e)}
                              className="h-7 text-[11px] font-medium text-muted-foreground hover:text-foreground gap-1 px-2"
                            >
                              <Circle className="size-3" />
                              <span>Marcar como não lida</span>
                            </Button>
                          )}
                        </div>

                        <div className="flex items-center gap-2.5 ml-auto">
                          <ReleaseFeedbackReaction itemId={item.id} title={item.title} />

                          {route && (
                            <Link
                              to={route}
                              onClick={closePanel}
                              className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                            >
                              <span>Testar</span>
                              <ArrowRight className="size-3" />
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : (
            <ReleaseNotesLog searchTerm={releasesSearch} onSearchChange={setReleasesSearch} />
          )}
        </div>

        {/* Rodapé fixo */}
        <div className="border-t border-border bg-muted/20 px-5 py-3 shrink-0 flex items-center justify-between gap-3">
          <Link
            to="/novidades"
            onClick={closePanel}
            className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
          >
            <span>Ver página completa de Novidades</span>
            <ExternalLink className="size-3" />
          </Link>

          <Button variant="outline" size="sm" onClick={closePanel} className="h-8 text-xs">
            Fechar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
      />
    </svg>
  );
}
