import { normalizeGtin } from './productNormalizationService';

function normalizeText(value?: string | null) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function compactObject(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function variantKey(product: any) {
  const attributes = compactObject(product?.attributes);
  if (typeof attributes.variantKey === 'string' && attributes.variantKey.trim()) {
    return normalizeText(attributes.variantKey);
  }

  const parts = [attributes.color, attributes.size]
    .filter((value) => typeof value === 'string' && value.trim())
    .map((value) => normalizeText(value));

  return parts.length > 0 ? parts.join(' ') : '';
}

function withVariant(baseKey: string, product: any) {
  const variant = variantKey(product);
  return variant ? `${baseKey}:variant:${variant}` : baseKey;
}

export function getCartDuplicateGroupKey(item: any) {
  const product = item.product || {};
  const normalizedUpc = normalizeGtin(product.upc || item.upc);
  if (normalizedUpc) return `upc:${normalizedUpc}`;

  const productId = product.id || item.productId;
  if (productId) return withVariant(`product:${productId}`, product);

  const brandModel = normalizeText(`${product.brand || item.brand || ''} ${product.model || item.model || ''}`);
  if (brandModel) return withVariant(`brand-model:${brandModel}`, product);

  const title = normalizeText(product.name || item.productName || item.name);
  return withVariant(`title:${title || 'unknown'}`, product);
}

function findSourceListing(item: any) {
  return item.product?.retailerProducts?.find((listing: any) => listing.retailerName === item.sourceRetailer);
}

export function buildCartGroups(items: any[]) {
  const groups = new Map<string, any[]>();
  for (const item of items) {
    const key = item.duplicateGroupKey || getCartDuplicateGroupKey(item);
    groups.set(key, [...(groups.get(key) || []), item]);
  }

  return Array.from(groups.entries())
    .map(([key, groupItems]) => {
      const first = groupItems[0];
      const product = first.product || {};
      const attributes = compactObject(product.attributes);

      return {
        key,
        title: product.name || first.productName || 'Unknown product',
        productId: product.id || first.productId,
        brand: product.brand || undefined,
        model: product.model || undefined,
        upc: product.upc || undefined,
        category: product.category || undefined,
        variantKey: attributes.variantKey || undefined,
        imageUrl: product.imageUrl || first.imageUrl,
        itemIds: groupItems.map((item) => item.id),
        totalQuantity: groupItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
        sourceRetailers: Array.from(new Set(groupItems.map((item) => item.sourceRetailer).filter(Boolean))).sort(),
        sourceListings: groupItems.map((item) => {
          const listing = findSourceListing(item);
          return {
            cartItemId: item.id,
            sourceRetailer: item.sourceRetailer,
            retailerSku: listing?.retailerSku || item.retailerSku,
            url: listing?.url || item.sourceUrl,
            price: listing?.price ?? item.price,
            quantity: item.quantity,
          };
        }),
        selectedMatchCount: groupItems.filter((item) => item.selectedRetailerProductId || item.matchResults?.some((match: any) => match.isSelected)).length,
      };
    })
    .sort((a, b) => a.title.localeCompare(b.title));
}
