import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  normalizeCategory,
  type EntryType,
  type FinancialEntry,
} from "@/lib/finance";

/**
 * Categorias financeiras
 * ----------------------
 * Catálogo editável por usuário. As movimentações continuam guardando o nome
 * da categoria como texto (`financial_entries.category`), então renomear ou
 * desativar uma categoria nunca altera o histórico já lançado.
 */
export type FinancialCategory = {
  id: string;
  type: EntryType;
  name: string;
  icon_key: string | null;
  is_active: boolean;
  sort_order: number;
};

const SELECT = "id, type, name, icon_key, is_active, sort_order";

export function useFinancialCategories() {
  return useQuery({
    queryKey: ["financial_categories"],
    queryFn: async (): Promise<FinancialCategory[]> => {
      const { data, error } = await supabase
        .from("financial_categories")
        .select(SELECT)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FinancialCategory[];
    },
  });
}

export type CategoryInput = {
  type: EntryType;
  name: string;
  icon_key?: string | null;
};

export function useCategoryMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["financial_categories"] });
  };

  const create = useMutation({
    mutationFn: async (input: CategoryInput) => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) throw new Error("Sessão expirada.");
      const { error } = await supabase.from("financial_categories").insert({
        user_id: uid,
        type: input.type,
        name: input.name.trim(),
        icon_key: input.icon_key ?? null,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  /** Renomear/ativar/desativar: o histórico de lançamentos permanece intacto. */
  const update = useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: { id: string } & Partial<
      Pick<FinancialCategory, "name" | "icon_key" | "is_active" | "sort_order">
    >) => {
      const { error } = await supabase
        .from("financial_categories")
        .update({ ...patch, ...(patch.name ? { name: patch.name.trim() } : {}) })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financial_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

/** Sugestões padrão do FotoPress para o tipo informado. */
export function defaultCategoriesFor(type: EntryType): readonly string[] {
  return type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
}

/**
 * Lista final exibida no seletor: categorias ativas do usuário primeiro, depois
 * as sugestões padrão que ainda não foram cadastradas nem desativadas, e por
 * fim categorias que só existem no histórico (para não sumirem da busca).
 */
export function pickerCategories(
  type: EntryType,
  categories: FinancialCategory[],
  entries: FinancialEntry[],
): { own: string[]; suggested: string[]; historical: string[] } {
  const ofType = categories.filter((c) => c.type === type);
  const own = ofType.filter((c) => c.is_active).map((c) => c.name);
  const known = new Set(ofType.map((c) => normalizeCategory(c.name)));

  const suggested = defaultCategoriesFor(type).filter((c) => !known.has(normalizeCategory(c)));

  const suggestedKeys = new Set(suggested.map(normalizeCategory));
  const seen = new Set<string>();
  const historical: string[] = [];
  for (const entry of entries) {
    if (entry.type !== type || !entry.category) continue;
    const value = entry.category.trim();
    const key = normalizeCategory(value);
    if (!key || known.has(key) || suggestedKeys.has(key) || seen.has(key)) continue;
    seen.add(key);
    historical.push(value);
  }

  return { own, suggested: [...suggested], historical };
}

/** Quantas movimentações já usam esta categoria (avisa antes de excluir). */
export function usageCount(entries: FinancialEntry[], type: EntryType, name: string) {
  const key = normalizeCategory(name);
  return entries.filter((e) => e.type === type && normalizeCategory(e.category ?? "") === key)
    .length;
}
