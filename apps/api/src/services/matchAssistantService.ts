type AssistantMatch = {
  matchType?: string;
  confidence?: number;
  reason?: string;
  retailerProduct?: any;
};

function money(value: unknown) {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round(amount * 100) / 100 : null;
}

function formatMoney(value: number | null) {
  return value == null ? 'unknown' : `$${value.toFixed(2)}`;
}

function normalizeSignals(reason?: string) {
  return String(reason || '')
    .split(';')
    .map((signal) => signal.trim())
    .filter(Boolean);
}

function attributesOf(value: any): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function attributeSummary(sourceAttributes: Record<string, unknown>, destinationAttributes: Record<string, unknown>) {
  const keys = Array.from(new Set([...Object.keys(sourceAttributes), ...Object.keys(destinationAttributes)]));
  return keys
    .filter((key) => ['color', 'size', 'variantKey', 'material', 'capacity'].includes(key))
    .map((key) => ({
      attribute: key,
      source: sourceAttributes[key] ?? null,
      destination: destinationAttributes[key] ?? null,
      matches:
        sourceAttributes[key] != null &&
        destinationAttributes[key] != null &&
        String(sourceAttributes[key]).toLowerCase() === String(destinationAttributes[key]).toLowerCase(),
    }));
}

function approvalRequired(matchType: string, confidence: number, signals: string[]) {
  return (
    matchType !== 'exact' ||
    confidence < 0.85 ||
    signals.includes('variant_mismatch') ||
    signals.includes('variant_unverified') ||
    signals.includes('unavailable')
  );
}

export function buildSmartMatchAssistant(product: any, match: AssistantMatch | null) {
  if (!match?.retailerProduct) {
    return {
      summary: `No confident match is available for ${product?.name || product?.productName || 'this item'}.`,
      bestBuyingPath: 'Keep this item at the source retailer until a supported destination listing is reviewed.',
      requiresApproval: true,
      approvalPrompt: 'Review manually before replacing this cart item.',
      citations: {
        attributes: [],
        pricingSignals: [],
        matchSignals: ['no_match'],
      },
      differences: [],
    };
  }

  const retailerProduct = match.retailerProduct;
  const destinationProduct = retailerProduct.product || {};
  const sourceName = product?.name || product?.productName || 'Source item';
  const destinationName = destinationProduct.name || retailerProduct.name || 'matched listing';
  const sourcePrice = money(product?.price ?? product?.sourcePrice);
  const destinationPrice = money(retailerProduct.price);
  const priceDelta = sourcePrice != null && destinationPrice != null ? Math.round((destinationPrice - sourcePrice) * 100) / 100 : null;
  const confidence = Number(match.confidence || 0);
  const matchType = String(match.matchType || 'unknown');
  const signals = normalizeSignals(match.reason);
  const sourceAttributes = attributesOf(product?.attributes);
  const destinationAttributes = attributesOf(destinationProduct.attributes);
  const attributes = attributeSummary(sourceAttributes, destinationAttributes);
  const requiresApproval = approvalRequired(matchType, confidence, signals);
  const priceMessage =
    priceDelta == null
      ? 'Price comparison is unavailable.'
      : priceDelta < 0
        ? `Destination is ${formatMoney(Math.abs(priceDelta))} cheaper before shipping, tax, and rewards.`
        : priceDelta > 0
          ? `Destination is ${formatMoney(priceDelta)} more before shipping, tax, and rewards.`
          : 'Destination base price matches the source price.';
  const trustLabel = retailerProduct.sellerTrustLabel || 'unknown trust';
  const availability = retailerProduct.inStock === false ? 'out of stock' : 'in stock';

  const differences = [
    {
      area: 'identity',
      source: sourceName,
      destination: destinationName,
      assessment: signals.includes('upc_match') || signals.includes('sku_match') ? 'strong identifier match' : `${matchType} match`,
    },
    {
      area: 'price',
      source: formatMoney(sourcePrice),
      destination: formatMoney(destinationPrice),
      assessment: priceMessage,
    },
    {
      area: 'availability',
      source: 'cart source listing',
      destination: availability,
      assessment: availability === 'in stock' ? 'available for transfer consideration' : 'do not transfer while unavailable',
    },
  ];

  return {
    summary: `${destinationName} is a ${matchType} match for ${sourceName} at ${Math.round(confidence * 100)}% confidence.`,
    bestBuyingPath: requiresApproval
      ? 'Ask for approval before transferring this item, then revalidate price, variant, and availability at checkout.'
      : 'This item can be transferred to the matched retailer after checkout revalidation.',
    requiresApproval,
    approvalPrompt: requiresApproval
      ? `Approve replacing ${sourceName} with ${destinationName}? Check variant, seller trust, and price before continuing.`
      : null,
    citations: {
      attributes,
      pricingSignals: [
        {
          sourcePrice,
          destinationPrice,
          priceDelta,
          message: priceMessage,
        },
      ],
      matchSignals: signals,
      sellerTrust: {
        label: trustLabel,
        score: retailerProduct.sellerTrustScore ?? null,
        signals: retailerProduct.sellerTrustSignals || [],
      },
    },
    differences,
  };
}
