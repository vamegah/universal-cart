export interface ProductSearchResult {
  name: string;
  price: number;
  sku: string;
  image?: string;
  sourceUrl: string;
  brand?: string;
  model?: string;
  upc?: string;
  category?: string;
  attributes?: Record<string, any>;
  availability?: string;
  rawMetadata?: any;
}

export interface RetailerAdapter {
  fetchProduct(url: string): Promise<any>;
  searchProducts?(query: string): Promise<ProductSearchResult[]>;
  addToCart(productId: string, quantity: number, payment?: { virtualCardToken?: string }): Promise<string>; // returns cart URL
}

export abstract class BaseRetailerAdapter implements RetailerAdapter {
  abstract fetchProduct(url: string): Promise<any>;
  searchProducts?(query: string): Promise<ProductSearchResult[]>;
  abstract addToCart(productId: string, quantity: number, payment?: { virtualCardToken?: string }): Promise<string>;
}
