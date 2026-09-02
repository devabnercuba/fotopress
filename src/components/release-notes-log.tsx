import { useEffect, useMemo, useState } from "react";
import Markdown from "react-markdown";
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Filter,
  History,
  Search,
  Sparkles,
  Tag,
  Wrench,
  Zap,
} from "lucide-react";

import { ReleaseFeedbackReaction } from "@/components/release-feedback-reaction";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  RELEASE_HISTORY,
  type ReleaseCategoryTag,
  type ReleaseNoteItem,
  type ReleaseVersion,
} from "@/lib/release-notes-data";
import { cn } from "@/lib/utils";

export const categoryStyles: Record<
  ReleaseCategoryTag,
  {
    label: string;
    ptLabel: string;
    bg: string;
    text: string;
    border: string;
    icon: typeof Sparkles;
  }
> = {
  "New Feature": {
    label: "New Feature",
    ptLabel: "Nova Funcionalidade",
    bg: "bg-primary/10",
    text: "text-primary",
    border: "border-primary/25",
    icon: Sparkles,
  },
  Improvement: {
    label: "Improvement",
    ptLabel: "Melhoria",
    bg: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-400",
    border: "border-emerald-500/25",
    icon: CheckCircle2,
  },
  Fix: {
    label: "Fix",
    ptLabel: "Correção",
    bg: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-400",
    border: "border-amber-500/25",
    icon: Wrench,
  },
  Performance: {
    label: "Performance",
    ptLabel: "Performance",
    bg: "bg-purple-500/10",
    text: "text-purple-600 dark:text-purple-400",
    border: "border-purple-500/25",
    icon: Zap,
  },
};

export function getCategoryTag(item: ReleaseNoteItem): ReleaseCategoryTag {
  if (item.categoryTag) return item.categoryTag;
  if (item.type === "feature") return "New Feature";
  if (item.type === "improvement") return "Improvement";
  if (item.type === "fix") return "Fix";
  return "Performance";
}

interface ReleaseNotesLogProps {
  className?: string;
  defaultExpanded?: boolean;
  searchTerm?: string;
  onSearchChange?: (term: string) => void;
  hideSearchInput?: boolean;
}

export function ReleaseNotesLog({
  className,
  defaultExpanded = true,
  searchTerm,
  onSearchChange,
  hideSearchInput = false,
}: ReleaseNotesLogProps) {
  const [internalSearch, setInternalSearch] = useState("");
  const search = searchTerm !== undefined ? searchTerm : internalSearch;

  const handleSearchChange = (val: string) => {
    if (onSearchChange) onSearchChange(val);
    setInternalSearch(val);
  };

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedModule, setSelectedModule] = useState<string>("all");
  const [expandedVersions, setExpandedVersions] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    RELEASE_HISTORY.forEach((v, index) => {
      initial[v.version] = defaultExpanded || index === 0;
    });
    return initial;
  });

  // Unique modules
  const allModules = useMemo(() => {
    const set = new Set<string>();
    RELEASE_HISTORY.forEach((v) => {
      v.items.forEach((item) => set.add(item.module));
    });
    return Array.from(set).sort();
  }, []);

  // Category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: 0,
      "New Feature": 0,
      Improvement: 0,
      Fix: 0,
      Performance: 0,
    };

    RELEASE_HISTORY.forEach((v) => {
      v.items.forEach((item) => {
        counts.all += 1;
        const cat = getCategoryTag(item);
        if (counts[cat] !== undefined) counts[cat] += 1;
      });
    });

    return counts;
  }, []);

  // Filter releases and items
  const filteredReleases = useMemo(() => {
    const term = search.trim().toLowerCase();

    return RELEASE_HISTORY.map((v) => {
      const items = v.items.filter((item) => {
        const cat = getCategoryTag(item);
        if (selectedCategory !== "all" && cat !== selectedCategory) return false;
        if (selectedModule !== "all" && item.module !== selectedModule) return false;
        if (term) {
          const matchTitle = item.title.toLowerCase().includes(term);
          const matchDesc = item.description.toLowerCase().includes(term);
          const matchMod = item.module.toLowerCase().includes(term);
          const matchVer = v.version.toLowerCase().includes(term);
          const matchCat = cat.toLowerCase().includes(term);
          if (!matchTitle && !matchDesc && !matchMod && !matchVer && !matchCat) return false;
        }
        return true;
      });

      return {
        ...v,
        items,
        hasMatches: items.length > 0,
      };
    }).filter((v) => v.hasMatches);
  }, [search, selectedCategory, selectedModule]);

  const toggleVersion = (version: string) => {
    setExpandedVersions((prev) => ({
      ...prev,
      [version]: !prev[version],
    }));
  };

  const toggleAll = (expand: boolean) => {
    const next: Record<string, boolean> = {};
    RELEASE_HISTORY.forEach((v) => {
      next[v.version] = expand;
    });
    setExpandedVersions(next);
  };

  // Custom Markdown components
  const markdownComponents = {
    p: ({ children }: { children?: React.ReactNode }) => (
      <p className="leading-relaxed mb-2 last:mb-0 text-xs text-muted-foreground">{children}</p>
    ),
    strong: ({ children }: { children?: React.ReactNode }) => (
      <strong className="font-semibold text-foreground">{children}</strong>
    ),
    code: ({ children }: { children?: React.ReactNode }) => (
      <code className="rounded bg-muted/80 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-foreground border border-border/40">
        {children}
      </code>
    ),
    ul: ({ children }: { children?: React.ReactNode }) => (
      <ul className="list-disc pl-4 space-y-1 my-2 text-xs text-muted-foreground">{children}</ul>
    ),
    ol: ({ children }: { children?: React.ReactNode }) => (
      <ol className="list-decimal pl-4 space-y-1 my-2 text-xs text-muted-foreground">{children}</ol>
    ),
    li: ({ children }: { children?: React.ReactNode }) => (
      <li className="leading-relaxed">{children}</li>
    ),
  };

  return (
    <div className={cn("space-y-6", className)} id="release-notes-log-component">
      {/* Header com Estatísticas Rápidas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <History className="size-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-foreground">
              Histórico de Releases & Logs de Melhorias
            </h3>
            <p className="text-xs text-muted-foreground">
              Registro contínuo de atualizações com suporte a Markdown, tags e categorias
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Badge variant="secondary" className="font-semibold text-[11px] px-2.5 py-1">
            {RELEASE_HISTORY[0]?.version} (Atual)
          </Badge>
          <Badge variant="outline" className="text-muted-foreground text-[11px] px-2.5 py-1">
            {categoryCounts.all} melhorias documentadas
          </Badge>
        </div>
      </div>

      {/* Controles de Busca e Filtros por Categoria */}
      <div className="space-y-3">
        {!hideSearchInput && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Buscar por funcionalidade, Markdown, módulo ou versão..."
                className="pl-9 h-9 text-xs"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => handleSearchChange("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                >
                  Limpar
                </button>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <Button
              type="button"
              variant={selectedCategory === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory("all")}
              className="h-8 text-xs shrink-0"
            >
              Todas ({categoryCounts.all})
            </Button>
            <Button
              type="button"
              variant={selectedCategory === "New Feature" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory("New Feature")}
              className="h-8 text-xs shrink-0 gap-1.5"
            >
              <Sparkles className="size-3 text-primary" />
              <span>New Feature</span>
              <span className="rounded-full bg-primary/20 px-1.5 py-0.2 text-[10px] font-bold">
                {categoryCounts["New Feature"]}
              </span>
            </Button>
            <Button
              type="button"
              variant={selectedCategory === "Improvement" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory("Improvement")}
              className="h-8 text-xs shrink-0 gap-1.5"
            >
              <CheckCircle2 className="size-3 text-emerald-500" />
              <span>Improvement</span>
              <span className="rounded-full bg-emerald-500/20 px-1.5 py-0.2 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                {categoryCounts.Improvement}
              </span>
            </Button>
            <Button
              type="button"
              variant={selectedCategory === "Fix" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory("Fix")}
              className="h-8 text-xs shrink-0 gap-1.5"
            >
              <Wrench className="size-3 text-amber-500" />
              <span>Fix</span>
              <span className="rounded-full bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                {categoryCounts.Fix}
              </span>
            </Button>
            <Button
              type="button"
              variant={selectedCategory === "Performance" ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory("Performance")}
              className="h-8 text-xs shrink-0 gap-1.5"
            >
              <Zap className="size-3 text-purple-500" />
              <span>Performance</span>
              <span className="rounded-full bg-purple-500/20 px-1.5 py-0.2 text-[10px] font-bold text-purple-600 dark:text-purple-400">
                {categoryCounts.Performance}
              </span>
            </Button>
          </div>
        </div>

        {/* Filtro por Módulo & Atalhos de Expansão */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
            <span className="text-[11px] font-medium text-muted-foreground shrink-0 flex items-center gap-1 mr-1">
              <Tag className="size-3" /> Módulos:
            </span>
            <button
              type="button"
              onClick={() => setSelectedModule("all")}
              className={cn(
                "rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors shrink-0",
                selectedModule === "all"
                  ? "bg-secondary text-secondary-foreground font-semibold"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted",
              )}
            >
              Todos
            </button>
            {allModules.map((mod) => (
              <button
                key={mod}
                type="button"
                onClick={() => setSelectedModule(mod)}
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors shrink-0",
                  selectedModule === mod
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted",
                )}
              >
                {mod}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 text-[11px] text-muted-foreground ml-auto">
            <button
              type="button"
              onClick={() => toggleAll(true)}
              className="hover:text-foreground underline underline-offset-2"
            >
              Expandir todas
            </button>
            <span>•</span>
            <button
              type="button"
              onClick={() => toggleAll(false)}
              className="hover:text-foreground underline underline-offset-2"
            >
              Recolher todas
            </button>
          </div>
        </div>
      </div>

      {/* Lista de Versões com Suporte a Markdown */}
      {filteredReleases.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center">
          <Filter className="size-8 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm font-medium text-foreground">Nenhuma melhoria encontrada</p>
          <p className="text-xs text-muted-foreground mt-1">
            Tente buscar por outro termo ou remova os filtros ativos.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearch("");
              setSelectedCategory("all");
              setSelectedModule("all");
            }}
            className="mt-3 text-xs"
          >
            Redefinir filtros
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          {filteredReleases.map((version) => {
            const isExpanded = expandedVersions[version.version] ?? true;

            return (
              <div
                key={version.version}
                className="overflow-hidden rounded-xl border border-border bg-card transition-all"
              >
                {/* Cabeçalho da Versão */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleVersion(version.version)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") toggleVersion(version.version);
                  }}
                  className="flex cursor-pointer items-start justify-between gap-3 border-b border-border/60 bg-surface/40 p-4 transition-colors hover:bg-surface"
                >
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-base font-bold text-foreground tracking-tight">
                        {version.version}
                      </span>
                      {version.badge && (
                        <span className="rounded-full bg-primary/10 border border-primary/25 px-2 py-0.2 text-[10px] font-bold text-primary">
                          {version.badge}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="size-3" />
                        {version.date}
                      </span>
                    </div>

                    {/* Resumo formatado com Markdown */}
                    <div className="markdown-body">
                      <Markdown components={markdownComponents}>{version.summary}</Markdown>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pt-0.5">
                    <span className="text-[11px] font-medium text-muted-foreground hidden sm:inline">
                      {version.items.length} item{version.items.length > 1 ? "s" : ""}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs px-2 text-muted-foreground gap-1"
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="size-3.5" />
                          <span className="hidden sm:inline">Ocultar</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown className="size-3.5" />
                          <span className="hidden sm:inline">Expandir</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Itens da Versão formatados com Markdown e Category Tags */}
                {isExpanded && (
                  <div className="divide-y divide-border/50 p-2 sm:p-4">
                    <div className="space-y-3.5">
                      {version.items.map((item) => {
                        const categoryTag = getCategoryTag(item);
                        const style = categoryStyles[categoryTag];
                        const Icon = style.icon;

                        return (
                          <div
                            key={item.id}
                            className="flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-surface/60 border border-border/40 bg-card"
                          >
                            <span
                              className={cn(
                                "flex size-7 shrink-0 items-center justify-center rounded-md border mt-0.5",
                                style.bg,
                                style.border,
                                style.text,
                              )}
                            >
                              <Icon className="size-3.5" />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                <h4 className="text-xs sm:text-sm font-semibold text-foreground">
                                  {item.title}
                                </h4>

                                {/* Tag de Categoria com destaque */}
                                <span
                                  className={cn(
                                    "rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-tight",
                                    style.bg,
                                    style.border,
                                    style.text,
                                  )}
                                >
                                  {style.label}
                                </span>

                                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground font-medium">
                                  {item.module}
                                </span>
                              </div>

                              {/* Renderização de Markdown no corpo da melhoria */}
                              <div className="markdown-body">
                                <Markdown components={markdownComponents}>
                                  {item.description}
                                </Markdown>
                              </div>

                              {/* Componente de Reação / Feedback */}
                              <div className="mt-3 pt-2 border-t border-border/40 flex items-center justify-between gap-2">
                                <span className="text-[10px] text-muted-foreground font-mono">
                                  {item.id}
                                </span>
                                <ReleaseFeedbackReaction itemId={item.id} title={item.title} />
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
