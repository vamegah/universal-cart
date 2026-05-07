const VISUAL_ATTRIBUTE_KEYS = ['color', 'size', 'material', 'pattern', 'shape', 'style', 'capacity', 'variantKey'];

function normalizeText(input: unknown) {
  return String(input || '')
    .toLowerCase()
    .replace(/https?:\/\//g, ' ')
    .replace(/\.[a-z0-9]{2,4}(\?|#|$)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokens(input: unknown) {
  return normalizeText(input).split(/\s+/).filter((token) => token.length > 1 && !/^\d{2,}$/.test(token));
}

function visualTokens(product: {
  name?: string | null;
  brand?: string | null;
  model?: string | null;
  imageUrl?: string | null;
  attributes?: Record<string, any> | null;
}) {
  const attributes = product.attributes && typeof product.attributes === 'object' ? product.attributes : {};
  const attributeTokens = VISUAL_ATTRIBUTE_KEYS.flatMap((key) => tokens(attributes[key]));
  return [
    ...tokens(product.imageUrl),
    ...tokens(product.name),
    ...tokens(product.brand),
    ...tokens(product.model),
    ...attributeTokens,
  ];
}

export function generateImageEmbedding(product: {
  name?: string | null;
  brand?: string | null;
  model?: string | null;
  imageUrl?: string | null;
  attributes?: Record<string, any> | null;
}) {
  const vector = new Map<string, number>();
  for (const token of visualTokens(product)) {
    vector.set(token, (vector.get(token) || 0) + 1);
  }
  return vector;
}

export function cosineSimilarity(a: Map<string, number>, b: Map<string, number>) {
  if (a.size === 0 || b.size === 0) return 0;
  let dot = 0;
  let aNorm = 0;
  let bNorm = 0;
  for (const value of a.values()) aNorm += value * value;
  for (const value of b.values()) bNorm += value * value;
  for (const [key, value] of a.entries()) {
    dot += value * (b.get(key) || 0);
  }
  if (aNorm === 0 || bNorm === 0) return 0;
  return dot / (Math.sqrt(aNorm) * Math.sqrt(bNorm));
}

export function scoreVisualSimilarity(source: any, candidate: any) {
  const sourceEmbedding = generateImageEmbedding(source);
  const candidateEmbedding = generateImageEmbedding(candidate);
  const similarity = cosineSimilarity(sourceEmbedding, candidateEmbedding);
  const sharedTokens = Array.from(sourceEmbedding.keys()).filter((token) => candidateEmbedding.has(token));

  return {
    similarity: Math.round(similarity * 1000) / 1000,
    sharedTokens,
    sourceTokenCount: sourceEmbedding.size,
    candidateTokenCount: candidateEmbedding.size,
  };
}

export function visualReviewRequired(matchType: string, visualSimilarity: number, confidence: number, runnerUpSimilarity = 0) {
  return (
    matchType !== 'exact' &&
    (visualSimilarity >= 0.35 || confidence < 0.82 || Math.abs(visualSimilarity - runnerUpSimilarity) < 0.08)
  );
}
