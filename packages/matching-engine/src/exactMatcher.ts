import { MatchCandidate } from './index';

export function exactMatch(upc: string, candidates: any[]): MatchCandidate | null {
  const found = candidates.find(c => c.upc === upc);
  if (found) {
    return {
      productId: found.id,
      retailerProductId: found.retailerProductId,
      matchType: 'exact',
      confidence: 0.99,
    };
  }
  return null;
}