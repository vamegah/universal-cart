import { useCartStore } from '@/stores/cartStore';
import {
  clearServerCart,
  addServerCartItem,
  getServerCart,
  getStoredAuthToken,
  importProductFromUrl,
  removeServerCartItem,
  updateServerCartItemQuantity,
} from '@/services/api';
import { useCallback, useEffect, useState } from 'react';

function calculateSellerTrustScore(listing: any) {
  if (!listing) return undefined;
  let score = 50;
  if (listing.isAuthorizedSeller) score += 20;
  if (listing.warrantySupport) score += 10;
  if ((listing.returnWindowDays || 0) >= 30) score += 10;
  if (typeof listing.customerRating === 'number') {
    score += Math.max(-10, Math.min(10, (listing.customerRating - 3.5) * 6));
  }
  if (listing.counterfeitRisk === 'low') score += 10;
  if (listing.counterfeitRisk === 'medium') score -= 10;
  if (listing.counterfeitRisk === 'high') score -= 30;
  return Math.max(0, Math.min(100, Math.round(score)));
}

function sellerTrustSignals(listing: any) {
  if (!listing) return undefined;
  return [
    listing.isAuthorizedSeller ? 'authorized seller' : '',
    listing.warrantySupport ? 'warranty support' : '',
    listing.returnWindowDays ? `${listing.returnWindowDays}-day returns` : '',
    typeof listing.customerRating === 'number' ? `${listing.customerRating.toFixed(1)} rating` : '',
    listing.counterfeitRisk && listing.counterfeitRisk !== 'unknown' ? `${listing.counterfeitRisk} counterfeit risk` : '',
  ].filter(Boolean);
}

function mapServerCartItem(item: any) {
  const sourceListing = item.sourceListing || item.product?.retailerProducts?.find((listing: any) => listing.retailerName === item.sourceRetailer);
  const selectedMatch = item.matchResults?.find((match: any) => match.isSelected);
  const matchedListing = selectedMatch?.retailerProduct;
  const trustScore = matchedListing?.sellerTrustScore ?? calculateSellerTrustScore(matchedListing);

  return {
    id: item.id,
    productId: item.productId,
    duplicateGroupKey: item.duplicateGroupKey,
    retailerSku: sourceListing?.retailerSku,
    sourceUrl: sourceListing?.url,
    sourceRetailer: item.sourceRetailer,
    productName: item.product?.name || 'Unknown product',
    price: sourceListing?.price || 0,
    imageUrl: item.product?.imageUrl,
    quantity: item.quantity,
    matchedStore: selectedMatch?.retailerProduct?.retailerName,
    matchedProductId: selectedMatch?.retailerProductId,
    matchType: selectedMatch?.matchType,
    confidence: selectedMatch?.confidenceScore,
    matchedPrice: matchedListing?.price,
    matchedUrl: matchedListing?.url,
    sellerTrustScore: trustScore,
    sellerTrustLabel: matchedListing?.sellerTrustLabel ?? (trustScore == null ? undefined : trustScore >= 80 ? 'strong' : trustScore >= 60 ? 'acceptable' : 'review'),
    sellerTrustSignals: matchedListing?.sellerTrustSignals ?? sellerTrustSignals(matchedListing),
    pricingComparison: undefined,
    brand: item.product?.brand,
    model: item.product?.model,
    upc: item.product?.upc,
    category: item.product?.category,
    attributes: item.product?.attributes,
  };
}

export function useCart() {
  const { items, addItem, setItems, removeItem, updateQuantity, clearCart } = useCartStore();
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [isHydrating, setIsHydrating] = useState(false);

  const hydrateCart = useCallback(async () => {
    if (!getStoredAuthToken()) return;

    setIsHydrating(true);
    try {
      const cart = await getServerCart();
      setItems((cart.items || []).map(mapServerCartItem));
    } finally {
      setIsHydrating(false);
    }
  }, [setItems]);

  useEffect(() => {
    hydrateCart().catch((error) => console.error('Failed to hydrate cart', error));
  }, [hydrateCart]);

  const importProduct = async (url: string) => {
    setIsImporting(true);
    setImportError(null);
    try {
      const product = await importProductFromUrl(url);
      addItem({
        id: product.cartItemId,
        productId: product.id,
        retailerSku: product.retailerSku,
        sourceUrl: product.url,
        sourceRetailer: product.sourceRetailer,
        productName: product.productName,
        price: product.price,
        imageUrl: product.imageUrl,
        quantity: product.quantity ?? 1,
      });
    } catch (err) {
      const status = (err as any).response?.status;
      setImportError(status === 401 ? 'Authentication required' : 'Failed to import product. Check the URL.');
      console.error(err);
    } finally {
      setIsImporting(false);
    }
  };

  const importSearchResult = async (result: any) => {
    setIsImporting(true);
    setImportError(null);
    try {
      const cartItem = await addServerCartItem(result.productId, result.sourceRetailer, 1);
      addItem({
        id: cartItem.id,
        productId: result.productId,
        retailerSku: result.retailerSku,
        sourceUrl: result.url,
        sourceRetailer: result.sourceRetailer,
        productName: result.productName,
        price: result.price,
        imageUrl: result.imageUrl,
        quantity: cartItem.quantity ?? 1,
        brand: result.brand,
        model: result.model,
        upc: result.upc,
        category: result.category,
        attributes: result.attributes,
      });
    } catch (err) {
      const status = (err as any).response?.status;
      setImportError(status === 401 ? 'Authentication required' : 'Failed to add selected product.');
      console.error(err);
    } finally {
      setIsImporting(false);
    }
  };

  const removeCartItem = async (id: string) => {
    if (getStoredAuthToken()) {
      await removeServerCartItem(id);
    }
    removeItem(id);
  };

  const updateCartQuantity = async (id: string, quantity: number) => {
    const safeQuantity = Math.max(1, quantity);
    if (getStoredAuthToken()) {
      await updateServerCartItemQuantity(id, safeQuantity);
    }
    updateQuantity(id, safeQuantity);
  };

  const clearCartItems = async () => {
    if (getStoredAuthToken()) {
      await clearServerCart();
    }
    clearCart();
  };

  return {
    items,
    importProduct,
    importSearchResult,
    hydrateCart,
    removeItem: removeCartItem,
    updateQuantity: updateCartQuantity,
    clearCart: clearCartItems,
    isImporting,
    isHydrating,
    importError,
  };
}
