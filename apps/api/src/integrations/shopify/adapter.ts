import axios from 'axios';
import { BaseRetailerAdapter } from '../baseAdapter';
import { extractJsonLdMetadata, parseJsonLd, parsePrice, safeMatch } from '../productParser';

function getShopifyProductJsonUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const productMatch = parsed.pathname.match(/\/products\/([^/?#]+)/i);
    if (!productMatch) return null;

    const handle = productMatch[1].replace(/\.json$/i, '');
    parsed.pathname = `/products/${handle}.json`;
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
  } catch {
    return null;
  }
}

function compactAttributes(attributes: Record<string, any>): Record<string, any> | undefined {
  const entries = Object.entries(attributes).filter(([, value]) => value != null && value !== '');
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
}

export class ShopifyAdapter extends BaseRetailerAdapter {
  async fetchProduct(url: string) {
    const jsonUrl = getShopifyProductJsonUrl(url);
    if (jsonUrl) {
      try {
        const response = await axios.get(jsonUrl, {
          headers: {
            Accept: 'application/json,text/plain,*/*',
          },
        });
        const product = response.data?.product;
        if (product) {
          const variants = Array.isArray(product.variants) ? product.variants : [];
          const variant = variants.find((candidate: any) => candidate.available !== false) || variants[0] || null;
          const price = parsePrice(variant?.price?.toString?.() ?? product.price?.toString?.() ?? null);
          const sku = variant?.sku || variant?.id?.toString?.() || product.id?.toString?.();
          const name = product.title;
          const missing = [
            !name ? 'name' : null,
            price == null ? 'price' : null,
            !sku ? 'sku' : null,
          ].filter(Boolean);

          if (missing.length > 0) {
            throw new Error(`Unable to parse Shopify product metadata from JSON API. Missing: ${missing.join(', ')}.`);
          }

          return {
            name,
            price,
            sku,
            image: variant?.featured_image?.src || product.image?.src || product.images?.[0]?.src,
            sourceUrl: url,
            brand: product.vendor || undefined,
            model: variant?.title && variant.title !== 'Default Title' ? variant.title : undefined,
            upc: variant?.barcode || undefined,
            category: product.product_type || undefined,
            attributes: compactAttributes({
              handle: product.handle,
              option1: variant?.option1,
              option2: variant?.option2,
              option3: variant?.option3,
              tags: product.tags,
            }),
            availability: variant?.available === false ? 'OutOfStock' : 'InStock',
            rawMetadata: { product, variant },
          };
        }
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('Unable to parse Shopify')) {
          throw error;
        }
      }
    }

    const response = await axios.get(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    const html = response.data as string;
    const structured = extractJsonLdMetadata(parseJsonLd(html));

    const name =
      structured.name ||
      safeMatch(html, /property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
      safeMatch(html, /<h1[^>]*class=["'][^"']*product[^"']*title[^"']*["'][^>]*>([^<]+)<\/h1>/i) ||
      safeMatch(html, /<h1[^>]*>([^<]+)<\/h1>/i);

    const priceText =
      safeMatch(html, /property=["']product:price:amount["']\s+content=["']([^"']+)["']/i) ||
      safeMatch(html, /<span[^>]*data-product-price[^>]*>([^<]+)<\/span>/i) ||
      safeMatch(html, /"price"\s*:\s*"?([\d.,]+)"?/i);

    const image =
      structured.image ||
      safeMatch(html, /property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
      safeMatch(html, /<img[^>]*class=["'][^"']*product[^"']*image[^"']*["'][^>]*src=["']([^"']+)["']/i);

    const sku =
      structured.sku ||
      safeMatch(html, /"sku"\s*:\s*"([^"]+)"/i) ||
      safeMatch(html, /"variantId"\s*:\s*"?([^",}]+)"?/i);

    const brand =
      structured.brand ||
      safeMatch(html, /property=["']product:brand["']\s+content=["']([^"']+)["']/i) ||
      safeMatch(html, /"vendor"\s*:\s*"([^"]+)"/i);

    const availability =
      structured.availability ||
      safeMatch(html, /"availability"\s*:\s*"([^"]+)"/i) ||
      safeMatch(html, /<button[^>]*name=["']add["'][^>]*>([^<]+)<\/button>/i);

    const price = parsePrice(priceText) ?? structured.price;
    const missing = [
      !name ? 'name' : null,
      price == null ? 'price' : null,
      !sku ? 'sku' : null,
    ].filter(Boolean);

    if (missing.length > 0) {
      throw new Error(`Unable to parse Shopify product metadata from the provided URL. Missing: ${missing.join(', ')}.`);
    }

    return {
      name,
      price,
      sku,
      image,
      sourceUrl: url,
      brand: brand || undefined,
      model: structured.model || undefined,
      upc: structured.upc || undefined,
      category: structured.category || undefined,
      attributes: structured.attributes || undefined,
      availability: availability || undefined,
      rawMetadata: structured.rawMetadata || undefined,
    };
  }

  async addToCart(productId: string, quantity: number) {
    return `${productId}/cart/add?quantity=${quantity}`;
  }
}
