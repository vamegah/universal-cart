import stringSimilarity from 'string-similarity';
import { MatchCandidate } from './index';

export function nlpMatch(sourceName: string, candidates: any[]): MatchCandidate | null {
  const names = candidates.map(c => c.name);
  const matches = stringSimilarity.findBestMatch(sourceName, names);
  if (matches.bestMatch.rating >= 0.7) {
    const best = candidates[matches.bestMatchIndex];
    return {
      productId: best.id,
      retailerProductId: best.retailerProductId,
      matchType: 'similar',
      confidence: matches.bestMatch.rating,
    };
  }
  return null;
}