import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/**
 * Financeiro (v1)
 * ---------------
 * Modelo simples e proposital: cada movimentação é uma RECEITA ou DESPESA
 * ligada a UMA cobertura (partida OU evento). O saldo é sempre
 * receitas − despesas. Nenhuma integração com Kiwify/billing da plataforma e
 * nenhuma conversão automática de pacotes do CRM de atletas.
 */
export type EntryType = "income" | "expense";

export type FinancialEntry = {
  id: string;
  type: EntryType;
  amount: number;
  category: string | null;
  description: string | null;
  occurred_at: string;
  match_id: string | null;
  event_id: string | null;
  notes: string | null;
  created_at: string;
  /** Resumo da cobertura no momento do lançamento (sobrevive à exclusão). */
  coverage_label: string | null;
  coverage_date: string | null;
  coverage_type: string | null;
};

export type FinancialEntryInput = {
  type: EntryType;
  amount: number;
  category: string | null;
  description: string | null;
  occurred_at: string;
  match_id: string | null;
  event_id: string | null;
  notes: string | null;
  coverage_label?: string | null;
  coverage_date?: string | null;
  coverage_type?: string | null;
};

export const ENTRY_TYPE_LABEL: Record<EntryType, string> = {
  income: "Receita",
  expense: "Despesa",
};

/** Sugestões — o campo é texto livre, o usuário pode digitar a própria. */
export const EXPENSE_CATEGORIES = [
  "Combustível",
  "Pedágio",
  "Estacionamento",
  "Alimentação",
  "Hospedagem",
  "Transporte",
  "Credenciamento",
  "Equipamento",
  "Outros",
] as const;

export const INCOME_CATEGORIES = [
  "Pacote de fotos",
  "Venda de fotos",
  "Cobertura",
  "Serviço",
  "Licenciamento",
  "Outros",
] as const;

/** Remove acentos e normaliza caixa para comparar categorias sem duplicar visualmente. */
export function normalizeCategory(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

/** Categorias já usadas pelo usuário que não estão na lista padrão do tipo. */
export function customCategories(entries: FinancialEntry[], type: EntryType): string[] {
  const standard = new Set(
    (type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(normalizeCategory),
  );
  const seen = new Set<string>();
  const result: string[] = [];
  for (const entry of entries) {
    if (entry.type !== type || !entry.category) continue;
    const value = entry.category.trim();
    if (!value) continue;
    const key = normalizeCategory(value);
    if (standard.has(key) || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

const SELECT =
  "id, type, amount, category, description, occurred_at, match_id, event_id, notes, created_at, coverage_label, coverage_date, coverage_type";

export function formatMoney(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Chave única de cobertura usada em filtros e na URL (`match:<id>`). */
export function coverageKey(entry: Pick<FinancialEntry, "match_id" | "event_id" | "id">) {
  if (entry.match_id) return `match:${entry.match_id}`;
  if (entry.event_id) return `event:${entry.event_id}`;
  // Cobertura excluída: o lançamento continua existindo, agrupado por si.
  return `orphan:${entry.id}`;
}

export function parseCoverageKey(key: string): {
  match_id: string | null;
  event_id: string | null;
} {
  const [kind, id] = key.split(":");
  return kind === "match" ? { match_id: id!, event_id: null } : { match_id: null, event_id: id! };
}

export function useFinancialEntries() {
  return useQuery({
    queryKey: ["financial_entries"],
    queryFn: async (): Promise<FinancialEntry[]> => {
      const { data, error } = await supabase
        .from("financial_entries")
        .select(SELECT)
        .order("occurred_at", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        ...row,
        amount: Number(row.amount),
      })) as FinancialEntry[];
    },
  });
}

export function useFinanceMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["financial_entries"] });

  const create = useMutation({
    mutationFn: async (input: FinancialEntryInput) => {
      const { error } = await supabase.from("financial_entries").insert(input);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...input }: FinancialEntryInput & { id: string }) => {
      const { error } = await supabase.from("financial_entries").update(input).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("financial_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return { create, update, remove };
}

export type CoverageTotals = {
  key: string;
  income: number;
  expense: number;
  balance: number;
  entries: FinancialEntry[];
};

/** Agrupa lançamentos por cobertura preservando a ordem de entrada. */
export function groupByCoverage(entries: FinancialEntry[]): CoverageTotals[] {
  const map = new Map<string, CoverageTotals>();
  for (const entry of entries) {
    const key = coverageKey(entry);
    const current = map.get(key) ?? {
      key,
      income: 0,
      expense: 0,
      balance: 0,
      entries: [] as FinancialEntry[],
    };
    if (entry.type === "income") current.income += entry.amount;
    else current.expense += entry.amount;
    current.balance = current.income - current.expense;
    current.entries.push(entry);
    map.set(key, current);
  }
  return [...map.values()];
}
