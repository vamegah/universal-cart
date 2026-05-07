import { AmazonClient } from './amazonClient';
import { WalmartClient } from './walmartClient';
import { TargetClient } from './targetClient';
import { MacysClient } from './macysClient';
import { scrapeProduct } from './scraper';

export interface RetailerClient {
  fetchProduct(url: string): Promise<{
    name: string;
    price: number;
    sku: string;
    imageUrl?: string;
    description?: string;
  }>;
  addToCart(productId: string, quantity: number): Promise<string>;
}

export function getClientForUrl(url: string): RetailerClient {
  if (url.includes('amazon')) return new AmazonClient();
  if (url.includes('walmart')) return new WalmartClient();
  if (url.includes('target')) return new TargetClient();
  if (url.includes('macys')) return new MacysClient();
  // fallback to generic scraper
  return {
    fetchProduct: (url) => scrapeProduct(url),
    addToCart: async (productId, quantity) => `https://example.com/cart?add=${productId}`,
  };
}