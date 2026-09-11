/**
 * Utilitários para controle de concorrência e lotes em operações assíncronas.
 * Permite paralelismo controlado sem sobrecarregar APIs externas ou limites do Supabase.
 */

/**
 * Mapeia uma lista de itens executando a função assíncrona com limite de concorrência.
 * Mantém a ordem dos resultados de acordo com a lista original.
 */
export async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const safeLimit = Math.max(1, Math.min(limit, items.length));
  const results: R[] = new Array(items.length);
  let currentIndex = 0;

  const workers = Array.from({ length: safeLimit }, async () => {
    while (currentIndex < items.length) {
      const idx = currentIndex++;
      results[idx] = await fn(items[idx], idx);
    }
  });

  await Promise.all(workers);
  return results;
}

/**
 * Divide uma lista em lotes (chunks) de tamanho máximo definido.
 */
export function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0 || items.length === 0) return items.length === 0 ? [] : [items];
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}
