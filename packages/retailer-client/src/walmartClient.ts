import axios from 'axios';
import * as cheerio from 'cheerio';
import { RetailerClient } from './index';

export class WalmartClient implements RetailerClient {
  async fetchProduct(url: string) {
    const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const $ = cheerio.load(response.data);
    const name = $('[data-testid="product-title"]').text().trim();
    const price = parseFloat($('[data-testid="price"]').text().replace('$', '')) || 0;
    const sku = url.match(/\/ip\/([^/]+)/)?.[1] || '';
    const imageUrl = $('img[data-testid="hero-image"]').attr('src');
    return { name, price, sku, imageUrl };
  }
  async addToCart(productId: string, quantity: number) {
    return `https://walmart.com/cart?add=${productId}&qty=${quantity}`;
  }
}