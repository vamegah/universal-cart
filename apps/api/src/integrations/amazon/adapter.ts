import axios from 'axios';
import { BaseRetailerAdapter, ProductSearchResult } from '../baseAdapter';
import { extractJsonLdMetadata, parseJsonLd, parsePrice, safeMatch } from '../productParser';

export class AmazonAdapter extends BaseRetailerAdapter {
  private readonly headers = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  };

  async fetchProduct(url: string) {
    const response = await axios.get(url, {
      headers: this.headers,
    });

    const html = response.data as string;
    const structured = extractJsonLdMetadata(parseJsonLd(html));

    const name =
      safeMatch(html, /<span[^>]*id="productTitle"[^>]*>([^<]+)<\/span>/i) ||
      safeMatch(html, /<span[^>]*id="title"[^>]*>([^<]+)<\/span>/i) ||
      safeMatch(html, /<h1[^>]*class=".*product-title.*"[^>]*>([^<]+)<\/h1>/i) ||
      structured.name;

    const priceText =
      safeMatch(html, /<span[^>]*id="priceblock_ourprice"[^>]*>([^<]+)<\/span>/i) ||
      safeMatch(html, /<span[^>]*id="priceblock_dealprice"[^>]*>([^<]+)<\/span>/i) ||
      safeMatch(html, /<span[^>]*id="priceblock_saleprice"[^>]*>([^<]+)<\/span>/i) ||
      safeMatch(html, /"price":"([^\"]+)"/i);

    const image =
      safeMatch(html, /<img[^>]*id="landingImage"[^>]*data-old-hires="([^\"]+)"/i) ||
      safeMatch(html, /<img[^>]*id="landingImage"[^>]*src="([^\"]+)"/i) ||
      safeMatch(html, /"large":"([^\"]+)"/i) ||
      structured.image;

    const sku =
      safeMatch(html, /<input[^>]*id="ASIN"[^>]*value="([^\"]+)"/i) ||
      safeMatch(html, /"asin":"([^\"]+)"/i) ||
      safeMatch(html, /dp\/([A-Z0-9]{10})/i) ||
      structured.sku;

    const brand =
      safeMatch(html, /<a[^>]*id="bylineInfo"[^>]*>([^<]+)<\/a>/i) ||
      safeMatch(html, /<a[^>]*id="brand"[^>]*>([^<]+)<\/a>/i) ||
      safeMatch(html, /"brand":"([^\"]+)"/i) ||
      structured.brand;

    const availability =
      safeMatch(html, /<div[^>]*id="availability"[^>]*>\s*<span[^>]*>([^<]+)<\/span>/i) ||
      safeMatch(html, /"availability":"([^\"]+)"/i) ||
      structured.availability;

    const price = parsePrice(priceText) ?? structured.price;
    if (!name || price === null || !sku) {
      throw new Error('Unable to parse Amazon product metadata from the provided URL.');
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
    return `https://amazon.com/cart?add=${encodeURIComponent(productId)}&qty=${quantity}`;
  }

  async searchProducts(query: string): Promise<ProductSearchResult[]> {
    const searchUrl = `https://www.amazon.com/s?k=${encodeURIComponent(query)}`;
    const response = await axios.get(searchUrl, { headers: this.headers });
    const html = response.data as string;
    const results: ProductSearchResult[] = [];
    const seen = new Set<string>();
    const itemRegex = /<div[^>]*data-asin=["']([A-Z0-9]{10})["'][^>]*data-component-type=["']s-search-result["'][^>]*>([\s\S]*?)(?=<div[^>]*data-asin=["'][A-Z0-9]{10}["'][^>]*data-component-type=["']s-search-result["']|<\/body>|$)/gi;
    let match: RegExpExecArray | null;

    while ((match = itemRegex.exec(html)) !== null && results.length < 10) {
      const sku = match[1];
      if (!sku || seen.has(sku)) continue;
      const block = match[2];
      const name =
        safeMatch(block, /<h2[^>]*>[\s\S]*?<span[^>]*>([^<]+)<\/span>/i) ||
        safeMatch(block, /aria-label=["']([^"']+)["']/i);
      const whole = safeMatch(block, /<span[^>]*class=["'][^"']*a-price-whole[^"']*["'][^>]*>([^<]+)<\/span>/i);
      const fraction = safeMatch(block, /<span[^>]*class=["'][^"']*a-price-fraction[^"']*["'][^>]*>([^<]+)<\/span>/i);
      const priceText =
        whole && fraction ? `${whole}.${fraction}` : safeMatch(block, /<span[^>]*class=["'][^"']*a-offscreen[^"']*["'][^>]*>([^<]+)<\/span>/i);
      const price = parsePrice(priceText);
      if (!name || price == null) continue;

      const href = safeMatch(block, /<a[^>]*class=["'][^"']*a-link-normal[^"']*["'][^>]*href=["']([^"']+)["']/i);
      const image = safeMatch(block, /<img[^>]*class=["'][^"']*s-image[^"']*["'][^>]*src=["']([^"']+)["']/i);
      seen.add(sku);
      results.push({
        name,
        price,
        sku,
        image: image || undefined,
        sourceUrl: href?.startsWith('http') ? href : `https://www.amazon.com/dp/${sku}`,
        rawMetadata: { searchUrl },
      });
    }

    return results;
  }
}
