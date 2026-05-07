// User related
export interface User {
  id: string;
  email: string;
  createdAt: Date;
  preferences?: UserPreferences;
}

export interface UserPreferences {
  defaultStore?: string;
  defaultCardId?: string;
  shippingAddress?: ShippingAddress;
}

export interface ShippingAddress {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface UserCard {
  id: string;
  retailerName: string;
  cardLast4: string;
  rewardsRate: number;
  financingTerms?: FinancingTerms;
}

export interface FinancingTerms {
  minAmount: number;
  months: number;
  apr: number;
}

// Product related
export interface Product {
  id: string;
  name: string;
  brand?: string;
  model?: string;
  upc?: string;
  category?: string;
  imageUrl?: string;
  attributes?: Record<string, any>;
}

export interface RetailerProduct {
  id: string;
  productId: string;
  retailerName: string;
  retailerSku: string;
  price: number;
  shippingCost: number;
  taxRate: number;
  url: string;
  inStock: boolean;
  lastUpdated: Date;
}

// Cart related
export interface UniversalCart {
  id: string;
  userId: string;
  createdAt: Date;
  status: 'active' | 'converted' | 'auto_bought';
  items: CartItem[];
}

export interface CartItem {
  id: string;
  cartId: string;
  productId: string;
  product: Product;
  sourceRetailer: string;
  quantity: number;
  addedAt: Date;
  matchResults?: MatchResult[];
}

export interface MatchResult {
  id: string;
  cartItemId: string;
  retailerProductId: string;
  retailerProduct?: RetailerProduct;
  matchType: 'exact' | 'similar' | 'substitute';
  confidenceScore: number;
  isSelected: boolean;
}

// Checkout & Optimization
export interface SplitPlan {
  id: string;
  cartId: string;
  assignment: Record<string, string>; // itemId -> storeName
  totalCost: number;
  createdAt: Date;
}

export interface AutoBuyRule {
  id: string;
  userId: string;
  cartId: string;
  trigger: AutoBuyTrigger;
  destinationPref: string;
  executionCardId?: string;
  status: 'active' | 'executed' | 'paused';
  createdAt: Date;
  executedAt?: Date;
}

export type AutoBuyTrigger =
  | { type: 'total_price_below'; value: number }
  | { type: 'item_price_below'; itemId: string; value: number };

// API request/response types
export interface ImportProductRequest {
  url: string;
}

export interface ImportProductResponse {
  id: string;
  sourceRetailer: string;
  productName: string;
  price: number;
  imageUrl?: string;
  url: string;
}

export interface MatchRequest {
  product: {
    name: string;
    price: number;
    retailer: string;
  };
  preferredStore: string;
}

export interface MatchResponse {
  matchType: 'exact' | 'similar' | 'substitute';
  confidence: number;
  retailerProduct: RetailerProduct;
}

export interface CheckoutRedirectRequest {
  items: CartItem[];
  store: string;
}

export interface CheckoutRedirectResponse {
  redirectUrl: string;
}

export interface SplitOptimizeRequest {
  cartId: string;
  userStores: string[];
}

export interface SplitOptimizeResponse {
  assignment: Record<string, string>;
  totalCost: number;
}

export interface AutoBuyRuleCreateRequest {
  cartId: string;
  trigger: AutoBuyTrigger;
  destinationPref: string;
  executionCardId?: string;
}
