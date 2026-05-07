import { prisma } from '../index';
import { describeSellerTrust } from './sellerTrustService';
import { normalizeGtin } from './productNormalizationService';
import { scoreVisualSimilarity, visualReviewRequired } from './visualSimilarityService';

export interface MatchCandidate {
  matchType: 'exact' | 'close' | 'substitute' | 'unavailable';
  confidence: number;
  reason: string;
  retailerProduct: any;
  visualSimilarity?: number;
  reviewRequired?: boolean;
  reviewReason?: string;
}

function normalizeText(input: string) {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function tokenize(value: string) {
  return normalizeText(value).split(' ').filter(Boolean);
}

function calculateOverlap(tokensA: string[], tokensB: string[]) {
  if (tokensA.length === 0) return 0;
  const setB = new Set(tokensB);
  const shared = tokensA.filter((token) => setB.has(token));
  return shared.length / tokensA.length;
}

function attributesOf(value: any): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function variantKey(attributes: Record<string, any>) {
  if (typeof attributes.variantKey === 'string' && attributes.variantKey.trim()) {
    return normalizeText(attributes.variantKey);
  }

  const parts = [attributes.color, attributes.size]
    .filter((value) => typeof value === 'string' && value.trim())
    .map((value) => normalizeText(value));

  return parts.length > 0 ? parts.join(' ') : '';
}

function compareVariantAttributes(sourceAttributes?: Record<string, any>, candidateAttributes?: Record<string, any>) {
  const sourceKey = variantKey(attributesOf(sourceAttributes));
  const candidateKey = variantKey(attributesOf(candidateAttributes));
  if (!sourceKey && !candidateKey) return 'not_provided';
  if (sourceKey && candidateKey && sourceKey === candidateKey) return 'variant_match';
  if (sourceKey && candidateKey && sourceKey !== candidateKey) return 'variant_mismatch';
  return 'variant_unverified';
}

export async function gatherCandidates(
  productData: {
    name?: string;
    brand?: string;
    model?: string;
    sku?: string;
    upc?: string;
    category?: string;
    imageUrl?: string;
    attributes?: Record<string, any>;
  },
  destinationStore: string
) {
  const candidates = new Map<string, MatchCandidate>();
  const addCandidate = (rp: any, reason: string, confidence: number, matchType: MatchCandidate['matchType']) => {
    if (!rp || !rp.id) return;
    if (rp.counterfeitRisk === 'high') return;
    const reasons = [reason];
    let adjustedMatchType = matchType;
    let adjustedConfidence = confidence;
    const visual = scoreVisualSimilarity(
      {
        name: productData.name,
        brand: productData.brand,
        model: productData.model,
        imageUrl: productData.imageUrl,
        attributes: productData.attributes,
      },
      {
        name: rp.product?.name,
        brand: rp.product?.brand,
        model: rp.product?.model,
        imageUrl: rp.product?.imageUrl,
        attributes: rp.product?.attributes,
      }
    );
    if (visual.similarity >= 0.35) {
      reasons.push(`visual_similarity_${visual.similarity.toFixed(2)}`);
      if (adjustedConfidence < 0.9) {
        adjustedConfidence = Math.min(0.9, adjustedConfidence + visual.similarity * 0.08);
      }
      if (reason === 'visual_similarity') {
        adjustedMatchType = 'substitute';
        adjustedConfidence = Math.min(adjustedConfidence, 0.78);
      }
    }

    const variantComparison = compareVariantAttributes(productData.attributes, rp.product?.attributes);
    if (variantComparison === 'variant_match') {
      reasons.push('variant_match');
      adjustedConfidence = Math.min(0.99, adjustedConfidence + 0.02);
    } else if (variantComparison === 'variant_mismatch') {
      reasons.push('variant_mismatch');
      adjustedMatchType = 'substitute';
      adjustedConfidence = Math.min(adjustedConfidence, 0.64);
    } else if (variantComparison === 'variant_unverified') {
      reasons.push('variant_unverified');
      if (adjustedMatchType === 'exact') adjustedMatchType = 'close';
      adjustedConfidence = Math.min(adjustedConfidence, 0.82);
    }

    if (rp.inStock === false) {
      reasons.push('unavailable');
      adjustedMatchType = 'unavailable';
      adjustedConfidence = Math.min(adjustedConfidence, 0.9);
    }

    const trust = describeSellerTrust(rp);
    const trustAdjustedConfidence = Math.max(0, Math.min(0.99, adjustedConfidence + (trust.score - 70) / 1000));
    const retailerProduct = { ...rp, sellerTrustScore: trust.score, sellerTrustLabel: trust.label, sellerTrustSignals: trust.signals };
    const existing = candidates.get(rp.id);
    if (!existing || existing.confidence < trustAdjustedConfidence) {
      candidates.set(rp.id, {
        retailerProduct,
        reason: `${reasons.join('; ')}; seller_trust_${trust.score}`,
        confidence: trustAdjustedConfidence,
        matchType: adjustedMatchType,
        visualSimilarity: visual.similarity,
        reviewRequired: visualReviewRequired(adjustedMatchType, visual.similarity, trustAdjustedConfidence),
        reviewReason:
          adjustedMatchType !== 'exact' && visual.similarity >= 0.35
            ? 'Visual similarity helped surface this candidate; review before approval.'
            : undefined,
      });
    }
  };

  const normalizedUpc = normalizeGtin(productData.upc);
  const normalizedName = productData.name ? normalizeText(productData.name) : '';
  const sourceTokens = tokenize(productData.name || '');
  const firstToken = sourceTokens[0] || '';
  const normalizedBrand = productData.brand ? normalizeText(productData.brand) : '';
  const normalizedModel = productData.model ? normalizeText(productData.model) : '';

  if (normalizedUpc) {
    const upcMatch = await prisma.retailerProduct.findFirst({
      where: {
        retailerName: destinationStore,
        product: { upc: normalizedUpc },
      },
      include: { product: true },
    });
    addCandidate(upcMatch, 'upc_match', 0.99, 'exact');
  }

  if (productData.sku) {
    const skuMatch = await prisma.retailerProduct.findFirst({
      where: {
        retailerName: destinationStore,
        retailerSku: productData.sku,
      },
      include: { product: true },
    });
    addCandidate(skuMatch, 'sku_match', 0.98, 'exact');
  }

  if (productData.brand && productData.model) {
    const brandModelMatches = await prisma.retailerProduct.findMany({
      where: {
        retailerName: destinationStore,
        product: {
          brand: productData.brand,
          model: productData.model,
        },
      },
      include: { product: true },
      take: 5,
    });
    brandModelMatches.forEach((rp) => addCandidate(rp, 'brand_model_match', 0.95, 'exact'));
  }

  if (productData.brand && !productData.model) {
    const brandMatches = await prisma.retailerProduct.findMany({
      where: {
        retailerName: destinationStore,
        product: { brand: productData.brand },
      },
      include: { product: true },
      take: 8,
    });
    brandMatches.forEach((rp) => addCandidate(rp, 'brand_match', 0.8, 'close'));
  }

  if (productData.model && !productData.brand) {
    const modelMatches = await prisma.retailerProduct.findMany({
      where: {
        retailerName: destinationStore,
        product: { model: productData.model },
      },
      include: { product: true },
      take: 8,
    });
    modelMatches.forEach((rp) => addCandidate(rp, 'model_match', 0.75, 'substitute'));
  }

  if (productData.category) {
    const categoryMatches = await prisma.retailerProduct.findMany({
      where: {
        retailerName: destinationStore,
        product: { category: productData.category },
      },
      include: { product: true },
      take: 6,
    });
    categoryMatches.forEach((rp) => addCandidate(rp, 'category_match', 0.72, 'substitute'));
  }

  if (normalizedName) {
    const exactNameMatches = await prisma.retailerProduct.findMany({
      where: {
        retailerName: destinationStore,
        product: { name: productData.name },
      },
      include: { product: true },
      take: 5,
    });
    exactNameMatches.forEach((rp) => addCandidate(rp, 'exact_name_match', 0.92, 'exact'));

    if (firstToken) {
      const fuzzyMatches = await prisma.retailerProduct.findMany({
        where: {
          retailerName: destinationStore,
          product: {
            name: { contains: firstToken },
          },
        },
        include: { product: true },
        take: 12,
      });
      fuzzyMatches.forEach((rp) => {
        const candidateName = rp.product?.name ?? '';
        const overlap = calculateOverlap(sourceTokens, tokenize(candidateName));
        const confidence = Math.min(0.87, 0.66 + overlap * 0.35);
        const matchType = overlap > 0.6 ? 'close' : 'substitute';
        addCandidate(rp, 'name_overlap', confidence, matchType);
      });
    }

    if (normalizedBrand && normalizedModel) {
      const brandModelNameMatches = await prisma.retailerProduct.findMany({
        where: {
          retailerName: destinationStore,
          product: {
            brand: productData.brand,
            name: { contains: firstToken },
          },
        },
        include: { product: true },
        take: 6,
      });
      brandModelNameMatches.forEach((rp) => addCandidate(rp, 'brand_name_match', 0.88, 'close'));
    }
  }

  if (productData.imageUrl || productData.attributes) {
    const visualPool = await prisma.retailerProduct.findMany({
      where: {
        retailerName: destinationStore,
        product: {
          category: productData.category || undefined,
        },
      },
      include: { product: true },
      take: 20,
    });
    visualPool.forEach((rp) => {
      const visual = scoreVisualSimilarity(
        {
          name: productData.name,
          brand: productData.brand,
          model: productData.model,
          imageUrl: productData.imageUrl,
          attributes: productData.attributes,
        },
        {
          name: rp.product?.name,
          brand: rp.product?.brand,
          model: rp.product?.model,
          imageUrl: rp.product?.imageUrl,
          attributes: rp.product?.attributes,
        }
      );
      if (visual.similarity >= 0.42) {
        addCandidate(rp, 'visual_similarity', Math.min(0.78, 0.58 + visual.similarity * 0.3), 'substitute');
      }
    });
  }

  const sortedCandidates = Array.from(candidates.values()).sort((a, b) => b.confidence - a.confidence);
  const topVisualScores = sortedCandidates.map((candidate) => candidate.visualSimilarity || 0).sort((a, b) => b - a);
  return sortedCandidates.map((candidate) => {
    const runnerUp = topVisualScores.find((score) => score !== candidate.visualSimilarity) || 0;
    const reviewRequired = candidate.reviewRequired || visualReviewRequired(
      candidate.matchType,
      candidate.visualSimilarity || 0,
      candidate.confidence,
      runnerUp
    );
    return {
      ...candidate,
      reviewRequired,
      reviewReason: reviewRequired && !candidate.reviewReason
        ? 'Visual or low-confidence signals require human review before transfer.'
        : candidate.reviewReason,
    };
  });
}

export async function matchProductToStore(productId: string, destinationStore: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { retailerProducts: true },
  });
  if (!product) throw new Error('Product not found');

  const match = product.retailerProducts.find((rp: { retailerName: string }) => rp.retailerName === destinationStore);
  if (match) {
    const trust = describeSellerTrust(match);
    return {
      matchType: 'exact',
      confidence: Math.min(0.99, 0.97 + trust.score / 5000),
      retailerProduct: { ...match, sellerTrustScore: trust.score, sellerTrustLabel: trust.label, sellerTrustSignals: trust.signals },
    };
  }

  const similar = await prisma.retailerProduct.findFirst({
    where: {
      retailerName: destinationStore,
      product: {
        name: { contains: product.name.split(' ')[0] },
      },
    },
    include: { product: true },
  });
  if (similar) {
    const trust = describeSellerTrust(similar);
    return {
      matchType: 'similar',
      confidence: Math.max(0, Math.min(0.9, 0.75 + (trust.score - 70) / 1000)),
      retailerProduct: { ...similar, sellerTrustScore: trust.score, sellerTrustLabel: trust.label, sellerTrustSignals: trust.signals },
    };
  }
  return null;
}

export async function findMatchForProduct(
  productData: {
    name?: string;
    brand?: string;
    model?: string;
    sku?: string;
    upc?: string;
    category?: string;
    price?: number;
    imageUrl?: string;
    attributes?: Record<string, any>;
  },
  destinationStore: string
) {
  const candidates = await gatherCandidates(productData, destinationStore);
  if (candidates.length === 0) return null;

  const best = candidates[0];
  return {
    matchType: best.matchType,
    confidence: best.confidence,
    reason: best.reason,
    retailerProduct: best.retailerProduct,
    visualSimilarity: best.visualSimilarity,
    reviewRequired: best.reviewRequired,
    reviewReason: best.reviewReason,
    candidates,
  };
}

export async function saveMatch(cartItemId: string, retailerProductId: string, matchType: string, confidence: number) {
  return prisma.matchResult.create({
    data: {
      cartItemId,
      retailerProductId,
      matchType,
      confidenceScore: confidence,
      isSelected: true,
    },
  });
}

export async function saveMatchCandidates(
  cartItemId: string,
  candidates: Array<{
    retailerProductId: string;
    matchType: string;
    confidence: number;
    reason: string;
  }>,
  selectedRetailerProductId?: string
) {
  if (!Array.isArray(candidates)) {
    throw new Error('Candidates must be an array');
  }

  if (selectedRetailerProductId) {
    await prisma.matchResult.updateMany({
      where: { cartItemId, isSelected: true },
      data: { isSelected: false },
    });
  }

  await prisma.matchResult.deleteMany({
    where: { cartItemId, isSelected: false },
  });

  const rows = candidates.map((candidate) => ({
    cartItemId,
    retailerProductId: candidate.retailerProductId,
    matchType: candidate.matchType,
    confidenceScore: candidate.confidence,
    isSelected: candidate.retailerProductId === selectedRetailerProductId,
  }));

  if (rows.length === 0) {
    return { stored: 0 };
  }

  await prisma.matchResult.createMany({ data: rows });
  return { stored: rows.length };
}

export async function selectMatch(cartItemId: string, retailerProductId: string, matchType: string, confidence: number) {
  await prisma.matchResult.updateMany({
    where: {
      cartItemId,
      isSelected: true,
    },
    data: {
      isSelected: false,
    },
  });

  return prisma.matchResult.create({
    data: {
      cartItemId,
      retailerProductId,
      matchType,
      confidenceScore: confidence,
      isSelected: true,
    },
  });
}
