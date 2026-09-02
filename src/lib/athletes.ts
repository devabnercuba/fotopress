import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

import { uploadAsset } from "./storage";

/**
 * Atletas / Contatos
 * ------------------
 * Cadastro simples de pessoas acompanhadas nas coberturas. O vínculo com o
 * clube usa o id da tabela `teams` — nunca o nome digitado.
 * Os dados de contato (telefone, WhatsApp, e-mail) são privados do usuário.
 */
export type Relationship = "client" | "prospect" | "contact" | "former_client" | "unclassified";

export const RELATIONSHIPS: { value: Relationship; label: string }[] = [
  { value: "client", label: "Cliente" },
  { value: "prospect", label: "Prospect" },
  { value: "contact", label: "Contato" },
  { value: "former_client", label: "Ex-cliente" },
  { value: "unclassified", label: "Sem classificação" },
];

export const RELATIONSHIP_LABEL: Record<string, string> = Object.fromEntries(
  RELATIONSHIPS.map((r) => [r.value, r.label]),
);

export const ATHLETE_STATUS: { value: string; label: string }[] = [
  { value: "active", label: "Ativo" },
  { value: "inactive", label: "Inativo" },
];

export const ATHLETE_STATUS_LABEL: Record<string, string> = Object.fromEntries(
  ATHLETE_STATUS.map((s) => [s.value, s.label]),
);

/**
 * Categorias (base/principal) — campo livre, nunca enum fechado.
 * Sugestões iniciais servem apenas de atalho; o usuário pode criar as suas.
 */
export const CATEGORY_SUGGESTIONS = [
  "Principal",
  "Adulto",
  "Sub-23",
  "Sub-20",
  "Sub-18",
  "Sub-17",
  "Sub-16",
  "Sub-15",
  "Sub-14",
  "Sub-13",
  "Sub-12",
  "Sub-11",
  "Sub-10",
  "Sub-9",
  "Sub-8",
  "Sub-7",
] as const;

/** Chave de comparação: "SUB 17", "sub-17" e "Sub 17" viram "sub-17". */
export function normalizeCategory(value: string | null | undefined) {
  if (!value) return null;
  const key = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[\s._/-]+/g, " ")
    .trim()
    .replace(/\bsub\s*(\d+)\b/g, "sub-$1")
    .replace(/\s+/g, " ");
  return key || null;
}

/** Rótulo apresentável a partir de um texto livre ("sub 17" → "Sub-17"). */
export function formatCategoryLabel(value: string | null | undefined) {
  if (!value) return null;
  const clean = value.trim().replace(/\s+/g, " ");
  if (!clean) return null;
  const sub = clean.match(/^sub\s*[-_.]?\s*(\d+)$/i);
  if (sub) return `Sub-${sub[1]}`;
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

export function sameCategory(a: string | null | undefined, b: string | null | undefined) {
  const na = normalizeCategory(a);
  const nb = normalizeCategory(b);
  return !!na && !!nb && na === nb;
}

export type Athlete = {
  id: string;
  name: string;
  full_name: string | null;
  nickname: string | null;
  team_id: string | null;
  position: string | null;
  number: number | null;
  photo_url: string | null;
  instagram: string | null;
  notes: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  relationship: string;
  status: string;
  category: string | null;
  sport: string | null;
  team: { id: string; name: string; logo_local: string | null; logo_url: string | null } | null;
};

export type AthleteInput = {
  name: string;
  nickname?: string | null;
  team_id: string | null;
  position: string | null;
  number: number | null;
  instagram: string | null;
  notes: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  relationship: string;
  status: string;
  category?: string | null;
  sport?: string | null;
};

const SELECT =
  "id, name, full_name, nickname, team_id, position, number, photo_url, instagram, notes, phone, whatsapp, email, relationship, status, category, sport, team:teams(id, name, logo_local, logo_url)";

export const POSITIONS = [
  "Goleiro",
  "Lateral",
  "Zagueiro",
  "Volante",
  "Meia",
  "Atacante",
  "Técnico",
  "Dirigente",
  "Imprensa",
] as const;

/**
 * Normaliza telefone para o formato internacional (só dígitos).
 * Números brasileiros com 10/11 dígitos recebem o DDI 55.
 */
export function toInternationalPhone(raw: string | null | undefined) {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (raw.trim().startsWith("+")) return digits;
  if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
  return digits.length >= 10 ? digits : null;
}

export function whatsappLink(raw: string | null | undefined) {
  const phone = toInternationalPhone(raw);
  return phone ? `https://wa.me/${phone}` : null;
}

export function useAthletes() {
  return useQuery({
    queryKey: ["athletes"],
    queryFn: async (): Promise<Athlete[]> => {
      const { data, error } = await supabase
        .from("athletes")
        .select(SELECT)
        .is("deleted_at", null)
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as Athlete[];
    },
  });
}

export function useAthleteMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["athletes"] });

  const save = useMutation({
    mutationFn: async ({
      id,
      photo,
      ...input
    }: AthleteInput & { id?: string; photo?: File | null }) => {
      const payload = {
        ...input,
        ...(photo ? { photo_url: await uploadAsset(photo, "athletes") } : {}),
      };
      const { error } = id
        ? await supabase.from("athletes").update(payload).eq("id", id)
        : await supabase.from("athletes").insert(payload);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /**
   * Arquivamento (exclusão suave): o atleta sai das listas, mas o histórico
   * comercial ligado a ele — engajamentos, pacotes e financeiro — permanece.
   */
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { data: auth } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("athletes")
        .update({ deleted_at: new Date().toISOString(), deleted_by: auth.user?.id ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { save, remove };
}
