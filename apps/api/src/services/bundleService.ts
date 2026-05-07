type BundleCartItem = {
  id?: string;
  itemId?: string;
  productId: string;
  quantity?: number;
  product?: {
    name?: string | null;
    category?: string | null;
  } | null;
};

type BundleRetailerProduct = {
  productId: string;
  retailerName: string;
  price: number;
  url?: string | null;
  inStock?: boolean | null;
  bundleId?: string | null;
  bundlePrice?: number | null;
};

export function detectBundles(cartItems: BundleCartItem[], retailerProducts: BundleRetailerProduct[]) {
  const productsById = new Map(cartItems.map((item) => [item.productId, item]));
  const listingsByProduct = new Map<string, BundleRetailerProduct[]>();

  for (const listing of retailerProducts) {
    if (listing.inStock === false || !productsById.has(listing.productId)) continue;
    const current = listingsByProduct.get(listing.productId) || [];
    current.push(listing);
    listingsByProduct.set(listing.productId, current);
  }

  const groups = new Map<string, BundleCartItem[]>();
  for (const item of cartItems) {
    const category = item.product?.category;
    if (!category) continue;
    groups.set(category, [...(groups.get(category) || []), item]);
  }

  const bundles = [];
  for (const [category, items] of groups) {
    if (items.length < 2) continue;

    const retailers = new Set(retailerProducts.map((listing) => listing.retailerName));
    for (const retailerName of retailers) {
      const retailerListings = items.map((item) =>
        (listingsByProduct.get(item.productId) || []).find((listing) => listing.retailerName === retailerName)
      );

      if (retailerListings.some((listing) => !listing)) continue;

      const sharedBundleId = retailerListings[0]?.bundleId;
      const bundlePrice = sharedBundleId && retailerListings.every((listing) => listing?.bundleId === sharedBundleId)
        ? Number(retailerListings[0]?.bundlePrice)
        : NaN;
      const combinedPrice = Number.isFinite(bundlePrice) && bundlePrice > 0
        ? bundlePrice
        : retailerListings.reduce((sum, listing, index) => {
        const quantity = Number(items[index].quantity || 1);
        return sum + Number(listing?.price || 0) * quantity;
      }, 0);
      const individualBestPrice = items.reduce((sum, item) => {
        const quantity = Number(item.quantity || 1);
        const best = Math.min(...(listingsByProduct.get(item.productId) || []).map((listing) => listing.price));
        return sum + (Number.isFinite(best) ? best : 0) * quantity;
      }, 0);

      if (combinedPrice < individualBestPrice) {
        bundles.push({
          category,
          retailerName,
          itemIds: items.map((item) => item.id || item.itemId || item.productId),
          productIds: items.map((item) => item.productId),
          combinedPrice,
          individualBestPrice,
          savings: individualBestPrice - combinedPrice,
          urls: retailerListings.map((listing) => listing?.url || '').filter(Boolean),
        });
      }
    }
  }

  return bundles.sort((a, b) => b.savings - a.savings);
}
