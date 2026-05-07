import type { CartItem } from '../stores/cartStore';

export type CartGroup = {
  key: string;
  title: string;
  brand?: string;
  model?: string;
  upc?: string;
  imageUrl?: string;
  items: CartItem[];
  totalQuantity: number;
  sourceRetailers: string[];
  matchedCount: number;
  bestEffectiveSavings: number | null;
};

function normalizeText(value?: string) {
  return (value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function getCartGroupKey(item: CartItem) {
  if (item.duplicateGroupKey) return item.duplicateGroupKey;
  if (item.upc) return `upc:${item.upc}`;
  if (item.productId) return `product:${item.productId}`;

  const brandModel = normalizeText(`${item.brand || ''} ${item.model || ''}`);
  if (brandModel) return `brand-model:${brandModel}`;

  return `title:${normalizeText(item.productName)}`;
}

export function groupCartItems(items: CartItem[]): CartGroup[] {
  const groups = new Map<string, CartItem[]>();

  for (const item of items) {
    const key = getCartGroupKey(item);
    groups.set(key, [...(groups.get(key) || []), item]);
  }

  return Array.from(groups.entries())
    .map(([key, groupItems]) => {
      const first = groupItems[0];
      const savingsValues = groupItems
        .map((item) => item.pricingComparison?.recommendation.effectiveSavings)
        .filter((value): value is number => typeof value === 'number');

      return {
        key,
        title: first.productName,
        brand: first.brand,
        model: first.model,
        upc: first.upc,
        imageUrl: first.imageUrl,
        items: groupItems,
        totalQuantity: groupItems.reduce((sum, item) => sum + item.quantity, 0),
        sourceRetailers: Array.from(new Set(groupItems.map((item) => item.sourceRetailer))).sort(),
        matchedCount: groupItems.filter((item) => item.matchedProductId).length,
        bestEffectiveSavings: savingsValues.length > 0 ? Math.max(...savingsValues) : null,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}
