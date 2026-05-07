export interface ProductMetadata {
  name?: string;
  price?: number;
  sku?: string;
  image?: string;
  brand?: string;
  model?: string;
  upc?: string;
  category?: string;
  attributes?: Record<string, any>;
  availability?: string;
  rawMetadata?: any;
}

export function safeMatch(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern);
  const value = match?.[1]?.trim();
  return value ? value : null;
}

export function parsePrice(priceText: string | null): number | null {
  if (!priceText) return null;
  let cleaned = priceText.replace(/[^\d.,]/g, '');
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');

  if (lastComma !== -1 && lastDot !== -1) {
    if (lastComma > lastDot) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    const commaDigits = cleaned.length - lastComma - 1;
    cleaned = commaDigits === 2 ? cleaned.replace(',', '.') : cleaned.replace(/,/g, '');
  }

  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseJsonLd(html: string): Array<Record<string, any>> {
  const jsonLdBlocks: Array<Record<string, any>> = [];
  const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;

  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const json = JSON.parse(match[1].trim());
      if (Array.isArray(json)) {
        json.forEach((entry) => {
          if (entry && typeof entry === 'object') jsonLdBlocks.push(entry);
        });
      } else if (json && typeof json === 'object') {
        jsonLdBlocks.push(json);
      }
    } catch {
      continue;
    }
  }

  return jsonLdBlocks;
}

function normalizeJsonLdValue(value: any): any {
  if (Array.isArray(value)) {
    return value[0];
  }
  if (typeof value === 'object' && value !== null) {
    if ('name' in value) return normalizeJsonLdValue(value.name);
    if ('@id' in value) return normalizeJsonLdValue(value['@id']);
  }
  return value;
}

export function extractJsonLdMetadata(jsonLdBlocks: Array<Record<string, any>>): ProductMetadata {
  const metadata: ProductMetadata = {};
  for (const block of jsonLdBlocks) {
    const type = block['@type']?.toString().toLowerCase?.();
    if (!type) continue;

    const product = type.includes('product') ? block : null;
    if (!product) continue;

    metadata.name ||= normalizeJsonLdValue(product.name);
    metadata.sku ||= normalizeJsonLdValue(product.sku);
    metadata.image ||= normalizeJsonLdValue(product.image);
    metadata.brand ||= normalizeJsonLdValue(product.brand);
    metadata.model ||= normalizeJsonLdValue(product.model || product.mpn);
    metadata.upc ||= normalizeJsonLdValue(product.gtin13 || product.gtin14 || product.gtin8 || product.ean13 || product.ean || product.barcode);
    metadata.category ||= normalizeJsonLdValue(product.category || product.productCategory);
    metadata.availability ||= normalizeJsonLdValue(product.offers?.availability);

    const attributes: Record<string, any> = {
      ...(metadata.attributes || {}),
    };
    if (product.color) attributes.color = normalizeJsonLdValue(product.color);
    if (product.size) attributes.size = normalizeJsonLdValue(product.size);
    if (product.material) attributes.material = normalizeJsonLdValue(product.material);
    if (Object.keys(attributes).length > 0) {
      metadata.attributes = attributes;
    }

    if (metadata.rawMetadata == null) {
      metadata.rawMetadata = product;
    }

    const priceValue = normalizeJsonLdValue(product.offers?.price || product.price || product.offers?.priceSpecification?.price);
    metadata.price ??= parsePrice(priceValue?.toString?.() ?? null) ?? undefined;

    if (metadata.name && metadata.price != null && metadata.sku) break;
  }

  return metadata;
}

export function parseProductMetadataFromHtml(html: string): ProductMetadata {
  const jsonLd = parseJsonLd(html);
  const jsonLdMetadata = extractJsonLdMetadata(jsonLd);

  return jsonLdMetadata;
}
