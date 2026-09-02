import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

export type TutorialVideo = {
  id: string;
  title: string;
  description: string | null;
  youtube_url: string;
  youtube_video_id: string;
  category: string;
  related_route: string | null;
  sort_order: number;
  is_featured: boolean;
  is_published: boolean;
};

export const TUTORIAL_CATEGORIES = [
  "Comece por aqui",
  "Jogos e Eventos",
  "Credenciamento e Agenda",
  "Atletas/Clientes",
  "Radar e Fontes",
  "Configurações",
  "Outros",
];

/** Extrai o ID do vídeo aceitando apenas domínios legítimos do YouTube. */
export function extractYoutubeId(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  let url: URL;
  try {
    url = new URL(value.startsWith("http") ? value : `https://${value}`);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const valid = (id: string | undefined | null) =>
    id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;

  if (host === "youtu.be") return valid(url.pathname.split("/")[1]);

  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "watch") return valid(url.searchParams.get("v"));
    if (["shorts", "embed", "live", "v"].includes(parts[0] ?? "")) return valid(parts[1]);
    return valid(url.searchParams.get("v"));
  }

  return null;
}

export function youtubeEmbedUrl(videoId: string) {
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=1`;
}

export function youtubeThumbnails(videoId: string) {
  return [
    `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
  ];
}

const SELECT =
  "id, title, description, youtube_url, youtube_video_id, category, related_route, sort_order, is_featured, is_published";

/** Lista os tutoriais; RLS já esconde os não publicados de usuários comuns. */
export function useTutorialVideos() {
  return useQuery({
    queryKey: ["tutorial-videos"],
    queryFn: async (): Promise<TutorialVideo[]> => {
      const { data, error } = await supabase
        .from("tutorial_videos")
        .select(SELECT)
        .order("category")
        .order("sort_order")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as TutorialVideo[];
    },
  });
}

/** Verifica no banco se o usuário logado é administrador. */
export function useIsTutorialAdmin() {
  return useQuery({
    queryKey: ["is-admin"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return false;
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: auth.user.id,
        _role: "admin",
      });
      if (error) return false;
      return data === true;
    },
  });
}

export type TutorialInput = {
  title: string;
  description: string | null;
  youtube_url: string;
  youtube_video_id: string;
  category: string;
  related_route: string | null;
  sort_order: number;
  is_featured: boolean;
  is_published: boolean;
};

export function useTutorialMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["tutorial-videos"] });

  const create = useMutation({
    mutationFn: async (input: TutorialInput) => {
      const { error } = await supabase.from("tutorial_videos").insert(input);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<TutorialInput> & { id: string }) => {
      const { error } = await supabase.from("tutorial_videos").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tutorial_videos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
