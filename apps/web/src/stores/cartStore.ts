import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CartItem {
  id: string;
  productId?: string;
  duplicateGroupKey?: string;
  retailerSku?: string;
  sourceUrl?: string;
  sourceRetailer: string;
  productName: string;
  price: number;
  imageUrl?: string;
  quantity: number;
  matchedStore?: string;
  matchedProductId?: string;
  matchType?: 'exact' | 'similar' | 'substitute' | 'none';
  confidence?: number;
  matchedPrice?: number;
  matchedUrl?: string;
  sellerTrustScore?: number;
  sellerTrustLabel?: string;
  sellerTrustSignals?: string[];
  brand?: string;
  model?: string;
  upc?: string;
  category?: string;
  attributes?: Record<string, any>;
  pricingComparison?: {
    source?: {
      retailerName: string;
      totalBeforeRewards: number;
      effectiveTotal: number;
      rewardsValue: number;
      loyalty?: {
        pointsEarned: number;
        pointsValue: number;
        thresholdValue: number;
        totalValue: number;
        details: string[];
      };
      coupons?: {
        estimatedSavings: number;
        appliedSavings: number;
        confirmed: boolean;
        note: string;
      };
    } | null;
    destination: {
      retailerName: string;
      totalBeforeRewards: number;
      effectiveTotal: number;
      rewardsValue: number;
      loyalty?: {
        pointsEarned: number;
        pointsValue: number;
        thresholdValue: number;
        totalValue: number;
        details: string[];
      };
      coupons?: {
        estimatedSavings: number;
        appliedSavings: number;
        confirmed: boolean;
        note: string;
      };
    };
    recommendation: {
      cheaperDestination: boolean | null;
      effectiveSavings: number | null;
      explanation: string;
    };
  };
}

interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  setItems: (items: CartItem[]) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  setMatch: (
    itemId: string,
    store: string,
    productId: string,
    matchType?: 'exact' | 'similar' | 'substitute' | 'none',
    confidence?: number,
    matchedPrice?: number,
    matchedUrl?: string,
    sellerTrustScore?: number,
    sellerTrustLabel?: string,
    sellerTrustSignals?: string[]
  ) => void;
  setPricingComparison: (itemId: string, pricingComparison: CartItem['pricingComparison']) => void;
  clearCart: () => void;
}

export function upsertCartItem(items: CartItem[], item: CartItem) {
  const existingIndex = items.findIndex((current) => current.id === item.id);
  if (existingIndex >= 0) {
    return items.map((current, index) => (
      index === existingIndex
        ? { ...current, ...item, quantity: item.quantity ?? current.quantity + 1 }
        : current
    ));
  }

  const sameSourceIndex = items.findIndex((current) =>
    item.productId &&
    current.productId === item.productId &&
    current.sourceRetailer === item.sourceRetailer
  );
  if (sameSourceIndex >= 0) {
    return items.map((current, index) => (
      index === sameSourceIndex
        ? { ...current, ...item, id: item.id || current.id, quantity: item.quantity ?? current.quantity + 1 }
        : current
    ));
  }

  return [...items, item];
}

export const useCartStore = create<CartStore>()(
  persist(
    (set) => ({
      items: [],
      addItem: (item) =>
        set((state) => ({
          items: upsertCartItem(state.items, item),
        })),
      setItems: (items) => set({ items }),
      removeItem: (id) =>
        set((state) => ({
          items: state.items.filter((i) => i.id !== id),
        })),
      updateQuantity: (id, quantity) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.id === id ? { ...i, quantity: Math.max(1, quantity) } : i
          ),
        })),
      setMatch: (itemId, store, productId, matchType, confidence, matchedPrice, matchedUrl, sellerTrustScore, sellerTrustLabel, sellerTrustSignals) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.id === itemId
              ? {
                  ...i,
                  matchedStore: store,
                  matchedProductId: productId,
                  matchType,
                  confidence,
                  matchedPrice,
                  matchedUrl,
                  sellerTrustScore,
                  sellerTrustLabel,
                  sellerTrustSignals,
                }
              : i
          ),
        })),
      setPricingComparison: (itemId, pricingComparison) =>
        set((state) => ({
          items: state.items.map((i) => (i.id === itemId ? { ...i, pricingComparison } : i)),
        })),
      clearCart: () => set({ items: [] }),
    }),
    {
      name: 'universal-cart-storage',
    }
  )
);
