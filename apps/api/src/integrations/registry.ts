import { RetailerAdapter } from './baseAdapter';
import { AmazonAdapter } from './amazon/adapter';
import { WalmartAdapter } from './walmart/adapter';
import { TargetAdapter } from './target/adapter';
import { MacysAdapter } from './macys/adapter';
import { BestBuyAdapter } from './bestbuy/adapter';
import { ShopifyAdapter } from './shopify/adapter';

export interface RetailerDefinition {
  name: string;
  domains: string[];
  adapter: new () => RetailerAdapter;
}

const retailers: RetailerDefinition[] = [
  {
    name: 'Amazon',
    domains: ['amazon.com', 'www.amazon.com', 'smile.amazon.com'],
    adapter: AmazonAdapter,
  },
  {
    name: 'Walmart',
    domains: ['walmart.com', 'www.walmart.com'],
    adapter: WalmartAdapter,
  },
  {
    name: 'Target',
    domains: ['target.com', 'www.target.com'],
    adapter: TargetAdapter,
  },
  {
    name: "Macy's",
    domains: ['macys.com', 'www.macys.com'],
    adapter: MacysAdapter,
  },
  {
    name: 'BestBuy',
    domains: ['bestbuy.com', 'www.bestbuy.com'],
    adapter: BestBuyAdapter,
  },
  {
    name: 'Shopify',
    domains: ['myshopify.com'],
    adapter: ShopifyAdapter,
  },
];

export function getRetailerDefinition(url: string): RetailerDefinition | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return retailers.find((retailer) =>
      retailer.domains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
    ) || null;
  } catch {
    return null;
  }
}

export function getRetailerDefinitionByName(name: string): RetailerDefinition | null {
  return retailers.find((retailer) => retailer.name.toLowerCase() === name.toLowerCase()) || null;
}

export function getSupportedRetailerNames(): string[] {
  return retailers.map((retailer) => retailer.name);
}

export function getRetailerDefinitions(): RetailerDefinition[] {
  return retailers.map((retailer) => ({ ...retailer, domains: [...retailer.domains] }));
}
