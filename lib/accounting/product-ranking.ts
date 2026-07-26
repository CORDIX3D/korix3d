export type ProductRankingItem = {
  product_id?: string | null;
  sku?: string | null;
  name?: string | null;
  quantity?: number | string | null;
  total?: number | string | null;
};

export type ProductSalesReport = {
  top: Array<{ name: string; sold: number; revenue: number }>;
  byCategory: Record<string, number>;
};

function finiteNonNegative(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function itemKey(item: ProductRankingItem) {
  const productId = item.product_id?.trim();
  if (productId) return `id:${productId}`;

  const sku = item.sku?.trim().toLocaleLowerCase('pl');
  if (sku) return `sku:${sku}`;

  const name = item.name?.trim().toLocaleLowerCase('pl');
  return name ? `name:${name}` : null;
}

export function buildProductSalesReport(
  items: ProductRankingItem[],
  categoryByProductId: Readonly<Record<string, string>> = {},
  limit = 10
): ProductSalesReport {
  const sales = new Map<
    string,
    { name: string; sold: number; revenue: number }
  >();
  const byCategory: Record<string, number> = {};

  for (const item of items) {
    const key = itemKey(item);
    const quantity = finiteNonNegative(item.quantity);
    if (!key || quantity <= 0) continue;

    const name = item.name?.trim() || item.sku?.trim() || 'Produkt bez nazwy';
    const current = sales.get(key) || { name, sold: 0, revenue: 0 };
    current.sold += quantity;
    current.revenue += finiteNonNegative(item.total);
    sales.set(key, current);

    const productId = item.product_id?.trim();
    const category =
      (productId ? categoryByProductId[productId]?.trim() : '') ||
      'Bez kategorii';
    byCategory[category] = (byCategory[category] || 0) + quantity;
  }

  return {
    top: [...sales.values()]
      .sort(
        (left, right) =>
          right.revenue - left.revenue ||
          right.sold - left.sold ||
          left.name.localeCompare(right.name, 'pl')
      )
      .slice(0, Math.max(0, limit)),
    byCategory: Object.fromEntries(
      Object.entries(byCategory).sort(
        ([leftName, leftSold], [rightName, rightSold]) =>
          rightSold - leftSold || leftName.localeCompare(rightName, 'pl')
      )
    ),
  };
}
