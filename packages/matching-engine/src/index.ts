import { exactMatch } from './exactMatcher';
import { nlpMatch } from './nlpMatcher';
// imageMatcher would be called via Python bridge

export interface MatchCandidate {
  productId: string;
  retailerProductId: string;
  matchType: 'exact' | 'similar' | 'substitute';
  confidence: number;
}

export async function matchProduct(
  sourceProduct: { name: string; brand?: string; model?: string; upc?: string },
  targetProducts: Array<{ id: string; name: string; brand?: string; model?: string; upc?: string; retailerProductId: string }>
): Promise<MatchCandidate | null> {
  // 1. Exact match by UPC
  if (sourceProduct.upc) {
    const exact = exactMatch(sourceProduct.upc, targetProducts);
    if (exact) return exact;
  }
  // 2. NLP similarity
  const nlpResult = nlpMatch(sourceProduct.name, targetProducts);
  if (nlpResult && nlpResult.confidence >= 0.75) return nlpResult;
  // 3. Could call Python image matcher if images provided
  return null;
}

// For future Python bridge
export async function matchByImage(imageBuffer: Buffer, targetProducts: any[]): Promise<MatchCandidate | null> {
  // Stub: call python script via child_process
  console.log('Image matching not implemented in MVP');
  return null;
}