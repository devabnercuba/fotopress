import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

import { useAuthUser } from "./profile";

/**
 * Novidades do FotoPress
 * -----------------------
 * Publicações globais feitas pelo administrador. A leitura é individual:
 * cada usuário marca as novidades que já viu em `product_update_reads`.
 */
export type ProductUpdate = {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string | null;
  related_route: string | null;
  published_at: string;
  is_published: boolean;
};

export const UPDATE_CATEGORIES = [
  { value: "novidade", label: "Novidade" },
  { value: "melhoria", label: "Melhoria" },
  { value: "correcao", label: "Correção" },
] as const;

export function categoryLabel(value: string) {
  return UPDATE_CATEGORIES.find((c) => c.value === value)?.label ?? "Novidade";
}

/** Rotas internas permitidas em "link relacionado" (nunca URL externa/js). */
export const RELATED_ROUTES = [
  { value: "", label: "Sem link" },
  { value: "/calendario", label: "Calendário de Jogos" },
  { value: "/jogos", label: "Jogos/Eventos" },
  { value: "/agenda", label: "Minha Agenda" },
  { value: "/atletas", label: "Atletas/Clientes" },
  { value: "/credenciamento", label: "Credenciamento" },
  { value: "/campeonatos", label: "Campeonatos" },
  { value: "/fontes", label: "Fontes de Jogos" },
  { value: "/fontes-conteudo", label: "Fontes de Notícias" },
  { value: "/integracao-kiwify", label: "Integração Kiwify" },
  { value: "/primeiros-passos", label: "Primeiros passos" },
  { value: "/configuracoes", label: "Configurações" },
] as const;

/** Só aceita caminho interno simples — bloqueia javascript: e URLs externas. */
export function safeRoute(route: string | null | undefined) {
  if (!route) return null;
  const value = route.trim();
  if (!/^\/[A-Za-z0-9\-/_]*$/.test(value)) return null;
  return value;
}

export const BUILT_IN_UPDATES: ProductUpdate[] = [
  {
    id: "update-2026-09-02-calendar-export",
    title: "Exportação de Jogos para Calendário (.ics e Google Agenda)",
    description:
      "Agora você pode exportar qualquer partida ou evento esportivo diretamente para o seu calendário pessoal (Apple Calendar, Microsoft Outlook ou Google Agenda) em apenas um clique.",
    category: "novidade",
    icon: "calendar",
    related_route: "/calendario",
    published_at: "2026-09-02T12:00:00.000Z",
    is_published: true,
  },
  {
    id: "update-2026-09-02-event-details-dialog",
    title: "Modal de Detalhes do Evento & Compartilhamento",
    description:
      "Ao clicar em qualquer evento esportivo no calendário, veja os dados completos do confronto, local, horário e compartilhe rapidamente via WhatsApp ou copie o link com um clique.",
    category: "melhoria",
    icon: "sparkles",
    related_route: "/calendario",
    published_at: "2026-09-02T11:00:00.000Z",
    is_published: true,
  },
  {
    id: "update-2026-09-02-event-favorites",
    title: "Favoritar Eventos Esportivos e Filtro Exclusivo",
    description:
      "Marque jogos e coberturas com o ícone de coração para destacar partidas prioritárias. Ative o filtro 'Favoritos' para visualizá-los instantaneamente no calendário.",
    category: "novidade",
    icon: "heart",
    related_route: "/calendario",
    published_at: "2026-09-02T10:00:00.000Z",
    is_published: true,
  },
  {
    id: "update-2026-08-30-sports-calendar",
    title: "Novo Calendário Esportivo Unificado com Filtros Dinâmicos",
    description:
      "Visualização completa de jogos e eventos esportivos por data, filtros inteligentes por modalidade esportiva, status e atalhos rápidos (Hoje, Próximos 7 dias).",
    category: "novidade",
    icon: "calendar",
    related_route: "/calendario",
    published_at: "2026-08-30T10:00:00.000Z",
    is_published: true,
  },
  {
    id: "update-2026-08-25-skeletons-empty-states",
    title: "Carregamento Rápido com Skeletons e Telas Informativas",
    description:
      "Tempo percebido de carregamento reduzido com animações de esqueleto e novas telas com ações direcionadas para buscas sem correspondência.",
    category: "melhoria",
    icon: "zap",
    related_route: "/calendario",
    published_at: "2026-08-25T14:00:00.000Z",
    is_published: true,
  },
  {
    id: "update-2026-08-20-kiwify-integration",
    title: "Integração Kiwify & Gestão de Acessos",
    description:
      "Sincronização em tempo real de pagamentos, controle de planos ativos e liberação automática de recursos da plataforma.",
    category: "melhoria",
    icon: "credit-card",
    related_route: "/integracao-kiwify",
    published_at: "2026-08-20T10:00:00.000Z",
    is_published: true,
  },
];

const LOCAL_STORAGE_READS_KEY = "fotopress:read_updates";

function getLocalReads(userId?: string): string[] {
  try {
    const raw = window.localStorage.getItem(`${LOCAL_STORAGE_READS_KEY}:${userId || "guest"}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setLocalReads(userId: string | undefined, ids: string[]) {
  try {
    window.localStorage.setItem(
      `${LOCAL_STORAGE_READS_KEY}:${userId || "guest"}`,
      JSON.stringify(ids),
    );
  } catch (_e) {
    // Ignora restrições do localStorage no navegador
  }
}

const SELECT = "id, title, description, category, icon, related_route, published_at, is_published";

export function useProductUpdates(includeDrafts = false) {
  return useQuery({
    queryKey: ["product_updates", includeDrafts],
    queryFn: async (): Promise<ProductUpdate[]> => {
      try {
        let query = supabase.from("product_updates").select(SELECT).order("published_at", {
          ascending: false,
        });
        if (!includeDrafts) query = query.eq("is_published", true);
        const { data, error } = await query;
        if (error) throw error;
        const dbUpdates = (data ?? []) as ProductUpdate[];

        // Combina com novidades de sistema nativas para garantir que novas funcionalidades
        // implementadas sempre estejam visíveis aos usuários
        const dbIds = new Set(dbUpdates.map((u) => u.id));
        const missingBuiltins = BUILT_IN_UPDATES.filter(
          (u) => !dbIds.has(u.id) && (includeDrafts || u.is_published),
        );
        const all = [...dbUpdates, ...missingBuiltins];
        return all.sort((a, b) => b.published_at.localeCompare(a.published_at));
      } catch (err) {
        console.warn("Usando novidades integradas:", err);
        return BUILT_IN_UPDATES.filter((u) => includeDrafts || u.is_published);
      }
    },
  });
}

/** IDs das novidades que o usuário logado já visualizou. */
export function useProductUpdateReads() {
  const { data: user } = useAuthUser();
  const userId = user?.id;

  return useQuery({
    queryKey: ["product_update_reads", userId],
    queryFn: async (): Promise<string[]> => {
      const localReads = getLocalReads(userId);
      if (!userId) return localReads;

      try {
        const { data, error } = await supabase
          .from("product_update_reads")
          .select("update_id")
          .eq("user_id", userId);
        if (error) throw error;
        const dbReads = (data ?? []).map((r) => r.update_id as string);
        const merged = Array.from(new Set([...localReads, ...dbReads]));
        setLocalReads(userId, merged);
        return merged;
      } catch {
        return localReads;
      }
    },
  });
}

/** Quantas novidades publicadas ainda não foram vistas por este usuário. */
export function useUnreadUpdatesCount() {
  const { data: updates = [] } = useProductUpdates();
  const { data: reads = [] } = useProductUpdateReads();
  const read = new Set(reads);
  return updates.filter((u) => u.is_published && !read.has(u.id)).length;
}

/** Retorna a novidade mais recente ainda não lida pelo usuário. */
export function useLatestUnreadUpdate() {
  const { data: updates = [] } = useProductUpdates();
  const { data: reads = [] } = useProductUpdateReads();
  const read = new Set(reads);
  const unreadList = updates.filter((u) => u.is_published && !read.has(u.id));
  return {
    latest: unreadList[0] ?? null,
    unreadList,
    totalUnread: unreadList.length,
  };
}

/** Marca as novidades como lidas ao abrir a página (sem botão manual). */
export function useMarkUpdatesRead() {
  const qc = useQueryClient();
  const { data: user } = useAuthUser();
  const userId = user?.id;

  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;

      // 1. Atualiza imediatamente o localStorage para resposta instantânea na UI
      const current = getLocalReads(userId);
      const updated = Array.from(new Set([...current, ...ids]));
      setLocalReads(userId, updated);

      // 2. Persiste no Supabase se houver usuário autenticado
      if (userId) {
        try {
          await supabase.from("product_update_reads").upsert(
            ids.map((update_id) => ({ user_id: userId, update_id })),
            { onConflict: "user_id,update_id", ignoreDuplicates: true },
          );
        } catch (e) {
          console.warn("Não foi possível sincronizar leituras com o banco:", e);
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product_update_reads"] });
    },
  });
}

/** Alterna o status lido/não lido de um item individual de novidade. */
export function useToggleUpdateReadStatus() {
  const qc = useQueryClient();
  const { data: user } = useAuthUser();
  const userId = user?.id;

  return useMutation({
    mutationFn: async ({ id, shouldMarkRead }: { id: string; shouldMarkRead: boolean }) => {
      const current = getLocalReads(userId);
      let updated: string[];

      if (shouldMarkRead) {
        updated = Array.from(new Set([...current, id]));
        setLocalReads(userId, updated);

        if (userId) {
          try {
            await supabase
              .from("product_update_reads")
              .upsert([{ user_id: userId, update_id: id }], {
                onConflict: "user_id,update_id",
                ignoreDuplicates: true,
              });
          } catch (e) {
            console.warn("Erro ao registrar leitura:", e);
          }
        }
      } else {
        updated = current.filter((readId) => readId !== id);
        setLocalReads(userId, updated);

        if (userId) {
          try {
            await supabase
              .from("product_update_reads")
              .delete()
              .eq("user_id", userId)
              .eq("update_id", id);
          } catch (e) {
            console.warn("Erro ao remover leitura:", e);
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product_update_reads"] });
    },
  });
}

/** Marca todas as novidades disponíveis como lidas. */
export function useMarkAllUpdatesRead() {
  const markRead = useMarkUpdatesRead();
  const { data: updates = [] } = useProductUpdates();

  return {
    markAll: () => {
      const publishedIds = updates.filter((u) => u.is_published).map((u) => u.id);
      if (publishedIds.length > 0) {
        markRead.mutate(publishedIds);
      }
    },
    isPending: markRead.isPending,
  };
}

export type ProductUpdateInput = Omit<ProductUpdate, "id"> & { id?: string };

export function useProductUpdateMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["product_updates"] });

  const save = useMutation({
    mutationFn: async (input: ProductUpdateInput) => {
      const payload = {
        title: input.title.trim(),
        description: input.description.trim(),
        category: input.category,
        icon: input.icon?.trim() || null,
        related_route: safeRoute(input.related_route),
        published_at: input.published_at,
        is_published: input.is_published,
      };
      if (input.id) {
        const { error } = await supabase.from("product_updates").update(payload).eq("id", input.id);
        if (error) throw error;
        return input.id;
      }
      const { data, error } = await supabase
        .from("product_updates")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_updates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { save, remove };
}
