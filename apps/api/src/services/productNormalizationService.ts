import { ProductSearchResult } from '../integrations/baseAdapter';

export type NormalizedProductData = ProductSearchResult & {
  attributes?: Record<string, any>;
  rawMetadata?: any;
};

const CATEGORY_ALIASES: Array<[RegExp, string]> = [
  [/\b(electronics?|audio|headphones?|speakers?|computers?|phones?)\b/i, 'electronics'],
  [/\b(apparel|clothing|fashion|shoes?|shirts?|pants?|dresses?)\b/i, 'fashion'],
  [/\b(grocery|food|coffee|beverage|pantry)\b/i, 'grocery'],
  [/\b(home|kitchen|furniture|decor|appliance)\b/i, 'home'],
  [/\b(beauty|skincare|cosmetics?|fragrance)\b/i, 'beauty'],
  [/\b(toys?|games?)\b/i, 'toys'],
  [/\b(books?|media)\b/i, 'books'],
];

const COLOR_WORDS = [
  'black',
  'blue',
  'brown',
  'clear',
  'gold',
  'gray',
  'green',
  'grey',
  'ivory',
  'orange',
  'pink',
  'purple',
  'red',
  'silver',
  'white',
  'yellow',
];

function cleanText(value?: string | null): string | undefined {
  if (value == null) return undefined;
  const cleaned = String(value)
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || undefined;
}

function normalizeComparableText(value?: string | null): string | undefined {
  const cleaned = cleanText(value);
  if (!cleaned) return undefined;
  return cleaned
    .replace(/[™®©]/g, '')
    .replace(/\s*[-|]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeGtin(value?: string | null): string | undefined {
  const digits = String(value || '').replace(/\D/g, '');
  return [8, 12, 13, 14].includes(digits.length) ? digits : undefined;
}

function normalizeCategory(value?: string | null): string | undefined {
  const cleaned = cleanText(value);
  if (!cleaned) return undefined;

  for (const [pattern, category] of CATEGORY_ALIASES) {
    if (pattern.test(cleaned)) return category;
  }

  return cleaned.toLowerCase();
}

function normalizeAttributeKey(key: string): string {
  const normalized = key.trim().toLowerCase().replace(/[\s_-]+(.)/g, (_, letter) => letter.toUpperCase());
  if (normalized === 'colour') return 'color';
  if (normalized === 'variantTitle') return 'variant';
  return normalized;
}

function compactAttributes(attributes?: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(attributes || {})) {
    if (value == null || value === '') continue;
    const normalizedKey = normalizeAttributeKey(key);
    out[normalizedKey] = typeof value === 'string' ? cleanText(value) : value;
  }
  return out;
}

function inferVariantAttributes(model?: string, name?: string) {
  const attributes: Record<string, string> = {};
  const source = cleanText(model) || cleanText(name) || '';
  const slashParts = source.split('/').map((part) => cleanText(part)).filter(Boolean) as string[];

  if (slashParts.length >= 2) {
    const [possibleColor, possibleSize] = slashParts.slice(-2);
    if (possibleColor && COLOR_WORDS.includes(possibleColor.toLowerCase())) {
      attributes.color = possibleColor;
      attributes.size = possibleSize;
    }
  }

  const colorMatch = source.match(new RegExp(`\\b(${COLOR_WORDS.join('|')})\\b`, 'i'));
  if (!attributes.color && colorMatch) attributes.color = colorMatch[1];

  const sizeMatch = source.match(/\b(?:size\s*)?(XS|S|M|L|XL|XXL|XXXL)\b/i);
  if (!attributes.size && sizeMatch) attributes.size = sizeMatch[1].toUpperCase();

  return attributes;
}

function stripVariantNoiseFromName(name: string, attributes: Record<string, any>) {
  let normalized = name;
  for (const key of ['color', 'size']) {
    const value = typeof attributes[key] === 'string' ? attributes[key] : '';
    if (!value) continue;
    normalized = normalized.replace(new RegExp(`\\b${escapeRegExp(value)}\\b`, 'ig'), ' ');
  }

  return normalized
    .replace(/\b(size|color|colour)\b/gi, ' ')
    .replace(/\s*[/|-]\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeImportedProductData(
  retailerName: string,
  productData: ProductSearchResult
): NormalizedProductData {
  const inferredAttributes = inferVariantAttributes(productData.model, productData.name);
  const attributes = {
    ...compactAttributes(productData.attributes),
    ...inferredAttributes,
  };

  const normalizedName = normalizeComparableText(productData.name) || productData.name;
  const canonicalName = stripVariantNoiseFromName(normalizedName, attributes) || normalizedName;

  if (canonicalName && canonicalName !== normalizedName) {
    attributes.canonicalName = canonicalName;
  }

  const variantParts = ['color', 'size']
    .map((key) => attributes[key])
    .filter((value) => typeof value === 'string' && value.trim())
    .map((value) => String(value).toLowerCase());
  if (variantParts.length > 0) {
    attributes.variantKey = variantParts.join('|');
  }

  return {
    ...productData,
    name: canonicalName,
    brand: normalizeComparableText(productData.brand),
    model: normalizeComparableText(productData.model),
    upc: normalizeGtin(productData.upc),
    category: normalizeCategory(productData.category),
    attributes: Object.keys(attributes).length > 0 ? attributes : undefined,
    rawMetadata: productData.rawMetadata || {
      retailerName,
      sourceUrl: productData.sourceUrl,
      sourceName: productData.name,
      sourceBrand: productData.brand,
      sourceModel: productData.model,
      sourceCategory: productData.category,
      sourceUpc: productData.upc,
    },
  };
}
